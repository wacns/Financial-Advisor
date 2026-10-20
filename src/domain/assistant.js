import { reportData, reportRange } from "./reports.js";
import { commitmentStats } from "./commitments.js";
import { convert, recordValue } from "./model.ts";
import { totalBalance } from "../finance.js";
import { bahrainDate, formatMoney as money, toFils } from "../locale.ts";
export function assistantSummary(s, month = bahrainDate().slice(0, 7)) {
  const totals = reportData(s, reportRange(s, "month", month), {
    kind: "expense",
  });
  const active = s.subscriptions.filter((p) => p.status === "active");
  return {
    month,
    currency: s.settings.base,
    trackedBalance: totalBalance(s),
    income: totals.income,
    expenses: totals.expenses,
    net: totals.net,
    categoryTotals: totals.groups.slice(0, 10),
    monthlySubscriptions:
      Math.round(
        active.reduce(
          (n, p) =>
            n +
            convert(
              s,
              commitmentStats(s, p, "subscription").monthly,
              p.currency,
            ),
          0,
        ) * 1000,
      ) / 1000,
    subscriptionCount: active.length,
    installmentsRemaining:
      s.installments
        .filter((p) => p.status === "active")
        .reduce(
          (n, p) =>
            n +
            toFils(
              convert(
                s,
                commitmentStats(s, p, "installment").remaining,
                p.currency,
              ),
            ),
          0,
        ) / 1000,
  };
}
export function localAnswer(s, question, month) {
  const q = question.toLowerCase(),
    summary = assistantSummary(s, month);
  if (/subscription|اشتراك/.test(q))
    return `${summary.subscriptionCount} active subscriptions cost about ${money(summary.monthlySubscriptions)} per month after annualizing their billing intervals. Paused and cancelled plans are excluded.`;
  if (/installment|قسط|أقساط/.test(q))
    return `Active installment trackers have ${money(summary.installmentsRemaining)} scheduled principal remaining. Amounts marked paid without a transaction update the tracker without creating spending.`;
  if (/balance|wealth|available|رصيد/.test(q))
    return `Your included tracked accounts total ${money(summary.trackedBalance)}. This uses saved account balances and exchange rates; excluded accounts are left out.`;
  if (/income|salary|دخل|راتب/.test(q))
    return `Recorded income for ${summary.month} is ${money(summary.income)}, spending is ${money(summary.expenses)}, and net cash flow is ${money(summary.net)}. Transfers and balance adjustments are excluded.`;
  if (/biggest|largest|categor|أكثر|تصنيف/.test(q)) {
    const first = summary.categoryTotals[0];
    return first
      ? `Your largest spending category in ${summary.month} is ${first.name}: ${money(first.amount)} out of ${money(summary.expenses)} recorded spending.`
      : `There are no expenses to categorize for ${summary.month}.`;
  }
  if (/spend|spent|expense|مصروف|إنفاق/.test(q))
    return `You recorded ${money(summary.expenses)} in expenses for ${summary.month}. Net cash flow is ${money(summary.net)}. Use Insights to choose more accounts, dates and groupings.`;
  return `For ${summary.month}, recorded income is ${money(summary.income)}, expenses are ${money(summary.expenses)}, and net cash flow is ${money(summary.net)}. Ask about spending, income, balances, categories, subscriptions or installments.`;
}
export function captureAccount(s, currency) {
  return (
    s.accounts.find(
      (a) => a.id === s.settings.defaultAccountId && a.currency === currency,
    ) || s.accounts.find((a) => a.currency === currency)
  );
}
export const assistantRecordTotal = (s, records) =>
  records.reduce((n, t) => n + toFils(recordValue(s, t)), 0) / 1000;
