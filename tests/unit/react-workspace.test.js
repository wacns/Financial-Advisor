import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyEntry,
  togglePlan,
  transactionCSV,
} from "../../src/application/workspace.ts";
import { entryForm } from "../../src/application/forms.ts";
import { blankState } from "../../src/finance.ts";
import { createSecureStorage } from "../../src/platform/secure-storage.ts";
const fixture = () => ({
  ...blankState(),
  accounts: [
    { id: "a", name: "Current", balance: 100 },
    { id: "b", name: "Savings", balance: 50 },
  ],
});

test("shared entry commands preserve the original workspace and a single fils across transfers and failures", () => {
  const state = fixture();
  const data = {
    accountId: "a",
    toAccountId: "b",
    amount: "0.001",
    date: "2026-10-18",
    name: "Transfer",
  };
  const next = applyEntry(state, "transfer", data, null, () => "transfer");
  assert.deepEqual(
    next.accounts.map((a) => a.balance),
    [99.999, 50.001],
  );
  assert.deepEqual(
    state.accounts.map((a) => a.balance),
    [100, 50],
  );
  assert.throws(
    () => applyEntry(state, "transfer", { ...data, toAccountId: "a" }),
    /different accounts/,
  );
  assert.equal(state.transactions.length, 0);
  for (const [kind, data] of [
    ["account", { name: "Bad", balance: "1.0001" }],
    ["budget", { category: "Food & drink", limit: "0" }],
    ["goal", { name: "Bad", target: "100", saved: "-1" }],
  ])
    assert.throws(() => applyEntry(state, kind, data));
});
test("all entry types share form defaults and recording captures a schedule occurrence before edits", () => {
  const state = fixture();
  state.recurring = [
    {
      id: "bill",
      name: "Bill",
      amount: 2,
      accountId: "a",
      nextDue: "2026-10-20",
      frequency: "monthly",
      type: "expense",
      category: "Utilities",
      anchorDay: 20,
    },
  ];
  const form = entryForm("record", "bill", state);
  state.recurring[0].nextDue = "2026-11-20";
  assert.throws(
    () => applyEntry(state, "record", form.values, "bill"),
    /schedule changed/,
  );
  assert.equal(state.accounts[0].balance, 100);
  assert.equal(entryForm("transfer", null, state).values.toAccountId, "b");
  assert.throws(
    () => entryForm("transfer", null, blankState()),
    /two accounts/,
  );
  assert.equal(togglePlan(state, "pause", "bill").recurring[0].paused, true);
  assert.equal(state.recurring[0].paused, undefined);
});
test("CSV exports account destinations, precise amounts and neutralizes spreadsheet formulas", () => {
  const state = fixture();
  const csv = transactionCSV(state, [
    {
      date: "2026-10-18",
      name: "=SECRET()",
      type: "transfer",
      category: "Transfer",
      amount: 0.001,
      accountId: "a",
      toAccountId: "b",
    },
  ]);
  assert.match(csv, /"'=SECRET\(\)"/);
  assert.match(csv, /"0.001","BHD","Current","Savings"/);
});
function memoryStore() {
  const values = new Map();
  let failure = "";
  return {
    values,
    set failure(key) {
      failure = key;
    },
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      if (key.includes(failure) && failure) throw Error("Keychain unavailable");
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      values.delete(key);
    },
  };
}
test("native auth storage splits large sessions, replaces them atomically and removes all credential chunks", async () => {
  const store = memoryStore();
  let index = 0;
  const storage = createSecureStorage(store, () => String(++index));
  const value = "session-البحرين-🌴".repeat(1300);
  await storage.setItem("sb-project-auth-token", value);
  assert.equal(await storage.getItem("sb-project-auth-token"), value);
  for (const chunk of store.values.values())
    assert.ok(Buffer.byteLength(chunk, "utf8") <= 1800);
  store.failure = ".2.1";
  await assert.rejects(
    () => storage.setItem("sb-project-auth-token", "replacement".repeat(500)),
    /Keychain/,
  );
  assert.equal(await storage.getItem("sb-project-auth-token"), value);
  store.failure = "";
  await storage.setItem("sb-project-auth-token", "new-session");
  assert.equal(await storage.getItem("sb-project-auth-token"), "new-session");
  assert.equal(store.values.size, 2);
  await storage.removeItem("sb-project-auth-token");
  assert.equal(store.values.size, 0);
});
