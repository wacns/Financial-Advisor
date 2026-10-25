import { field, isOneOf, matches } from "../_shared/guards.ts";
/** The price the hosted assistant currently charges, as capabilities() reports it. */
export type HostedOptions = {
  hosted: { configured: boolean; priceCredits: unknown; pricingVersion: unknown };
};
export type Funding =
  | { mode: "byok"; provider: "openai" | "gateway"; apiKey: string; model: string }
  | { mode: "hosted"; requestId: string; priceCredits: unknown; pricingVersion: unknown };
const fail = (message: string, status: number) =>
  Object.assign(Error(message), { status });
const isRequestId = matches(
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
);
export function fundingRequest(body: unknown, options: HostedOptions): Funding {
  const mode = field(body, "mode") || "hosted";
  if (mode === "chatgpt")
    throw fail(
      "ChatGPT plan usage is awaiting OpenAI approval and connection setup. No paid fallback was used.",
      503,
    );
  if (mode === "byok") {
    const provider = field(body, "provider"),
      apiKey = field(body, "apiKey"),
      model = field(body, "model");
    if (
      !isOneOf(["openai", "gateway"], provider) ||
      typeof apiKey !== "string" ||
      apiKey.length < 20 ||
      apiKey.length > 512 ||
      /\s|[\x00-\x1f\x7f]/.test(apiKey) ||
      typeof model !== "string" ||
      !(
        provider === "gateway"
          ? /^[a-z0-9.-]+\/[a-z0-9._:-]{1,120}$/i
          : /^[a-z0-9._:-]{1,120}$/i
      ).test(model)
    )
      throw fail(
        "Choose a supported provider and enter its API key and model ID.",
        400,
      );
    if (field(body, "pricingConsent") !== true)
      throw fail(
        "Accept your provider's API usage charges before sending a request.",
        400,
      );
    return {
      mode,
      provider,
      apiKey,
      model,
    };
  }
  if (mode !== "hosted")
    throw fail("Choose an assistant funding option.", 400);
  if (!options.hosted.configured)
    throw fail(
      "Hosted AI pricing and service are not configured. Purchases are disabled. Use local insights or your own key.",
      503,
    );
  if (
    field(body, "pricingConsent") !== true ||
    field(body, "priceCredits") !== options.hosted.priceCredits ||
    field(body, "pricingVersion") !== options.hosted.pricingVersion
  )
    throw fail(
      "Review the current hosted price and accept the credit charge before sending.",
      409,
    );
  // An empty id fails the pattern, so the value returned below is the checked one.
  const requestId = field(body, "requestId") || "";
  if (!isRequestId(requestId))
    throw fail("A unique request ID is required.", 400);
  return {
    mode,
    requestId,
    priceCredits: field(body, "priceCredits"),
    pricingVersion: field(body, "pricingVersion"),
  };
}
