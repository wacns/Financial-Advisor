import { organizeCommand, accountAppearance } from "../domain/organizing.ts";
import type { OrganizeInput } from "../domain/organizing.ts";
import { commitmentCommand } from "../domain/commitments.ts";
import type { CommitmentInput } from "../domain/commitments.ts";
import { termDetails } from "../domain/accounts.ts";
import { normalizeWorkspace, validateWorkspace, clone } from "../domain/model.ts";
import { featureCommand } from "../domain/commands.ts";
import type { FeatureInput } from "../domain/commands.ts";
import { projectCommand, validateProjects } from "../domain/projects.ts";
import type { ProjectInput } from "../domain/projects.ts";
import { saveTransaction } from "../domain/ledger.ts";
import { addTransaction, addTransfer } from "../finance.ts";
import {
  saveRecurring,
  recordRecurring,
  addDebt,
  recordRepayment,
  saveProject,
} from "../planning.ts";
import type {
  DebtInput,
  OccurrenceInput,
  ProjectFormInput,
  RecurringInput,
  RepaymentInput,
} from "../planning.ts";
import { toFils } from "../locale.ts";
import { checkedLater } from "../guards.ts";
import type { Account, Budget, Transaction, Workspace } from "../domain/types.ts";
/**
 * Everything an entry form can submit. Each entry kind reads its own fields; values are
 * unchecked until the command for that kind and validateWorkspace check them.
 */
export type EntryInput = OrganizeInput &
  CommitmentInput &
  FeatureInput &
  ProjectInput &
  RecurringInput &
  OccurrenceInput &
  DebtInput &
  RepaymentInput &
  ProjectFormInput & { [K in keyof Account]?: unknown } & {
    [K in keyof Budget]?: unknown;
  };
const positive = (value: unknown, label: string) => {
  const amount = toFils(value) / 1000;
  if (amount <= 0) throw Error(`${label} must be greater than zero.`);
  return amount;
};
const nonnegative = (value: unknown) => {
  const amount = toFils(value) / 1000;
  if (amount < 0) throw Error("Saved amounts cannot be negative.");
  return amount;
};
function name(value: unknown, max = 80): string {
  const text = String(value || "").trim();
  if (!text || text.length > max)
    throw Error(`Enter a name between 1 and ${max} characters.`);
  return text;
}
// Both clients use exactly the same mutations. Clone before validation so failed
// changes cannot alter account balances or the workspace currently on screen.
export function applyEntry(
  state: unknown,
  kind: string,
  data: EntryInput,
  id: string | null | undefined,
  uuid: () => string = () => crypto.randomUUID(),
): Workspace {
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
    if (data.last4 && !/^\d{4}$/.test(String(data.last4)))
      throw Error(
        "Enter exactly four digits or leave the last four digits blank.",
      );
    next.accounts.push(
      checkedLater<Account>({
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
      }),
    );
  } else if (kind === "budget") {
    const limit = positive(data.limit, "Spending limit");
    next.budgets = next.budgets.filter(
      (b) =>
        !(
          b.category === data.category &&
          (b.period || "Monthly") === (data.period || "Monthly")
        ),
    );
    next.budgets.push(
      checkedLater<Budget>({
        id: uuid(),
        category: data.category,
        currency: next.settings.base,
        period: data.period || "Monthly",
        limit,
      }),
    );
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
export function togglePlan(
  state: Workspace,
  kind: string,
  id: string | null | undefined,
): Workspace {
  const next = clone(state);
  // A schedule toggles paused; anything else is a project and toggles archived.
  if (kind === "pause") {
    const record = next.recurring.find((row) => row.id === id);
    if (!record) throw Error("This plan no longer exists.");
    record.paused = !record.paused;
  } else {
    const record = next.projects.find((row) => row.id === id);
    if (!record) throw Error("This plan no longer exists.");
    record.archived = !record.archived;
  }
  return next;
}
export function transactionCSV(
  state: Workspace,
  transactions: Transaction[],
): string {
  const cell = (value: unknown) =>
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
