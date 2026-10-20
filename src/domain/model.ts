import { validateEnhancements } from "./enhancement-validation.ts";
import { isCivilDate, toFils } from "../locale.ts";
import { must } from "../guards.ts";
import type {
  CollectionKey,
  CurrencyCode,
  CycleBudget,
  CycleBudgetEntry,
  Rates,
  Settings,
  StoredCycleBudgetEntry,
  StoredWorkspace,
  Transaction,
  TransactionDraft,
  Workspace,
} from "./types.ts";
export const currencyCodes: CurrencyCode[] = [
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
export const defaultRates: Record<CurrencyCode, number> = {
  BHD: 1,
  USD: 0.376,
  EUR: 0.41,
  GBP: 0.49,
  SAR: 0.100267,
  AED: 0.10238,
  KWD: 1.22,
  OMR: 0.977,
  QAR: 0.1033,
  INR: 0.00448,
};
export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  currencyCodes.some((code) => code === value);
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const collectionKeys: CollectionKey[] = [
  "accounts",
  "transactions",
  "budgets",
  "goals",
  "recurring",
  "debts",
  "projects",
  "warranties",
  "cycleBudgets",
  "templates",
  "payees",
  "tags",
  "subscriptions",
  "installments",
];
const normalizeCycleEntry = <T extends StoredCycleBudgetEntry>(
  e: T,
): T & CycleBudgetEntry => {
  const include = e.include ?? [];
  return Object.assign(e, {
    include,
    exclude: e.exclude ?? [],
    categoryMode: e.categoryMode ?? (include.length ? "selected" : "all"),
  });
};
export function normalizeWorkspace(input: unknown): Workspace {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: stored workspaces are trusted as written here (validateWorkspace checks them before saves and imports); a structural check at this point would reject data that opens today.
  const s = must(clone(input), "workspace") as StoredWorkspace;
  if (s.currency !== "BHD")
    throw Error(
      "This workspace uses another currency. Import it with explicit account currencies before opening it.",
    );
  // Key order matters for stored JSON: spread keeps existing keys in place and appends
  // missing ones in the same order the old in-place assignments did.
  const settings: Settings = {
    base: "BHD",
    language: "en",
    theme: "light",
    motion: true,
    cycleStartDay: 1,
    rates: { ...defaultRates },
    categories: [],
    ...s.settings,
  };
  settings.rates = { ...defaultRates, ...settings.rates, BHD: 1 };
  return {
    ...s,
    currency: s.currency,
    schemaVersion: 2,
    accounts: (s.accounts ?? []).map((a) =>
      Object.assign(a, { currency: a.currency ?? "BHD" }),
    ),
    transactions: s.transactions ?? [],
    budgets: s.budgets ?? [],
    goals: (s.goals ?? []).map((g) =>
      Object.assign(g, { currency: g.currency ?? "BHD" }),
    ),
    recurring: s.recurring ?? [],
    debts: s.debts ?? [],
    projects: (s.projects ?? []).map((p) =>
      Object.assign(p, {
        categories: p.categories ?? [],
        contracts: p.contracts ?? [],
        milestones: p.milestones ?? [],
        documents: p.documents ?? [],
        reserve: p.reserve ?? 0,
        currency: p.currency ?? "BHD",
      }),
    ),
    warranties: s.warranties ?? [],
    cycleBudgets: (s.cycleBudgets ?? []).map((b): CycleBudget => {
      const children = (b.children ?? []).map(normalizeCycleEntry);
      const day = b.day ?? (Number(b.from?.slice(8)) || 1);
      return normalizeCycleEntry(Object.assign(b, { children, day }));
    }),
    templates: s.templates ?? [],
    payees: s.payees ?? [],
    tags: s.tags ?? [],
    subscriptions: s.subscriptions ?? [],
    installments: s.installments ?? [],
    settings,
  };
}
export function convert(
  s: { settings?: Partial<Settings> },
  amount: number | string,
  from: string = "BHD",
  to: string = s.settings?.base || "BHD",
): number {
  const rates: Rates = s.settings?.rates || defaultRates;
  const fromRate = rates[from] ?? 0,
    toRate = rates[to] ?? 0;
  if (!(fromRate > 0 && toRate > 0))
    throw Error("Set a positive exchange rate for both currencies.");
  return Math.round((toFils(amount) * fromRate) / toRate) / 1000;
}
export const accountCurrency = (
  s: Pick<Workspace, "accounts">,
  id: string | undefined,
): CurrencyCode => s.accounts.find((a) => a.id === id)?.currency || "BHD";
export const recordValue = (
  s: Pick<Workspace, "accounts" | "settings">,
  t: Pick<Transaction, "amount" | "currency" | "accountId">,
  to: string = s.settings?.base || "BHD",
): number =>
  convert(s, t.amount, t.currency || accountCurrency(s, t.accountId), to);
export function text(value: unknown, label = "Name", max = 80): string {
  const result = String(value || "").trim();
  if (!result || result.length > max)
    throw Error(`${label} must contain 1–${max} characters.`);
  return result;
}
export function amount(value: unknown, positive = false): number {
  if (value == null || value === "" || typeof value === "boolean")
    throw Error("Enter an amount.");
  const n = toFils(value) / 1000;
  if (positive && n <= 0) throw Error("Amount must be greater than zero.");
  return n;
}
export function date(value: unknown, optional = false): string {
  if (optional && !value) return "";
  if (!isCivilDate(value)) throw Error("Choose a valid date.");
  return value;
}
export function validateWorkspace(s: Workspace | null | undefined): Workspace {
  if (
    !s ||
    s.currency !== "BHD" ||
    !Array.isArray(s.accounts) ||
    !Array.isArray(s.transactions)
  )
    throw Error("Invalid backup. Nothing was changed.");
  for (const key of collectionKeys) {
    const rows = s[key];
    if (!Array.isArray(rows) || rows.length > 50000)
      throw Error(`Invalid ${key} collection.`);
    const ids = new Set<string>();
    for (const row of rows) {
      if (
        !row ||
        typeof row.id !== "string" ||
        !row.id ||
        row.id.length > 120 ||
        ids.has(row.id)
      )
        throw Error(`Invalid or duplicate ${key} ID.`);
      ids.add(row.id);
    }
  }
  if (
    !currencyCodes.includes(s.settings.base) ||
    !["en", "ar"].includes(s.settings.language) ||
    !["light", "dark", "system"].includes(s.settings.theme)
  )
    throw Error("Invalid workspace settings.");
  if (
    !Number.isInteger(s.settings.cycleStartDay) ||
    s.settings.cycleStartDay < 1 ||
    s.settings.cycleStartDay > 31
  )
    throw Error("Cycle day must be 1–31.");
  for (const [currency, rate] of Object.entries(s.settings.rates))
    if (
      !isCurrencyCode(currency) ||
      !Number.isFinite(Number(rate)) ||
      Number(rate) <= 0 ||
      Number(rate) > 1e9
    )
      throw Error("Exchange rates must be positive.");
  if (
    !Array.isArray(s.settings.categories) ||
    s.settings.categories.length > 2000 ||
    s.settings.categories.some(
      (c) => typeof c !== "string" || !c.trim() || c.length > 500,
    )
  )
    throw Error("Invalid category catalog.");
  if (s.settings.reminders) {
    const r = s.settings.reminders;
    if (
      !Number.isInteger(r.hour) ||
      r.hour < 0 ||
      r.hour > 23 ||
      !["daily", "weekly"].includes(r.frequency) ||
      (["expenses", "salary", "advice"] as const).some(
        (k) => typeof r[k] !== "boolean",
      )
    )
      throw Error("Invalid reminder preferences.");
  }
  if (typeof s.settings.motion !== "boolean")
    throw Error("Invalid motion setting.");
  const nonnegative = (value: unknown) => {
    if (amount(value) < 0) throw Error("Amounts cannot be negative.");
  };
  for (const a of s.accounts) {
    text(a.name);
    amount(a.balance);
    if (!currencyCodes.includes(a.currency))
      throw Error("Unsupported account currency.");
    for (const key of [
      "apr",
      "limit",
      "cost",
      "installment",
      "loanOriginal",
    ] as const)
      if (a[key] != null) nonnegative(a[key]);
    date(a.startDate, true);
    date(a.maturity, true);
    if (a.startDate && a.maturity && a.maturity < a.startDate)
      throw Error("Maturity must follow the start date.");
    if (a.last4 && !/^\d{4}$/.test(a.last4))
      throw Error("Last four digits must contain four digits.");
  }
  const validateTransaction = (t: TransactionDraft, template = false) => {
    if (!template) date(t.date);
    amount(t.amount);
    text(t.name, "Description");
    text(t.category, "Category", 500);
    if (
      !["expense", "income", "transfer", "adjustment"].includes(t.type) ||
      !s.accounts.some((a) => a.id === t.accountId)
    )
      throw Error("Invalid transaction account/type.");
    if (t.currency && t.currency !== accountCurrency(s, t.accountId))
      throw Error("Transaction currency must match its account.");
    if (t.type !== "adjustment" && t.amount <= 0)
      throw Error("Transactions must have positive amounts.");
    if (t.type === "transfer") {
      if (
        !s.accounts.some((a) => a.id === t.toAccountId) ||
        t.accountId === t.toAccountId
      )
        throw Error("Invalid transfer destination.");
      amount(t.received ?? t.amount, true);
    }
    if (
      t.labels &&
      (!Array.isArray(t.labels) ||
        t.labels.length > 5 ||
        t.labels.some(
          (l) => typeof l !== "string" || !l.trim() || l.length > 40,
        ))
    )
      throw Error("Invalid labels.");
    if (t.time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t.time))
      throw Error("Invalid transaction time.");
    if (
      t.salaryMonth &&
      (!isCivilDate(`${t.salaryMonth}-01`) || t.type !== "income")
    )
      throw Error("Only income can have a valid salary month.");
    if (t.note && (typeof t.note !== "string" || t.note.length > 1000))
      throw Error("Invalid transaction note.");
    if (t.projectId && !s.projects.some((p) => p.id === t.projectId))
      throw Error("Project payment refers to a missing project.");
    if (
      t.debtId &&
      (!s.debts.some((d) => d.id === t.debtId) ||
        amount(t.principal, true) <= 0)
    )
      throw Error("Invalid repayment principal or debt.");
  };
  for (const t of s.transactions) validateTransaction(t);
  for (const b of s.budgets) {
    text(b.category, "Category", 500);
    amount(b.limit, true);
    if (b.currency && !currencyCodes.includes(b.currency))
      throw Error("Invalid budget currency.");
  }
  for (const g of s.goals) {
    text(g.name);
    amount(g.target, true);
    if (!currencyCodes.includes(g.currency))
      throw Error("Invalid goal currency.");
    nonnegative(g.saved);
  }
  for (const r of s.recurring) {
    if (r.loanInstallment) {
      const a = s.accounts.find((a) => a.id === r.accountId),
        loan = s.accounts.find((a) => a.id === r.toAccountId);
      if (
        !loan ||
        loan.type !== "Loan" ||
        a?.currency !== loan.currency ||
        r.type !== "transfer" ||
        r.frequency !== "monthly" ||
        r.received !== r.amount ||
        amount(r.interest || 0) < 0
      )
        throw Error("Invalid linked loan installment.");
    }
    validateTransaction({ ...r, date: r.nextDue });
    text(r.name);
    date(r.nextDue);
    if (!["daily", "weekly", "monthly", "yearly"].includes(r.frequency))
      throw Error("Invalid repeat frequency.");
    if (!Number.isInteger(r.anchorDay) || r.anchorDay < 1 || r.anchorDay > 31)
      throw Error("Invalid repeat anchor.");
  }
  for (const d of s.debts) {
    text(d.name);
    nonnegative(d.balance);
    amount(d.originalBalance, true);
    amount(d.installment, true);
    date(d.nextDue);
    if (
      (d.direction && !["lent", "borrowed"].includes(d.direction)) ||
      (d.currency && !currencyCodes.includes(d.currency))
    )
      throw Error("Invalid debt direction/currency.");
  }
  for (const t of s.templates) {
    text(t.name);
    if (!t.record) throw Error("Invalid template.");
    validateTransaction(t.record, true);
  }
  for (const w of s.warranties) {
    text(w.name);
    date(w.purchased);
    date(w.expires);
    if (w.expires <= w.purchased)
      throw Error("Warranty expiry must follow purchase.");
    if (
      w.receipt &&
      (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
        w.receipt,
      ) ||
        w.receipt.length > 1500000)
    )
      throw Error("Invalid warranty receipt.");
  }
  for (const p of s.projects) {
    text(p.name);
    amount(p.budget, true);
    nonnegative(p.reserve);
    date(p.startDate, true);
    date(p.targetDate, true);
    if (p.startDate && p.targetDate && p.targetDate < p.startDate)
      throw Error("Project target must follow its start.");
    if (!currencyCodes.includes(p.currency))
      throw Error("Invalid project currency.");
    for (const key of [
      "categories",
      "contracts",
      "milestones",
      "documents",
    ] as const) {
      const rows: { id: string; name: string }[] = p[key];
      if (
        !Array.isArray(rows) ||
        rows.length > 2000 ||
        new Set(rows.map((r) => r.id)).size !== rows.length
      )
        throw Error("Invalid project collection.");
      for (const r of rows) {
        if (typeof r.id !== "string") throw Error("Invalid project record ID.");
        text(r.name);
      }
    }
    for (const c of p.categories) nonnegative(c.budget);
    for (const c of p.contracts) {
      amount(c.original, true);
      date(c.startDate, true);
      date(c.endDate, true);
      if (!Array.isArray(c.variations) || c.variations.length > 200)
        throw Error("Invalid contract variations.");
      for (const v of c.variations) {
        text(v.name);
        amount(v.amount);
        date(v.date);
      }
    }
    for (const m of p.milestones) {
      amount(m.amount, true);
      date(m.due);
    }
    for (const d of p.documents)
      if (
        !/^data:(application\/pdf|text\/plain|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/.test(
          d.file || "",
        ) ||
        d.file.length > 1500000 ||
        (d.contractId && !p.contracts.some((c) => c.id === d.contractId)) ||
        (d.transactionId &&
          !s.transactions.some(
            (t) => t.id === d.transactionId && t.projectId === p.id,
          ))
      )
        throw Error("Invalid project document or link.");
  }
  return validateEnhancements(s);
}
