import { normalizeWorkspace, convert } from "./domain/model.js";
import { addTransfer } from "./finance.js";
import { addTransaction, categories } from "./finance.js";
import { bahrainDate, toFils, isCivilDate } from "./locale.js";

export const frequencies = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};
export function normalizePlanning(state) {
  return {
    ...state,
    recurring: state.recurring ?? [],
    debts: state.debts ?? [],
    projects: state.projects ?? [],
  };
}
function positive(value, label) {
  const fils = toFils(value);
  if (fils <= 0) throw Error(`${label} must be greater than zero.`);
  return fils / 1000;
}
function name(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 80)
    throw Error("Enter a name between 1 and 80 characters.");
  return text;
}
function validDate(value) {
  if (!isCivilDate(value)) throw Error("Choose a valid date.");
  return value;
}
function accountExists(state, id) {
  if (!state.accounts.some((a) => a.id === id))
    throw Error("Choose an existing account.");
}
export function nextOccurrence(
  date,
  frequency,
  anchorDay = Number(date.slice(8)),
  anchorMonth = Number(date.slice(5, 7)),
) {
  validDate(date);
  if (!Object.hasOwn(frequencies, frequency))
    throw Error("Choose a repeat frequency.");
  const [year, month, day] = date.split("-").map(Number);
  if (frequency === "weekly" || frequency === "daily") {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(day + (frequency === "daily" ? 1 : 7));
    return next.toISOString().slice(0, 10);
  }
  const target = new Date(
    Date.UTC(
      year + (frequency === "yearly" ? 1 : 0),
      frequency === "yearly" ? anchorMonth - 1 : month,
      1,
      12,
    ),
  );
  const days = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(anchorDay, days));
  return target.toISOString().slice(0, 10);
}
export function dueStatus(date, today = bahrainDate()) {
  if (date < today) return "Overdue";
  if (date === today) return "Due today";
  return "Upcoming";
}
export function saveRecurring(state, data, id = crypto.randomUUID()) {
  const old = state.recurring.find((r) => r.id === id);
  accountExists(state, data.accountId);
  if (!["income", "expense", "transfer"].includes(data.type))
    throw Error("Choose income or expense.");
  if (!Object.hasOwn(frequencies, data.frequency))
    throw Error("Choose a repeat frequency.");
  if (!String(data.category || "").trim()) throw Error("Choose a category.");
  if (
    data.type === "transfer" &&
    (!state.accounts.some((a) => a.id === data.toAccountId) ||
      data.accountId === data.toAccountId)
  )
    throw Error("Choose different accounts for the recurring transfer.");
  const nextDue = validDate(data.nextDue);
  const changedDate = old?.nextDue !== nextDue;
  const record = {
    id,
    name: name(data.name),
    type: data.type,
    category: data.type === "income" ? "Income" : data.category,
    amount: positive(data.amount, "Amount"),
    accountId: data.accountId,
    frequency: data.frequency,
    nextDue,
    anchorDay: changedDate ? Number(nextDue.slice(8)) : old.anchorDay,
    anchorMonth: changedDate ? Number(nextDue.slice(5, 7)) : old.anchorMonth,
    paused: old?.paused ?? false,
    toAccountId: data.toAccountId || "",
    received: data.received
      ? positive(data.received, "Received amount")
      : undefined,
    isSalary: data.isSalary === true || data.isSalary === "yes",
    currency:
      state.accounts.find((a) => a.id === data.accountId)?.currency || "BHD",
  };
  if (old?.loanInstallment) {
    if (
      record.type !== "transfer" ||
      record.frequency !== "monthly" ||
      record.toAccountId !== old.toAccountId
    )
      throw Error("Use the linked loan installment form to change this plan.");
    Object.assign(record, {
      loanInstallment: true,
      interest: old.interest || 0,
      received: record.amount,
    });
  }
  const index = state.recurring.findIndex((r) => r.id === id);
  if (index < 0) state.recurring.push(record);
  else state.recurring[index] = record;
  return record;
}
export function recordRecurring(
  state,
  id,
  data,
  transactionId = crypto.randomUUID(),
) {
  const schedule = state.recurring.find((r) => r.id === id);
  if (!schedule || schedule.paused)
    throw Error("This schedule is no longer active.");
  if (
    schedule.nextDue !== data.scheduledFor ||
    state.transactions.some(
      (t) => t.recurringId === id && t.scheduledFor === data.scheduledFor,
    )
  ) {
    throw Error(
      "This payment has already been recorded or the schedule changed. Refresh and check the next due date.",
    );
  }
  const next = nextOccurrence(
    schedule.nextDue,
    schedule.frequency,
    schedule.anchorDay,
    schedule.anchorMonth,
  );
  if (schedule.loanInstallment) {
    const loan = state.accounts.find((a) => a.id === schedule.toAccountId),
      source = state.accounts.find((a) => a.id === data.accountId);
    if (
      !loan ||
      loan.type !== "Loan" ||
      !source ||
      source.currency !== loan.currency
    )
      throw Error("Loan installments require accounts in the same currency.");
    if (toFils(data.amount) > toFils(Math.max(0, -loan.balance)))
      throw Error("Principal exceeds the remaining loan balance.");
  }
  (schedule.type === "transfer" ? addTransfer : addTransaction)(state, {
    toAccountId: schedule.toAccountId,
    received: schedule.loanInstallment
      ? data.amount
      : data.received || schedule.received,
    salaryMonth:
      data.salaryMonth ||
      (schedule.isSalary ? data.scheduledFor.slice(0, 7) : undefined),
    id: transactionId,
    name: schedule.name,
    type: schedule.type,
    category: schedule.category,
    accountId: data.accountId,
    amount: positive(data.amount, "Amount"),
    date: validDate(data.date),
    recurringId: id,
    scheduledFor: schedule.nextDue,
  });
  if (schedule.type === "transfer")
    Object.assign(state.transactions[0], {
      recurringId: id,
      scheduledFor: schedule.nextDue,
    });
  if (schedule.loanInstallment && schedule.interest > 0)
    addTransaction(state, {
      id: `${transactionId}-interest`,
      name: `Interest · ${schedule.name}`,
      type: "expense",
      category: "Debts & loans",
      accountId: data.accountId,
      amount: schedule.interest,
      date: data.date,
      recurringId: id,
      scheduledFor: schedule.nextDue,
    });
  schedule.nextDue = next;
}
export function addDebt(state, data, id = crypto.randomUUID()) {
  const balance = positive(data.balance, "Outstanding principal");
  const record = {
    id,
    name: name(data.name),
    direction: data.direction === "lent" ? "lent" : "borrowed",
    currency: data.currency || "BHD",
    lender: String(data.lender || "")
      .trim()
      .slice(0, 80),
    balance,
    originalBalance: balance,
    installment: positive(data.installment, "Planned payment"),
    nextDue: validDate(data.nextDue),
    anchorDay: Number(data.nextDue.slice(8)),
  };
  state.debts.push(record);
  return record;
}
export function recordRepayment(
  state,
  id,
  data,
  transactionId = crypto.randomUUID(),
) {
  const debt = state.debts.find((d) => d.id === id);
  if (!debt || debt.balance <= 0)
    throw Error("This debt has already been repaid.");
  if (debt.nextDue !== data.scheduledFor)
    throw Error(
      "This repayment schedule changed. Refresh before recording another payment.",
    );
  const amount = positive(data.amount, "Payment");
  const principal = positive(data.principal, "Principal portion");
  if (
    toFils(principal) >
    toFils(
      convert(
        state,
        amount,
        state.accounts.find((a) => a.id === data.accountId)?.currency || "BHD",
        debt.currency || "BHD",
      ),
    )
  )
    throw Error("The principal portion cannot exceed the total payment.");
  if (toFils(principal) > toFils(debt.balance))
    throw Error("The principal portion cannot exceed the outstanding debt.");
  const next = nextOccurrence(debt.nextDue, "monthly", debt.anchorDay);
  addTransaction(state, {
    id: transactionId,
    name: `Repayment · ${debt.name}`,
    type: debt.direction === "lent" ? "income" : "expense",
    category: "Debts & loans",
    accountId: data.accountId,
    amount,
    date: validDate(data.date),
    debtId: id,
    principal,
    scheduledFor: debt.nextDue,
  });
  debt.balance = (toFils(debt.balance) - toFils(principal)) / 1000;
  debt.nextDue = next;
}
export function saveProject(state, data, id = crypto.randomUUID()) {
  const old = state.projects.find((p) => p.id === id);
  const record = {
    id,
    name: name(data.name),
    budget: positive(data.budget, "Budget"),
    targetDate: data.targetDate ? validDate(data.targetDate) : "",
    notes: String(data.notes || "")
      .trim()
      .slice(0, 300),
    archived: old?.archived ?? false,
    currency: old?.currency || data.currency || "BHD",
    reserve: old?.reserve || 0,
    categories: old?.categories || [],
    contracts: old?.contracts || [],
    milestones: old?.milestones || [],
    documents: old?.documents || [],
    startDate: data.startDate || old?.startDate || bahrainDate(),
  };
  const index = state.projects.findIndex((p) => p.id === id);
  if (index < 0) state.projects.push(record);
  else state.projects[index] = record;
  return record;
}
export function projectSpend(state, id) {
  return (
    state.transactions
      .filter((t) => t.projectId === id && t.type === "expense")
      .reduce(
        (sum, t) =>
          sum +
          toFils(
            convert(
              state,
              t.amount,
              t.currency ||
                state.accounts.find((a) => a.id === t.accountId)?.currency ||
                "BHD",
              state.projects.find((p) => p.id === id)?.currency || "BHD",
            ),
          ),
        0,
      ) / 1000
  );
}
export function upcomingPayments(state) {
  return [
    ...upcomingCommitments(state),
    ...state.recurring
      .filter((r) => !r.paused)
      .map((r) => ({ ...r, kind: "recurring" })),
    ...state.debts
      .filter((d) => d.balance > 0)
      .map((d) => ({
        ...d,
        amount: d.installment,
        type: d.direction === "lent" ? "income" : "expense",
        kind: "debt",
      })),
  ].sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}
import { upcomingCommitments } from "./domain/commitments.js";
