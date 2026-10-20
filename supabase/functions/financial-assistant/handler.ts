import { fundingRequest } from "./funding.ts";
import type { Funding, HostedOptions } from "./funding.ts";
import { field, isOneOf } from "../_shared/guards.ts";
const currencies = [
  "BHD",
  "USD",
  "EUR",
  "GBP",
  "SAR",
  "AED",
  "KWD",
  "OMR",
  "QAR",
  "INR",
] as const;
export const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "drafts"],
  properties: {
    answer: { type: "string", maxLength: 4000 },
    drafts: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "currency", "type", "date", "category"],
        properties: {
          name: { type: "string", maxLength: 80 },
          amount: { type: "string" },
          currency: { type: "string", enum: currencies },
          type: { type: "string", enum: ["income", "expense"] },
          date: {
            type: "string",
            description: "YYYY-MM-DD, or empty when missing/ambiguous",
          },
          category: { type: "string", maxLength: 80 },
        },
      },
    },
  },
};
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
/** What the model is given: the question and, optionally, aggregate totals only. */
export type AssistantInput = {
  question: string;
  summary?: Record<string, unknown>;
};
export function validateAssistantInput(input: unknown): AssistantInput {
  const question = field(input, "question");
  if (
    field(input, "consent") !== true ||
    typeof question !== "string" ||
    !question.trim() ||
    question.length > 4000
  )
    throw Error(
      "Allow cloud processing and enter a question of at most 4,000 characters.",
    );
  const result: AssistantInput = { question: question.trim() };
  const s = field(input, "summary");
  if (s != null) {
    const month = field(s, "month"),
      currency = field(s, "currency");
    if (
      !s ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month)) ||
      !isOneOf(currencies, currency)
    )
      throw Error("Invalid aggregate summary.");
    const clean: Record<string, unknown> = { month, currency };
    for (const key of [
      "trackedBalance",
      "income",
      "expenses",
      "net",
      "monthlySubscriptions",
      "subscriptionCount",
      "installmentsRemaining",
    ]) {
      const value = field(s, key);
      // Number.isFinite only passes numbers, so Math.abs sees a number.
      if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e15)
        throw Error("Invalid aggregate summary.");
      clean[key] = value;
    }
    const totals = field(s, "categoryTotals");
    if (!Array.isArray(totals) || totals.length > 10)
      throw Error("Invalid category summary.");
    clean.categoryTotals = totals.map((row: unknown) => {
      const name = field(row, "name"),
        amount = field(row, "amount");
      if (
        typeof name !== "string" ||
        name.length > 160 ||
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 1e15
      )
        throw Error("Invalid category summary.");
      return { name, amount };
    });
    result.summary = clean;
  }
  return result;
}
export function validateAssistantOutput(output: unknown) {
  const answer = field(output, "answer"),
    drafts = field(output, "drafts");
  if (
    typeof answer !== "string" ||
    !answer.trim() ||
    answer.length > 4000 ||
    !Array.isArray(drafts) ||
    drafts.length > 5
  )
    throw Error("Invalid assistant response.");
  return {
    answer,
    drafts: drafts.map((draft: unknown) => {
      const name = field(draft, "name"),
        amount = field(draft, "amount"),
        date = field(draft, "date"),
        category = field(draft, "category");
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.length > 80 ||
        !isOneOf(currencies, field(draft, "currency")) ||
        !isOneOf(["income", "expense"], field(draft, "type")) ||
        typeof amount !== "string" ||
        (amount !== "" &&
          (!/^\d+(\.\d{1,3})?$/.test(amount) ||
            Number(amount) <= 0 ||
            Number(amount) > 1e9)) ||
        typeof date !== "string" ||
        (date !== "" && !validDate(date)) ||
        typeof category !== "string" ||
        category.length > 80
      )
        throw Error("Invalid assistant draft.");
      return Object.fromEntries(
        ["name", "amount", "currency", "type", "date", "category"].map(
          (key) => [key, field(draft, key)],
        ),
      );
    }),
  };
}
type User = { id: string };
type Reservation = { insufficient?: boolean; duplicate?: boolean; balance?: unknown; status?: unknown };
type Settlement = { status?: unknown; balance?: unknown };
/** Everything the handler needs from the outside world; index.ts supplies the real ones. */
export type AssistantDependencies = {
  authenticate: (request: Request) => Promise<User | null>;
  capabilities: () => HostedOptions & Record<string, unknown>;
  balance: (request: Request, user: User) => Promise<unknown>;
  reserve: (user: User, funding: Extract<Funding, { mode: "hosted" }>) => Promise<Reservation>;
  settle: (
    user: User,
    funding: Extract<Funding, { mode: "hosted" }>,
    action: string,
    usage: unknown,
  ) => Promise<Settlement>;
  quota: (request: Request) => Promise<boolean>;
  generate: (input: AssistantInput, funding: Funding) => Promise<{ output: unknown; usage: unknown }>;
  json: (request: Request, data: unknown, status?: number) => Response;
};

export function assistantHandler({
  authenticate,
  capabilities,
  balance,
  reserve,
  settle,
  quota,
  generate,
  json,
}: AssistantDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return json(request, {}, 200);
    if (request.method !== "POST")
      return json(request, { error: "Method not allowed." }, 405);
    let body: unknown;
    try {
      if (Number(request.headers.get("content-length")) > 20000)
        throw Error("Request is too large.");
      const text = await request.text();
      if (text.length > 20000) throw Error("Request is too large.");
      body = JSON.parse(text);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw Error("Invalid request.");
    } catch (e) {
      return json(request, { error: field(e, "message") || "Invalid request." }, 400);
    }
    const options = capabilities();
    const action = field(body, "action");
    if (action === "capabilities") return json(request, options, 200);
    const user = await authenticate(request).catch(() => null);
    if (!user)
      return json(
        request,
        { error: "Sign in to use the cloud assistant." },
        401,
      );
    if (action === "status") {
      try {
        // Spreading a non-object adds nothing, exactly as the object spread did.
        const status: unknown = await balance(request, user);
        return json(request, { ...options, ...Object.assign({}, status) }, 200);
      } catch {
        return json(
          request,
          { error: "AI credit status is unavailable. No request was sent." },
          503,
        );
      }
    }
    let input: AssistantInput, funding: Funding;
    try {
      if (action && action !== "ask") throw Error("Invalid action.");
      input = validateAssistantInput(body);
      funding = fundingRequest(body, options);
    } catch (e) {
      const status = field(e, "status");
      return json(
        request,
        { error: field(e, "message"), configured: options.hosted.configured },
        // status is a number on funding errors; anything else falls back as before.
        typeof status === "number" && status ? status : 400,
      );
    }
    // The hosted funding once credits are reserved; only then is a settlement or refund owed.
    let reserved: Extract<Funding, { mode: "hosted" }> | null = null;
    try {
      if (!(await quota(request)))
        return json(
          request,
          {
            error:
              "Cloud assistant limit reached. Wait at least five seconds between questions; the daily limit is 20.",
          },
          429,
        );
      if (funding.mode === "hosted") {
        const reservation = await reserve(user, funding);
        if (reservation.insufficient)
          return json(
            request,
            {
              error:
                "Insufficient prepaid AI credits. Purchases are not available yet.",
              balance: reservation.balance,
            },
            402,
          );
        if (reservation.duplicate)
          return json(
            request,
            {
              error:
                "This request was already submitted. Check its status before starting another question.",
              status: reservation.status,
            },
            409,
          );
        reserved = funding;
      }
      // Funding credentials are never included in the model's input.
      const result = await generate(input, funding);
      const output = validateAssistantOutput(result.output);
      if (reserved) {
        const paid = await settle(user, reserved, "complete", result.usage);
        // A failed database response after completion is ambiguous: do not run
        // inference again or refund a completed request. Settlement is idempotent.
        if (paid.status !== "completed")
          throw Error("Settlement not completed");
        return json(
          request,
          {
            ...output,
            funding: {
              mode: "hosted",
              chargedCredits: reserved.priceCredits,
              balance: paid.balance,
            },
          },
          200,
        );
      }
      return json(
        request,
        { ...output, funding: { mode: "byok", chargedCredits: 0 } },
        200,
      );
    } catch {
      if (reserved) {
        try {
          await settle(user, reserved, "refund", {});
        } catch {
          /* Reservation can be reconciled by its request ID. */
        }
      }
      return json(
        request,
        {
          error:
            "The AI service could not complete this question. Hosted reservations are refunded when possible; check your credit balance before retrying. Your own provider may charge failed requests. No other funding option was used.",
        },
        503,
      );
    }
  };
}
