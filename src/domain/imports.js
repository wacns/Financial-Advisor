import {
  normalizeWorkspace,
  validateWorkspace,
  clone,
  defaultRates,
  accountCurrency,
} from "./model.js";
import { validateCycleBudgets } from "./cycles.js";
import { validateProjects } from "./projects.js";
import { saveTransaction } from "./ledger.js";
export function backupText(s) {
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
export function parseBackup(content) {
  if (content.length > 16000000)
    throw Error("Backup must be smaller than 16 MB.");
  const raw = JSON.parse(content.replace(/^\uFEFF/, ""));
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
  let input = raw.data || raw;
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
    input = clone(input);
    input.currency = "BHD";
    input.region = "BH";
    input.timeZone = "Asia/Bahrain";
    const originalSettings = input.settings || {},
      catalog = originalSettings.categoryCatalog;
    input.settings = {
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
    for (const a of input.accounts) {
      a.balance = a.opening / 1000;
      a.currency ??= "BHD";
      a.apr ??= 0;
      a.startDate = a.start || "";
      if (a.installment != null) a.installment /= 1000;
      if (a.loanOriginal != null) a.loanOriginal /= 1000;
    }
    const transaction = (t) => ({
      ...t,
      accountId: t.account,
      toAccountId: t.to,
      name: t.note || t.name || t.category || "Imported entry",
      amount: t.amount / 1000,
      received: t.received == null ? undefined : t.received / 1000,
      currency:
        input.accounts.find((a) => a.id === t.account)?.currency || "BHD",
      scheduledFor: t.recurringDue || t.scheduledFor,
    });
    input.transactions = input.transactions.map(transaction);
    for (const t of input.transactions) {
      const a = input.accounts.find((a) => a.id === t.accountId);
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
        const dest = input.accounts.find((a) => a.id === t.toAccountId);
        if (!dest) throw Error("Transfer destination missing.");
        dest.balance =
          Math.round((dest.balance + (t.received ?? t.amount)) * 1000) / 1000;
      }
    }
    input.recurring = (input.recurring || []).map((r) => ({
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
    for (const b of input.budgets || [])
      b.currency = originalSettings.base || "BHD";
    input.templates = (originalSettings.templates || []).map((t) => ({
      ...t,
      record: transaction(t.record),
    }));
    input.projects = (input.projects || []).map((p) => ({
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
    input.cycleBudgets = (input.cycleBudgets || []).map((b) => {
      const envelope = (e) => ({
        ...e,
        limit: e.limit / 1000,
        weeks: e.weeks.map((n) => n / 1000),
        categoryMode: e.categoryMode || (e.include.length ? "selected" : "all"),
      });
      return { ...envelope(b), children: b.children.map(envelope) };
    });
  }
  const s = normalizeWorkspace(input);
  validateWorkspace(s);
  validateCycleBudgets(s);
  validateProjects(s);
  return s;
}
export function parseCSV(content) {
  const rows = [];
  let row = [],
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
export function importCSV(
  s,
  content,
  accountId,
  uuid = () => crypto.randomUUID(),
) {
  if (content.length > 16000000) throw Error("CSV must be smaller than 16 MB.");
  const rows = parseCSV(content.replace(/^\uFEFF/, "")),
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
    key = (t) =>
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
    const r = Object.fromEntries(header.map((h, i) => [h, cells[i]]));
    r.type = String(r.type || "")
      .trim()
      .toLowerCase();
    r.date = String(r.date || "").trim();
    r.currency = String(r.currency || "")
      .trim()
      .toUpperCase();
    if (r.currency && r.currency !== accountCurrency(next, accountId))
      throw Error(
        "CSV currency must match the destination account. Choose a matching account or convert the amounts explicitly.",
      );
    if (!["expense", "income"].includes(r.type))
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
