export const REGION = 'BH';
export const CURRENCY = 'BHD';
export const TIME_ZONE = 'Asia/Bahrain';
export const LOCALE = 'en-BH';
export const DEMO_STORAGE_KEY = 'northline-bh-demo-v1';

export function bahrainDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatDate(date, options = { day: '2-digit', month: 'short' }) {
  // Stored transaction dates are civil dates, not UTC timestamps.
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, calendar: 'gregory', ...options })
    .format(new Date(`${date}T12:00:00+03:00`));
}

export function formatMoney(amount) {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency: CURRENCY, currencyDisplay: 'code',
    minimumFractionDigits: 3, maximumFractionDigits: 3,
  }).format(amount);
}

export function toFils(value) {
  const amount = Number(value);
  const fils = Math.round(amount * 1000);
  if (!Number.isFinite(amount) || Math.abs(amount) > 1e12 ||
      Math.abs(amount * 1000 - fils) > 0.0001) {
    throw Error('Enter a BHD amount with no more than three decimal places.');
  }
  return fils;
}

export function requireBahrainWorkspace(state) {
  if (state.currency !== CURRENCY) {
    throw Error('This workspace uses another currency. Its records have been preserved; currency conversion is required before opening it in Northline Bahrain.');
  }
  return state;
}

export function isCivilDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
