import { accountAppearance } from "./organizing.ts";
import type { AppearanceInput } from "./organizing.ts";
import { termDetails } from "./accounts.ts";
import type { TermInput } from "./accounts.ts";
import { saveRecurring } from "../planning.ts";
import {
  clone,
  normalizeWorkspace,
  validateWorkspace,
  amount,
  text,
  date,
  currencyCodes,
  isCurrencyCode,
} from "./model.ts";
import { cycleRange, splitWeeks, validateCycleBudgets } from "./cycles.ts";
import {
  saveTransaction,
  deleteTransaction,
  copyTransaction,
} from "./ledger.ts";
import type { TransactionInput } from "./ledger.ts";
import { bahrainDate, toFils } from "../locale.ts";
import { categories } from "../finance.ts";
import { checkedLater, isOneOf, must } from "../guards.ts";
import type {
  CurrencyCode,
  CycleBudget,
  CycleBudgetEntry,
  Warranty,
  Workspace,
} from "./types.ts";
export const categoryPaths = (s: Workspace): string[] =>
  [
    ...new Set([
      ...categories,
      ...(s.settings?.categories || []),
      ...[
        ...(s.transactions || []),
        ...(s.recurring || []),
        ...(s.budgets || []),
        ...(s.subscriptions || []),
        ...(s.installments || []),
        ...(s.templates || []).map((t) => t.record),
      ]
        .map((t) => t.category)
        .filter((value) => typeof value === "string" && value.trim()),
    ]),
  ].filter((c) => !(s.settings?.hiddenCategories || []).includes(c));
const list = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
const positive = (value: unknown) => amount(value, true);
/** Fields the settings and management forms submit; each command kind reads its own subset. */
export type FeatureInput = TransactionInput &
  TermInput &
  AppearanceInput &
  Partial<Record<CurrencyCode, unknown>> & {
    [week: `week${number}`]: unknown;
    hour?: unknown;
    interest?: unknown;
    apr?: unknown;
    limit?: unknown;
    cost?: unknown;
    last4?: unknown;
    frequency?: unknown;
    expenses?: unknown;
    salary?: unknown;
    advice?: unknown;
    enabled?: unknown;
    loanId?: unknown;
    transactionId?: unknown;
    balance?: unknown;
    target?: unknown;
    saved?: unknown;
    lender?: unknown;
    nextDue?: unknown;
    base?: unknown;
    language?: unknown;
    theme?: unknown;
    cycleStartDay?: unknown;
    motion?: unknown;
    parent?: unknown;
    parentId?: unknown;
    categoryMode?: string;
    include?: unknown;
    exclude?: unknown;
    key?: string;
    salaryMonth?: string;
    purchased?: unknown;
    expires?: unknown;
    brand?: unknown;
    serial?: unknown;
    retailer?: unknown;
    notes?: unknown;
    receipt?: string;
  };
export function featureCommand(
  input: unknown,
  kind: string,
  data: FeatureInput,
  id?: string | null,
  uuid: () => string = () => crypto.randomUUID(),
): Workspace | null {
  const s = normalizeWorkspace(input),
    row = <T extends { id: string }>(rows: T[]): T => {
      const r = rows.find((r) => r.id === id);
      if (!r) throw Error("This record no longer exists.");
      return r;
    };
  if (kind === "reminderPreferences") {
    const hour = Number(data.hour);
    const frequency = data.frequency;
    if (
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      !isOneOf(["daily", "weekly"], frequency)
    )
      throw Error("Choose a reminder hour (0–23) and frequency.");
    s.settings.reminders = {
      hour,
      frequency,
      expenses: data.expenses === "yes",
      salary: data.salary === "yes",
      advice: data.advice === "yes",
    };
  } else if (kind === "widgetPreferences")
    s.settings.widgetsEnabled = data.enabled === "yes";
  else if (kind === "loanInstallment") {
    const loan = s.accounts.find((a) => a.id === data.loanId),
      source = s.accounts.find((a) => a.id === data.accountId);
    if (
      !loan ||
      loan.type !== "Loan" ||
      !source ||
      source.id === loan.id ||
      source.currency !== loan.currency
    )
      throw Error("Choose a loan and payment account in the same currency.");
    const existing = s.recurring.find(
        (r) => r.loanInstallment && r.toAccountId === loan.id,
      ),
      principal = positive(data.amount),
      interest = amount(data.interest || 0);
    if (interest < 0) throw Error("Interest cannot be negative.");
    const r = saveRecurring(
      s,
      {
        ...data,
        name: `${loan.name} installment`,
        type: "transfer",
        frequency: "monthly",
        category: "Debts & loans",
        toAccountId: loan.id,
        received: principal,
        amount: principal,
      },
      existing?.id || uuid(),
    );
    r.loanInstallment = true;
    r.interest = interest;
    loan.installment = principal;
  } else if (kind === "editTransaction") saveTransaction(s, data, id, uuid);
  else if (kind === "deleteTransaction") deleteTransaction(s, id);
  else if (kind === "template") {
    const source = s.transactions.find((t) => t.id === data.transactionId);
    if (!source) throw Error("Choose an existing transaction.");
    s.templates.push({
      id: uuid(),
      name: text(data.name),
      record: copyTransaction(source),
    });
  } else if (kind === "deleteTemplate")
    s.templates = s.templates.filter((t) => t.id !== id);
  else if (kind === "reconcile") {
    const a = row(s.accounts),
      target = amount(data.balance),
      difference = (toFils(target) - toFils(a.balance)) / 1000;
    if (difference)
      saveTransaction(
        s,
        {
          accountId: a.id,
          type: "adjustment",
          amount: difference,
          name: "Balance reconciliation",
          category: "Adjustment",
          date: data.date || bahrainDate(),
        },
        undefined,
        uuid,
      );
  } else if (kind === "editAccount") {
    const a = row(s.accounts);
    if (
      data.currency !== a.currency &&
      [...s.transactions, ...s.recurring].some(
        (t) => t.accountId === id || t.toAccountId === id,
      )
    )
      throw Error("An account with transactions cannot change currency.");
    Object.assign(a, {
      ...termDetails(data),
      ...accountAppearance(data),
      name: text(data.name),
      type: data.type,
      currency: data.currency,
      apr: amount(data.apr || 0),
      limit: amount(data.limit || 0),
      cost: amount(data.cost || 0),
      last4: String(data.last4 || ""),
    });
    if (
      (a.apr ?? 0) < 0 ||
      (a.limit ?? 0) < 0 ||
      (a.cost ?? 0) < 0 ||
      (a.startDate && a.maturity && a.maturity < a.startDate)
    )
      throw Error("Check the account term dates and non-negative amounts.");
    for (const r of s.recurring.filter(
      (r) => r.loanInstallment && r.toAccountId === a.id,
    )) {
      const installment = a.installment;
      if (a.type !== "Loan" || !(installment !== undefined && installment > 0))
        throw Error(
          "A linked installment requires a loan with a positive installment.",
        );
      r.amount = installment;
      r.received = installment;
    }
    // A balance correction is an explicit adjustment rather than a hidden edit.
    const target = amount(data.balance);
    if (target !== a.balance)
      saveTransaction(
        s,
        {
          accountId: id,
          type: "adjustment",
          amount: (toFils(target) - toFils(a.balance)) / 1000,
          name: "Opening balance correction",
          category: "Adjustment",
          date: bahrainDate(),
        },
        undefined,
        uuid,
      );
  } else if (kind === "deleteAccount") {
    if (
      s.transactions.some((t) => t.accountId === id || t.toAccountId === id) ||
      s.recurring.some((r) => r.accountId === id || r.toAccountId === id) ||
      s.templates.some(
        (t) => t.record.accountId === id || t.record.toAccountId === id,
      )
    )
      throw Error(
        "An account linked to records or schedules cannot be deleted.",
      );
    if ([...s.subscriptions, ...s.installments].some((p) => p.accountId === id))
      throw Error("This account has linked commitments.");
    s.accounts = s.accounts.filter((a) => a.id !== id);
    if (s.settings.defaultAccountId === id) s.settings.defaultAccountId = "";
  } else if (kind === "editGoal")
    Object.assign(row(s.goals), {
      name: text(data.name),
      target: positive(data.target),
      saved: amount(data.saved),
    });
  else if (kind === "deleteGoal") s.goals = s.goals.filter((r) => r.id !== id);
  else if (kind === "deleteBudget")
    s.budgets = s.budgets.filter((r) => r.id !== id);
  else if (kind === "deleteSchedule")
    s.recurring = s.recurring.filter((r) => r.id !== id);
  else if (kind === "editDebt")
    Object.assign(row(s.debts), {
      name: text(data.name),
      lender: String(data.lender || ""),
      installment: positive(data.installment),
      nextDue: date(data.nextDue),
    });
  else if (kind === "deleteDebt") {
    if (s.transactions.some((t) => t.debtId === id))
      throw Error(
        "Keep debts with payment history; mark them settled through repayments instead.",
      );
    s.debts = s.debts.filter((r) => r.id !== id);
  } else if (kind === "preferences") {
    const { base, language, theme } = data;
    if (
      !isCurrencyCode(base) ||
      !isOneOf(["en", "ar"], language) ||
      !isOneOf(["light", "dark", "system"], theme)
    )
      throw Error("Choose supported preferences.");
    const day = Number(data.cycleStartDay);
    if (!Number.isInteger(day) || day < 1 || day > 31)
      throw Error("Cycle day must be 1–31.");
    Object.assign(s.settings, {
      base,
      language,
      theme,
      cycleStartDay: day,
      motion: data.motion !== "no",
    });
  } else if (kind === "rates") {
    delete s.settings.ratesAsOf;
    delete s.settings.ratesSource;
    for (const code of currencyCodes)
      s.settings.rates[code] = code === "BHD" ? 1 : positive(data[code]);
  } else if (kind === "category") {
    const name = text(data.name);
    if (name.includes(" / "))
      throw Error("Enter the name without / separators.");
    const path = data.parent ? `${data.parent} / ${name}` : name;
    if (
      categoryPaths(s).some(
        (c) => c.toLowerCase() === path.toLowerCase() && c !== id,
      )
    )
      throw Error("This category already exists.");
    if (id) {
      if (id === "Other") throw Error("Other is the reserved fallback.");
      const replace = (value: string) =>
        value === id
          ? path
          : value?.startsWith(`${id} / `)
            ? path + value.slice(id.length)
            : value;
      s.settings.categories = [...new Set(categoryPaths(s).map(replace))];
      s.settings.hiddenCategories = [
        ...(s.settings.hiddenCategories || []),
        id,
      ];
      for (const key of [
        "transactions",
        "recurring",
        "budgets",
        "subscriptions",
        "installments",
      ] as const)
        for (const r of s[key]) r.category = replace(r.category);
      for (const style of s.settings.categoryStyles || [])
        style.path = replace(style.path);
      for (const t of s.templates)
        t.record.category = replace(t.record.category);
      for (const b of s.cycleBudgets)
        for (const c of [b, ...b.children])
          for (const key of ["include", "exclude"] as const)
            c[key] = c[key].map(replace);
    } else s.settings.categories.push(path);
    s.settings.hiddenCategories = (s.settings.hiddenCategories || []).filter(
      (c) => c !== path,
    );
    if (data.color || data.icon) {
      const { color, icon } = accountAppearance(data);
      s.settings.categoryStyles = [
        ...(s.settings.categoryStyles || []).filter(
          (style) => style.path !== path,
        ),
        { path, color, icon },
      ];
    }
  } else if (kind === "deleteCategory") {
    const used =
      [
        ...s.transactions,
        ...s.recurring,
        ...s.budgets,
        ...s.subscriptions,
        ...s.installments,
        ...s.templates.map((t) => t.record),
      ].some((r) => r.category === id || r.category?.startsWith(`${id} / `)) ||
      s.cycleBudgets.some((b) =>
        [b, ...b.children].some((c) =>
          [...c.include, ...c.exclude].some(
            (p) => p === id || p.startsWith(`${id} / `),
          ),
        ),
      );
    if (
      id === "Other" ||
      used ||
      categoryPaths(s).some((c) => c.startsWith(`${id} / `))
    )
      throw Error(
        "Only unused categories without subcategories can be deleted.",
      );
    s.settings.categories = s.settings.categories.filter((c) => c !== id);
    s.settings.categoryStyles = (s.settings.categoryStyles || []).filter(
      (style) => style.path !== id,
    );
    s.settings.hiddenCategories = [...(s.settings.hiddenCategories || []), id];
  } else if (kind === "cycleBudget" || kind === "subBudget") {
    const parent =
      kind === "subBudget"
        ? s.cycleBudgets.find((b) => b.id === data.parentId)
        : null;
    if (kind === "subBudget" && !parent)
      throw Error("Choose a main cycle budget.");
    // Without a parent, the record being edited is a main cycle budget.
    const main = parent ? undefined : s.cycleBudgets.find((c) => c.id === id);
    const existing: CycleBudgetEntry | undefined = parent
      ? parent.children.find((c) => c.id === id)
      : main;
    const limit = positive(data.limit),
      weeks = [0, 1, 2, 3].map((i) =>
        data[`week${i + 1}`] === "" || data[`week${i + 1}`] == null
          ? must(splitWeeks(limit)[i], "weekly allocation")
          : amount(data[`week${i + 1}`]),
      );
    const record = checkedLater<CycleBudgetEntry>({
      ...existing,
      id: id || uuid(),
      name: text(data.name),
      limit,
      weeks,
      categoryMode: data.categoryMode || "all",
      include: list(data.include),
      exclude: list(data.exclude),
    });
    if (parent) {
      parent.children = parent.children.filter((c) => c.id !== record.id);
      parent.children.push(record);
    } else {
      const key = data.key;
      const budget = checkedLater<CycleBudget>(
        Object.assign(record, {
          key,
          day: main?.day || s.settings.cycleStartDay,
          currency: main?.currency || data.currency || s.settings.base,
          ...(main
            ? { from: main.from, until: main.until, to: main.to }
            : cycleRange(s, String(key))),
          children: main?.children || [],
        }),
      );
      s.cycleBudgets = s.cycleBudgets.filter((c) => c.id !== budget.id);
      s.cycleBudgets.push(budget);
    }
    validateCycleBudgets(s);
  } else if (kind === "copyCycle") {
    const original = row(s.cycleBudgets),
      copy = clone(original);
    Object.assign(copy, {
      id: uuid(),
      key: data.key,
      day: s.settings.cycleStartDay,
      ...cycleRange(s, String(data.key)),
    });
    copy.children = copy.children.map((c) => ({ ...c, id: uuid() }));
    s.cycleBudgets.push(copy);
    validateCycleBudgets(s);
  } else if (kind === "deleteCycle")
    s.cycleBudgets = s.cycleBudgets.filter((b) => b.id !== id);
  else if (kind === "deleteSubBudget") {
    const b = s.cycleBudgets.find((b) => b.id === data.parentId);
    if (!b) throw Error("Budget not found.");
    b.children = b.children.filter((c) => c.id !== id);
  } else if (kind === "salaryLink") {
    const t = row(s.transactions);
    if (t.type !== "income")
      throw Error("Only recorded income can be assigned to a salary month.");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(data.salaryMonth)))
      throw Error("Choose a valid salary month.");
    t.salaryMonth = data.salaryMonth;
  } else if (kind === "warranty") {
    const purchased = date(data.purchased),
      expires = date(data.expires);
    if (expires <= purchased)
      throw Error("Expiry must be after the purchase date.");
    const record: Warranty = {
      id: id || uuid(),
      name: text(data.name),
      category: String(data.category || "Other"),
      brand: String(data.brand || ""),
      serial: String(data.serial || ""),
      retailer: String(data.retailer || ""),
      purchased,
      expires,
      notes: String(data.notes || "").slice(0, 1000),
      receipt: data.receipt || "",
    };
    if (
      record.receipt &&
      !/^data:image\/(png|jpeg|webp);base64,/.test(record.receipt)
    )
      throw Error("Choose a receipt image.");
    s.warranties = s.warranties.filter((r) => r.id !== record.id);
    s.warranties.push(record);
  } else if (kind === "deleteWarranty")
    s.warranties = s.warranties.filter((r) => r.id !== id);
  else return null;
  validateWorkspace(s);
  return s;
}
