import { isCivilDate } from "../locale.ts";
export function parseReceipt(value) {
  const lines = String(value)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    totals = [];
  for (let i = 0; i < lines.length; i++) {
    if (
      !/\b(total|amount due|balance due)\b/i.test(lines[i]) ||
      /subtotal|sub total|tax|vat|change/i.test(lines[i])
    )
      continue;
    const match = (lines[i] + " " + (lines[i + 1] || "")).match(
      /\d[\d,]*\.\d{2,3}\b/g,
    );
    if (match)
      totals.push({
        value: match[0].replaceAll(",", ""),
        priority: /grand|amount due|balance due/i.test(lines[i]) ? 2 : 1,
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
  let date = rawDate
    ? `${rawDate[1]}-${rawDate[2].padStart(2, "0")}-${rawDate[3].padStart(2, "0")}`
    : "";
  if (!date) {
    const european = String(value).match(
      /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/,
    );
    if (european && Number(european[1]) > 12)
      date = `${european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
  }
  if (date && !isCivilDate(date)) date = "";
  return {
    amount: clear ? candidates[0].value : "",
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
    category: /supermarket|grocery|restaurant|cafe|coffee/i.test(value)
      ? "Food & drink"
      : /petrol|fuel|taxi/i.test(value)
        ? "Transport"
        : /pharmacy|hospital/i.test(value)
          ? "Health"
          : "Other",
  };
}
