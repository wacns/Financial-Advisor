import { isCivilDate } from "../locale.ts";
import { must } from "../guards.ts";
export function parseReceipt(value: unknown) {
  const lines = String(value)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    totals: { value: string; priority: number }[] = [];
  for (const [i, line] of lines.entries()) {
    if (
      !/\b(total|amount due|balance due)\b/i.test(line) ||
      /subtotal|sub total|tax|vat|change/i.test(line)
    )
      continue;
    const match = (line + " " + (lines[i + 1] || "")).match(
      /\d[\d,]*\.\d{2,3}\b/g,
    );
    if (match)
      totals.push({
        value: must(match[0], "total").replaceAll(",", ""),
        priority: /grand|amount due|balance due/i.test(line) ? 2 : 1,
      });
  }
  totals.sort((a, b) => b.priority - a.priority);
  const candidates = totals.filter((t) => t.priority === totals[0]?.priority),
    clear =
      candidates.length && new Set(candidates.map((t) => t.value)).size === 1;
  const rawDate = String(value).match(
      /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/,
    ),
    rawTime = String(value).match(
      /\b([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/,
    );
  // Every group in these date patterns is required, so a match has all three.
  let date = rawDate
    ? `${rawDate[1]}-${must(rawDate[2], "month").padStart(2, "0")}-${must(rawDate[3], "day").padStart(2, "0")}`
    : "";
  if (!date) {
    const european = String(value).match(
      /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/,
    );
    if (european && Number(european[1]) > 12)
      date = `${european[3]}-${must(european[2], "month").padStart(2, "0")}-${must(european[1], "day").padStart(2, "0")}`;
  }
  if (date && !isCivilDate(date)) date = "";
  return {
    amount: clear ? must(candidates[0], "total").value : "",
    name:
      lines
        .find(
          (line) =>
            /[a-z]{3}/i.test(line) &&
            !/receipt|invoice|tel|vat|www\.|thank/i.test(line),
        )
        ?.slice(0, 80) || "",
    date,
    time: rawTime ? rawTime[0] : "",
    currency:
      (String(value).match(/\b(BHD|USD|EUR|GBP|SAR|AED|KWD|OMR|QAR|INR)\b/i) ||
        [])[1]?.toUpperCase() || "",
    category: /supermarket|grocery|restaurant|cafe|coffee/i.test(String(value))
      ? "Food & drink"
      : /petrol|fuel|taxi/i.test(String(value))
        ? "Transport"
        : /pharmacy|hospital/i.test(String(value))
          ? "Health"
          : "Other",
  };
}
