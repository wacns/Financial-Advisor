import React, { useEffect, useRef, useState } from "react";
import { Button, Card, Heading, Label, Muted, Row, Stack } from "./ui.jsx";
import Field from "./Field";
import { parseTransactionText } from "../domain/capture.js";
import {
  assistantSummary,
  captureAccount,
  localAnswer,
} from "../domain/assistant.js";
import { categoryPaths } from "../domain/commands.js";
import { currencyCodes } from "../domain/model.js";
import {
  recognizeSpeech,
  speechSupported,
  stopSpeech,
} from "../platform/speech";
import { client } from "./client.js";

export function reviewCapture(w, open, draft) {
  const account = captureAccount(w.state, draft.currency);
  if (!account)
    throw Error(`Add a ${draft.currency} account before reviewing this entry.`);
  const categories = categoryPaths(w.state);
  // The captured currency selects the initial matching account. After that,
  // let the form derive its label from the account the user is reviewing.
  const entry = { ...draft };
  delete entry.currency;
  open("transaction", undefined, {
    draft: {
      ...entry,
      accountId: account.id,
      category: categories.includes(draft.category)
        ? draft.category
        : categories[0],
    },
  });
}

export default function MoneyTools({
  workspace: w,
  open,
  month,
  capture,
  onCaptureConsumed,
}) {
  const [text, setText] = useState(""),
    [currency, setCurrency] = useState("BHD"),
    [drafts, setDrafts] = useState([]),
    [error, setError] = useState(""),
    [listening, setListening] = useState(false),
    [speechLanguage, setSpeechLanguage] = useState("en-BH"),
    [question, setQuestion] = useState(""),
    [messages, setMessages] = useState([]),
    [mode, setMode] = useState("local"),
    [shareSummary, setShareSummary] = useState("no"),
    [consent, setConsent] = useState("no"),
    [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopSpeech().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!capture) return;
    if (capture.text) {
      setText(capture.text);
      setDrafts([]);
    } else if (capture.draft) {
      setDrafts([
        {
          draft: capture.draft,
          warnings: [
            "Review the amount, direction, date and account before saving.",
          ],
          source: "Shortcut",
        },
      ]);
    }
    onCaptureConsumed();
  }, [capture, onCaptureConsumed]);
  function parse() {
    setError("");
    try {
      setDrafts(parseTransactionText(text, { defaultCurrency: currency }));
    } catch (e) {
      setError(e.message);
    }
  }
  function review(draft) {
    setError("");
    try {
      reviewCapture(w, open, draft);
    } catch (e) {
      setError(e.message);
    }
  }
  async function dictate() {
    setError("");
    setListening(true);
    try {
      const result = await recognizeSpeech(speechLanguage);
      if (alive.current && result) {
        setText((previous) => (previous ? `${previous}\n${result}` : result));
        setDrafts([]);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setListening(false);
    }
  }
  async function ask() {
    if (!question.trim() || busy) return;
    setError("");
    setBusy(true);
    const prompt = question.trim();
    try {
      let answer,
        proposals = [];
      if (mode === "local") answer = localAnswer(w.state, prompt, month);
      else {
        if (w.demo || !w.user)
          throw Error(
            "Sign in to use the cloud assistant. Local insights work in the demo.",
          );
        if (consent !== "yes")
          throw Error(
            "Choose permission to send this question before using cloud AI.",
          );
        const { data, error: failure } = await client.functions.invoke(
          "financial-assistant",
          {
            body: {
              question: prompt,
              consent: true,
              ...(shareSummary === "yes"
                ? { summary: assistantSummary(w.state, month) }
                : {}),
            },
          },
        );
        if (failure) {
          let detail;
          try {
            detail = await failure.context?.json();
          } catch {
            /* Non-JSON gateway error. */
          }
          throw Error(
            detail?.error ||
              "The cloud assistant is unavailable. Local insights and text capture remain available.",
          );
        }
        if (typeof data?.answer !== "string" || !Array.isArray(data?.drafts))
          throw Error("The assistant returned an invalid response.");
        answer = data.answer;
        proposals = data.drafts;
      }
      setMessages((previous) =>
        [...previous, { question: prompt, answer, mode }].slice(-12),
      );
      if (proposals.length)
        setDrafts(
          proposals.map((draft) => ({
            draft,
            warnings: [
              "AI suggestion: check every field. This has not been saved.",
            ],
            source: "Cloud assistant",
          })),
        );
      setQuestion("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack>
      <Card>
        <Heading>Smart capture</Heading>
        <Muted>
          Paste a bank message or describe a payment, one per line. For example:
          “Paid BHD 4.250 at Pearl Cafe on 2026-10-20”. Messages are parsed on
          your device. Nothing is saved until you review an entry and press
          Save.
        </Muted>
        <Field
          label="Payment messages or spoken text"
          type="textarea"
          value={text}
          onChange={(value) => {
            setText(value);
            setDrafts([]);
          }}
        />
        <Row>
          <Field
            label="Default capture currency"
            type="select"
            value={currency}
            onChange={setCurrency}
            options={currencyCodes}
          />
          <Field
            label="Speech language"
            type="select"
            value={speechLanguage}
            onChange={setSpeechLanguage}
            options={[
              { value: "en-BH", label: "English" },
              { value: "ar-BH", label: "العربية" },
            ]}
          />
        </Row>
        <Row>
          <Button disabled={!text.trim() || listening} onPress={parse}>
            Prepare drafts
          </Button>
          <Button
            secondary
            disabled={!speechSupported() || listening}
            onPress={dictate}
          >
            Use microphone
          </Button>
          {listening ? (
            <Button
              secondary
              onPress={() => stopSpeech().catch((e) => setError(e.message))}
            >
              Finish speaking
            </Button>
          ) : null}
          <Button
            secondary
            onPress={() => {
              setText("");
              setDrafts([]);
            }}
          >
            Clear capture
          </Button>
        </Row>
        <Muted>
          {listening ? "Listening… stop when you have finished. " : ""}Voice
          uses your device's speech service, which may process audio online.
          Microphone access is requested only when you choose it. Speech
          availability depends on the device and language.
        </Muted>
      </Card>
      {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      {drafts.length ? (
        <Card>
          <Heading>Review captured entries</Heading>
          <Muted>
            Ambiguous amounts and dates are left for you to enter. Text-message
            drafts are checked for duplicate saves. Review Transactions before
            intentionally recording a separate payment.
          </Muted>
          {drafts.map(({ draft, warnings, source }, i) => (
            <Card
              key={`${draft.captureFingerprint || i}-${i}`}
              testID="capture-draft"
            >
              <Heading>{draft.name}</Heading>
              <Label>
                {draft.type} · {draft.amount || "Amount needed"}{" "}
                {draft.currency} · {draft.date || "Date needed"}
              </Label>
              <Muted>{source}</Muted>
              {warnings.map((warning, j) => (
                <Muted key={j}>{warning}</Muted>
              ))}
              <Button onPress={() => review(draft)}>
                Review entry {i + 1}
              </Button>
            </Card>
          ))}
        </Card>
      ) : null}
      <Card>
        <Heading>Money assistant</Heading>
        <Field
          label="Assistant mode"
          type="select"
          value={mode}
          onChange={(value) => {
            setMode(value);
            setConsent("no");
          }}
          options={[
            { value: "local", label: "Local insights" },
            { value: "cloud", label: "Cloud AI (optional)" },
          ]}
        />
        <Muted>
          {mode === "local"
            ? `Local insights use your saved records for ${month} without sending them to an AI provider. Ask about spending, income, balances, categories, subscriptions or installments.`
            : "Cloud AI sends each question to the configured AI provider through your signed-in account. It can suggest entries for review and cannot save or change your records. Requires the server's AI service to be configured."}
        </Muted>
        {mode === "cloud" ? (
          <Stack>
            <Field
              label="Include this month's aggregate summary"
              type="select"
              value={shareSummary}
              onChange={setShareSummary}
              options={[
                { value: "no", label: "No financial summary" },
                { value: "yes", label: "Include totals and category totals" },
              ]}
            />
            <Muted>
              Summary includes the month, reporting currency, included account
              total, income/spending/net totals, top category totals and
              subscription/installment totals. Account names, transaction
              descriptions, attachments and contacts are excluded.
            </Muted>
            <Field
              label="Permission for cloud processing"
              type="select"
              value={consent}
              onChange={setConsent}
              options={[
                { value: "no", label: "Do not send" },
                { value: "yes", label: "Allow my question and chosen summary" },
              ]}
            />
          </Stack>
        ) : null}
        <Field
          label="Ask the money assistant"
          type="textarea"
          value={question}
          onChange={setQuestion}
          disabled={busy}
        />
        <Row>
          <Button disabled={!question.trim() || busy} onPress={ask}>
            {busy ? "Thinking…" : "Ask assistant"}
          </Button>
          <Button
            secondary
            disabled={busy}
            onPress={() => {
              setMessages([]);
              setQuestion("");
            }}
          >
            Clear conversation
          </Button>
        </Row>
        {messages.map((message, i) => (
          <Card key={i}>
            <Label>{message.question}</Label>
            <Muted>
              {message.mode === "local" ? "Local insights" : "Cloud AI"}
            </Muted>
            <Label>{message.answer}</Label>
          </Card>
        ))}
        <Muted>
          Conversation is kept only while this screen is open. Each cloud
          question is independent. Suggestions use tracked data and require your
          judgment.
        </Muted>
      </Card>
      <Card>
        <Heading>Shortcuts & quick entry</Heading>
        <Muted>
          On iOS, choose FinancialAdvisor → Review payment in Shortcuts. You can
          pass text from a personal automation, or pass an amount, description
          and currency. The app opens a draft for review. FinancialAdvisor does
          not read your SMS inbox or Apple Pay history.
        </Muted>
        <Muted>
          URL example:
          com.wacns.financialadvisor://capture?amount=4.250&amp;currency=BHD&amp;name=Coffee
        </Muted>
        <Muted>
          Android also supports this URL and the existing home-screen
          quick-entry and template widgets. A newer native build is required for
          microphone capture and iOS Shortcuts.
        </Muted>
      </Card>
    </Stack>
  );
}
