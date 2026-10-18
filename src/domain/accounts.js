import { amount, date } from "./model.js";
export function termDetails(data) {
  const tenure = Number(data.tenure || 0),
    startDate = date(data.startDate, true);
  let maturity = date(data.maturity, true);
  if (!Number.isInteger(tenure) || tenure < 0 || tenure > 1200)
    throw Error("Tenure must be 1–1200 whole months, or blank.");
  if (tenure) {
    if (!startDate) throw Error("Enter a start date to calculate maturity.");
    const d = new Date(`${startDate}T12:00:00Z`),
      day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + tenure);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    maturity = d.toISOString().slice(0, 10);
  }
  if (startDate && maturity && maturity <= startDate)
    throw Error("Maturity must be after the start date.");
  return {
    tenure,
    startDate,
    maturity,
    installment: amount(data.installment || 0),
    loanOriginal: amount(
      data.loanOriginal ||
        (data.type === "Loan" ? Math.max(0, -Number(data.balance)) : 0),
    ),
  };
}
