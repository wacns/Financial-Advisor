import { cycleRange, shiftPeriod } from "./cycles.js";
import { recordValue, convert } from "./model.js";
import { toFils, bahrainDate, isCivilDate } from "../locale.js";
export function reportRange(s, mode, anchor, from, to) {
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
export function reportData(
  s,
  range,
  { account = "all", group = "category", kind = "expense" } = {},
) {
  const rows = s.transactions.filter(
    (t) =>
      (range.salaryMonth && t.type === "income" && t.salaryMonth
        ? t.salaryMonth === range.salaryMonth
        : t.date >= range.from && t.date < range.until) &&
      (account === "all" ||
        t.accountId === account ||
        t.toAccountId === account),
  );
  const groups = new Map();
  let income = 0,
    expenses = 0;
  for (const t of rows) {
    if (t.type === "transfer" || t.type === "adjustment") continue;
    const value = recordValue(s, t),
      type =
        t.type === "adjustment" ? (value < 0 ? "expense" : "income") : t.type;
    if (type === "income") income += toFils(Math.abs(value));
    else expenses += toFils(Math.abs(value));
    if (type !== kind) continue;
    let key =
      group === "account"
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
export function accountDetails(a, today = bahrainDate()) {
  const days = a.maturity
    ? Math.ceil((Date.parse(a.maturity) - Date.parse(today)) / 86400000)
    : null;
  return {
    utilization: a.limit > 0 ? (Math.max(0, -a.balance) / a.limit) * 100 : null,
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
      a.installment > 0
        ? Math.ceil(Math.max(0, -a.balance) / a.installment)
        : null,
  };
}

export function basicBudgetStats(s, b, month) {
  const range =
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
  return { spent, limit, remaining: (toFils(limit) - toFils(spent)) / 1000 };
}
