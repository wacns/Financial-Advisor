import test from "node:test";
import assert from "node:assert/strict";
import { parseTransactionText, captureURL } from "../../src/domain/capture.ts";
import {
  assistantSummary,
  captureAccount,
  localAnswer,
} from "../../src/domain/assistant.ts";
import { exchangeSnapshot } from "../../src/domain/currency-tools.ts";
import { blankState } from "../../src/finance.ts";
import { applyEntry } from "../../src/application/workspace.ts";
import {
  normalizeWorkspace,
  validateWorkspace,
  defaultRates,
} from "../../src/domain/model.ts";
import {
  assistantHandler,
  validateAssistantInput,
  validateAssistantOutput,
} from "../../supabase/functions/financial-assistant/handler.ts";
import { json, hasDuePayment } from "../../supabase/functions/_shared/push.ts";
import { commitmentDue } from "../../src/domain/commitments.ts";
import { calendarEntries } from "../../src/reports.ts";
import { basicBudgetStats } from "../../src/domain/reports.ts";
import type { EntryInput } from "../../src/application/workspace.ts";
import type { Budget, Subscription } from "../../src/domain/types.ts";
import { field, must } from "../../src/guards.ts";
import { partial } from "../support.ts";
const today = "2026-10-20";
test("budget daily allowance rounds down a fils and closes at the period boundary", () => {
  const s = normalizeWorkspace(blankState());
  const b = partial<Budget>({
    category: "Shopping",
    limit: 1,
    currency: "BHD",
    period: "Monthly",
  });
  const stats = basicBudgetStats(s, b, "2026-10", "2026-10-29");
  assert.equal(stats.daysLeft, 3);
  assert.equal(stats.dailyAllowance, 0.333);
  assert.equal(basicBudgetStats(s, b, "2026-10", "2026-11-01").daysLeft, 0);
});
test("category rename preserves appearance and updates subscription/installment references", () => {
  let i = 0;
  const apply = (s: unknown, kind: string, data: EntryInput, id?: string) =>
    applyEntry(s, kind, data, id, () => `category-test-${++i}`);
  let s = apply(blankState(), "account", {
    name: "Cash",
    type: "Cash",
    balance: 10,
    currency: "BHD",
  });
  const accountId = s.accounts[0]?.id;
  s = apply(s, "category", {
    name: "Cloud services",
    parent: "",
    color: "#23566d",
    icon: "◆",
  });
  s = apply(s, "subscription", {
    name: "Cloud",
    amount: 1,
    accountId,
    category: "Cloud services",
    firstDue: "2026-10-20",
    frequency: "monthly",
    interval: 1,
  });
  assert.throws(
    () => apply(s, "deleteCategory", {}, "Cloud services"),
    /unused/,
  );
  s = apply(
    s,
    "category",
    { name: "Digital services", parent: "", color: "#694568", icon: "◆" },
    "Cloud services",
  );
  assert.equal(s.subscriptions[0]?.category, "Digital services");
  assert.deepEqual(s.settings.categoryStyles, [
    { path: "Digital services", color: "#694568", icon: "◆" },
  ]);
});
test("text capture isolates the purchase from balances and leaves ambiguous amounts/dates for review", () => {
  const [row] = parseTransactionText(
    "Purchase BHD 1.001 at Pearl Cafe on 2026-10-19. Available balance BHD 900.000",
    { today },
  );
  assert.equal(row?.draft.amount, "1.001");
  assert.equal(row?.draft.name, "Pearl Cafe");
  assert.equal(row?.draft.date, "2026-10-19");
  assert.match(String(row?.draft.captureFingerprint), /^text-[a-f0-9]{32}$/);
  for (const message of ["Paid BHD 4 and BHD 5", "coffee", "BHD 1.0001"])
    assert.equal(parseTransactionText(message, { today })[0]?.draft.amount, "");
  assert.equal(
    parseTransactionText("دفعت ٤٫٢٥٠ دينار أمس", { today })[0]?.draft.amount,
    "4.25",
  );
  assert.equal(
    parseTransactionText("Paid BHD 2 yesterday", { today })[0]?.draft.date,
    "2026-10-19",
  );
  assert.equal(
    parseTransactionText("Paid BHD 2 on 03/04/2026", { today })[0]?.draft.date,
    "",
  );
  assert.equal(
    parseTransactionText("Received USD 3.500 from Employer", { today })[0]?.draft
      .type,
    "income",
  );
  assert.throws(() => parseTransactionText("x\n".repeat(26)), /25 messages/);
});
test("capture links are strict and duplicate message replay never changes a balance", () => {
  for (const url of [
    "https://evil.example/capture?amount=2",
    "com.wacns.financialadvisor://capture/extra?amount=2",
    "com.wacns.financialadvisor://capture?amount=-1",
    "com.wacns.financialadvisor://capture?amount=1.0001",
    "com.wacns.financialadvisor://capture?amount=2&currency=XYZ",
  ])
    assert.equal(captureURL(url), null);
  assert.equal(
    captureURL("com.wacns.financialadvisor://capture?amount=0.001&name=Tea")
      ?.draft?.amount,
    "0.001",
  );
  let s = applyEntry(
    blankState(),
    "account",
    { name: "Cash", type: "Cash", currency: "BHD", balance: 5 },
    null,
    () => "cash",
  );
  const draft = must(parseTransactionText("Paid BHD 1.001 at Shop", { today })[0], "parsed message")
    .draft;
  const recorded = applyEntry(
    s,
    "transaction",
    { ...draft, accountId: "cash" },
    null,
    () => "captured",
  );
  assert.equal(recorded.accounts[0]?.balance, 3.999);
  assert.throws(
    () =>
      applyEntry(
        recorded,
        "transaction",
        { ...draft, accountId: "cash" },
        null,
        () => "replayed",
      ),
    /already recorded/,
  );
  assert.equal(recorded.accounts[0]?.balance, 3.999);
  assert.equal(recorded.transactions.length, 1);
  assert.equal(captureAccount(recorded, "USD"), undefined);
});
test("assistant summary is aggregate only and cloud input strips extra fields", () => {
  const s = normalizeWorkspace(blankState());
  const summary = assistantSummary(s, "2026-10");
  assert.equal(summary.currency, "BHD");
  assert.equal(summary.expenses, 0);
  assert.equal(field(summary, "accounts"), undefined);
  assert.equal(field(summary, "transactions"), undefined);
  assert.match(localAnswer(s, "How much did I spend?", "2026-10"), /0\.000/);
  const clean = validateAssistantInput({
    consent: true,
    question: " totals ",
    summary: { ...summary, transactions: ["private"], owner: "forged" },
  });
  assert.equal(field(clean.summary, "transactions"), undefined);
  assert.equal(field(clean.summary, "owner"), undefined);
  assert.throws(
    () => validateAssistantInput({ consent: false, question: "Hi" }),
    /Allow cloud/,
  );
  assert.throws(
    () =>
      validateAssistantOutput({
        answer: "Saved!",
        drafts: [
          {
            name: "Tea",
            amount: "-1",
            currency: "BHD",
            date: today,
            type: "expense",
            category: "Food",
          },
        ],
      }),
    /Invalid/,
  );
});
test("cloud handler enforces authentication, consent, configuration, quota and response validation before returning suggestions", async () => {
  let authenticated = false,
    enabled = false,
    allowed = true,
    calls = 0,
    quotas = 0,
    bad = false;
  const handler = assistantHandler({
    json,
    authenticate: async () => (authenticated ? { id: "a" } : null),
    capabilities: () => ({ hosted: { configured: enabled, priceCredits: 2, pricingVersion: "test-v1" } }),
    balance: async () => ({ balance: 10 }),
    reserve: async () => ({ status: "reserved", balance: 8 }),
    settle: async (_user, _funding, action) => ({ status: action === "complete" ? "completed" : "refunded", balance: 8 }),
    quota: async () => {
      quotas++;
      return allowed;
    },
    generate: async () => {
      calls++;
      return { output: bad
        ? { answer: "Bad", drafts: [{ ownerId: "forged" }] }
        : { answer: "Review this in the app.", drafts: [] } };
    },
  });
  const request = (body: object) =>
    new Request("https://example.test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://financial-advisor-partner.vercel.app",
      },
      body: JSON.stringify({ mode: "hosted", pricingConsent: true, priceCredits: 2, pricingVersion: "test-v1", requestId: "22222222-2222-4222-8222-222222222222", ...body }),
    });
  assert.equal(
    (await handler(request({ consent: true, question: "Hi" }))).status,
    401,
  );
  authenticated = true;
  assert.equal((await handler(request({ question: "Hi" }))).status, 400);
  const disabled = await handler(request({ consent: true, question: "Hi" }));
  assert.equal(disabled.status, 503);
  assert.equal(field(await disabled.json(), "configured"), false);
  assert.equal(quotas, 0);
  assert.equal(calls, 0);
  enabled = true;
  allowed = false;
  assert.equal(
    (await handler(request({ consent: true, question: "Hi" }))).status,
    429,
  );
  assert.equal(calls, 0);
  allowed = true;
  const result = await handler(request({ consent: true, question: "Hi" }));
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  bad = true;
  assert.equal(
    (await handler(request({ consent: true, question: "Hi" }))).status,
    503,
  );
});
test("currency quotes require a valid provider/date and malformed imported history is rejected", () => {
  const payload = {
    result: "success",
    base_code: "BHD",
    time_last_update_unix: Date.parse(`${today}T00:00:00Z`) / 1000,
    rates: Object.fromEntries(
      Object.entries(defaultRates).map(([code, rate]) => [code, 1 / rate]),
    ),
  };
  const snapshot = exchangeSnapshot(payload);
  const s = applyEntry(blankState(), "refreshRates", snapshot);
  assert.equal(s.settings.rates.BHD, 1);
  assert.equal(s.settings.rateHistory?.length, 1);
  assert.throws(() =>
    exchangeSnapshot({ ...payload, base_code: "USD" }),
  );
  assert.throws(
    () =>
      validateWorkspace({
        ...s,
        settings: {
          ...s.settings,
          rateHistory: [
            {
              asOf: today,
              source: "ExchangeRate-API",
              savedAt: new Date().toISOString(),
              rates: { BHD: 1 },
            },
          ],
        },
      }),
    /quote history/,
  );
});
test("commitments appear in the central calendar and reminders follow month-end schedules and paid gaps", () => {
  const s = normalizeWorkspace(blankState());
  const plan = partial<Subscription>({
    id: "sub",
    name: "Storage",
    amount: 2,
    currency: "BHD",
    firstDue: "2026-01-31",
    frequency: "monthly",
    interval: 1,
    status: "active",
    payments: [
      { index: 0, date: "2026-01-31", amount: 2 },
      { index: 2, date: "2026-03-31", amount: 2 },
    ],
  });
  s.subscriptions = [plan];
  assert.equal(hasDuePayment(s, "2026-02-27"), false);
  assert.equal(hasDuePayment(s, "2026-02-28"), true);
  const entries = calendarEntries(s, "2026-02");
  assert.equal(entries[0]?.kind, "subscription");
  assert.equal(entries[0]?.actionable, true);
  for (const frequency of ["daily", "weekly", "monthly", "yearly"] as const)
    for (const interval of [1, 3, 6]) {
      const p = partial<Subscription>({ ...plan, frequency, interval, payments: [{ index: 0 }] });
      s.subscriptions = [p];
      const due = commitmentDue(p, 1);
      assert.equal(hasDuePayment(s, due), true);
      assert.equal(
        hasDuePayment(
          s,
          new Date(Date.parse(`${due}T12:00:00Z`) - 86400000)
            .toISOString()
            .slice(0, 10),
        ),
        false,
      );
    }
});
