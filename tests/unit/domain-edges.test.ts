import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkspace } from "../../src/domain/model.ts";
import { saveTransaction, deleteTransaction } from "../../src/domain/ledger.ts";
import { featureCommand } from "../../src/domain/commands.ts";
import { importCSV, parseBackup } from "../../src/domain/imports.ts";

const base = () =>
  normalizeWorkspace({
    currency: "BHD",
    accounts: [
      { id: "a", name: "Current", type: "Current account", balance: 100 },
      { id: "b", name: "Savings", type: "Savings", balance: 50 },
    ],
    transactions: [
      {
        id: "t1",
        name: "Lunch",
        category: "Food",
        amount: 5,
        date: "2026-01-02",
        type: "expense",
        accountId: "a",
        debtId: "gone",
        principal: 5,
      },
    ],
  });
const entry = {
  type: "expense",
  amount: "5",
  date: "2026-01-01",
  name: "x",
  category: "Food",
} as const;
const balances = (s: ReturnType<typeof base>) => s.accounts.map((a) => a.balance);

test("saving against a missing account fails without touching balances", () => {
  const s = base();
  assert.throws(() => saveTransaction(s, { ...entry, accountId: "zz" }, undefined, () => "n"), {
    message: "Choose an existing account.",
  });
  assert.deepEqual(balances(s), [100, 50]);
});

test("a transfer to a missing account fails after debiting the source, as today", () => {
  const s = base();
  assert.throws(
    () =>
      saveTransaction(
        s,
        { ...entry, type: "transfer", category: "Transfer", accountId: "a", toAccountId: "zz" },
        undefined,
        () => "n",
      ),
    { message: "Choose different accounts for your transfer." },
  );
  assert.deepEqual(balances(s), [95, 50]);
});

test("deleting a missing transaction reports it", () => {
  assert.throws(() => deleteTransaction(base(), "nope"), { message: "Transaction not found." });
});

test("deleting a repayment whose debt is gone still reverses the entry", () => {
  const s = base();
  deleteTransaction(s, "t1");
  assert.deepEqual(balances(s), [105, 50]);
  assert.equal(s.transactions.length, 0);
});

test("commands against missing records fail and leave the input workspace unchanged", () => {
  const input = base();
  const before = JSON.stringify(input);
  assert.throws(() => featureCommand(input, "deleteTransaction", {}, "nope"), {
    message: "Transaction not found.",
  });
  assert.throws(
    () =>
      featureCommand(input, "editTransaction", { ...entry, accountId: "a", projectId: "gone" }, undefined, () => "n"),
    { message: "Choose an active project." },
  );
  assert.throws(
    () =>
      featureCommand(
        input,
        "editTransaction",
        { ...entry, type: "transfer", category: "Transfer", accountId: "a", toAccountId: "zz" },
        undefined,
        () => "n",
      ),
    { message: "Choose different accounts for your transfer." },
  );
  assert.equal(JSON.stringify(input), before);
});

test("malformed CSV imports fail with today's messages and change nothing", () => {
  const input = base();
  const before = JSON.stringify(input);
  const columns = { message: "CSV requires date,type,amount columns; category,name/note,time are optional." };
  const cases: [string, { message: string }][] = [
    ["date,type,name\n2026-01-01,expense,x", columns],
    ["", columns],
    ["date,type,amount\n2026-13-01,expense,4", { message: "Choose a valid date." }],
    ["date,type,amount\n2026-01-01,expense", { message: "A CSV row has the wrong number of columns." }],
    ["date,type,amount\n2026-01-01,expense,abc", { message: "Enter an amount with no more than three decimal places." }],
    ["date,type,amount\n2026-01-01,expense,4\n2026-01-02,expense,", { message: "Amount must be greater than zero." }],
  ];
  for (const [csv, error] of cases) assert.throws(() => importCSV(input, csv, "a", () => "u"), error, csv);
  assert.equal(JSON.stringify(input), before);
});

test("backups are checked with today's messages", () => {
  const backup = (data: unknown, extra = {}) =>
    JSON.stringify({ format: "financial-advisor-partner", version: 2, data, ...extra });
  assert.deepEqual(parseBackup(backup({ currency: "BHD", accounts: [] })).transactions, []);
  assert.throws(() => parseBackup("{"), SyntaxError);
  assert.throws(() => parseBackup(JSON.stringify({ format: "other", data: {} })), {
    message: "Unsupported backup format.",
  });
  assert.throws(
    () =>
      parseBackup(
        backup({
          currency: "BHD",
          accounts: [],
          transactions: [
            { id: "x", name: "n", category: "c", amount: 1, date: "2026-01-01", type: "expense", accountId: "nope" },
          ],
        }),
      ),
    { message: "Invalid transaction account/type." },
  );
});
