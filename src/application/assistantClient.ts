import { client } from "./client.ts";
import { field } from "../guards.ts";

export type AIRequestRecord = {
  requestId: string;
  status: string;
  credits: number;
};
/** What the financial-assistant function reports about available AI funding. */
export type AIOptions = {
  hosted: {
    configured: boolean;
    priceCredits: number | null;
    pricingVersion: string | null;
    purchasesEnabled: boolean;
  };
  byok: {
    configured: boolean;
    providers: string[];
    sessionOnly: boolean;
  };
  chatgpt: {
    signInConfigured: boolean;
    planConfigured: boolean;
    approvalRequired: boolean;
  };
  balance: number;
  recentRequests: AIRequestRecord[];
};
export const unavailableAI: AIOptions = {
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

/** Calls the financial-assistant function; the response is unchecked here. */
export async function assistantRequest(
  body: { action: string } & Record<string, unknown>,
): Promise<unknown> {
  if (!client) throw Error("Sign in before using cloud AI.");
  const { data, error } = await client.functions.invoke("financial-assistant", {
    body,
    timeout: body.action === "ask" ? 45000 : 12000,
  });
  if (error) {
    let detail: unknown;
    try {
      // The same call as error.context?.json(), on an error typed loosely by supabase-js.
      const context = field(error, "context"),
        json = field(context, "json");
      if (typeof json === "function") detail = await json.call(context);
    } catch {
      /* Sanitized fallback. */
    }
    throw Error(
      String(
        field(detail, "error") ||
          "The AI service is unavailable. No other funding option was used.",
      ),
    );
  }
  const result: unknown = data;
  return result;
}

export async function aiOptions(signedIn = false): Promise<AIOptions> {
  const options = await assistantRequest({
    action: signedIn ? "status" : "capabilities",
  });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: the status response comes from this project's own financial-assistant function and was always read without validation.
  return options as AIOptions;
}
