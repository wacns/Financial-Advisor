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
  configured,
  quota,
  generate,
  json,
}) {
  return async (request) => {
    if (request.method === "OPTIONS") return json(request, {}, 200);
    if (request.method !== "POST")
      return json(request, { error: "Method not allowed." }, 405);
    const user = await authenticate(request).catch(() => null);
    if (!user)
      return json(
        request,
        { error: "Sign in to use the cloud assistant." },
        401,
      );
    let input;
    try {
      if (Number(request.headers.get("content-length")) > 20000)
        throw Error("Request is too large.");
      const text = await request.text();
      if (text.length > 20000) throw Error("Request is too large.");
      input = validateAssistantInput(JSON.parse(text));
    } catch (e) {
      return json(request, { error: e.message || "Invalid request." }, 400);
    }
    if (!configured())
      return json(
        request,
        {
          error:
            "Cloud AI is not configured yet. Local insights and text capture are available.",
          configured: false,
        },
        503,
      );
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
      const output = validateAssistantOutput(await generate(input));
      return json(request, output, 200);
    } catch {
      return json(
        request,
        {
          error:
            "The AI service could not complete this question. Try local insights or retry later.",
        },
        503,
      );
    }
  };
}
