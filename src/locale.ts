import { must } from "./guards.ts";
import type { Settings } from "./domain/types.ts";
export const REGION = "BH";
export const CURRENCY = "BHD";
export const TIME_ZONE = "Asia/Bahrain";
export const LOCALE = "en-BH";
export const DEMO_STORAGE_KEY = "northline-bh-demo-v1";

export function bahrainDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    must(
      parts.find((part) => part.type === type),
      `${type} date part`,
    ).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatDate(
  date: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!options && displayDateFormat) {
    const parts = new Intl.DateTimeFormat(
      displayLocale === "ar-BH" ? "ar-BH" : "en-GB",
      {
        timeZone: TIME_ZONE,
        calendar: "gregory",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(new Date(`${date}T12:00:00+03:00`));
    const order: Intl.DateTimeFormatPartTypes[] =
      displayDateFormat === "ymd"
        ? ["year", "month", "day"]
        : displayDateFormat === "mdy"
          ? ["month", "day", "year"]
          : ["day", "month", "year"];
    return order
      .map((key) => parts.find((p) => p.type === key)?.value)
      .join(" / ");
  }
  options ||= { day: "2-digit", month: "short" };
  // Stored transaction dates are civil dates, not UTC timestamps.
  return new Intl.DateTimeFormat(
    displayLocale === "ar-BH" ? "ar-BH" : "en-GB",
    {
      timeZone: TIME_ZONE,
      calendar: "gregory",
      ...options,
    },
  ).format(new Date(`${date}T12:00:00+03:00`));
}

let displayCurrency: string = CURRENCY,
  displayLocale: string = LOCALE,
  displayDateFormat: string = "";
export function setDisplayPreferences(
  settings: Partial<Pick<Settings, "base" | "dateFormat" | "language">> = {},
): void {
  displayCurrency = settings.base || CURRENCY;
  displayDateFormat = settings.dateFormat || "";
  displayLocale = settings.language === "ar" ? "ar-BH" : LOCALE;
}
export function formatMoney(
  amount: number,
  currency: string = displayCurrency,
): string {
  return new Intl.NumberFormat(displayLocale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

export function toFils(value: unknown): number {
  const normalized =
    typeof value === "string"
      ? value
          .trim()
          .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
          .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
          .replace("٫", ".")
      : value;
  const amount = Number(normalized);
  const fils = Math.round(amount * 1000);
  if (
    !Number.isFinite(amount) ||
    Math.abs(amount) > 1e12 ||
    Math.abs(amount * 1000 - fils) > 0.0001
  ) {
    throw Error("Enter an amount with no more than three decimal places.");
  }
  return fils;
}

export function requireBahrainWorkspace<T extends { currency: string }>(
  state: T,
): T {
  if (state.currency !== CURRENCY) {
    throw Error(
      "This workspace uses another currency. Its records have been preserved; currency conversion is required before opening it in FinancialAdvisor.",
    );
  }
  return state;
}

export function isCivilDate(value: unknown): value is string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
