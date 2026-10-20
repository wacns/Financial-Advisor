import { bahrainDate, isCivilDate, toFils } from "../locale.ts";
import { convert, recordValue, currencyCodes, text } from "./model.ts";
import { commitmentStats } from "./commitments.js";
export function shiftPeriod(month, n) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
export const addDays = (value, n) =>
  new Date(Date.parse(`${value}T12:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
export function cycleRange(state, key) {
  if (!isCivilDate(`${key}-01`)) throw Error("Choose a valid month.");
  const day = Number(state.settings?.cycleStartDay || 1);
  function anchored(period) {
    const last = new Date(`${shiftPeriod(period, 1)}-01T12:00:00Z`);
    last.setUTCDate(0);
    return `${period}-${String(Math.min(day, last.getUTCDate())).padStart(2, "0")}`;
  }
  const from = anchored(day === 1 ? key : shiftPeriod(key, -1)),
    until = anchored(day === 1 ? shiftPeriod(key, 1) : key);
  return { from, until, to: addDays(until, -1) };
}
export function cycleKey(state, today = bahrainDate()) {
  const key = today.slice(0, 7);
  return today >= cycleRange(state, key).until ? shiftPeriod(key, 1) : key;
}
export const matchesPath = (path, rule) =>
  path === rule || path.startsWith(`${rule} / `);
export function budgetMatches(b, category) {
  let selected = b.categoryMode !== "selected",
    depth = -1;
  for (const rule of b.include || [])
    if (matchesPath(category, rule) && rule.length > depth) {
      selected = true;
      depth = rule.length;
    }
  for (const rule of b.exclude || [])
    if (matchesPath(category, rule) && rule.length >= depth) {
      selected = false;
      depth = rule.length;
    }
  return selected;
}
export function splitWeeks(value) {
  const total = toFils(value),
    q = Math.floor(total / 4),
    r = total % 4;
  return Array.from({ length: 4 }, (_, i) => (q + (i < r ? 1 : 0)) / 1000);
}
export function budgetStats(s, b, child = b, today = bahrainDate()) {
  const rows = s.transactions.filter(
    (t) =>
      t.type === "expense" &&
      t.date >= b.from &&
      t.date < b.until &&
      t.date <= today &&
      budgetMatches(b, t.category) &&
      budgetMatches(child, t.category),
  );
  const spent =
    rows.reduce((sum, t) => sum + toFils(recordValue(s, t, b.currency)), 0) /
    1000;
  const totalDays = Math.round(
      (Date.parse(b.until) - Date.parse(b.from)) / 86400000,
    ),
    elapsed = Math.max(
      0,
      Math.min(
        totalDays,
        Math.round((Date.parse(today) - Date.parse(b.from)) / 86400000) + 1,
      ),
    );
  return {
    rows,
    spent,
    remaining: (toFils(child.limit) - toFils(spent)) / 1000,
    percent: (spent / child.limit) * 100,
    daily:
      Math.floor(
        Math.max(0, toFils(child.limit) - toFils(spent)) /
          Math.max(1, totalDays - elapsed + 1),
      ) / 1000,
    forecast: elapsed
      ? Math.round((spent / elapsed) * totalDays * 1000) / 1000
      : 0,
    weeks: (child.weeks || splitWeeks(child.limit)).map((limit, i) => {
      const from = addDays(b.from, i * 7),
        until = i === 3 ? b.until : addDays(b.from, (i + 1) * 7);
      return {
        from,
        until,
        limit,
        spent:
          rows
            .filter((t) => t.date >= from && t.date < until)
            .reduce(
              (sum, t) => sum + toFils(recordValue(s, t, b.currency)),
              0,
            ) / 1000,
      };
    }),
  };
}
export function validateCycleBudgets(s) {
  const keys = new Set();
  for (const b of s.cycleBudgets || []) {
    if (!currencyCodes.includes(b.currency) || !isCivilDate(`${b.key}-01`))
      throw Error("Invalid budget currency or month.");
    if (!Number.isInteger(b.day) || b.day < 1 || b.day > 31)
      throw Error("Invalid stored cycle day.");
    const expected = cycleRange({ settings: { cycleStartDay: b.day } }, b.key);
    if (
      b.from !== expected.from ||
      b.until !== expected.until ||
      b.to !== expected.to
    )
      throw Error("Budget dates must match the stored cycle day.");
    if (keys.has(b.key)) throw Error("A budget already exists for this cycle.");
    keys.add(b.key);
    if (!isCivilDate(b.from) || !isCivilDate(b.until) || b.until <= b.from)
      throw Error("Invalid budget cycle dates.");
    for (const other of s.cycleBudgets)
      if (other.id !== b.id && b.from < other.until && b.until > other.from)
        throw Error("Budget cycles cannot overlap.");
    if (
      !Array.isArray(b.children) ||
      b.children.length > 100 ||
      new Set(b.children.map((c) => c.id)).size !== b.children.length
    )
      throw Error("Invalid sub-budgets.");
    const all = [b, ...b.children];
    for (const e of all) {
      text(e.name);
      if (
        !Array.isArray(e.weeks) ||
        !Array.isArray(e.include) ||
        !Array.isArray(e.exclude) ||
        [...e.include, ...e.exclude].some(
          (p) => typeof p !== "string" || !p || p.length > 500,
        ) ||
        !["all", "selected"].includes(e.categoryMode)
      )
        throw Error("Invalid category rules.");
      if (
        !(e.limit > 0) ||
        e.weeks.length !== 4 ||
        e.weeks.some((n) => n < 0) ||
        e.weeks.reduce((a, n) => a + toFils(n), 0) > toFils(e.limit)
      )
        throw Error("Four weekly allocations must not exceed the budget.");
      if (e.categoryMode === "selected" && !e.include.length)
        throw Error("Select at least one category.");
    }
    if (
      b.children.reduce((sum, c) => sum + toFils(c.limit), 0) > toFils(b.limit)
    )
      throw Error("Sub-budgets exceed the main budget.");
    for (let i = 0; i < 4; i++)
      if (
        b.children.reduce((sum, c) => sum + toFils(c.weeks[i]), 0) >
        toFils(b.weeks[i])
      )
        throw Error("Sub-budget weekly allocations exceed the main week.");
    const paths = new Set([
      "__future__",
      ...s.transactions.map((t) => t.category),
      ...s.settings.categories,
      ...all.flatMap((e) => [...e.include, ...e.exclude]),
    ]);
    for (const path of paths)
      if (
        budgetMatches(b, path) &&
        b.children.filter((c) => budgetMatches(c, path)).length > 1
      )
        throw Error(
          "Sub-budget categories overlap. Exclude shared categories first.",
        );
  }
  return s;
}
export function accumulatedSavings(s, today = bahrainDate()) {
  return (s.cycleBudgets || [])
    .filter((b) => b.until <= today)
    .map((b) => ({
      key: b.key,
      name: b.name,
      amount: convert(s, budgetStats(s, b, b, today).remaining, b.currency),
    }));
}
export function recurringForecast(s) {
  const factors = {
    daily: 365 / 12,
    weekly: 52 / 12,
    monthly: 1,
    yearly: 1 / 12,
  };
  const rows = s.recurring
    .filter((r) => !r.paused)
    .map((r) => ({
      ...r,
      value:
        Math.round(
          (recordValue(s, r) +
            convert(
              s,
              r.loanInstallment ? r.interest || 0 : 0,
              r.currency || "BHD",
            )) *
            (factors[r.frequency] || 0) *
            1000,
        ) / 1000,
    }));
  for (const plan of s.subscriptions || []) {
    if (plan.status !== "active") continue;
    rows.push({
      ...plan,
      type: "expense",
      frequency: `every ${plan.interval} ${plan.frequency}`,
      value: convert(
        s,
        commitmentStats(s, plan, "subscription").monthly,
        plan.currency,
      ),
    });
  }
  const income = rows
      .filter((r) => r.type === "income")
      .reduce((sum, r) => sum + r.value, 0),
    expenses =
      rows
        .filter((r) => r.type !== "income")
        .reduce((sum, r) => sum + r.value, 0) +
      s.debts
        .filter((d) => d.balance > 0 && d.direction !== "lent")
        .reduce(
          (sum, d) => sum + convert(s, d.installment, d.currency || "BHD"),
          0,
        );
  return {
    rows,
    income: Math.round(income * 1000) / 1000,
    expenses: Math.round(expenses * 1000) / 1000,
    remaining: Math.round((income - expenses) * 1000) / 1000,
    percent: income ? (expenses / income) * 100 : 0,
  };
}

export function budgetHistory(s, b, today = bahrainDate()) {
  return Array.from({ length: 6 }, (_, i) => {
    const key = shiftPeriod(b.key, i - 6),
      range = cycleRange({ settings: { cycleStartDay: b.day || 1 } }, key),
      spent =
        s.transactions
          .filter(
            (t) =>
              t.type === "expense" &&
              t.date >= range.from &&
              t.date < range.until &&
              t.date <= today &&
              budgetMatches(b, t.category),
          )
          .reduce((n, t) => n + toFils(recordValue(s, t, b.currency)), 0) /
        1000;
    return { key, ...range, spent };
  });
}
