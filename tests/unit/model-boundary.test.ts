import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultRates, normalizeWorkspace, validateWorkspace } from "../../src/domain/model.ts";
import type { CollectionKey } from "../../src/domain/types.ts";
import { must } from "../../src/guards.ts";

const collections: CollectionKey[] = [
  "accounts", "transactions", "budgets", "goals", "recurring", "debts", "projects",
  "warranties", "cycleBudgets", "templates", "payees", "tags", "subscriptions", "installments",
];

test("normalizeWorkspace fills every missing collection and the schema version", () => {
  const s = normalizeWorkspace({ currency: "BHD" });
  for (const key of collections) assert.deepEqual(s[key], [], key);
  assert.equal(s.schemaVersion, 2);
});

test("normalizeWorkspace merges stored settings over the defaults and pins BHD at 1", () => {
  const s = normalizeWorkspace({
    currency: "BHD",
    settings: { theme: "dark", rates: { USD: 0.5, BHD: 3 } },
  });
  assert.deepEqual(s.settings, {
    base: "BHD",
    language: "en",
    theme: "dark",
    motion: true,
    cycleStartDay: 1,
    categories: [],
    rates: { ...defaultRates, USD: 0.5, BHD: 1 },
  });
});

test("normalizeWorkspace defaults account, goal, cycle-budget and project fields", () => {
  const s = normalizeWorkspace({
    currency: "BHD",
    accounts: [{ id: "a" }, { id: "b", currency: "USD" }],
    goals: [{ id: "g" }],
    cycleBudgets: [
      { id: "c1", from: "2026-01-15", children: [{ id: "x", include: ["Food"] }] },
      { id: "c2", day: 7, include: [] },
      { id: "c3" },
    ],
    projects: [{ id: "p" }],
  });
  assert.deepEqual(s.accounts.map((a) => a.currency), ["BHD", "USD"]);
  assert.equal(must(s.goals[0], "goal").currency, "BHD");
  const [c1, c2, c3] = [0, 1, 2].map((i) => must(s.cycleBudgets[i], "cycle budget"));
  if (!c1 || !c2 || !c3) throw Error("expected three cycle budgets");
  const child = must(c1.children[0], "child budget");
  assert.equal(c1.day, 15);
  assert.deepEqual(
    [c1.include, c1.exclude, c1.categoryMode],
    [[], [], "all"],
  );
  assert.deepEqual(
    [child.include, child.exclude, child.categoryMode],
    [["Food"], [], "selected"],
  );
  assert.equal(c2.day, 7);
  assert.deepEqual(c2.children, []);
  assert.equal(c3.day, 1);
  assert.deepEqual(s.projects[0], {
    id: "p",
    categories: [],
    contracts: [],
    milestones: [],
    documents: [],
    reserve: 0,
    currency: "BHD",
  });
});

test("normalizeWorkspace rejects another currency with today's message", () => {
  assert.throws(() => normalizeWorkspace({ currency: "USD" }), {
    message:
      "This workspace uses another currency. Import it with explicit account currencies before opening it.",
  });
});

test("normalizeWorkspace leaves its input unmutated", () => {
  const input = { currency: "BHD", accounts: [{ id: "a" }], settings: { theme: "dark" } };
  const before = structuredClone(input);
  normalizeWorkspace(input);
  assert.deepEqual(input, before);
});

test("validateWorkspace rejects missing data with today's message", () => {
  assert.throws(() => validateWorkspace(null), { message: "Invalid backup. Nothing was changed." });
  assert.throws(() => validateWorkspace(undefined), {
    message: "Invalid backup. Nothing was changed.",
  });
});
