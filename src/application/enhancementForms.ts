import { accountColors, accountIcons } from "../domain/organizing.ts";
import { commitmentStats, paymentDraft } from "../domain/commitments.ts";
import { categoryPaths } from "../domain/commands.ts";
import { bahrainDate } from "../locale.ts";
import { must } from "../guards.ts";
import type { Account, CurrencyCode, Workspace } from "../domain/types.ts";
/** A choice in a select field: a plain value, or a value with its own label. */
export type FieldOption = string | { value: string; label: string };
/** One input in an entry form. */
export type FormField = {
  label: string;
  name: string;
  value: unknown;
  type: string;
  options?: readonly FieldOption[];
};
/** Everything the entry modal needs to show and submit a form. */
export type FormSpec = {
  kind: string;
  id: string | null | undefined;
  title: string;
  fields: FormField[];
  note: string;
  values: Record<string, unknown>;
  submitLabel?: string;
  accounts?: Pick<Account, "id" | "currency">[];
  reportingCurrency?: CurrencyCode;
};
/** Extra values a screen passes when opening a form. */
export type FormContext = Record<string, unknown> & {
  draft?: Record<string, unknown>;
};
const f = (
  label: string,
  name: string,
  value: unknown = "",
  type = "text",
  options?: readonly FieldOption[],
): FormField => ({
  label,
  name,
  value,
  type,
  options,
});
const n = (label: string, name: string, value: unknown = "") =>
  f(label, name, value, "number");
const select = (
  label: string,
  name: string,
  options: readonly FieldOption[],
  value?: unknown,
) => {
  const first = options[0];
  return f(
    label,
    name,
    value ?? ((typeof first === "string" ? first : first?.value) || ""),
    "select",
    options,
  );
};
export function accountAppearanceFields(): FormField[] {
  return [
    select("Account color", "color", accountColors),
    select("Account icon", "icon", accountIcons),
    select("Include in total balance", "includeInTotal", ["yes", "no"], "yes"),
    n("Reward points per currency unit (optional)", "rewardRate", 0),
  ];
}
export function contactFields(s: Workspace): FormField[] {
  return [
    select(
      "Payee / payer (optional)",
      "payeeId",
      [
        { value: "", label: "None" },
        ...s.payees.map((p) => ({ value: p.id, label: p.name })),
      ],
      "",
    ),
    f("Location (optional)", "location"),
    n("Reward points (blank uses account rate)", "rewardPoints", ""),
    f("Receipt attachment (optional)", "receipt", "", "file"),
  ];
}
export function enhancementForm(
  kind: string,
  id: string | null | undefined,
  s: Workspace,
  context: FormContext = {},
): FormSpec | null {
  let fields: FormField[] = [],
    title = "",
    values: object = {},
    note = "";
  const submitLabel = "Save";
  const accounts = s.accounts.map((a) => ({
    value: a.id,
    label: `${a.name} · ${a.currency}`,
  }));
  if (["payee", "tag"].includes(kind)) {
    const row =
      kind === "payee"
        ? s.payees.find((p) => p.id === id)
        : s.tags.find((p) => p.id === id);
    title =
      kind === "payee"
        ? row
          ? "Edit contact"
          : "New payee or payer"
        : row
          ? "Edit tag"
          : "New tag";
    fields =
      kind === "payee"
        ? [
            f("Contact name", "name"),
            select(
              "Contact role",
              "role",
              [
                { value: "payee", label: "Payee — payments to" },
                { value: "payer", label: "Payer — income from" },
                { value: "both", label: "Both" },
              ],
              "both",
            ),
            f("Contact note (optional)", "note"),
          ]
        : [f("Tag name", "name"), select("Tag color", "color", accountColors)];
    if (row) values = { ...row };
    if (kind === "tag")
      note =
        "Renaming a tag updates its linked transactions and templates without changing any amounts.";
  } else if (kind === "defaultAccount") {
    title = "Default account";
    fields = [
      select(
        "Default entry account",
        "accountId",
        [{ value: "", label: "First available account" }, ...accounts],
        s.settings.defaultAccountId || "",
      ),
    ];
  } else if (kind === "datePreferences") {
    title = "Date display";
    fields = [
      select(
        "Date format",
        "dateFormat",
        [
          { value: "dmy", label: "Day / month / year" },
          { value: "mdy", label: "Month / day / year" },
          { value: "ymd", label: "Year / month / day" },
        ],
        s.settings.dateFormat || "dmy",
      ),
    ];
  } else if (kind === "subscription" || kind === "installment") {
    if (!accounts.length) throw Error("Add a payment account first.");
    const row =
      kind === "subscription"
        ? s.subscriptions.find((p) => p.id === id)
        : s.installments.find((p) => p.id === id);
    title = (row ? "Edit " : "New ") + kind;
    fields = [
      f(
        kind === "subscription" ? "Subscription name" : "Installment plan name",
        "name",
      ),
      f("Provider / merchant (optional)", "provider"),
      select(
        "Payment account",
        "accountId",
        accounts,
        // The check above guarantees at least one account.
        s.settings.defaultAccountId || must(accounts[0], "account").value,
      ),
      select(
        "Category",
        "category",
        categoryPaths(s),
        categoryPaths(s).includes("Utilities") ? "Utilities" : "Other",
      ),
      select(
        "Payee (optional)",
        "payeeId",
        [
          { value: "", label: "None" },
          ...s.payees.map((p) => ({ value: p.id, label: p.name })),
        ],
        "",
      ),
      ...(kind === "subscription"
        ? [n("Payment amount", "amount")]
        : [
            n("Total purchase amount", "total"),
            n("Number of installments", "count", 12),
          ]),
      f("First due date", "firstDue", bahrainDate(), "date"),
      select(
        "Payment frequency",
        "frequency",
        ["monthly", "yearly", "weekly", "daily"],
        "monthly",
      ),
      n("Repeat every (frequency units)", "interval", 1),
      ...(kind === "subscription"
        ? [
            f("Trial end date (optional)", "trialEnds", "", "date"),
            f("Provider website (HTTPS, optional)", "website"),
          ]
        : []),
      f("Plan note (optional)", "note"),
    ];
    if (row) values = { ...row };
    note =
      kind === "installment"
        ? "The total is divided into exact installments, with any rounding in the last payment. Creating this tracker does not create debt or spend money."
        : "Track renewals and trials. No payment is posted until you confirm it. The frequency and interval support plans such as every 3 or 6 months.";
  } else if (kind === "subscriptionPayment" || kind === "installmentPayment") {
    const isInstallment = kind === "installmentPayment",
      plan = isInstallment
        ? s.installments.find((p) => p.id === id)
        : s.subscriptions.find((p) => p.id === id);
    if (!plan) throw Error("This plan no longer exists.");
    const stats = commitmentStats(
      s,
      plan,
      isInstallment ? "installment" : "subscription",
    );
    if (stats.complete) throw Error("All installments are already paid.");
    title = `Record ${plan.name}`;
    const draft = paymentDraft(
      s,
      plan,
      isInstallment ? "installment" : "subscription",
    );
    values = draft;
    fields = [
      select(
        "How to record payment",
        "method",
        [
          { value: "transaction", label: "Create an expense transaction" },
          { value: "manual", label: "Mark paid only — no transaction" },
        ],
        "transaction",
      ),
      select("Pay from account", "accountId", accounts, plan.accountId),
      n("Actual cash amount", "amount", draft.amount),
      f("Payment date", "date", bahrainDate(), "date"),
      f("Payment note (optional)", "note"),
    ];
    note = `Occurrence ${stats.index + 1}, due ${stats.due}. Mark paid only updates this tracker, without changing balances or creating an expense. Use it for payments already recorded elsewhere.`;
  } else return null;
  return {
    kind,
    id,
    title,
    fields,
    submitLabel,
    note,
    accounts: s.accounts,
    reportingCurrency: s.settings.base,
    values: {
      ...Object.fromEntries(
        fields.map((field) => [field.name, String(field.value ?? "")]),
      ),
      ...values,
      ...context,
    },
  };
}
