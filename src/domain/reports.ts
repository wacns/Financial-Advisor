import { cycleRange, shiftPeriod } from "./cycles.ts";
import { recordValue, convert } from "./model.ts";
import { toFils, bahrainDate, isCivilDate } from "../locale.ts";
import type { Account, Budget, Settings, Transaction, Workspace } from "./types.ts";
export type ReportRange = {
  from: string;
  until: string;
  to?: string;
  salaryMonth?: string;
};
export function reportRange(
  s: { settings?: Partial<Pick<Settings, "cycleStartDay">> },
  mode: string,
  anchor: string,
  from?: string,
  to?: string,
): ReportRange {
  if (["last7", "last30", "last3months"].includes(mode)) {
    const today = bahrainDate(),
      end = new Date(`${today}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const start = new Date(`${today}T12:00:00Z`);
    if (mode === "last3months") {
      const day = start.getUTCDate();
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - 3);
      start.setUTCDate(
        Math.min(
          day,
          new Date(
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
          ).getUTCDate(),
        ),
      );
    } else start.setUTCDate(start.getUTCDate() - (mode === "last7" ? 6 : 29));
    return {
      from: start.toISOString().slice(0, 10),
      until: end.toISOString().slice(0, 10),
    };
  }
  if (mode === "custom") {
    if (!isCivilDate(from) || !isCivilDate(to) || to < from)
      throw Error("Choose an ordered, valid date range.");
    return {
      from,
      until: new Date(Date.parse(to + "T12:00:00Z") + 86400000)
        .toISOString()
        .slice(0, 10),
    };
  }
  if (mode === "quarter") {
    const month = String(
        Math.floor((Number(anchor.slice(5)) - 1) / 3) * 3 + 1,
      ).padStart(2, "0"),
      start = `${anchor.slice(0, 4)}-${month}`;
    return { from: `${start}-01`, until: `${shiftPeriod(start, 3)}-01` };
  }
  if (mode === "year")
    return {
      from: `${anchor.slice(0, 4)}-01-01`,
      until: `${Number(anchor.slice(0, 4)) + 1}-01-01`,
    };
  return { ...cycleRange(s, anchor), salaryMonth: anchor };
}
export type ReportOptions = {
  account?: string;
  accounts?: string[];
  group?: string;
  kind?: string;
};
export function reportData(
  s: Workspace,
  range: ReportRange,
  {
    account = "all",
    accounts = [],
    group = "category",
    kind = "expense",
  }: ReportOptions = {},
) {
  const rows = s.transactions.filter(
    (t) =>
      (range.salaryMonth && t.type === "income" && t.salaryMonth
        ? t.salaryMonth === range.salaryMonth
        : t.date >= range.from && t.date < range.until) &&
      (accounts.length
        ? accounts.includes(t.accountId) ||
          (t.toAccountId !== undefined && accounts.includes(t.toAccountId))
        : account === "all" ||
          t.accountId === account ||
          t.toAccountId === account),
  );
  const groups = new Map<string | undefined, number>();
  let income = 0,
    expenses = 0;
  for (const t of rows) {
    if (t.type === "transfer" || t.type === "adjustment") continue;
    // Adjustments were skipped just above, so only income and expenses reach this point.
    const value = recordValue(s, t),
      type = t.type;
    if (type === "income") income += toFils(Math.abs(value));
    else expenses += toFils(Math.abs(value));
    if (type !== kind) continue;
    let key =
      group === "payee"
        ? s.payees?.find((p) => p.id === t.payeeId)?.name || "No contact"
        : group === "account"
          ? s.accounts.find((a) => a.id === t.accountId)?.name
          : group === "description"
            ? t.name
            : group === "parent"
              ? t.category.split(" / ")[0]
              : group === "label"
                ? (t.labels || []).join(", ") || "Unlabeled"
                : t.category;
    groups.set(key, (groups.get(key) || 0) + toFils(Math.abs(value)));
  }
  return {
    rows,
    income: income / 1000,
    expenses: expenses / 1000,
    net: (income - expenses) / 1000,
    groups: [...groups]
      .map(([name, value]) => ({ name, amount: value / 1000 }))
      .sort((a, b) => b.amount - a.amount),
  };
}
export function accountDetails(a: Account, today: string = bahrainDate()) {
  // Missing limits and installments compare as before: undefined > 0 is false, like 0 > 0.
  const limit = a.limit ?? 0,
    installment = a.installment ?? 0;
  const days = a.maturity
    ? Math.ceil((Date.parse(a.maturity) - Date.parse(today)) / 86400000)
    : null;
  return {
    utilization: limit > 0 ? (Math.max(0, -a.balance) / limit) * 100 : null,
    valuation: a.cost ? Math.round((a.balance - a.cost) * 1000) / 1000 : null,
    annualInterest: a.apr
      ? Math.round(((Math.abs(a.balance) * a.apr) / 100) * 1000) / 1000
      : null,
    daysRemaining: days,
    termProgress:
      a.startDate && a.maturity
        ? Math.max(
            0,
            Math.min(
              100,
              ((Date.parse(today) - Date.parse(a.startDate)) /
                (Date.parse(a.maturity) - Date.parse(a.startDate))) *
                100,
            ),
          )
        : null,
    maturityValue:
      a.startDate && a.maturity
        ? Math.round(
            (a.balance +
              (((Math.abs(a.balance) * (a.apr || 0)) / 100) *
                (Date.parse(a.maturity) - Date.parse(a.startDate))) /
                86400000 /
                365) *
              1000,
          ) / 1000
        : null,
    paymentsRemaining:
      installment > 0
        ? Math.ceil(Math.max(0, -a.balance) / installment)
        : null,
  };
}

export function basicBudgetStats(
  s: Workspace,
  b: Budget,
  month: string,
  today: string = bahrainDate(),
) {
  const range: ReportRange =
    b.period === "Yearly"
      ? reportRange(s, "year", month)
      : cycleRange(s, month);
  const spent =
    s.transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.date >= range.from &&
          t.date < range.until &&
          (t.category === b.category ||
            t.category.startsWith(b.category + " / ")),
      )
      .reduce((n, t) => n + Math.abs(toFils(recordValue(s, t))), 0) / 1000;
  const limit = convert(s, b.limit, b.currency || "BHD");
  const remaining = (toFils(limit) - toFils(spent)) / 1000;
  const daysLeft =
    today >= range.until
      ? 0
      : Math.ceil(
          (Date.parse(`${range.until}T12:00:00Z`) -
            Date.parse(
              `${today < range.from ? range.from : today}T12:00:00Z`,
            )) /
            86400000,
        );
  return {
    spent,
    limit,
    remaining,
    daysLeft,
    dailyAllowance: daysLeft
      ? Math.floor(Math.max(0, toFils(remaining)) / daysLeft) / 1000
      : 0,
  };
}
