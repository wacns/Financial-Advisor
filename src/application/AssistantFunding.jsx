import React from "react";
import { Linking } from "react-native";
import { Button, Label, Muted, NavLink, Stack } from "./ui.jsx";
import Field from "./Field";
const openLink = (url) => Linking.openURL(url).catch(() => {});

export default function AssistantFunding({
  mode,
  options,
  provider,
  setProvider,
  apiKey,
  setApiKey,
  model,
  setModel,
  pricingConsent,
  setPricingConsent,
  busy,
  refresh,
  statusError,
  linkIdentity,
}) {
  if (mode === "local") return null;
  return (
    <Stack>
      {statusError ? (
        <Label accessibilityRole="alert">{statusError}</Label>
      ) : null}
      {mode === "chatgpt" ? (
        <>
          <Muted>
            ChatGPT sign-in and permission to use a subscription are separate.
            The subscription connection is awaiting OpenAI approval and setup.
            Your plan limits would apply; hosted credits and API keys are not
            used as a fallback.
          </Muted>
          <Button
            secondary
            disabled={busy || !options.chatgpt.signInConfigured}
            onPress={linkIdentity}
          >
            Continue with ChatGPT
          </Button>
          <NavLink
            href="https://developers.openai.com/siwc/quickstart"
            onPress={() =>
              openLink("https://developers.openai.com/siwc/quickstart")
            }
          >
            <Label>About ChatGPT plan usage ↗</Label>
          </NavLink>
        </>
      ) : null}
      {mode === "hosted" ? (
        <>
          <Label>Prepaid AI credits: {options.balance ?? 0}</Label>
          <Muted>
            {options.hosted.configured
              ? `Each successfully completed question costs ${options.hosted.priceCredits} credits (price ${options.hosted.pricingVersion}). Credits are reserved before processing; failed requests are refunded when possible. Check recent requests if a response is interrupted.`
              : "Hosted AI is awaiting pricing and service setup. No credit price has been chosen and purchases are disabled."}
          </Muted>
          <Muted>
            Hosted credits pay for FinancialAdvisor's API service. They are
            separate from your financial accounts, ChatGPT subscription and
            provider API balance. Credit purchases are not available yet.
          </Muted>
          <Button secondary disabled={busy} onPress={refresh}>
            Refresh AI balance
          </Button>
          {(options.recentRequests || []).slice(0, 5).map((request) => (
            <Muted key={request.requestId}>
              {request.status} · {request.credits} credits ·{" "}
              {request.requestId.slice(0, 8)}
            </Muted>
          ))}
        </>
      ) : null}
      {mode === "byok" ? (
        <>
          <Field
            label="Your AI provider"
            type="select"
            value={provider}
            disabled={busy}
            onChange={(value) => {
              setProvider(value);
              setApiKey("");
              setModel("");
              setPricingConsent("no");
            }}
            options={[
              { value: "openai", label: "OpenAI API" },
              { value: "gateway", label: "Vercel AI Gateway" },
            ]}
          />
          <Field
            label="Your API key (this session only)"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={setApiKey}
            disabled={busy}
          />
          <Field
            label="Your model ID"
            value={model}
            onChange={setModel}
            disabled={busy}
          />
          <Muted>
            {provider === "openai"
              ? "Use an exact Responses API model ID available to your OpenAI API account."
              : "Use a provider/model ID available to your Gateway account."}{" "}
            Your provider bills your API account at its own rates. A ChatGPT
            subscription does not cover ordinary API-key requests.
            FinancialAdvisor credits are not charged.
          </Muted>
          <Muted>
            The key is held only in this screen's memory, sent over HTTPS to the
            assistant function and your selected provider, and cleared when you
            leave or change funding options. It is not saved in browser storage,
            financial records or backups.
          </Muted>
          <NavLink
            href={
              provider === "openai"
                ? "https://openai.com/api/pricing/"
                : "https://vercel.com/ai-gateway/models"
            }
            onPress={() =>
              openLink(
                provider === "openai"
                  ? "https://openai.com/api/pricing/"
                  : "https://vercel.com/ai-gateway/models",
              )
            }
          >
            <Label>Check provider pricing ↗</Label>
          </NavLink>
          <Button secondary disabled={busy} onPress={() => setApiKey("")}>
            Clear API key
          </Button>
        </>
      ) : null}
      {mode === "hosted" || mode === "byok" ? (
        <Field
          label="Accept AI usage charges"
          type="select"
          value={pricingConsent}
          onChange={setPricingConsent}
          disabled={busy}
          options={[
            { value: "no", label: "Do not accept charges" },
            {
              value: "yes",
              label:
                mode === "hosted"
                  ? "Accept the displayed credit price"
                  : "Accept my provider's API charges",
            },
          ]}
        />
      ) : null}
    </Stack>
  );
}
