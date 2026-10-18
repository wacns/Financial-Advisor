import { basicBudgetStats } from "./domain/reports.js";
import { recordValue } from "./domain/model.js";
import { cycleRange } from "./domain/cycles.js";
import { categorySpend, summary } from "./finance.js";
import { toFils, isCivilDate } from "./locale.js";
import { nextOccurrence, upcomingPayments } from "./planning.js";

export function shiftMonth(month, offset) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function accountReport(state, accountId = "all") {
  return {
    ...state,
    transactions: state.transactions.filter(
      (t) =>
        accountId === "all" ||
        t.accountId === accountId ||
        t.toAccountId === accountId,
    ),
  };
}

export function spendingBreakdown(state, month) {
  const totals = new Map();
  for (const t of state.transactions) {
    const { from, until } = cycleRange(state, month);
    if (!(t.type === "expense") || t.date < from || t.date >= until) continue;
    totals.set(
      t.category,
      (totals.get(t.category) || 0) + Math.abs(toFils(recordValue(state, t))),
    );
  }
  return [...totals]
    .map(([name, fils]) => ({ name, amount: fils / 1000 }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

export function monthlyTrend(state, month) {
  return Array.from({ length: 6 }, (_, i) => {
    const period = shiftMonth(month, i - 5);
    return { month: period, ...summary(state, period) };
  });
}

export function budgetHealth(state, month) {
  let limit = 0,
    spent = 0,
    exceeded = 0;
  for (const budget of state.budgets) {
    const stats = basicBudgetStats(state, budget, month),
      amount = toFils(stats.spent);
    limit += toFils(stats.limit);
    spent += amount;
    if (amount > toFils(stats.limit)) exceeded++;
  }
  return {
    limit: limit / 1000,
    spent: spent / 1000,
    remaining: (limit - spent) / 1000,
    exceeded,
  };
}

// Project repeated schedules without advancing them or creating ledger records.
// Jump near the requested month first, even if a schedule is years overdue.
export function calendarEntries(state, month) {
  if (!isCivilDate(`${month}-01`)) throw Error("Choose a valid month.");
  const start = `${month}-01`;
  const end = `${shiftMonth(month, 1)}-01`;
  const entries = [];
  for (const r of state.recurring || []) {
    if (r.paused || r.nextDue >= end) continue;
    let date = r.nextDue;
    if (date < start) {
      if (r.frequency === "weekly" || r.frequency === "daily") {
        const jump = Math.ceil(
          (new Date(`${start}T12:00:00Z`) - new Date(`${date}T12:00:00Z`)) /
            (r.frequency === "daily" ? 86400000 : 604800000),
        );
        const target = new Date(`${date}T12:00:00Z`);
        target.setUTCDate(
          target.getUTCDate() + jump * (r.frequency === "daily" ? 1 : 7),
        );
        date = target.toISOString().slice(0, 10);
      } else if (r.frequency === "monthly") {
        const days = new Date(
          new Date(`${end}T12:00:00Z`).getTime() - 86400000,
        ).getUTCDate();
        date = `${month}-${String(Math.min(r.anchorDay || Number(r.nextDue.slice(8)), days)).padStart(2, "0")}`;
      } else {
        const annualMonth = `${month.slice(0, 4)}-${String(r.anchorMonth || Number(r.nextDue.slice(5, 7))).padStart(2, "0")}`;
        const days = new Date(
          new Date(`${shiftMonth(annualMonth, 1)}-01T12:00:00Z`).getTime() -
            86400000,
        ).getUTCDate();
        date = `${annualMonth}-${String(Math.min(r.anchorDay || Number(r.nextDue.slice(8)), days)).padStart(2, "0")}`;
      }
    }
    while (date < end) {
      if (date >= start)
        entries.push({
          ...r,
          date,
          kind: "recurring",
          status: date === r.nextDue ? "due" : "projected",
          actionable: date === r.nextDue,
        });
      date = nextOccurrence(date, r.frequency, r.anchorDay, r.anchorMonth);
    }
  }
  // Do not assume the interest/principal split of future loan repayments.
  for (const r of upcomingPayments(state).filter((r) => r.kind === "debt")) {
    if (r.nextDue >= start && r.nextDue < end)
      entries.push({ ...r, date: r.nextDue, status: "due", actionable: true });
  }
  for (const t of state.transactions) {
    if ((t.recurringId || t.debtId) && t.date >= start && t.date < end)
      entries.push({
        ...t,
        kind: "transaction",
        status: "recorded",
        actionable: false,
      });
  }
  return entries.sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  );
}
