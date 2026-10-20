import { organizeCommand, accountAppearance } from "../domain/organizing.ts";
import { commitmentCommand } from "../domain/commitments.ts";
import { termDetails } from "../domain/accounts.ts";
import { normalizeWorkspace, validateWorkspace } from "../domain/model.ts";
import { featureCommand } from "../domain/commands.ts";
import { projectCommand, validateProjects } from "../domain/projects.ts";
import { saveTransaction } from "../domain/ledger.ts";
import { addTransaction, addTransfer } from "../finance.ts";
import {
  saveRecurring,
  recordRecurring,
  addDebt,
  recordRepayment,
  saveProject,
} from "../planning.ts";
import { toFils } from "../locale.ts";
const positive = (value, label) => {
  const amount = toFils(value) / 1000;
  if (amount <= 0) throw Error(`${label} must be greater than zero.`);
  return amount;
};
const nonnegative = (value) => {
  const amount = toFils(value) / 1000;
  if (amount < 0) throw Error("Saved amounts cannot be negative.");
  return amount;
};
function name(value, max = 80) {
  const text = String(value || "").trim();
  if (!text || text.length > max)
    throw Error(`Enter a name between 1 and ${max} characters.`);
  return text;
}
// Both clients use exactly the same mutations. Clone before validation so failed
// changes cannot alter account balances or the workspace currently on screen.
export function applyEntry(
  state,
  kind,
  data,
  id,
  uuid = () => crypto.randomUUID(),
) {
  const next = normalizeWorkspace(state);
  const organized =
    organizeCommand(next, kind, data, id, uuid) ||
    commitmentCommand(next, kind, data, id, uuid);
  if (organized) return organized;
  const feature = featureCommand(next, kind, data, id, uuid);
  if (feature) return validateProjects(feature);
  const project = projectCommand(next, kind, data, id, uuid);
  if (project) return project;
  if (kind === "transaction")
    saveTransaction(
      next,
      {
        ...data,
        name: name(data.name),
        id: uuid(),
        amount: positive(data.amount, "Amount"),
      },
      undefined,
      uuid,
    );
  else if (kind === "transfer") addTransfer(next, { ...data, id: uuid() });
  else if (kind === "account") {
    if (data.last4 && !/^\d{4}$/.test(data.last4))
      throw Error(
        "Enter exactly four digits or leave the last four digits blank.",
      );
    next.accounts.push({
      ...data,
      id: uuid(),
      ...termDetails(data),
      ...accountAppearance(data),
      name: name(data.name, 60),
      balance: toFils(data.balance) / 1000,
      currency: data.currency || "BHD",
      apr: Number(data.apr || 0),
      limit: Number(data.limit || 0),
      cost: Number(data.cost || 0),
    });
  } else if (kind === "budget") {
    const limit = positive(data.limit, "Spending limit");
    next.budgets = next.budgets.filter(
      (b) =>
        !(
          b.category === data.category &&
          (b.period || "Monthly") === (data.period || "Monthly")
        ),
    );
    next.budgets.push({
      id: uuid(),
      category: data.category,
      currency: next.settings.base,
      period: data.period || "Monthly",
      limit,
    });
  } else if (kind === "goal")
    next.goals.push({
      id: uuid(),
      name: name(data.name, 60),
      target: positive(data.target, "Target"),
      saved: nonnegative(data.saved),
      icon: "flag",
      currency: next.settings.base,
    });
  else if (kind === "fund") {
    const goal = next.goals.find((g) => g.id === id);
    if (!goal) throw Error("This goal no longer exists.");
    goal.saved = nonnegative(data.saved);
  } else if (kind === "recurring") saveRecurring(next, data, id || uuid());
  else if (kind === "record") recordRecurring(next, id, data, uuid());
  else if (kind === "debt") addDebt(next, data, uuid());
  else if (kind === "repayment") recordRepayment(next, id, data, uuid());
  else if (kind === "project") saveProject(next, data, id || uuid());
  else throw Error("Choose a valid entry type.");
  validateWorkspace(next);
  validateProjects(next);
  return next;
}
export function togglePlan(state, kind, id) {
  const next = JSON.parse(JSON.stringify(state));
  const record = (kind === "pause" ? next.recurring : next.projects).find(
    (row) => row.id === id,
  );
  if (!record) throw Error("This plan no longer exists.");
  const field = kind === "pause" ? "paused" : "archived";
  record[field] = !record[field];
  return next;
}
export function transactionCSV(state, transactions) {
  const cell = (value) =>
    '"' +
    String(value ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const currencies = [
    ...new Set(
      transactions.map(
        (t) =>
          t.currency ||
          state.accounts.find((a) => a.id === t.accountId)?.currency ||
          "BHD",
      ),
    ),
  ];
  const amountHeader =
    currencies.length === 1 ? `Amount (${currencies[0]})` : "Amount";
  return [
    `Date,Description,Category,Type,${amountHeader},Currency,Account,To Account,Time,Labels,Note,Payee,Location,Reward Points`,
    ...transactions.map((t) =>
      [
        t.date,
        t.name,
        t.category,
        t.type,
        t.amount.toFixed(3),
        t.currency ||
          state.accounts.find((a) => a.id === t.accountId)?.currency ||
          "BHD",
        state.accounts.find((a) => a.id === t.accountId)?.name || "",
        t.type === "transfer"
          ? state.accounts.find((a) => a.id === t.toAccountId)?.name || ""
          : "",
        t.time || "",
        (t.labels || []).join(", "),
        t.note || "",
        state.payees?.find((p) => p.id === t.payeeId)?.name || "",
        t.location || "",
        t.rewardPoints || "",
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
