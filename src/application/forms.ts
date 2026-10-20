import { accountAppearanceFields, contactFields } from "./enhancementForms.ts";
import type {
  FieldOption,
  FormContext,
  FormField,
  FormSpec,
} from "./enhancementForms.ts";
import { featureForm } from "./featureForms.ts";
import { categoryPaths } from "../domain/commands.ts";
import { normalizeWorkspace, currencyCodes } from "../domain/model.ts";
import { categories } from "../finance.ts";
import { bahrainDate } from "../locale.ts";
import { frequencies } from "../planning.ts";
import { must } from "../guards.ts";
export type { FormField, FormSpec } from "./enhancementForms.ts";
const field = (
  label: string,
  name: string,
  type = "text",
  value: unknown = "",
  options?: readonly FieldOption[],
): FormField => ({
  label,
  name,
  type,
  value,
  options,
});
const amount = (label: string, name: string, value: unknown = "") =>
  field(label, name, "number", value);
export function entryForm(
  kind: string,
  id: string | null | undefined,
  input: unknown,
  context: FormContext = {},
): FormSpec {
  const state = normalizeWorkspace(input);
  const feature = featureForm(kind, id, state, context);
  if (feature) return feature;
  const accounts = state.accounts.map((a) => ({ value: a.id, label: a.name }));
  const account = (
    label = "Account",
    name = "accountId",
    value: unknown = state.settings.defaultAccountId || accounts[0]?.value || "",
  ) => field(label, name, "select", value, accounts);
  const category = () =>
    field("Category", "category", "select", "Shopping", categoryPaths(state));
  const date = (label = "Date", name = "date", value = bahrainDate()) =>
    field(label, name, "date", value);
  let title = "",
    fields: FormField[] = [],
    values: Record<string, unknown> = {},
    note = "";
  if (
    ["transaction", "transfer", "recurring", "record", "repayment"].includes(
      kind,
    ) &&
    accounts.length < (kind === "transfer" ? 2 : 1)
  )
    throw Error(
      kind === "transfer"
        ? "Add at least two accounts before recording a transfer."
        : "Add an account before recording payments.",
    );
  if (kind === "transaction") {
    title = "A new money moment";
    fields = [
      field("Type", "type", "select", "expense", [
        "expense",
        "income",
        "adjustment",
      ]),
      amount("Amount (BHD)", "amount"),
      field("Description", "name"),
      category(),
      date(),
      account(),
      field("Project (optional)", "projectId", "select", id || "", [
        { value: "", label: "No project" },
        ...state.projects
          .filter((p) => !p.archived)
          .map((p) => ({ value: p.id, label: p.name })),
      ]),
    ];
  } else if (kind === "transfer") {
    title = "Give your money a new home";
    fields = [
      account("From account"),
      // The check above guarantees two accounts.
      account("To account", "toAccountId", must(accounts[1], "account").value),
      amount("Amount (BHD)", "amount"),
      date(),
      field("Description", "name", "text", "Account transfer"),
    ];
    note =
      "Record a transfer you have already made. This updates both account balances and stays out of income, spending and budgets. FinancialAdvisor does not move real money.";
  } else if (kind === "account") {
    title = "Give your money a home";
    fields = [
      field("Account name", "name"),
      field("Account type", "type", "select", "Current account", [
        "Current account",
        "Savings",
        "Investment",
        "Cash",
        "Credit card",
        "Fixed deposit",
        "Loan",
        "Money lent",
      ]),
      amount("Current balance (negative for debt)", "balance", "0"),
      field("Last four digits (optional)", "last4"),
      field("Account currency", "currency", "select", "BHD", currencyCodes),
      ...accountAppearanceFields(),
      amount("Tenure in months (optional)", "tenure", 0),
      amount("Original loan amount (optional)", "loanOriginal", 0),
      amount("Monthly loan installment (optional)", "installment", 0),
      amount("APR (%) (optional)", "apr", 0),
      amount("Credit limit (optional)", "limit", 0),
      amount("Cost basis (optional)", "cost", 0),
      date("Start date (optional)", "startDate", ""),
      date("Maturity date (optional)", "maturity", ""),
    ];
    note =
      "Balances are tracked manually in the selected account currency. Never enter bank credentials.";
  } else if (kind === "budget") {
    title = "Make a little plan";
    fields = [
      {
        ...category(),
        options: categoryPaths(state).filter((c) => c !== "Income"),
      },
      amount("Monthly spending limit (BHD)", "limit"),
    ];
    fields.push(
      field("Budget period", "period", "select", "Monthly", [
        "Monthly",
        "Yearly",
      ]),
    );
    note =
      "Budgets repeat each month. Saving an existing category updates its limit.";
  } else if (kind === "goal") {
    title = "What’s on your horizon?";
    fields = [
      field("Goal name", "name"),
      amount("Target amount (BHD)", "target"),
      amount("Already saved (BHD)", "saved", "0"),
    ];
  } else if (kind === "fund") {
    const goal = state.goals.find((g) => g.id === id);
    if (!goal) throw Error("This goal no longer exists.");
    title = `Progress: ${goal.name}`;
    values.currency = goal.currency;
    fields = [amount("Total saved so far (BHD)", "saved", goal.saved)];
    note = "This updates your goal tracker only; no money is moved.";
  } else if (kind === "recurring") {
    const row = state.recurring.find((r) => r.id === id);
    title = row ? "Edit schedule" : "Plan a bill or salary";
    fields = [
      field("Schedule name", "name"),
      field("Direction", "type", "select", "expense", [
        "expense",
        "income",
        "transfer",
      ]),
      amount("Amount (BHD)", "amount"),
      category(),
      account(),
      field("Transfer destination (optional)", "toAccountId", "select", "", [
        { value: "", label: "None" },
        ...accounts,
      ]),
      field("Salary schedule", "isSalary", "select", "no", ["no", "yes"]),
      field(
        "Repeat",
        "frequency",
        "select",
        "monthly",
        Object.entries(frequencies).map(([value, label]) => ({ value, label })),
      ),
      date("Next due date", "nextDue"),
    ];
    if (row) values = { ...row, isSalary: row.isSalary ? "yes" : "no" };
    note =
      "Schedules are reminders. Record each payment after it happens; future payments do not change your balance.";
  } else if (kind === "record" || kind === "repayment") {
    // A record is a schedule occurrence; a repayment pays a debt.
    const schedule =
        kind === "record"
          ? state.recurring.find((r) => r.id === id)
          : undefined,
      debt =
        kind === "record" ? undefined : state.debts.find((r) => r.id === id),
      row = schedule || debt;
    if (!row) throw Error("This schedule no longer exists.");
    title = schedule
      ? `Record ${schedule.type === "income" ? "income" : "payment"}`
      : "Record repayment";
    fields = [
      account(
        "Pay from account",
        "accountId",
        // Debts have no account of their own; `in` reads it exactly as row.accountId did.
        ("accountId" in row ? row.accountId : undefined) ||
          must(accounts[0], "account").value,
      ),
      amount(
        schedule ? "Actual amount (BHD)" : "Total payment (BHD)",
        "amount",
        schedule ? schedule.amount : debt?.installment,
      ),
      date("Payment date"),
    ];
    if (debt)
      fields.push(
        amount(
          "Principal portion (BHD)",
          "principal",
          Math.min(debt.installment, debt.balance),
        ),
      );
    values = { scheduledFor: row.nextDue };
    note =
      "Only record a payment that has already happened. This creates a transaction and advances the next due date.";
  } else if (kind === "debt") {
    title = "Keep your repayments in view";
    fields = [
      field("Debt name", "name"),
      field("Lender (optional)", "lender"),
      field("Debt direction", "direction", "select", "borrowed", [
        { value: "borrowed", label: "Money borrowed" },
        { value: "lent", label: "Money lent" },
      ]),
      field("Debt currency", "currency", "select", "BHD", currencyCodes),
      amount("Outstanding principal (BHD)", "balance"),
      amount("Planned monthly payment (BHD)", "installment"),
      date("Next due date", "nextDue"),
    ];
    note =
      "Tracking a debt does not change an account balance. Record repayments to update both your account and outstanding principal.";
  } else if (kind === "project") {
    const row = state.projects.find((p) => p.id === id);
    title = row ? "Edit project" : "A plan for your next chapter";
    fields = [
      field("Project name", "name"),
      amount("Project budget (BHD)", "budget"),
      date("Target date (optional)", "targetDate", ""),
      field("Notes (optional)", "notes"),
    ];
    if (row) values = { ...row };
  } else throw Error("Choose an entry type.");
  const currency =
    state.accounts.find((a) => a.id === values.accountId)?.currency || "BHD";
  if (currency !== "BHD")
    fields = fields.map((f) => ({
      ...f,
      label: f.label.replaceAll("BHD", currency),
    }));
  if (kind === "transaction")
    fields.push(
      field("Time (optional)", "time"),
      field("Labels (comma separated, optional)", "labels"),
      field("Note (optional)", "note"),
      field("Salary month (optional)", "salaryMonth", "month", ""),
      ...contactFields(state),
    );
  if (kind === "transfer")
    fields.push(amount("Received amount (optional)", "received"));
  if (kind === "project")
    fields.push(
      field("Project currency", "currency", "select", "BHD", currencyCodes),
      date("Start date (optional)", "startDate", bahrainDate()),
    );
  if (kind === "record") {
    const r = state.recurring.find((r) => r.id === id);
    if (r?.type === "transfer")
      fields.push(
        amount("Received amount (optional)", "received", r.received || ""),
      );
  }
  if (kind === "record")
    fields.push(field("Salary month (optional)", "salaryMonth", "month", ""));
  if (kind === "repayment")
    values.currency = state.debts.find((d) => d.id === id)?.currency || "BHD";
  return {
    kind,
    accounts: state.accounts.map((a) => ({ id: a.id, currency: a.currency })),
    reportingCurrency: state.settings.base,
    id,
    title,
    fields,
    note,
    values: {
      ...Object.fromEntries(fields.map((f) => [f.name, String(f.value)])),
      ...values,
      ...context.draft,
    },
  };
}
