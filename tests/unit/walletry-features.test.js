import test from "node:test";
import assert from "node:assert/strict";
import { applyEntry } from "../../src/application/workspace.js";
import { blankState, totalBalance } from "../../src/finance.js";
import { normalizeWorkspace } from "../../src/domain/model.js";
import {
  commitmentStats,
  commitmentDue,
  commitmentCalendar,
} from "../../src/domain/commitments.js";
import { filterTransactions } from "../../src/domain/organizing.js";
import { backupText, parseBackup } from "../../src/domain/imports.js";
const setup = () => {
  let i = 0;
  const apply = (s, kind, data = {}, id) =>
    applyEntry(s, kind, data, id, () => `feature-${++i}`);
  let state = apply(blankState(), "account", {
    name: "Cash",
    type: "Cash",
    balance: 10,
    currency: "BHD",
    rewardRate: 2,
  });
  return { state, apply, account: state.accounts[0].id };
};
test("old workspaces normalize new feature collections without posting records", () => {
  const old = blankState(),
    s = normalizeWorkspace(old);
  for (const key of ["payees", "tags", "subscriptions", "installments"])
    assert.deepEqual(s[key], []);
  assert.deepEqual(s.transactions, old.transactions);
  assert.deepEqual(s.accounts, old.accounts);
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
  const id = s.installments[0].id;
  assert.equal(commitmentDue(s.installments[0], 1), "2026-02-28");
  assert.equal(commitmentDue(s.installments[0], 2), "2026-03-31");
  s = apply(
    s,
    "installmentPayment",
    { index: 0, method: "manual", date: "2026-01-31" },
    id,
  );
  assert.equal(s.accounts[0].balance, 10);
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
  const transaction = s.transactions[0].id;
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
  assert.equal(s.accounts[0].balance, 9.996);
  assert.equal(
    commitmentStats(s, s.installments[0], "installment").remaining,
    0,
  );
  s = apply(s, "deleteTransaction", {}, transaction);
  assert.equal(s.accounts[0].balance, 9.997);
  assert.equal(commitmentStats(s, s.installments[0], "installment").index, 1);
  assert.equal(
    commitmentStats(s, s.installments[0], "installment").remaining,
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
  assert.equal(commitmentDue(s.subscriptions[0], 1), "2026-04-30");
  assert.equal(commitmentDue(s.subscriptions[0], 2), "2026-07-31");
  assert.equal(
    commitmentStats(s, s.subscriptions[0], "subscription").monthly,
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
        s.subscriptions[0].id,
      ),
    /payment account/,
  );
  assert.equal(JSON.stringify(s), before);
  const paused = apply(s, "pauseSubscription", {}, s.subscriptions[0].id);
  assert.throws(
    () =>
      apply(
        paused,
        "subscriptionPayment",
        { index: 0, method: "manual", date: "2026-02-01" },
        s.subscriptions[0].id,
      ),
    /Resume/,
  );
});
test("contact, tag, pin and reward metadata survive edits, filters and full backups", () => {
  const { apply, account, state } = setup();
  let s = apply(state, "payee", { name: "Local store", role: "payee" });
  const payee = s.payees[0].id;
  s = apply(s, "tag", { name: "Work", color: "#214b39" });
  const tag = s.tags[0].id;
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
  const id = s.transactions[0].id;
  assert.equal(s.transactions[0].rewardPoints, 2.002);
  const balance = s.accounts[0].balance;
  s = apply(s, "pinTransaction", {}, id);
  assert.equal(s.accounts[0].balance, balance);
  s = apply(s, "tag", { name: "Business", color: "#23566d" }, tag);
  assert.deepEqual(s.transactions[0].labels, ["Business"]);
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
  assert.equal(s.accounts[1].balance, 3);
  s = apply(s, "defaultAccount", { accountId: account });
  assert.equal(s.settings.defaultAccountId, account);
});
