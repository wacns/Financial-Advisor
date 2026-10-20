import test from "node:test";
import assert from "node:assert/strict";
import { applyEntry } from "../../src/application/workspace.ts";
import { blankState, totalBalance } from "../../src/finance.ts";
import { normalizeWorkspace } from "../../src/domain/model.ts";
import {
  commitmentStats,
  commitmentDue,
  commitmentCalendar,
} from "../../src/domain/commitments.ts";
import { filterTransactions } from "../../src/domain/organizing.ts";
import { backupText, parseBackup } from "../../src/domain/imports.ts";
import { entryForm } from "../../src/application/forms.ts";
import type { EntryInput } from "../../src/application/workspace.ts";
import { must } from "../../src/guards.ts";
const setup = () => {
  let i = 0;
  const apply = (s: unknown, kind: string, data: EntryInput = {}, id?: string) =>
    applyEntry(s, kind, data, id, () => `feature-${++i}`);
  let state = apply(blankState(), "account", {
    name: "Cash",
    type: "Cash",
    balance: 10,
    currency: "BHD",
    rewardRate: 2,
  });
  return { state, apply, account: must(state.accounts[0], "account").id };
};
test("plan pickers display their saved category, including imported and renamed categories", () => {
  const { state, apply, account } = setup();
  const initial = entryForm("subscription", undefined, state);
  assert.equal(initial.values.category, "Utilities");
  assert(
    initial.fields
      .find((f) => f.name === "category")
      ?.options?.includes(initial.values.category),
  );
  let s = apply(state, "subscription", {
    name: "Legacy plan",
    accountId: account,
    category: "Imported billing",
    amount: 1,
    firstDue: "2026-10-01",
    frequency: "monthly",
    interval: 1,
  });
  const edit = entryForm("subscription", must(s.subscriptions[0], "subscription").id, s);
  assert.equal(edit.values.category, "Imported billing");
  assert(
    edit.fields
      .find((f) => f.name === "category")
      ?.options?.includes(edit.values.category),
  );
  s = apply(s, "category", { name: "Power", parent: "" }, "Utilities");
  const afterRename = entryForm("installment", undefined, s);
  assert.equal(afterRename.values.category, "Other");
  assert(
    afterRename.fields
      .find((f) => f.name === "category")
      ?.options?.includes(afterRename.values.category),
  );
});
test("old workspaces normalize new feature collections without posting records", () => {
  const old = blankState(),
    s = normalizeWorkspace(old);
  for (const key of ["payees", "tags", "subscriptions", "installments"] as const)
    assert.deepEqual(s[key], []);
  assert.deepEqual(s.transactions, old.transactions);
  assert.deepEqual(s.accounts, old.accounts);
});
test("recorded bill expenses earn the selected account's future reward points", () => {
  const { apply, account, state } = setup();
  let s = apply(state, "recurring", {
    name: "Storage",
    type: "expense",
    amount: 1.001,
    category: "Utilities",
    accountId: account,
    nextDue: "2026-10-01",
    frequency: "monthly",
  });
  s = apply(
    s,
    "record",
    {
      date: "2026-10-01",
      scheduledFor: "2026-10-01",
      accountId: account,
      amount: 1.001,
    },
    must(s.recurring[0], "schedule").id,
  );
  assert.equal(s.transactions[0]?.rewardPoints, 2.002);
  assert.equal(s.accounts[0]?.balance, 8.999);
});
test("installments preserve the last fils, month ends, manual payments and reversals", () => {
  const { apply, account, state } = setup();
  let s = apply(state, "installment", {
    name: "Device",
    accountId: account,
    total: "0.005",
    count: 3,
    firstDue: "2026-01-31",
    frequency: "monthly",
    interval: 1,
  });
  const id = must(s.installments[0], "installment").id;
  assert.equal(commitmentDue(must(s.installments[0], "installment"), 1), "2026-02-28");
  assert.equal(commitmentDue(must(s.installments[0], "installment"), 2), "2026-03-31");
  s = apply(
    s,
    "installmentPayment",
    { index: 0, method: "manual", date: "2026-01-31" },
    id,
  );
  assert.equal(s.accounts[0]?.balance, 10);
  assert.equal(s.transactions.length, 0);
  s = apply(
    s,
    "installmentPayment",
    {
      index: 1,
      method: "transaction",
      date: "2026-02-28",
      accountId: account,
      amount: "0.001",
    },
    id,
  );
  const transaction = must(s.transactions[0], "transaction").id;
  assert.throws(
    () =>
      apply(
        s,
        "installmentPayment",
        { index: 1, method: "manual", date: "2026-02-28" },
        id,
      ),
    /already paid/,
  );
  s = apply(
    s,
    "installmentPayment",
    {
      index: 2,
      method: "transaction",
      date: "2026-03-31",
      accountId: account,
      amount: "0.003",
    },
    id,
  );
  assert.equal(s.accounts[0]?.balance, 9.996);
  assert.equal(
    commitmentStats(s, must(s.installments[0], "installment"), "installment").remaining,
    0,
  );
  s = apply(s, "deleteTransaction", {}, transaction);
  assert.equal(s.accounts[0]?.balance, 9.997);
  assert.equal(commitmentStats(s, must(s.installments[0], "installment"), "installment").index, 1);
  assert.equal(
    commitmentStats(s, must(s.installments[0], "installment"), "installment").remaining,
    0.001,
  );
  assert.equal(
    commitmentCalendar(s, "2026-03").filter((r) => r.status === "projected")
      .length,
    0,
  );
});
test("subscription intervals retain anchors and failed edits never change original state", () => {
  const { apply, account, state } = setup();
  const s = apply(state, "subscription", {
    name: "Service",
    accountId: account,
    amount: 6,
    firstDue: "2026-01-31",
    frequency: "monthly",
    interval: 3,
    website: "https://example.com",
  });
  assert.equal(commitmentDue(must(s.subscriptions[0], "subscription"), 1), "2026-04-30");
  assert.equal(commitmentDue(must(s.subscriptions[0], "subscription"), 2), "2026-07-31");
  assert.equal(
    commitmentStats(s, must(s.subscriptions[0], "subscription"), "subscription").monthly,
    2,
  );
  const before = JSON.stringify(s);
  assert.throws(
    () =>
      apply(
        s,
        "subscriptionPayment",
        {
          index: 0,
          method: "transaction",
          date: "2026-02-01",
          accountId: "missing",
          amount: 6,
        },
        must(s.subscriptions[0], "subscription").id,
      ),
    /payment account/,
  );
  assert.equal(JSON.stringify(s), before);
  const paused = apply(s, "pauseSubscription", {}, must(s.subscriptions[0], "subscription").id);
  assert.throws(
    () =>
      apply(
        paused,
        "subscriptionPayment",
        { index: 0, method: "manual", date: "2026-02-01" },
        must(s.subscriptions[0], "subscription").id,
      ),
    /Resume/,
  );
});
test("contact, tag, pin and reward metadata survive edits, filters and full backups", () => {
  const { apply, account, state } = setup();
  let s = apply(state, "payee", { name: "Local store", role: "payee" });
  const payee = must(s.payees[0], "payee").id;
  s = apply(s, "tag", { name: "Work", color: "#214b39" });
  const tag = must(s.tags[0], "tag").id;
  s = apply(s, "transaction", {
    name: "Coffee",
    accountId: account,
    amount: "1.001",
    type: "expense",
    category: "Food & drink",
    date: "2026-10-18",
    payeeId: payee,
    labels: "Work",
    location: "Manama",
    rewardPoints: "",
  });
  const id = must(s.transactions[0], "transaction").id;
  assert.equal(s.transactions[0]?.rewardPoints, 2.002);
  const balance = s.accounts[0]?.balance;
  s = apply(s, "pinTransaction", {}, id);
  assert.equal(s.accounts[0]?.balance, balance);
  s = apply(s, "tag", { name: "Business", color: "#23566d" }, tag);
  assert.deepEqual(s.transactions[0]?.labels, ["Business"]);
  assert.equal(
    filterTransactions(s, {
      query: "store manama",
      label: "Business",
      pinned: true,
    }).length,
    1,
  );
  assert.throws(() => apply(s, "deletePayee", {}, payee), /linked/);
  assert.throws(
    () => filterTransactions(s, { minimum: 10, maximum: 2 }),
    /amount range/,
  );
  const restored = parseBackup(backupText(s));
  assert.deepEqual(restored.transactions, s.transactions);
  assert.deepEqual(restored.payees, s.payees);
});
test("excluded accounts and default entry preferences do not alter recorded balances", () => {
  const { apply, state, account } = setup();
  let s = apply(state, "account", {
    name: "Separate savings",
    type: "Savings",
    balance: 3,
    currency: "BHD",
    includeInTotal: "no",
  });
  assert.equal(totalBalance(s), 10);
  assert.equal(s.accounts[1]?.balance, 3);
  s = apply(s, "defaultAccount", { accountId: account });
  assert.equal(s.settings.defaultAccountId, account);
});
