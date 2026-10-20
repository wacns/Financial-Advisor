import { bahrainDate, isCivilDate, toFils } from "../locale.js";
import { currencyCodes } from "./model.js";
function fingerprint(value) {
  // An idempotency hint, not a security credential. Four independent lanes
  // avoid the birthday collisions of a single 32-bit hash in large imports.
  const hashes = [2166136261, 2246822507, 3266489909, 668265263];
  for (const char of value)
    for (let i = 0; i < hashes.length; i++)
      hashes[i] = Math.imul(hashes[i] ^ char.codePointAt(0), 16777619 + i * 2);
  return `text-${hashes.map((h) => (h >>> 0).toString(16).padStart(8, "0")).join("")}`;
}
export function parseTransactionText(
  input,
  { today = bahrainDate(), defaultCurrency = "BHD" } = {},
) {
  if (typeof input !== "string" || input.length > 20000)
    throw Error("Use at most 20,000 characters.");
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 25) throw Error("Review at most 25 messages at a time.");
  return lines.map((original) => {
    const text = original
      .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
      .replaceAll("٫", ".")
      .replaceAll("٬", ",");
    const payment = text.split(
      /\b(?:(?:available|remaining|current)\s+)?balance\b|الرصيد/i,
    )[0];
    const codes = currencyCodes.join("|"),
      pattern = new RegExp(
        `\\b(${codes})\\s*([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,3})?)(?![0-9.])|([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,3})?)\\s*(${codes}|dinars?|riyals?|درهم|دينار|دنانير)(?![\\p{L}\\p{N}])`,
        "giu",
      );
    const matches = [...payment.matchAll(pattern)],
      amounts = matches.map((match) => ({
        currency: (match[1] || match[4] || defaultCurrency).toUpperCase(),
        value: (match[2] || match[3]).replaceAll(",", ""),
      }));
    for (const match of amounts)
      if (!currencyCodes.includes(match.currency))
        match.currency = defaultCurrency;
    let amount = "",
      currency = amounts[0]?.currency || defaultCurrency;
    const warnings = [];
    if (amounts.length === 1) {
      try {
        const fils = toFils(amounts[0].value);
        if (fils > 0) amount = String(fils / 1000);
      } catch {
        warnings.push("Check the amount precision.");
      }
    } else
      warnings.push(
        amounts.length
          ? "Several amounts were found; enter the payment amount."
          : "No explicit currency amount was found; enter it before saving.",
      );
    const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    let date = iso?.[0] || today;
    if (iso && !isCivilDate(date)) {
      date = "";
      warnings.push("The written date is invalid.");
    }
    if (!iso) {
      if (/\byesterday\b|أمس/i.test(text)) {
        const d = new Date(`${today}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        date = d.toISOString().slice(0, 10);
      } else if (/\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/.test(text)) {
        date = "";
        warnings.push("Check the written date and enter it explicitly.");
      } else warnings.push("Date defaults to today; check it.");
    }
    const income =
        /\b(received|credited|salary|refund|income)\b|استلمت|راتب|إيداع/i.test(
          payment,
        ),
      expense =
        /\b(spent|paid|debited|purchase|expense|bought)\b|دفعت|شراء|خصم/i.test(
          payment,
        );
    const type = income && !expense ? "income" : "expense";
    if (income && expense)
      warnings.push(
        "Both income and expense wording appear; choose the direction.",
      );
    const merchant = payment
      .match(
        /\b(?:at|from|to)\s+(.+?)(?=\s+(?:on|using|with|for|card)\b|[.;]|$)/i,
      )?.[1]
      ?.trim();
    const name =
      (
        merchant ||
        payment
          .replace(pattern, "")
          .replace(
            /\b(?:spent|paid|received|debited|credited|purchase|income|expense|today|yesterday|on)\b/gi,
            "",
          )
          .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
          .trim()
      ).slice(0, 80) || "Review captured transaction";
    const category =
      type === "income"
        ? "Income"
        : /coffee|restaurant|lunch|dinner|food|grocer|supermarket|cafe|مطعم|قهوة/i.test(
              payment,
            )
          ? "Food & drink"
          : /taxi|uber|fuel|petrol|parking|بترول/i.test(payment)
            ? "Transport"
            : /rent|internet|electric|water|subscription|bill|إيجار/i.test(
                  payment,
                )
              ? "Utilities"
              : "Shopping";
    return {
      draft: {
        name,
        type,
        amount,
        date,
        currency,
        category,
        note: "",
        captureFingerprint: fingerprint(`${text.toLowerCase()}|${date}`),
      },
      warnings,
      source: original,
    };
  });
}
export function captureURL(url) {
  let value;
  try {
    value = new URL(url);
  } catch {
    return null;
  }
  if (
    value.protocol !== "com.wacns.financialadvisor:" ||
    value.hostname !== "capture" ||
    !["", "/"].includes(value.pathname)
  )
    return null;
  const text = value.searchParams.get("text");
  if (text && text.length <= 20000) return { text };
  const amount = value.searchParams.get("amount"),
    currency = value.searchParams.get("currency") || "BHD",
    name = value.searchParams.get("name") || "Captured expense",
    type = value.searchParams.get("type") || "expense";
  if (
    !amount ||
    !currencyCodes.includes(currency) ||
    !["expense", "income"].includes(type)
  )
    return null;
  try {
    if (toFils(amount) <= 0) return null;
  } catch {
    return null;
  }
  return {
    draft: {
      name: name.slice(0, 80),
      type,
      amount,
      currency,
      date: bahrainDate(),
      category: type === "income" ? "Income" : "Shopping",
    },
  };
}
