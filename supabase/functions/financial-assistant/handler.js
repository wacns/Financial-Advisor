import { fundingRequest } from "./funding.js";
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
];
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
const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export function validateAssistantInput(input) {
  if (
    input?.consent !== true ||
    typeof input.question !== "string" ||
    !input.question.trim() ||
    input.question.length > 4000
  )
    throw Error(
      "Allow cloud processing and enter a question of at most 4,000 characters.",
    );
  const result = { question: input.question.trim() };
  if (input.summary != null) {
    const s = input.summary;
    if (
      !s ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month) ||
      !currencies.includes(s.currency)
    )
      throw Error("Invalid aggregate summary.");
    const clean = { month: s.month, currency: s.currency };
    for (const key of [
      "trackedBalance",
      "income",
      "expenses",
      "net",
      "monthlySubscriptions",
      "subscriptionCount",
      "installmentsRemaining",
    ]) {
      if (!Number.isFinite(s[key]) || Math.abs(s[key]) > 1e15)
        throw Error("Invalid aggregate summary.");
      clean[key] = s[key];
    }
    if (!Array.isArray(s.categoryTotals) || s.categoryTotals.length > 10)
      throw Error("Invalid category summary.");
    clean.categoryTotals = s.categoryTotals.map((row) => {
      if (
        typeof row.name !== "string" ||
        row.name.length > 160 ||
        !Number.isFinite(row.amount) ||
        row.amount < 0 ||
        row.amount > 1e15
      )
        throw Error("Invalid category summary.");
      return { name: row.name, amount: row.amount };
    });
    result.summary = clean;
  }
  return result;
}
export function validateAssistantOutput(output) {
  if (
    typeof output?.answer !== "string" ||
    !output.answer.trim() ||
    output.answer.length > 4000 ||
    !Array.isArray(output.drafts) ||
    output.drafts.length > 5
  )
    throw Error("Invalid assistant response.");
  return {
    answer: output.answer,
    drafts: output.drafts.map((draft) => {
      if (
        typeof draft.name !== "string" ||
        !draft.name.trim() ||
        draft.name.length > 80 ||
        !currencies.includes(draft.currency) ||
        !["income", "expense"].includes(draft.type) ||
        typeof draft.amount !== "string" ||
        (draft.amount !== "" &&
          (!/^\d+(\.\d{1,3})?$/.test(draft.amount) ||
            Number(draft.amount) <= 0 ||
            Number(draft.amount) > 1e9)) ||
        typeof draft.date !== "string" ||
        (draft.date !== "" && !validDate(draft.date)) ||
        typeof draft.category !== "string" ||
        draft.category.length > 80
      )
        throw Error("Invalid assistant draft.");
      return Object.fromEntries(
        ["name", "amount", "currency", "type", "date", "category"].map(
          (key) => [key, draft[key]],
        ),
      );
    }),
  };
}

export function assistantHandler({
  authenticate,
  capabilities,
  balance,
  reserve,
  settle,
  quota,
  generate,
  json,
}) {
  return async (request) => {
    if (request.method === "OPTIONS") return json(request, {}, 200);
    if (request.method !== "POST")
      return json(request, { error: "Method not allowed." }, 405);
    let body;
    try {
      if (Number(request.headers.get("content-length")) > 20000)
        throw Error("Request is too large.");
      const text = await request.text();
      if (text.length > 20000) throw Error("Request is too large.");
      body = JSON.parse(text);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw Error("Invalid request.");
    } catch (e) {
      return json(request, { error: e.message || "Invalid request." }, 400);
    }
    const options = capabilities();
    if (body.action === "capabilities") return json(request, options, 200);
    const user = await authenticate(request).catch(() => null);
    if (!user)
      return json(
        request,
        { error: "Sign in to use the cloud assistant." },
        401,
      );
    if (body.action === "status") {
      try {
        return json(
          request,
          { ...options, ...(await balance(request, user)) },
          200,
        );
      } catch {
        return json(
          request,
          { error: "AI credit status is unavailable. No request was sent." },
          503,
        );
      }
    }
    let input, funding;
    try {
      if (body.action && body.action !== "ask") throw Error("Invalid action.");
      input = validateAssistantInput(body);
      funding = fundingRequest(body, options);
    } catch (e) {
      return json(
        request,
        { error: e.message, configured: options.hosted.configured },
        e.status || 400,
      );
    }
    let reserved = false;
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
        reserved = true;
      }
      // Funding credentials are never included in the model's input.
      const result = await generate(input, funding);
      const output = validateAssistantOutput(result.output);
      if (reserved) {
        const paid = await settle(user, funding, "complete", result.usage);
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
              chargedCredits: funding.priceCredits,
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
          await settle(user, funding, "refund", {});
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
