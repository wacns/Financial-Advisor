import { bahrainDate, isCivilDate, toFils } from "../locale.ts";
import {
  normalizeWorkspace,
  validateWorkspace,
  text,
  amount,
  recordValue,
  currencyCodes,
} from "./model.ts";
import { field, isOneOf, matches } from "../guards.ts";
const isHexColor = matches(/^#[a-f0-9]{6}$/i);
import type { RateQuote, Rates, Transaction, Workspace } from "./types.ts";
export const accountIcons = ["▣", "▰", "◆", "◈", "●", "♧", "⌂", "✦"] as const;
export const accountColors = [
  "#214b39",
  "#23566d",
  "#694568",
  "#9b563b",
  "#54613a",
  "#514c83",
] as const;
export type AppearanceInput = {
  color?: unknown;
  icon?: unknown;
  rewardRate?: unknown;
  includeInTotal?: unknown;
};
export function accountAppearance(data: AppearanceInput) {
  const color = data.color || accountColors[0],
    icon = data.icon || accountIcons[0];
  if (!isHexColor(color) || !isOneOf(accountIcons, icon))
    throw Error("Choose a valid account color and icon.");
  const rewardRate = Number(data.rewardRate || 0);
  if (!Number.isFinite(rewardRate) || rewardRate < 0 || rewardRate > 100000)
    throw Error("Reward rate must be between 0 and 100,000.");
  return {
    color,
    icon,
    includeInTotal:
      data.includeInTotal !== false && data.includeInTotal !== "no",
    rewardRate,
  };
}
/** Fields the organizing forms submit; each command kind reads its own subset. */
export type OrganizeInput = {
  role?: unknown;
  name?: unknown;
  note?: unknown;
  color?: unknown;
  accountId?: unknown;
  source?: unknown;
  asOf?: unknown;
  rates?: unknown;
  dateFormat?: unknown;
};
export function organizeCommand(
  input: unknown,
  kind: string,
  data: OrganizeInput,
  id: string | null | undefined,
  uuid: () => string,
): Workspace | null {
  const supported = [
    "payee",
    "deletePayee",
    "tag",
    "deleteTag",
    "pinTransaction",
    "defaultAccount",
    "datePreferences",
    "refreshRates",
  ];
  if (!supported.includes(kind)) return null;
  const s = normalizeWorkspace(input);
  if (kind === "payee") {
    const role = data.role;
    if (!isOneOf(["payee", "payer", "both"], role))
      throw Error("Choose payee, payer or both.");
    const row = {
      id: id || uuid(),
      name: text(data.name),
      role,
      note: String(data.note || "").slice(0, 500),
    };
    if (
      s.payees.some(
        (p) =>
          p.id !== id &&
          p.name.toLocaleLowerCase() === row.name.toLocaleLowerCase(),
      )
    )
      throw Error("That contact already exists.");
    s.payees = [...s.payees.filter((p) => p.id !== row.id), row];
  } else if (kind === "deletePayee") {
    if (
      [
        ...s.transactions,
        ...s.recurring,
        ...s.templates.map((t) => t.record),
      ].some((t) => t.payeeId === id) ||
      [...s.subscriptions, ...s.installments].some((p) => p.payeeId === id)
    )
      throw Error("This contact is linked to records. Edit its name instead.");
    s.payees = s.payees.filter((p) => p.id !== id);
  } else if (kind === "tag") {
    const old = s.tags.find((t) => t.id === id),
      name = text(data.name, "Tag", 40),
      color = data.color || accountColors[0];
    if (!isHexColor(color))
      throw Error("Choose a six-digit tag color.");
    if (
      s.tags.some(
        (t) => t.id !== id && t.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw Error("That tag already exists.");
    if (old && old.name !== name)
      for (const t of [...s.transactions, ...s.templates.map((t) => t.record)])
        t.labels = [
          ...new Set((t.labels || []).map((l) => (l === old.name ? name : l))),
        ];
    s.tags = [
      ...s.tags.filter((t) => t.id !== id),
      { id: id || uuid(), name, color },
    ];
  } else if (kind === "deleteTag") {
    const tag = s.tags.find((t) => t.id === id);
    if (
      tag &&
      [...s.transactions, ...s.templates.map((t) => t.record)].some((t) =>
        t.labels?.includes(tag.name),
      )
    )
      throw Error("This tag is in use. Rename it instead.");
    s.tags = s.tags.filter((t) => t.id !== id);
  } else if (kind === "pinTransaction") {
    const row = s.transactions.find((t) => t.id === id);
    if (!row) throw Error("Transaction not found.");
    row.pinned = !row.pinned;
  } else if (kind === "defaultAccount") {
    // A set id must match an account, so the matched account's id is that same string.
    const account = data.accountId
      ? s.accounts.find((a) => a.id === data.accountId)
      : undefined;
    if (data.accountId && !account)
      throw Error("Choose an existing default account.");
    s.settings.defaultAccountId = account?.id || "";
  } else if (kind === "refreshRates") {
    const { source, asOf } = data;
    if (
      source !== "ExchangeRate-API" ||
      !isCivilDate(asOf) ||
      asOf > bahrainDate()
    )
      throw Error("Check the provider and quote date before applying rates.");
    const rates = Object.fromEntries(
      currencyCodes.map((code) => {
        const rate = field(data.rates, code);
        // Number.isFinite is false for anything but a number, so the typeof check adds nothing.
        if (
          typeof rate !== "number" ||
          !Number.isFinite(rate) ||
          rate <= 0 ||
          rate > 1e9 ||
          (code === "BHD" && rate !== 1)
        )
          throw Error("Invalid reviewed exchange rate.");
        return [code, rate];
      }),
    );
    s.settings.rates = rates;
    s.settings.ratesAsOf = asOf;
    s.settings.ratesSource = source;
    s.settings.rateHistory = (
      [
        ...(s.settings.rateHistory || []).filter((row) => row.asOf !== asOf),
        {
          asOf,
          source,
          rates,
          savedAt: new Date().toISOString(),
        },
      ] satisfies RateQuote[]
    ).slice(-90);
  } else {
    const dateFormat = data.dateFormat;
    if (!isOneOf(["dmy", "mdy", "ymd"], dateFormat))
      throw Error("Choose a date format.");
    s.settings.dateFormat = dateFormat;
  }
  return validateWorkspace(s);
}
export type TransactionFilter = {
  query?: string;
  type?: string;
  accountIds?: string[];
  payeeId?: string;
  label?: string;
  category?: string;
  from?: string;
  to?: string;
  minimum?: string;
  maximum?: string;
  pinned?: boolean;
};
export function filterTransactions(
  s: Workspace,
  {
    query = "",
    type = "all",
    accountIds = [],
    payeeId = "",
    label = "",
    category = "",
    from = "",
    to = "",
    minimum = "",
    maximum = "",
    pinned = false,
  }: TransactionFilter = {},
  rows: Transaction[] = s.transactions,
): Transaction[] {
  if (
    (from && !isCivilDate(from)) ||
    (to && !isCivilDate(to)) ||
    (from && to && from > to)
  )
    throw Error("Choose a valid ordered date range.");
  const min = minimum === "" ? null : amount(minimum),
    max = maximum === "" ? null : amount(maximum);
  if (
    (min != null && min < 0) ||
    (max != null && max < 0) ||
    (min != null && max != null && min > max)
  )
    throw Error("Check the amount range in reporting currency.");
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return rows
    .filter((t) => {
      const payee = s.payees.find((p) => p.id === t.payeeId)?.name || "";
      const account = s.accounts.find((a) => a.id === t.accountId)?.name || "";
      const searchable =
        `${t.name} ${t.category} ${(t.labels || []).join(" ")} ${t.note || ""} ${t.location || ""} ${payee} ${account}`.toLocaleLowerCase();
      const value = Math.abs(recordValue(s, t));
      return (
        words.every((word) => searchable.includes(word)) &&
        (type === "all" || t.type === type) &&
        (!accountIds.length ||
          accountIds.includes(t.accountId) ||
          (t.toAccountId !== undefined &&
            accountIds.includes(t.toAccountId))) &&
        (!payeeId || t.payeeId === payeeId) &&
        (!label || t.labels?.includes(label)) &&
        (!category ||
          t.category === category ||
          t.category.startsWith(category + " / ")) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        (min == null || value >= min) &&
        (max == null || value <= max) &&
        (!pinned || t.pinned)
      );
    })
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        b.date.localeCompare(a.date) ||
        String(b.time || "").localeCompare(a.time || ""),
    );
}
export function transactionGroups(rows: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  for (const t of rows) {
    const key = t.pinned ? "Pinned" : t.date;
    let group = groups.get(key);
    if (!group) groups.set(key, (group = []));
    group.push(t);
  }
  return [...groups].map(([date, transactions]) => ({ date, transactions }));
}
export function contactSummary(s: Workspace, id: string) {
  const rows = s.transactions.filter((t) => t.payeeId === id);
  return {
    rows,
    expenses:
      rows
        .filter((t) => t.type === "expense")
        .reduce((n, t) => n + toFils(recordValue(s, t)), 0) / 1000,
    income:
      rows
        .filter((t) => t.type === "income")
        .reduce((n, t) => n + toFils(recordValue(s, t)), 0) / 1000,
  };
}
export const currentDay = bahrainDate;
