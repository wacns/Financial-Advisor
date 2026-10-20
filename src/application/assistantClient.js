import { client } from "./client.js";

export const unavailableAI = {
  hosted: {
    configured: false,
    priceCredits: null,
    pricingVersion: null,
    purchasesEnabled: false,
  },
  byok: {
    configured: false,
    providers: ["openai", "gateway"],
    sessionOnly: true,
  },
  chatgpt: {
    signInConfigured: false,
    planConfigured: false,
    approvalRequired: true,
  },
  balance: 0,
  recentRequests: [],
};

export async function assistantRequest(body) {
  if (!client) throw Error("Sign in before using cloud AI.");
  const { data, error } = await client.functions.invoke("financial-assistant", {
    body,
    timeout: body.action === "ask" ? 45000 : 12000,
  });
  if (error) {
    let detail;
    try {
      detail = await error.context?.json();
    } catch {
      /* Sanitized fallback. */
    }
    throw Error(
      detail?.error ||
        "The AI service is unavailable. No other funding option was used.",
    );
  }
  return data;
}

export async function aiOptions(signedIn = false) {
  return assistantRequest({ action: signedIn ? "status" : "capabilities" });
}
