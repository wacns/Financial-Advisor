import { currencyCodes } from "./model.ts";
import type { Rates } from "./types.ts";
/** The parts of an ExchangeRate-API response this app reads. */
export type ExchangeResponse = {
  result?: unknown;
  base_code?: unknown;
  time_last_update_unix?: unknown;
  rates?: Record<string, unknown>;
};
export function exchangeSnapshot(response: ExchangeResponse) {
  const updated = response.time_last_update_unix;
  // Number.isFinite is only ever true for numbers, so the typeof checks add nothing at runtime.
  if (
    response.result !== "success" ||
    response.base_code !== "BHD" ||
    typeof updated !== "number" ||
    !Number.isFinite(updated)
  )
    throw Error("The exchange provider returned an invalid quote.");
  const rates: Rates = {};
  for (const code of currencyCodes) {
    const quote = response.rates?.[code];
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
