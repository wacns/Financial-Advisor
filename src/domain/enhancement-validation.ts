import { isCivilDate, toFils } from "../locale.ts";
import type { Installment, Subscription, Workspace } from "./types.ts";
const fail: (message: string) => never = (message) => {
  throw Error(message);
};
export function validateEnhancements(s: Workspace): Workspace {
  const date = (value: unknown) => {
    if (!isCivilDate(value)) fail("Choose a valid plan date.");
  };
  const positive = (value: unknown) => {
    if (toFils(value) <= 0) fail("Plan amounts must be positive.");
  };
  for (const p of s.payees)
    if (
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 80 ||
      !["payee", "payer", "both"].includes(p.role) ||
      (p.note && (typeof p.note !== "string" || p.note.length > 500))
    )
      fail("Invalid payee or payer.");
  for (const t of s.tags)
    if (
      typeof t.name !== "string" ||
      !t.name.trim() ||
      t.name.length > 40 ||
      !/^#[a-f0-9]{6}$/i.test(t.color)
    )
      fail("Invalid tag.");
  if (
    s.settings.defaultAccountId &&
    !s.accounts.some((a) => a.id === s.settings.defaultAccountId)
  )
    fail("Default account no longer exists.");
  if (
    s.settings.dateFormat &&
    !["dmy", "mdy", "ymd"].includes(s.settings.dateFormat)
  )
    fail("Invalid date format.");
  if (s.settings.rateHistory != null) {
    if (
      !Array.isArray(s.settings.rateHistory) ||
      s.settings.rateHistory.length > 90
    )
      fail("Invalid exchange quote history.");
    for (const row of s.settings.rateHistory) {
      if (
        !isCivilDate(row.asOf) ||
        row.source !== "ExchangeRate-API" ||
        typeof row.savedAt !== "string" ||
        !Number.isFinite(Date.parse(row.savedAt)) ||
        !row.rates ||
        row.rates.BHD !== 1 ||
        Object.keys(s.settings.rates).some((code) => {
          const rate = row.rates[code];
          return (
            rate === undefined ||
            !Number.isFinite(rate) ||
            rate <= 0 ||
            rate > 1e9
          );
        })
      )
        fail("Invalid exchange quote history.");
    }
  }
  if (s.settings.categoryStyles != null) {
    if (
      !Array.isArray(s.settings.categoryStyles) ||
      s.settings.categoryStyles.length > 2000 ||
      new Set(s.settings.categoryStyles.map((row) => row.path)).size !==
        s.settings.categoryStyles.length ||
      s.settings.categoryStyles.some(
        (row) =>
          typeof row.path !== "string" ||
          !row.path.trim() ||
          row.path.length > 250 ||
          !/^#[a-f0-9]{6}$/i.test(row.color) ||
          typeof row.icon !== "string" ||
          row.icon.length > 8,
      )
    )
      fail("Invalid category appearance.");
  }
  for (const a of s.accounts) {
    if (a.color && !/^#[a-f0-9]{6}$/i.test(a.color))
      fail("Invalid account color.");
    if (a.includeInTotal != null && typeof a.includeInTotal !== "boolean")
      fail("Invalid account total preference.");
    if (
      a.rewardRate != null &&
      (!Number.isFinite(a.rewardRate) ||
        a.rewardRate < 0 ||
        a.rewardRate > 100000)
    )
      fail("Invalid account reward rate.");
  }
  const contact = (t: { payeeId?: string }) => {
    if (t.payeeId && !s.payees.some((p) => p.id === t.payeeId))
      fail("Transaction contact no longer exists.");
  };
  for (const t of [...s.transactions, ...s.templates.map((t) => t.record)]) {
    contact(t);
    if (
      t.captureFingerprint != null &&
      !/^text-[a-f0-9]{32}$/.test(t.captureFingerprint)
    )
      fail("Invalid captured message identifier.");
    if (t.pinned != null && typeof t.pinned !== "boolean")
      fail("Invalid pinned flag.");
    if (
      t.location &&
      (typeof t.location !== "string" || t.location.length > 200)
    )
      fail("Location must be at most 200 characters.");
    if (
      t.rewardPoints != null &&
      (toFils(t.rewardPoints) < 0 || t.rewardPoints > 1e9)
    )
      fail("Invalid reward points.");
    if (
      t.receipt &&
      (!/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(
        t.receipt,
      ) ||
        t.receipt.length > 1500000)
    )
      fail("Invalid transaction attachment.");
  }
  // Subscriptions first, then installments, as before; the tuple tag lets each branch see its own fields.
  const commitments: (
    | readonly [Subscription, "subscription"]
    | readonly [Installment, "installment"]
  )[] = [
    ...s.subscriptions.map((p) => [p, "subscription"] as const),
    ...s.installments.map((p) => [p, "installment"] as const),
  ];
  for (const [p, kind] of commitments) {
      if (
        typeof p.name !== "string" ||
        !p.name.trim() ||
        p.name.length > 80 ||
        !["active", "paused", "cancelled"].includes(p.status)
      )
        fail("Invalid commitment name or status.");
      if (
        !s.accounts.some(
          (a) => a.id === p.accountId && a.currency === p.currency,
        )
      )
        fail("Commitment account and currency must match.");
      contact(p);
      if (
        typeof p.category !== "string" ||
        !p.category.trim() ||
        p.category.length > 160
      )
        fail("Choose a valid plan category.");
      date(p.firstDue);
      if (
        !["daily", "weekly", "monthly", "yearly"].includes(p.frequency) ||
        !Number.isInteger(p.interval) ||
        p.interval < 1 ||
        p.interval > 120
      )
        fail("Choose a valid payment frequency and interval.");
      if (kind === "installment") {
        positive(p.total);
        if (
          !Number.isInteger(p.count) ||
          p.count < 1 ||
          p.count > 1200 ||
          p.count > toFils(p.total)
        )
          fail("Installments need 1–1200 positive payments.");
      } else {
        positive(p.amount);
        if (p.trialEnds) date(p.trialEnds);
        if (p.website) {
          let url: URL;
          try {
            url = new URL(p.website);
          } catch {
            fail("Use an HTTPS subscription website.");
          }
          if (url.protocol !== "https:" || url.username || url.password)
            fail("Use an HTTPS subscription website.");
        }
      }
      if (!Array.isArray(p.payments) || p.payments.length > 10000)
        fail("Invalid payment history.");
      const seen = new Set();
      for (const payment of p.payments) {
        if (
          !Number.isInteger(payment.index) ||
          payment.index < 0 ||
          seen.has(payment.index) ||
          (kind === "installment" && payment.index >= p.count)
        )
          fail("Invalid or duplicate payment occurrence.");
        seen.add(payment.index);
        date(payment.date);
        date(payment.due);
        positive(payment.amount);
        if (!["transaction", "manual"].includes(payment.method))
          fail("Invalid payment method.");
        if (
          payment.method === "transaction" &&
          !s.transactions.some(
            (t) =>
              t.id === payment.transactionId &&
              t.commitmentId === p.id &&
              t.commitmentType === kind &&
              t.commitmentOccurrence === payment.index,
          )
        )
          fail("Missing linked payment transaction.");
        if (payment.method === "manual" && payment.transactionId)
          fail("Manual payment must not post a transaction.");
        if (kind === "installment") {
          const fils = toFils(p.total),
            base = Math.floor(fils / p.count),
            expected =
              payment.index === p.count - 1
                ? fils - base * (p.count - 1)
                : base;
          if (toFils(payment.amount) !== expected)
            fail("Installment history must match its exact allocation.");
        }
      }
    }
  for (const t of s.transactions)
    if (t.commitmentId) {
      const list: (Subscription | Installment)[] =
        t.commitmentType === "installment"
          ? s.installments
          : t.commitmentType === "subscription"
            ? s.subscriptions
            : [];
      if (
        !list.some(
          (p) =>
            p.id === t.commitmentId &&
            p.payments.some((payment) => payment.transactionId === t.id),
        ) ||
        t.type !== "expense"
      )
        fail("Invalid commitment transaction link.");
    }
  return s;
}
