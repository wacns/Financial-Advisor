import { currencyCodes } from "./model.ts";
import type { Rates } from "./types.ts";
import { field } from "../guards.ts";
/** Reads an ExchangeRate-API response; anything malformed is rejected below. */
export function exchangeSnapshot(response: unknown) {
  const updated = field(response, "time_last_update_unix");
  // Number.isFinite is only ever true for numbers, so the typeof checks add nothing at runtime.
  if (
    field(response, "result") !== "success" ||
    field(response, "base_code") !== "BHD" ||
    typeof updated !== "number" ||
    !Number.isFinite(updated)
  )
    throw Error("The exchange provider returned an invalid quote.");
  const rates: Rates = {};
  for (const code of currencyCodes) {
    const quote = field(field(response, "rates"), code);
    if (typeof quote !== "number" || !Number.isFinite(quote) || quote <= 0)
      throw Error(`Missing exchange quote: ${code}`);
    rates[code] = 1 / quote;
  }
  rates.BHD = 1;
  return {
    source: "ExchangeRate-API" as const,
    asOf: new Date(updated * 1000)
      .toISOString()
      .slice(0, 10),
    rates,
  };
}
