import test from "node:test";
import assert from "node:assert/strict";
import { assistantHandler } from "../../supabase/functions/financial-assistant/handler.js";
import { fundingRequest } from "../../supabase/functions/financial-assistant/funding.js";
import { json } from "../../supabase/functions/_shared/push.js";
import { startChatGPTSignIn, NATIVE_AUTH_REDIRECT } from "../../src/auth.ts";

const id = "60000000-0000-4000-8000-000000000001";
const capabilities = {
  hosted: {
    configured: true,
    priceCredits: 3,
    pricingVersion: "price-1",
    purchasesEnabled: false,
  },
  byok: { configured: true },
  chatgpt: { signInConfigured: false, planConfigured: false },
};
const paid = {
  consent: true,
  pricingConsent: true,
  mode: "hosted",
  priceCredits: 3,
  pricingVersion: "price-1",
  requestId: id,
  question: "Explain spending",
};
const request = (body) =>
  new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("funding validates prices, request identity and key/model boundaries without fallback", () => {
  for (const body of [
    { ...paid, priceCredits: 1 },
    { ...paid, pricingConsent: false },
    { ...paid, pricingVersion: "old" },
    { ...paid, requestId: "not-uuid" },
    { ...paid, mode: "other" },
  ])
    assert.throws(() => fundingRequest(body, capabilities));
  assert.throws(
    () => fundingRequest({ ...paid, mode: "chatgpt" }, capabilities),
    /approval/,
  );
  const own = {
    mode: "byok",
    provider: "openai",
    apiKey: "sk-session-example-only-000000",
    model: "account-model",
    pricingConsent: true,
  };
  assert.equal(fundingRequest(own, capabilities).provider, "openai");
  for (const change of [
    { provider: "custom" },
    { model: "https://attacker.test" },
    { apiKey: "bad\r\nkey" },
    { model: "" },
    { pricingConsent: false },
  ])
    assert.throws(() => fundingRequest({ ...own, ...change }, capabilities));
});

function harness(overrides = {}) {
  const calls = { provider: 0, reserve: 0, settle: [], inputs: [], quota: 0 };
  const deps = {
    json,
    capabilities: () => capabilities,
    authenticate: async () => ({ id: "real-user" }),
    balance: async () => ({ balance: 12, recentRequests: [] }),
    quota: async () => {
      calls.quota++;
      return true;
    },
    reserve: async (user) => {
      assert.equal(user.id, "real-user");
      calls.reserve++;
      return { status: "reserved", balance: 9 };
    },
    settle: async (_, funding, action) => {
      calls.settle.push(action);
      return {
        status: action === "complete" ? "completed" : "refunded",
        balance: 9,
      };
    },
    generate: async (input) => {
      calls.provider++;
      calls.inputs.push(input);
      return {
        output: { answer: "For review only", drafts: [] },
        usage: { inputTokens: 4, outputTokens: 5 },
      };
    },
    ...overrides,
  };
  return { handler: assistantHandler(deps), calls };
}
test("public capabilities reveal no credit balance and authenticated status never invokes inference", async () => {
  const { handler, calls } = harness({ authenticate: async () => null });
  const response = await handler(
    request({ action: "capabilities", userId: "victim" }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).balance, undefined);
  assert.equal((await handler(request({ action: "status" }))).status, 401);
  const signed = harness();
  assert.equal(
    (await (await signed.handler(request({ action: "status" }))).json())
      .balance,
    12,
  );
  assert.equal(calls.provider + signed.calls.provider + signed.calls.quota, 0);
});
test("hosted requests reserve and settle once, using authenticated ownership and a stripped model input", async () => {
  const { handler, calls } = harness();
  const response = await handler(
    request({
      ...paid,
      userId: "forged",
      apiKey: "do-not-forward",
      hidden: "private",
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).funding, {
    mode: "hosted",
    chargedCredits: 3,
    balance: 9,
  });
  assert.equal(calls.reserve, 1);
  assert.deepEqual(calls.settle, ["complete"]);
  assert.deepEqual(calls.inputs, [{ question: paid.question }]);
});
test("insufficient funds, reused request IDs, stale prices and quotas prevent paid inference", async () => {
  for (const [override, body, status] of [
    [{ reserve: async () => ({ insufficient: true, balance: 0 }) }, paid, 402],
    [
      { reserve: async () => ({ duplicate: true, status: "completed" }) },
      paid,
      409,
    ],
    [{}, { ...paid, priceCredits: 0 }, 409],
    [{ quota: async () => false }, paid, 429],
  ]) {
    const { handler, calls } = harness(override);
    assert.equal((await handler(request(body))).status, status);
    assert.equal(calls.provider, 0);
    assert.deepEqual(calls.settle, []);
  }
});
test("invalid/failed inference refunds reserved credits and never tries a different provider", async () => {
  for (const generate of [
    async () => {
      throw Error("provider detail must not leak");
    },
    async () => ({ output: { answer: "bad", drafts: [{ key: "private" }] } }),
  ]) {
    const { handler, calls } = harness({ generate });
    const response = await handler(request(paid));
    assert.equal(response.status, 503);
    assert.deepEqual(calls.settle, ["refund"]);
    assert.doesNotMatch(await response.text(), /provider detail|private/);
  }
});
test("BYOK uses no hosted credits and credentials are excluded from prompts and responses", async () => {
  const { handler, calls } = harness();
  const response = await handler(
    request({
      consent: true,
      question: "Hi",
      mode: "byok",
      provider: "openai",
      model: "account-model",
      apiKey: "sk-session-example-only-000000",
      pricingConsent: true,
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls.reserve, 0);
  assert.deepEqual(calls.settle, []);
  assert.deepEqual(calls.inputs, [{ question: "Hi" }]);
  assert.doesNotMatch(await response.text(), /sk-session|apiKey/);
});
test("ChatGPT identity foundation is gated, uses identity-only scopes and supports explicit linking", async () => {
  let value, opened, linked;
  const client = {
    auth: {
      signInWithOAuth: async (input) => {
        value = input;
        return {
          data: { url: "https://example.supabase.co/auth/v1/authorize" },
        };
      },
      linkIdentity: async (input) => {
        linked = input;
        return {
          data: { url: "https://example.supabase.co/auth/v1/authorize" },
        };
      },
    },
  };
  await assert.rejects(
    () => startChatGPTSignIn(client, null, null, false),
    /approval/,
  );
  await startChatGPTSignIn(
    client,
    null,
    {
      open: async (url) => {
        opened = url;
      },
    },
    true,
  );
  assert.equal(value.provider, "custom:chatgpt");
  assert.equal(value.options.redirectTo, NATIVE_AUTH_REDIRECT);
  assert.equal(value.options.scopes, "openid profile email");
  assert.equal(opened, "https://example.supabase.co/auth/v1/authorize");
  await startChatGPTSignIn(
    client,
    new URL("https://app.test"),
    null,
    true,
    true,
  );
  assert.equal(linked.provider, "custom:chatgpt");
});
