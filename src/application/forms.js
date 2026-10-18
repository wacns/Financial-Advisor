import { categories } from "../finance.js";
import { bahrainDate } from "../locale.js";
import { frequencies } from "../planning.js";
const field = (label, name, type = "text", value = "", options) => ({
  label,
  name,
  type,
  value,
  options,
});
const amount = (label, name, value = "") => field(label, name, "number", value);
export function entryForm(kind, id, state) {
  const accounts = state.accounts.map((a) => ({ value: a.id, label: a.name }));
  const account = (
    label = "Account",
    name = "accountId",
    value = accounts[0]?.value || "",
  ) => field(label, name, "select", value, accounts);
  const category = () =>
    field("Category", "category", "select", "Shopping", categories);
  const date = (label = "Date", name = "date", value = bahrainDate()) =>
    field(label, name, "date", value);
  let title = "",
    fields = [],
    values = {},
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
      field("Type", "type", "select", "expense", ["expense", "income"]),
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
      account("To account", "toAccountId", accounts[1].value),
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
      ]),
      amount("Current balance in BHD (negative for debt)", "balance", "0"),
      field("Last four digits (optional)", "last4"),
    ];
    note =
      "All balances are in BHD and tracked manually. Never enter bank credentials.";
  } else if (kind === "budget") {
    title = "Make a little plan";
    fields = [
      { ...category(), options: categories.filter((c) => c !== "Income") },
      amount("Monthly spending limit (BHD)", "limit"),
    ];
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
    fields = [amount("Total saved so far (BHD)", "saved", goal.saved)];
    note = "This updates your goal tracker only; no money is moved.";
  } else if (kind === "recurring") {
    const row = state.recurring.find((r) => r.id === id);
    title = row ? "Edit schedule" : "Plan a bill or salary";
    fields = [
      field("Schedule name", "name"),
      field("Direction", "type", "select", "expense", ["expense", "income"]),
      amount("Amount (BHD)", "amount"),
      category(),
      account(),
      field(
        "Repeat",
        "frequency",
        "select",
        "monthly",
        Object.entries(frequencies).map(([value, label]) => ({ value, label })),
      ),
      date("Next due date", "nextDue"),
    ];
    if (row) values = { ...row };
    note =
      "Schedules are reminders. Record each payment after it happens; future payments do not change your balance.";
  } else if (kind === "record" || kind === "repayment") {
    const row = (kind === "record" ? state.recurring : state.debts).find(
      (r) => r.id === id,
    );
    if (!row) throw Error("This schedule no longer exists.");
    title =
      kind === "record"
        ? `Record ${row.type === "income" ? "income" : "payment"}`
        : "Record repayment";
    fields = [
      account(
        "Pay from account",
        "accountId",
        row.accountId || accounts[0].value,
      ),
      amount(
        kind === "record" ? "Actual amount (BHD)" : "Total payment (BHD)",
        "amount",
        kind === "record" ? row.amount : row.installment,
      ),
      date("Payment date"),
    ];
    if (kind === "repayment")
      fields.push(
        amount(
          "Principal portion (BHD)",
          "principal",
          Math.min(row.installment, row.balance),
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
  return {
    kind,
    id,
    title,
    fields,
    note,
    values: {
      ...Object.fromEntries(fields.map((f) => [f.name, String(f.value)])),
      ...values,
    },
  };
}
