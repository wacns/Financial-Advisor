import { isCivilDate, bahrainDate, toFils } from "../locale.js";
import {
  normalizeWorkspace,
  validateWorkspace,
  amount,
  text,
  convert,
  accountCurrency,
} from "./model.js";
import { saveTransaction } from "./ledger.js";
export function commitmentDue(plan, index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > 10000 ||
    !isCivilDate(plan.firstDue)
  )
    throw Error("Invalid payment occurrence.");
  const [y, m, d] = plan.firstDue.split("-").map(Number),
    step = index * plan.interval;
  let date;
  if (["daily", "weekly"].includes(plan.frequency))
    date = new Date(
      Date.UTC(y, m - 1, d + step * (plan.frequency === "weekly" ? 7 : 1)),
    );
  else {
    date = new Date(
      Date.UTC(
        y + (plan.frequency === "yearly" ? step : 0),
        m - 1 + (plan.frequency === "monthly" ? step : 0),
        1,
      ),
    );
    date.setUTCDate(
      Math.min(
        d,
        new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );
  }
  const result = date.toISOString().slice(0, 10);
  if (!isCivilDate(result))
    throw Error("Payment date is outside the supported calendar.");
  return result;
}
export function nextCommitmentIndex(plan) {
  const consumed = new Set(plan.payments.map((p) => p.index));
  let index = 0;
  while (consumed.has(index)) index++;
  return index;
}
export function installmentAmount(plan, index) {
  const fils = toFils(plan.total),
    base = Math.floor(fils / plan.count);
  return (
    (index === plan.count - 1 ? fils - base * (plan.count - 1) : base) / 1000
  );
}
export function commitmentStats(s, plan, kind, today = bahrainDate()) {
  const index = nextCommitmentIndex(plan),
    complete = kind === "installment" && index >= plan.count;
  const amount = complete
    ? 0
    : kind === "installment"
      ? installmentAmount(plan, index)
      : plan.amount;
  const paid = plan.payments.reduce((n, p) => n + toFils(p.amount), 0) / 1000;
  const annual =
    { daily: 365.25, weekly: 365.25 / 7, monthly: 12, yearly: 1 }[
      plan.frequency
    ] / plan.interval;
  return {
    index,
    complete,
    amount,
    due: complete ? "" : commitmentDue(plan, index),
    paid,
    remaining:
      kind === "installment"
        ? (toFils(plan.total) - toFils(paid)) / 1000
        : null,
    monthly: kind === "subscription" ? (plan.amount * annual) / 12 : amount,
    overdue:
      !complete &&
      plan.status === "active" &&
      commitmentDue(plan, index) < today,
    currency: plan.currency,
  };
}
export function commitmentCommand(input, kind, data, id, uuid) {
  if (
    ![
      "subscription",
      "installment",
      "subscriptionPayment",
      "installmentPayment",
      "pauseSubscription",
      "cancelSubscription",
      "resumeSubscription",
      "deleteSubscription",
      "deleteInstallment",
    ].includes(kind)
  )
    return null;
  const s = normalizeWorkspace(input),
    installment = kind.toLowerCase().includes("installment"),
    key = installment ? "installments" : "subscriptions",
    old = s[key].find((p) => p.id === id);
  if (kind === "subscription" || kind === "installment") {
    const account = s.accounts.find((a) => a.id === data.accountId);
    if (!account) throw Error("Choose a payment account.");
    if (
      old?.payments.length &&
      (old.currency !== account.currency ||
        old.firstDue !== data.firstDue ||
        old.frequency !== data.frequency ||
        old.interval !== Number(data.interval || 1))
    )
      throw Error(
        "Keep a paid plan's currency and schedule; create a new plan for different terms.",
      );
    const row = {
      id: id || uuid(),
      name: text(data.name),
      provider: String(data.provider || "")
        .trim()
        .slice(0, 80),
      accountId: account.id,
      currency: account.currency,
      category: data.category || "Utilities",
      payeeId: data.payeeId || "",
      firstDue: data.firstDue,
      frequency: data.frequency,
      interval: Number(data.interval || 1),
      status: old?.status || "active",
      payments: old?.payments || [],
      note: String(data.note || "").slice(0, 500),
    };
    if (installment) {
      row.total = amount(data.total, true);
      row.count = Number(data.count);
      if (
        old?.payments.length &&
        (row.total !== old.total || row.count !== old.count)
      )
        throw Error(
          "Keep paid installment terms; create a new plan for changed amounts.",
        );
    } else {
      row.amount = amount(data.amount, true);
      row.trialEnds = data.trialEnds || "";
      row.website = String(data.website || "").trim();
    }
    s[key] = [...s[key].filter((p) => p.id !== row.id), row];
  } else {
    if (!old) throw Error("This plan no longer exists.");
    if (kind.startsWith("delete")) {
      if (old.payments.length)
        throw Error(
          "Plans with payment history must be kept. Pause or cancel the plan instead.",
        );
      s[key] = s[key].filter((p) => p.id !== id);
    } else if (kind.endsWith("Subscription"))
      old.status = kind.startsWith("pause")
        ? "paused"
        : kind.startsWith("cancel")
          ? "cancelled"
          : "active";
    else {
      if (old.status !== "active")
        throw Error("Resume the plan before recording a payment.");
      const stats = commitmentStats(
        s,
        old,
        installment ? "installment" : "subscription",
      );
      if (stats.complete || Number(data.index) !== stats.index)
        throw Error(
          "This occurrence was already paid or the schedule changed. Refresh before recording.",
        );
      if (!isCivilDate(data.date) || data.date > bahrainDate())
        throw Error("Use an actual payment date, no later than today.");
      const manual = data.method === "manual";
      let transactionId = null;
      if (!manual) {
        if (data.method !== "transaction")
          throw Error("Choose how to record this payment.");
        const account = s.accounts.find((a) => a.id === data.accountId);
        if (!account) throw Error("Choose a payment account.");
        transactionId = uuid();
        saveTransaction(
          s,
          {
            id: transactionId,
            name: old.name,
            type: "expense",
            accountId: account.id,
            amount: amount(data.amount, true),
            date: data.date,
            category: old.category,
            payeeId: old.payeeId,
            note: data.note || "",
            commitmentId: old.id,
            commitmentType: installment ? "installment" : "subscription",
            commitmentOccurrence: stats.index,
          },
          transactionId,
          uuid,
        );
      }
      old.payments.push({
        id: uuid(),
        index: stats.index,
        due: stats.due,
        date: data.date,
        amount: stats.amount,
        transactionId,
        method: manual ? "manual" : "transaction",
      });
    }
  }
  return validateWorkspace(s);
}
export function commitmentCalendar(s, month) {
  const rows = [];
  for (const [key, kind] of [
    ["subscriptions", "subscription"],
    ["installments", "installment"],
  ])
    for (const plan of s[key] || []) {
      for (const p of plan.payments)
        if (p.date.startsWith(month))
          rows.push({
            id: plan.id,
            key: `${plan.id}-${p.index}`,
            name: plan.name,
            date: p.date,
            amount: p.amount,
            currency: plan.currency,
            status: "recorded",
            kind,
            index: p.index,
          });
      if (plan.status !== "active") continue;
      const next = nextCommitmentIndex(plan);
      for (
        let index = next;
        index < 10000 && (kind !== "installment" || index < plan.count);
        index++
      ) {
        const due = commitmentDue(plan, index);
        if (due.slice(0, 7) > month) break;
        if (plan.payments.some((payment) => payment.index === index)) continue;
        if (due.startsWith(month))
          rows.push({
            id: plan.id,
            key: `${plan.id}-${index}`,
            name: plan.name,
            date: due,
            amount:
              kind === "installment"
                ? installmentAmount(plan, index)
                : plan.amount,
            currency: plan.currency,
            status: index === next ? "due" : "projected",
            kind,
            index,
          });
      }
    }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
export function paymentDraft(s, plan, kind) {
  const stats = commitmentStats(s, plan, kind);
  return {
    index: stats.index,
    method: "transaction",
    date: bahrainDate(),
    accountId: plan.accountId,
    amount: convert(
      s,
      stats.amount,
      plan.currency,
      accountCurrency(s, plan.accountId),
    ),
  };
}
export function upcomingCommitments(s) {
  return [
    ["subscriptions", "subscription"],
    ["installments", "installment"],
  ].flatMap(([key, kind]) =>
    (s[key] || [])
      .filter((p) => p.status === "active")
      .flatMap((plan) => {
        const stats = commitmentStats(s, plan, kind);
        return stats.complete
          ? []
          : [
              {
                ...plan,
                kind,
                type: "expense",
                nextDue: stats.due,
                amount: stats.amount,
              },
            ];
      }),
  );
}
