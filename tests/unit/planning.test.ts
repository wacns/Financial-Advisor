import test from "node:test";
import assert from "node:assert/strict";
import { blankState, addTransaction } from "../../src/finance.ts";
import { isCivilDate } from "../../src/locale.ts";
import {
  normalizePlanning,
  nextOccurrence,
  saveRecurring,
  recordRecurring,
  addDebt,
  recordRepayment,
  saveProject,
  projectSpend,
  upcomingPayments,
} from "../../src/planning.ts";
import type { Account, Workspace } from "../../src/domain/types.ts";
import { must } from "../../src/guards.ts";
import { partial } from "../support.ts";
function workspace() {
  const state = partial<Workspace>(blankState());
  state.accounts = partial<Account[]>([{ id: "current", name: "Current", balance: 1000 }]);
  return state;
}
const schedule = {
  name: "EWA",
  type: "expense",
  category: "Utilities",
  amount: 10.001,
  accountId: "current",
  frequency: "monthly",
  nextDue: "2027-01-31",
};
test("month-end schedules retain their anchor across February, edits, years and leap years", () => {
  assert.equal(nextOccurrence("2027-01-31", "monthly", 31), "2027-02-28");
  assert.equal(nextOccurrence("2027-02-28", "monthly", 31), "2027-03-31");
  assert.equal(nextOccurrence("2028-01-31", "monthly", 31), "2028-02-29");
  assert.equal(nextOccurrence("2028-02-29", "yearly", 29, 2), "2029-02-28");
  assert.equal(nextOccurrence("2031-02-28", "yearly", 29, 2), "2032-02-29");
  assert.equal(nextOccurrence("2026-12-31", "weekly"), "2027-01-07");
  const state = workspace();
  saveRecurring(state, schedule, "bill");
  recordRecurring(
    state,
    "bill",
    {
      scheduledFor: "2027-01-31",
      date: "2027-01-31",
      amount: 10.001,
      accountId: "current",
    },
    "paid",
  );
  saveRecurring(state, { ...state.recurring[0], amount: 11 }, "bill");
  assert.equal(state.recurring[0]?.anchorDay, 31);
});
test("recorded bills and income affect accounts once; retries and paused plans cannot create duplicate entries", () => {
  const state = workspace();
  saveRecurring(state, schedule, "bill");
  const payment = {
    scheduledFor: "2027-01-31",
    date: "2027-01-31",
    amount: 10.001,
    accountId: "current",
  };
  recordRecurring(state, "bill", payment, "tx");
  assert.equal(state.accounts[0]?.balance, 989.999);
  assert.equal(state.transactions[0]?.recurringId, "bill");
  assert.equal(state.recurring[0]?.nextDue, "2027-02-28");
  assert.throws(
    () => recordRecurring(state, "bill", payment),
    /already been recorded/,
  );
  must(state.recurring[0], "schedule").paused = true;
  assert.throws(
    () =>
      recordRecurring(state, "bill", {
        ...payment,
        scheduledFor: "2027-02-28",
      }),
    /no longer active/,
  );
  saveRecurring(
    state,
    { ...schedule, name: "Salary", type: "income", amount: 1800 },
    "salary",
  );
  recordRecurring(state, "salary", { ...payment, amount: 1800 }, "salary-tx");
  assert.equal(state.accounts[0]?.balance, 2789.999);
  assert.equal(state.transactions.length, 2);
  assert.equal(state.transactions[0]?.category, "Income");
  assert.equal(upcomingPayments(state).length, 1);
});
test("loan repayment separates cash, principal and fees and rejects overpayment without mutation", () => {
  const state = workspace();
  addDebt(
    state,
    { name: "Car", balance: 500, installment: 100, nextDue: "2027-01-31" },
    "debt",
  );
  const payment = {
    amount: 100.001,
    principal: 90.001,
    accountId: "current",
    date: "2027-01-31",
    scheduledFor: "2027-01-31",
  };
  recordRepayment(state, "debt", payment, "repayment");
  assert.equal(state.accounts[0]?.balance, 899.999);
  assert.equal(state.debts[0]?.balance, 409.999);
  assert.equal(state.transactions[0]?.amount, 100.001);
  assert.equal(state.transactions[0]?.principal, 90.001);
  assert.equal(state.debts[0]?.nextDue, "2027-02-28");
  const snapshot = structuredClone(state);
  assert.throws(
    () =>
      recordRepayment(state, "debt", {
        ...payment,
        scheduledFor: "2027-02-28",
        principal: 410,
        amount: 500,
      }),
    /outstanding debt/,
  );
  assert.throws(
    () =>
      recordRepayment(state, "debt", {
        ...payment,
        scheduledFor: "2027-02-28",
        principal: 200,
      }),
    /total payment/,
  );
  assert.throws(
    () => recordRepayment(state, "debt", payment),
    /schedule changed/,
  );
  assert.deepEqual(state, snapshot);
  recordRepayment(
    state,
    "debt",
    {
      ...payment,
      scheduledFor: "2027-02-28",
      amount: 409.999,
      principal: 409.999,
    },
    "final",
  );
  assert.equal(state.debts[0]?.balance, 0);
  assert.equal(upcomingPayments(state).length, 0);
});
test("project spend uses linked expenses once across months; archived projects keep history", () => {
  const state = workspace();
  saveProject(state, { name: "Renovation", budget: 100 }, "project");
  addTransaction(state, {
    id: "a",
    name: "Paint",
    amount: 10.001,
    type: "expense",
    category: "Home",
    accountId: "current",
    date: "2027-01-15",
    projectId: "project",
  });
  addTransaction(state, {
    id: "b",
    name: "Wood",
    amount: 20.002,
    type: "expense",
    category: "Home",
    accountId: "current",
    date: "2027-02-15",
    projectId: "project",
  });
  assert.equal(projectSpend(state, "project"), 30.003);
  assert.equal(state.accounts[0]?.balance, 969.997);
  must(state.projects[0], "project").archived = true;
  assert.equal(projectSpend(state, "project"), 30.003);
  assert.throws(
    () => addTransaction(state, { ...state.transactions[0], id: "c" }),
    /active project/,
  );
  assert.equal(state.transactions.length, 2);
});
test("older workspaces normalize without adding sample records or discarding existing fields", () => {
  const legacy: {
    currency: string;
    accounts: { id: string; balance: number }[];
    transactions: unknown[];
    custom: string;
    recurring?: unknown[];
  } = {
    currency: "BHD",
    accounts: [{ id: "account", balance: 7.123 }],
    transactions: [],
    custom: "keep",
  };
  const next = normalizePlanning(legacy);
  assert.deepEqual(next.recurring, []);
  assert.deepEqual(next.debts, []);
  assert.deepEqual(next.projects, []);
  assert.equal(next.accounts, legacy.accounts);
  assert.equal(next.custom, "keep");
  assert.equal(legacy.recurring, undefined);
});
test("invalid civil dates and sub-fils amounts never create a payment", () => {
  assert.equal(isCivilDate("2027-02-29"), false);
  assert.equal(isCivilDate("2028-02-29"), true);
  const state = workspace();
  saveRecurring(state, schedule, "bill");
  const snapshot = structuredClone(state);
  for (const data of [
    { date: "2027-02-30", amount: 5 },
    { date: "2027-02-28", amount: 0.0001 },
  ]) {
    assert.throws(() =>
      recordRecurring(state, "bill", {
        ...data,
        scheduledFor: "2027-01-31",
        accountId: "current",
      }),
    );
    assert.deepEqual(state, snapshot);
  }
});
