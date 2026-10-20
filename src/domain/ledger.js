import { toFils } from "../locale.js";
import {
  clone,
  amount,
  accountCurrency,
  convert,
  text,
  date,
} from "./model.js";
export function applyEffect(s, t, direction = 1) {
  const account = s.accounts.find((a) => a.id === t.accountId);
  if (!account) throw Error("Choose an existing account.");
  const delta =
    t.type === "income" || t.type === "adjustment"
      ? toFils(t.amount)
      : -toFils(t.amount);
  account.balance = amount(
    (toFils(account.balance) + direction * delta) / 1000,
  );
  if (t.type === "transfer") {
    const destination = s.accounts.find((a) => a.id === t.toAccountId);
    if (!destination || destination.id === account.id)
      throw Error("Choose different accounts for your transfer.");
    destination.balance = amount(
      (toFils(destination.balance) +
        direction * toFils(t.received ?? t.amount)) /
        1000,
    );
  }
}
export function saveTransaction(s, data, id, uuid = () => crypto.randomUUID()) {
  const old = s.transactions.find((t) => t.id === id);
  if (
    data.captureFingerprint &&
    s.transactions.some(
      (t) => t.id !== id && t.captureFingerprint === data.captureFingerprint,
    )
  )
    throw Error(
      "This captured message was already recorded. Check your transactions before adding another copy.",
    );
  if (old?.debtId || old?.commitmentId)
    throw Error(
      "Linked repayments cannot be edited. Delete the repayment and record its replacement to preserve principal.",
    );
  const t = {
    ...old,
    ...data,
    id: id || uuid(),
    name: text(data.name || old?.name),
    date: date(data.date),
    amount: amount(data.amount, data.type !== "adjustment"),
    currency: accountCurrency(s, data.accountId),
    labels: Array.isArray(data.labels)
      ? data.labels
      : String(data.labels || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
    note: String(data.note || "").slice(0, 500),
  };
  if (data.rewardPoints === "" || (data.rewardPoints == null && !old)) {
    const rate = s.accounts.find((a) => a.id === t.accountId)?.rewardRate || 0;
    t.rewardPoints =
      t.type === "expense" ? Math.round(t.amount * rate * 1000) / 1000 : 0;
  } else if (data.rewardPoints != null)
    t.rewardPoints = amount(data.rewardPoints);
  if (!["income", "expense", "transfer", "adjustment"].includes(t.type))
    throw Error("Choose a valid transaction type.");
  if (t.labels.length > 5 || t.labels.some((x) => x.length > 40))
    throw Error("Use up to five labels of 40 characters each.");
  if (t.time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t.time))
    throw Error("Time must be HH:mm or HH:mm:ss.");
  if (t.projectId && t.type !== "expense")
    throw Error("Project budgets track expenses only.");
  if (
    t.projectId &&
    !s.projects.some((p) => p.id === t.projectId && !p.archived)
  )
    throw Error("Choose an active project.");
  if (t.type !== "income") delete t.salaryMonth;
  if (t.type === "transfer")
    t.received =
      data.received === "" || data.received == null
        ? convert(s, t.amount, t.currency, accountCurrency(s, t.toAccountId))
        : amount(data.received, true);
  if (old) applyEffect(s, old, -1);
  applyEffect(s, t);
  s.transactions = s.transactions.filter((row) => row.id !== t.id);
  s.transactions.unshift(t);
  return t;
}
export function deleteTransaction(s, id) {
  const t = s.transactions.find((t) => t.id === id);
  if (!t) throw Error("Transaction not found.");
  applyEffect(s, t, -1);
  if (t.debtId) {
    const debt = s.debts.find((d) => d.id === t.debtId);
    if (debt)
      debt.balance = (toFils(debt.balance) + toFils(t.principal)) / 1000;
  }
  s.transactions = s.transactions.filter((row) => row.id !== id);
  for (const plan of [...(s.subscriptions || []), ...(s.installments || [])])
    plan.payments = plan.payments.filter((p) => p.transactionId !== id);
  for (const p of s.projects)
    for (const doc of p.documents)
      if (doc.transactionId === id) doc.transactionId = "";
  // The occurrence remains consumed even when deleted. Deleting history must
  // never silently reopen and duplicate an already-advanced bill/salary cycle.
}
export function copyTransaction(t) {
  const copy = clone(t);
  for (const key of [
    "id",
    "recurringId",
    "scheduledFor",
    "debtId",
    "principal",
    "contractId",
    "milestoneId",
    "commitmentId",
    "commitmentType",
    "commitmentOccurrence",
    "pinned",
    "captureFingerprint",
  ])
    delete copy[key];
  return copy;
}
