import { currencyCodes } from "./model.js";
export function exchangeSnapshot(response) {
  if (
    response.result !== "success" ||
    response.base_code !== "BHD" ||
    !Number.isFinite(response.time_last_update_unix)
  )
    throw Error("The exchange provider returned an invalid quote.");
  const rates = {};
  for (const code of currencyCodes) {
    const quote = response.rates?.[code];
    if (!Number.isFinite(quote) || quote <= 0)
      throw Error(`Missing exchange quote: ${code}`);
    rates[code] = 1 / quote;
  }
  rates.BHD = 1;
  return {
    source: "ExchangeRate-API",
    asOf: new Date(response.time_last_update_unix * 1000)
      .toISOString()
      .slice(0, 10),
    rates,
  };
}
