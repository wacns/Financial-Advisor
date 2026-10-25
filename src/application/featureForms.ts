import {
  enhancementForm,
  accountAppearanceFields,
  contactFields,
} from "./enhancementForms.ts";
import type {
  FieldOption,
  FormContext,
  FormField,
  FormSpec,
} from "./enhancementForms.ts";
import { currencyCodes } from "../domain/model.ts";
import { categoryPaths } from "../domain/commands.ts";
import { cycleKey, splitWeeks } from "../domain/cycles.ts";
import { bahrainDate } from "../locale.ts";
import { must } from "../guards.ts";
import type { Workspace } from "../domain/types.ts";
export const f = (
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
const d = (label: string, name: string, value: unknown = bahrainDate()) =>
  f(label, name, value, "date");
const firstValue = (options: readonly FieldOption[]) => {
  const first = options[0];
  return typeof first === "string" ? first : first?.value || "";
};
const select = (
  label: string,
  name: string,
  options: readonly FieldOption[],
  value: unknown = firstValue(options),
) => f(label, name, value, "select", options);
export function featureForm(
  kind: string,
  id: string | null | undefined,
  s: Workspace,
  context: FormContext = {},
): FormSpec | null {
  const enhanced = enhancementForm(kind, id, s, context);
  if (enhanced) return enhanced;
  const accountOptions = s.accounts.map((a) => ({
      value: a.id,
      label: `${a.name} · ${a.currency || "BHD"}`,
    })),
    categoryOptions = categoryPaths(s),
    project = s.projects.find((p) => p.id === context.projectId);
  // A form for a project item fails clearly when its project is gone, where it used to crash.
  const projectFor = () => must(project, "project");
  let fields: FormField[] = [],
    title = "",
    note = "",
    values: object | undefined = {};
  const account = () => select("Account", "accountId", accountOptions),
    category = () => select("Category", "category", categoryOptions);
  if (kind.startsWith("delete") || kind === "projectDeleteItem") {
    return {
      kind,
      id,
      title: "Confirm deletion",
      fields: [],
      submitLabel: "Delete",
      note:
        kind === "deleteTransaction"
          ? s.transactions.find((t) => t.id === id)?.commitmentId
            ? "This reverses the expense from the account balance and reopens the linked installment or subscription payment."
            : "This reverses the transaction from account balances. Bill and salary schedule due dates remain unchanged."
          : "Delete this record? Linked records may prevent deletion. This action is saved only when you press Delete.",
      values: { ...context },
    };
  } else if (kind === "editAccount") {
    const a = s.accounts.find((a) => a.id === id);
    title = "Edit account";
    fields = [
      f("Account name", "name"),
      select("Account type", "type", [
        "Current account",
        "Savings",
        "Investment",
        "Cash",
        "Credit card",
        "Fixed deposit",
        "Loan",
        "Money lent",
      ]),
      select("Account currency", "currency", currencyCodes),
      n("Final signed balance", "balance"),
      n("Tenure in months (optional)", "tenure", 0),
      n("Original loan amount (optional)", "loanOriginal", 0),
      n("Monthly loan installment (optional)", "installment", 0),
      n("APR (%)", "apr", 0),
      n("Credit limit", "limit", 0),
      n("Investment cost basis", "cost", 0),
      d("Start date (optional)", "startDate", ""),
      d("Maturity date (optional)", "maturity", ""),
      f("Last four digits (optional)", "last4"),
      ...accountAppearanceFields(),
    ];
    values = a;
    note =
      "Changing the balance creates one visible adjustment. Currency cannot change after transactions exist.";
  } else if (kind === "loanInstallment") {
    const loan = must(
        s.accounts.find((a) => a.id === context.loanId),
        "loan account",
      ),
      r = s.recurring.find(
        (r) => r.loanInstallment && r.toAccountId === loan.id,
      );
    title = "Schedule loan installment";
    fields = [
      select(
        "Pay from account",
        "accountId",
        accountOptions.filter(
          (a) =>
            a.value !== loan.id &&
            must(
              s.accounts.find((x) => x.id === a.value),
              "account",
            ).currency === loan.currency,
        ),
      ),
      n("Principal transfer amount", "amount", loan.installment || ""),
      n("Interest and fees (separate expense)", "interest", 0),
      d("Next due date", "nextDue"),
    ];
    values = r || {};
    note =
      "Recording pays principal into the loan account and records interest as a separate expense. No real money is sent.";
  } else if (kind === "reconcile") {
    title = "Reconcile account";
    fields = [
      n(
        "Final signed account balance",
        "balance",
        must(
          s.accounts.find((a) => a.id === id),
          "account",
        ).balance,
      ),
      d("Adjustment date", "date"),
    ];
    note =
      "The difference is recorded once as an adjustment. A negative value represents debt.";
  } else if (kind === "editTransaction") {
    const t = must(
      s.transactions.find((t) => t.id === id),
      "transaction",
    );
    title = "Edit transaction";
    fields = [
      select("Type", "type", ["expense", "income", "transfer", "adjustment"]),
      n("Amount", "amount"),
      f("Description", "name"),
      account(),
      select("To account", "toAccountId", [
        { value: "", label: "None" },
        ...accountOptions,
      ]),
      n("Received amount (optional)", "received"),
      category(),
      d("Date", "date"),
      f("Time (optional)", "time"),
      f("Labels (comma separated, optional)", "labels"),
      f("Note (optional)", "note"),
      ...contactFields(s),
    ];
    values = { ...t, labels: (t.labels || []).join(", ") };
    note =
      "Balances are reversed and recalculated atomically. For transfers, enter the actual destination amount.";
  } else if (kind === "template") {
    title = "Save transaction template";
    fields = [
      f(
        "Template name",
        "name",
        s.transactions.find((t) => t.id === context.transactionId)?.name || "",
      ),
    ];
  } else if (kind === "editGoal") {
    title = "Edit goal";
    fields = [
      f("Goal name", "name"),
      n("Target amount", "target"),
      n("Already saved", "saved"),
    ];
    values = s.goals.find((g) => g.id === id);
  } else if (kind === "editDebt") {
    title = "Edit debt";
    fields = [
      f("Debt name", "name"),
      f("Person or lender (optional)", "lender"),
      n("Planned monthly payment", "installment"),
      d("Next due date", "nextDue"),
    ];
    values = s.debts.find((g) => g.id === id);
  } else if (kind === "reminderPreferences") {
    const r = s.settings.reminders || {
      hour: 9,
      frequency: "daily",
      expenses: true,
      salary: false,
      advice: false,
    };
    title = "Reminder preferences";
    fields = [
      n("Reminder hour in Bahrain (0–23)", "hour", r.hour),
      select(
        "Reminder frequency",
        "frequency",
        ["daily", "weekly"],
        r.frequency,
      ),
      ...(["expenses", "salary", "advice"] as const).map((key) =>
        select(
          {
            expenses: "Payment reminders",
            salary: "Salary reminders",
            advice: "Educational check-ins",
          }[key],
          key,
          ["yes", "no"],
          r[key] ? "yes" : "no",
        ),
      ),
    ];
    note =
      "Choose what reminders to receive. Delivery also requires notification permission on your installed mobile app.";
  } else if (kind === "preferences") {
    title = "Workspace preferences";
    fields = [
      select(
        "Language",
        "language",
        [
          { value: "en", label: "English" },
          { value: "ar", label: "العربية" },
        ],
        s.settings.language,
      ),
      select("Theme", "theme", ["light", "dark", "system"], s.settings.theme),
      select("Reporting currency", "base", currencyCodes, s.settings.base),
      n(
        "Reporting cycle starts on day",
        "cycleStartDay",
        s.settings.cycleStartDay,
      ),
      select(
        "Animations",
        "motion",
        ["yes", "no"],
        s.settings.motion ? "yes" : "no",
      ),
    ];
    note =
      "Account currencies and historical amounts stay unchanged. Reports use your saved manual exchange rates.";
  } else if (kind === "rates") {
    title = "Manual exchange rates";
    fields = currencyCodes
      .filter((c) => c !== "BHD")
      .map((code) => n(`BHD per 1 ${code}`, code, s.settings.rates[code]));
    note =
      "Illustrative defaults are not live quotes. Enter your own rates; changing rates changes converted reports, never account balances.";
  } else if (kind === "category") {
    title = id ? "Rename category" : "New category";
    fields = [
      f("Category name", "name", id?.split(" / ").at(-1) || ""),
      select(
        "Parent category (optional)",
        "parent",
        [
          { value: "", label: "No parent" },
          ...categoryOptions
            .filter((c) => !c.includes(" / ") && c !== id)
            .map((c) => ({ value: c, label: c })),
        ],
        id?.includes(" / ") ? id.split(" / ")[0] : "",
      ),
    ];
    note =
      "Renaming updates linked transactions, plans, templates and budget rules. Only unused categories can be deleted.";
    fields.push(
      ...accountAppearanceFields()
        .slice(0, 2)
        .map((field) => ({
          ...field,
          label: field.label.replace("Account", "Category"),
        })),
    );
    values = {
      ...values,
      ...(s.settings.categoryStyles || []).find((style) => style.path === id),
    };
  } else if (kind === "cycleBudget" || kind === "subBudget") {
    const parent = s.cycleBudgets.find((b) => b.id === context.parentId),
      b =
        kind === "cycleBudget"
          ? s.cycleBudgets.find((b) => b.id === id)
          : parent?.children.find((c) => c.id === id);
    title = kind === "cycleBudget" ? "Cycle budget" : "Category sub-budget";
    fields = [
      f("Budget name", "name"),
      ...(kind === "cycleBudget"
        ? [
            f("Cycle month", "key", cycleKey(s), "month"),
            select(
              "Budget currency",
              "currency",
              currencyCodes,
              s.settings.base,
            ),
          ]
        : []),
      n("Total limit", "limit"),
      ...Array.from({ length: 4 }, (_, i) =>
        n(`Week ${i + 1} allocation (optional)`, `week${i + 1}`),
      ),
      select("Category mode", "categoryMode", ["all", "selected"]),
      f("Included categories (comma separated, optional)", "include"),
      f("Excluded categories (comma separated, optional)", "exclude"),
    ];
    if (b)
      values = {
        ...b,
        include: b.include.join(", "),
        exclude: b.exclude.join(", "),
        ...Object.fromEntries(
          b.weeks.map((value, i) => [`week${i + 1}`, value]),
        ),
      };
    note = `Leave all weekly fields empty to distribute evenly. Week 4 includes the remaining days. Category paths: ${categoryOptions.join(", ")}. Sub-budgets must fit their parent and cannot overlap categories.`;
  } else if (kind === "copyCycle") {
    title = "Copy budget to another cycle";
    fields = [f("Destination cycle month", "key", cycleKey(s), "month")];
  } else if (kind === "salaryLink") {
    title = "Assign salary month";
    fields = [
      f("Salary month", "salaryMonth", bahrainDate().slice(0, 7), "month"),
    ];
    note =
      "This labels recorded income without creating another transaction or changing balances.";
  } else if (kind === "warranty") {
    title = id ? "Edit warranty" : "New warranty";
    fields = [
      f("Item name", "name"),
      category(),
      f("Brand (optional)", "brand"),
      f("Serial number (optional)", "serial"),
      f("Retailer (optional)", "retailer"),
      d("Purchase date", "purchased"),
      d("Warranty expiry", "expires"),
      f("Notes (optional)", "notes"),
      f("Receipt image (optional)", "receipt", "", "image"),
    ];
    values = s.warranties.find((w) => w.id === id) || {};
  } else if (kind === "projectReserve") {
    title = "Project contingency";
    fields = [n("Contingency reserve", "reserve", projectFor().reserve)];
  } else if (kind === "projectCategory") {
    title = "Project category allocation";
    fields = [f("Category name", "name"), n("Allocated budget", "budget")];
    values = projectFor().categories.find((c) => c.id === id) || {};
  } else if (kind === "projectContract") {
    title = "Vendor agreement";
    fields = [
      f("Agreement name", "name"),
      f("Vendor (optional)", "vendor"),
      select(
        "Project category",
        "categoryId",
        projectFor().categories.map((c) => ({ value: c.id, label: c.name })),
      ),
      n("Original contract value", "original"),
      d("Start date (optional)", "startDate", ""),
      d("End date (optional)", "endDate", ""),
      f("Notes (optional)", "notes"),
    ];
    values = projectFor().contracts.find((c) => c.id === id) || {};
  } else if (kind === "projectVariation") {
    title = "Contract variation";
    fields = [
      f("Variation name", "name"),
      n("Change in value (negative for reduction)", "amount"),
      d("Date", "date"),
    ];
  } else if (kind === "projectMilestone") {
    title = "Scheduled project payment";
    fields = [
      f("Milestone name", "name"),
      select(
        "Agreement",
        "contractId",
        projectFor().contracts.map((c) => ({ value: c.id, label: c.name })),
      ),
      n("Milestone amount", "amount"),
      select("Payment kind", "kind", ["Milestone", "Advance", "Retention"]),
      d("Due date", "due"),
    ];
    values = projectFor().milestones.find((m) => m.id === id) || {};
  } else if (kind === "projectPayment") {
    const m = must(
      projectFor().milestones.find((m) => m.id === context.milestoneId),
      "milestone",
    );
    title = "Record project payment";
    fields = [
      f("Description", "name", m.name),
      account(),
      n("Amount in payment account currency", "amount"),
      d("Payment date", "date"),
    ];
  } else if (kind === "projectLink") {
    title = "Link existing expense";
    fields = [
      select(
        "Existing expense",
        "transactionId",
        s.transactions
          .filter(
            (t) =>
              t.type === "expense" &&
              (!t.projectId || t.projectId === projectFor().id),
          )
          .map((t) => ({
            value: t.id,
            label: `${t.date} · ${t.name} · ${t.amount}`,
          })),
      ),
      select(
        "Milestone",
        "milestoneId",
        projectFor().milestones.map((m) => ({ value: m.id, label: m.name })),
      ),
    ];
  } else if (kind === "projectDocument") {
    title = "Attach project document";
    fields = [
      f("Document name", "name"),
      f("Document file", "file", "", "file"),
      select("Agreement (optional)", "contractId", [
        { value: "", label: "None" },
        ...projectFor().contracts.map((c) => ({ value: c.id, label: c.name })),
      ]),
    ];
    note =
      "PDF, text and receipt images up to 1 MB. Documents are included in your private workspace backup.";
  } else return null;
  return {
    kind,
    id,
    title,
    fields,
    note,
    values: {
      ...Object.fromEntries(
        fields.map((field) => [field.name, String(field.value ?? "")]),
      ),
      ...values,
      ...context,
      ...context.draft,
    },
  };
}
