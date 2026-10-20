export function fundingRequest(body, options) {
  const mode = body.mode || "hosted";
  if (mode === "chatgpt")
    throw Object.assign(
      Error(
        "ChatGPT plan usage is awaiting OpenAI approval and connection setup. No paid fallback was used.",
      ),
      { status: 503 },
    );
  if (mode === "byok") {
    if (
      !["openai", "gateway"].includes(body.provider) ||
      typeof body.apiKey !== "string" ||
      body.apiKey.length < 20 ||
      body.apiKey.length > 512 ||
      /\s|[\x00-\x1f\x7f]/.test(body.apiKey) ||
      typeof body.model !== "string" ||
      !(
        body.provider === "gateway"
          ? /^[a-z0-9.-]+\/[a-z0-9._:-]{1,120}$/i
          : /^[a-z0-9._:-]{1,120}$/i
      ).test(body.model)
    )
      throw Object.assign(
        Error(
          "Choose a supported provider and enter its API key and model ID.",
        ),
        { status: 400 },
      );
    if (body.pricingConsent !== true)
      throw Object.assign(
        Error(
          "Accept your provider's API usage charges before sending a request.",
        ),
        { status: 400 },
      );
    return {
      mode,
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model,
    };
  }
  if (mode !== "hosted")
    throw Object.assign(Error("Choose an assistant funding option."), {
      status: 400,
    });
  if (!options.hosted.configured)
    throw Object.assign(
      Error(
        "Hosted AI pricing and service are not configured. Purchases are disabled. Use local insights or your own key.",
      ),
      { status: 503 },
    );
  if (
    body.pricingConsent !== true ||
    body.priceCredits !== options.hosted.priceCredits ||
    body.pricingVersion !== options.hosted.pricingVersion
  )
    throw Object.assign(
      Error(
        "Review the current hosted price and accept the credit charge before sending.",
      ),
      { status: 409 },
    );
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      body.requestId || "",
    )
  )
    throw Object.assign(Error("A unique request ID is required."), {
      status: 400,
    });
  return {
    mode,
    requestId: body.requestId,
    priceCredits: body.priceCredits,
    pricingVersion: body.pricingVersion,
  };
}
