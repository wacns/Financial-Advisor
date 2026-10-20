import {
  normalizeWorkspace,
  validateWorkspace,
  clone,
  defaultRates,
  accountCurrency,
} from "./model.ts";
import { validateCycleBudgets } from "./cycles.ts";
import { validateProjects } from "./projects.ts";
import { saveTransaction } from "./ledger.ts";
import type { Rates, Workspace } from "./types.ts";
export function backupText(s: Workspace): string {
  return JSON.stringify(
    {
      format: "financial-advisor-partner",
      version: 2,
      exportedAt: new Date().toISOString(),
      data: s,
    },
    null,
    2,
  );
}
// Reference backups (the older FinancialAdvisor format) store amounts as integer thousandths
// and use their own field names. These types cover the fields the conversion reads; every
// other field is carried across unchanged by the spreads below.
type ReferenceCategory = { parent: string; name: string };
type ReferenceTransaction = {
  account?: string;
  to?: string;
  note?: string;
  name?: string;
  category?: string;
  type?: string;
  amount: number;
  received?: number | null;
  recurringDue?: string;
  scheduledFor?: string;
};
type ReferenceSettings = {
  base?: string;
  animations?: boolean;
  rates?: Rates;
  categoryCatalog?: { parents?: string[]; children?: ReferenceCategory[] };
  customCategories?: string[];
  subcategories?: ReferenceCategory[];
  templates?: { record: ReferenceTransaction }[];
};
type ReferenceAccount = {
  id: string;
  opening: number;
  balance?: number;
  currency?: string;
  apr?: number;
  start?: string;
  startDate?: string;
  installment?: number;
  loanOriginal?: number;
};
type ReferenceRecurring = ReferenceTransaction & {
  next: string;
  frequency?: unknown;
  anchor?: number;
  paused?: boolean;
  interest?: number;
};
type ReferenceProject = {
  budget: number;
  reserve: number;
  start?: string;
  end?: string;
  categories: { budget: number }[];
  contracts: {
    original: number;
    start?: string;
    end?: string;
    variations: { amount: number }[];
  }[];
  milestones: { amount: number }[];
  documents: { data?: string; name?: string; date?: string }[];
};
type ReferenceEnvelope = {
  limit: number;
  weeks: number[];
  categoryMode?: string;
  include: string[];
};
type ReferenceWorkspace = {
  currency?: string;
  region?: string;
  timeZone?: string;
  version?: number;
  settings?: ReferenceSettings;
  accounts: ReferenceAccount[];
  transactions: ReferenceTransaction[];
  recurring?: ReferenceRecurring[];
  budgets?: { currency?: string }[];
  projects?: ReferenceProject[];
  cycleBudgets?: (ReferenceEnvelope & { children: ReferenceEnvelope[] })[];
};
/** A backup file: an envelope around a workspace, or (version 1) a bare reference workspace. */
type BackupFile = ReferenceWorkspace & {
  format?: string;
  backupVersion?: number;
  data?: ReferenceWorkspace;
};
export function parseBackup(content: string): Workspace {
  if (content.length > 16000000)
    throw Error("Backup must be smaller than 16 MB.");
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: backup files are trusted as written while converting; normalizeWorkspace, validateWorkspace, validateCycleBudgets and validateProjects check the result below.
  const raw = JSON.parse(content.replace(/^﻿/, "")) as BackupFile;
  if (
    !raw.format &&
    raw.version === 1 &&
    raw.settings?.rates &&
    Array.isArray(raw.accounts) &&
    raw.accounts.every((a) => typeof a.opening === "number")
  )
    return parseBackup(
      JSON.stringify({
        format: "financial-advisor-backup",
        backupVersion: 1,
        data: raw,
      }),
    );
  let input: unknown = raw.data || raw;
  if (
    raw.format &&
    !["financial-advisor-partner", "financial-advisor-backup"].includes(
      raw.format,
    )
  )
    throw Error("Unsupported backup format.");
  if (raw.format === "financial-advisor-partner" && raw.version !== 2)
    throw Error("Unsupported backup version.");
  if (raw.format === "financial-advisor-backup") {
    // Reference backups store integer thousandths and derive balances from an
    // opening amount plus their ledger. Import currency labels explicitly.
    if (raw.backupVersion !== 1)
      throw Error("Unsupported reference backup version.");
    const ref = clone(raw.data || raw);
    const originalSettings = ref.settings || {},
      catalog = originalSettings.categoryCatalog;
    const settings = {
      ...originalSettings,
      base: originalSettings.base || "BHD",
      motion: originalSettings.animations ?? true,
      widgetsEnabled: false,
      rates: { ...defaultRates, ...originalSettings.rates },
      categories: [
        ...(catalog?.parents || originalSettings.customCategories || []),
        ...(catalog?.children || originalSettings.subcategories || []).map(
          (c) => `${c.parent} / ${c.name}`,
        ),
      ],
    };
    // Accounts are converted in place, so the workspace keeps the same account objects.
    const accounts = ref.accounts.map((a) => {
      const converted = Object.assign(a, {
        balance: a.opening / 1000,
        currency: a.currency ?? "BHD",
        apr: a.apr ?? 0,
        startDate: a.start || "",
      });
      if (a.installment != null) a.installment /= 1000;
      if (a.loanOriginal != null) a.loanOriginal /= 1000;
      return converted;
    });
    const transaction = (t: ReferenceTransaction) => ({
      ...t,
      accountId: t.account,
      toAccountId: t.to,
      name: t.note || t.name || t.category || "Imported entry",
      amount: t.amount / 1000,
      received: t.received == null ? undefined : t.received / 1000,
      currency: accounts.find((a) => a.id === t.account)?.currency || "BHD",
      scheduledFor: t.recurringDue || t.scheduledFor,
    });
    const transactions = ref.transactions.map(transaction);
    for (const t of transactions) {
      const a = accounts.find((a) => a.id === t.accountId);
      if (!a) throw Error("Reference transaction account is missing.");
      a.balance =
        Math.round(
          (a.balance +
            (t.type === "income" || t.type === "adjustment"
              ? t.amount
              : -t.amount)) *
            1000,
        ) / 1000;
      if (t.type === "transfer") {
        const dest = accounts.find((a) => a.id === t.toAccountId);
        if (!dest) throw Error("Transfer destination missing.");
        dest.balance =
          Math.round((dest.balance + (t.received ?? t.amount)) * 1000) / 1000;
      }
    }
    const recurring = (ref.recurring || []).map((r) => ({
      ...transaction(r),
      name: r.name,
      nextDue: r.next,
      frequency: String(r.frequency).toLowerCase(),
      anchorDay: r.anchor || Number(r.next.slice(8)),
      anchorMonth: Number(r.next.slice(5, 7)),
      category: r.category || "Other",
      paused: r.paused || false,
      interest: (r.interest || 0) / 1000,
    }));
    // Basic limits and goal values are decimal units in reference backups.
    for (const b of ref.budgets || [])
      b.currency = originalSettings.base || "BHD";
    const templates = (originalSettings.templates || []).map((t) => ({
      ...t,
      record: transaction(t.record),
    }));
    const projects = (ref.projects || []).map((p) => ({
      ...p,
      budget: p.budget / 1000,
      reserve: p.reserve / 1000,
      startDate: p.start,
      targetDate: p.end,
      categories: p.categories.map((c) => ({ ...c, budget: c.budget / 1000 })),
      contracts: p.contracts.map((c) => ({
        ...c,
        original: c.original / 1000,
        startDate: c.start,
        endDate: c.end,
        variations: c.variations.map((v) => ({
          ...v,
          amount: v.amount / 1000,
        })),
      })),
      milestones: p.milestones.map((m) => ({ ...m, amount: m.amount / 1000 })),
      documents: p.documents.map((d) => ({
        ...d,
        file: d.data,
        fileName: d.name,
        createdAt: d.date,
      })),
    }));
    const cycleBudgets = (ref.cycleBudgets || []).map((b) => {
      const envelope = (e: ReferenceEnvelope) => ({
        ...e,
        limit: e.limit / 1000,
        weeks: e.weeks.map((n) => n / 1000),
        categoryMode: e.categoryMode || (e.include.length ? "selected" : "all"),
      });
      return { ...envelope(b), children: b.children.map(envelope) };
    });
    // The same keys the old in-place assignments set, in the same order: existing keys keep
    // their position and missing ones are appended.
    input = {
      ...ref,
      currency: "BHD",
      region: "BH",
      timeZone: "Asia/Bahrain",
      settings,
      transactions,
      recurring,
      templates,
      projects,
      cycleBudgets,
    };
  }
  const s = normalizeWorkspace(input);
  validateWorkspace(s);
  validateCycleBudgets(s);
  validateProjects(s);
  return s;
}
export function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (quoted && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
type CsvKeyFields = {
  accountId?: unknown;
  date?: unknown;
  time?: unknown;
  type?: unknown;
  amount?: unknown;
  category?: unknown;
  name?: unknown;
};
export function importCSV(
  s: Workspace,
  content: string,
  accountId: string,
  uuid: () => string = () => crypto.randomUUID(),
) {
  if (content.length > 16000000) throw Error("CSV must be smaller than 16 MB.");
  const rows = parseCSV(content.replace(/^﻿/, "")),
    header = rows
      .shift()
      ?.map((c) =>
        /^amount(?:\s*\([a-z]{3}\))?$/i.test(c.trim())
          ? "amount"
          : c.trim().toLowerCase(),
      );
  if (!header || !["date", "type", "amount"].every((c) => header.includes(c)))
    throw Error(
      "CSV requires date,type,amount columns; category,name/note,time are optional.",
    );
  if (!rows.length || rows.length > 5000)
    throw Error("Import between 1 and 5,000 rows.");
  const next = normalizeWorkspace(s),
    key = (t: CsvKeyFields) =>
      JSON.stringify([
        t.accountId,
        t.date,
        t.time || "",
        t.type,
        Number(t.amount),
        t.category,
        t.name,
      ]),
    known = new Set(next.transactions.map(key));
  let added = 0;
  for (const cells of rows) {
    if (cells.length !== header.length)
      throw Error("A CSV row has the wrong number of columns.");
    const r: Record<string, string | undefined> = Object.fromEntries(
      header.map((h, i) => [h, cells[i]]),
    );
    const type = (r.type = String(r.type || "")
      .trim()
      .toLowerCase());
    r.date = String(r.date || "").trim();
    const currency = (r.currency = String(r.currency || "")
      .trim()
      .toUpperCase());
    if (currency && currency !== accountCurrency(next, accountId))
      throw Error(
        "CSV currency must match the destination account. Choose a matching account or convert the amounts explicitly.",
      );
    if (!["expense", "income"].includes(type))
      throw Error("CSV imports support income and expenses only.");
    const t = {
      ...r,
      accountId,
      amount: Number(r.amount),
      name: r.name || r.description || r.note || r.category || "Imported entry",
      category: r.category || "Other",
    };
    if (known.has(key(t))) continue;
    saveTransaction(next, t, undefined, uuid);
    known.add(key(t));
    added++;
  }
  validateWorkspace(next);
  return { state: next, added, skipped: rows.length - added };
}
