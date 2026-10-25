import { convert, recordValue } from "./domain/model.ts";
import { cycleRange } from "./domain/cycles.ts";
import {
  bahrainDate,
  CURRENCY,
  REGION,
  TIME_ZONE,
  toFils,
  isCivilDate,
} from "./locale.ts";
import { checkedLater, isOneOf, must } from "./guards.ts";
import type { TransactionInput } from "./domain/ledger.ts";
import type {
  StoredWorkspace,
  Transaction,
  TransactionType,
  Workspace,
} from "./domain/types.ts";
export const categories = [
  "Shopping",
  "Food & drink",
  "Transport",
  "Home",
  "Health",
  "Entertainment",
  "Utilities",
  "Debts & loans",
  "Income",
  "Other",
];
export function totalBalance(state: Pick<Workspace, "accounts" | "settings">): number {
  return (
    state.accounts
      .filter((account) => account.includeInTotal !== false)
      .reduce(
        (sum, account) =>
          sum +
          toFils(convert(state, account.balance, account.currency || "BHD")),
        0,
      ) / 1000
  );
}
export function monthTransactions(state: Workspace, month: string): Transaction[] {
  const { from, until } = cycleRange(state, month);
  return state.transactions
    .filter((t) =>
      t.type === "income" && t.salaryMonth
        ? t.salaryMonth === month
        : t.date >= from && t.date < until,
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.time || "").localeCompare(a.time || ""),
    );
}
export function summary(state: Workspace, month: string) {
  const transactions = monthTransactions(state, month);
  return {
    income:
      transactions
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + toFils(recordValue(state, t)), 0) / 1000,
    expenses:
      transactions
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Math.abs(toFils(recordValue(state, t))), 0) /
      1000,
  };
}
export function categorySpend(
  state: Workspace,
  month: string,
  category: string,
): number {
  return (
    monthTransactions(state, month)
      .filter(
        (t) =>
          t.type === "expense" &&
          (t.category === category || t.category.startsWith(category + " / ")),
      )
      .reduce((s, t) => s + Math.abs(toFils(recordValue(state, t))), 0) / 1000
  );
}
export function addTransaction(
  state: Workspace,
  transaction: TransactionInput,
): Workspace {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12)
    throw Error("Enter a valid positive amount.");
  if (!isOneOf(["income", "expense"], transaction.type))
    throw Error("Select a transaction type.");
  if (!isCivilDate(transaction.date)) throw Error("Choose a valid date.");
  if (
    transaction.projectId &&
    !state.projects?.some((p) => p.id === transaction.projectId && !p.archived)
  )
    throw Error("Choose an active project.");
  if (transaction.projectId && transaction.type !== "expense")
    throw Error("Project budgets track expenses only.");
  const account = state.accounts.find((a) => a.id === transaction.accountId);
  if (!account) throw Error("Choose an account first.");
  const fils = toFils(amount);
  account.balance =
    (toFils(account.balance) + (transaction.type === "income" ? fils : -fils)) /
    1000;
  const rewardPoints =
    transaction.rewardPoints == null || transaction.rewardPoints === ""
      ? transaction.type === "expense"
        ? Math.round(amount * (account.rewardRate || 0) * 1000) / 1000
        : 0
      : transaction.rewardPoints;
  state.transactions.unshift(
    checkedLater<Transaction>({ ...transaction, amount, rewardPoints }),
  );
  return state;
}
// A transfer is one ledger record with two account effects. It is neither
// income nor an expense, so existing budget and summary calculations exclude it.
export function addTransfer(
  state: Workspace,
  transfer: TransactionInput,
): Workspace {
  const source = state.accounts.find((a) => a.id === transfer.accountId);
  const destination = state.accounts.find((a) => a.id === transfer.toAccountId);
  if (!source || !destination) throw Error("Choose two existing accounts.");
  if (source.id === destination.id)
    throw Error("Choose different accounts for your transfer.");
  const fils = toFils(transfer.amount);
  if (fils <= 0) throw Error("Enter a valid positive amount.");
  if (!isCivilDate(transfer.date)) throw Error("Choose a valid date.");
  const name = String(transfer.name || "").trim();
  if (!name || name.length > 80)
    throw Error("Enter a description between 1 and 80 characters.");
  const sourceBalance = toFils(source.balance) - fils;
  const received =
    transfer.received === "" || transfer.received == null
      ? convert(
          state,
          transfer.amount,
          source.currency || "BHD",
          destination.currency || "BHD",
        )
      : Number(transfer.received);
  const receivedFils = toFils(received);
  if (receivedFils <= 0) throw Error("Enter a valid amount received.");
  const destinationBalance = toFils(destination.balance) + receivedFils;
  // Validate both resulting balances before changing either account.
  toFils(sourceBalance / 1000);
  toFils(destinationBalance / 1000);
  source.balance = sourceBalance / 1000;
  destination.balance = destinationBalance / 1000;
  state.transactions.unshift(
    checkedLater<Transaction>({
      id: transfer.id,
      name,
      type: "transfer",
      category: "Transfer",
      amount: fils / 1000,
      received,
      currency: source.currency || "BHD",
      date: transfer.date,
      accountId: source.id,
      toAccountId: destination.id,
    }),
  );
  return state;
}
/** A new, empty workspace; normalizeWorkspace fills in the remaining collections and settings. */
export function blankState(): StoredWorkspace & {
  accounts: NonNullable<StoredWorkspace["accounts"]>;
  transactions: Transaction[];
} {
  return {
    accounts: [],
    transactions: [],
    budgets: [],
    goals: [],
    recurring: [],
    debts: [],
    projects: [],
    currency: CURRENCY,
    region: REGION,
    timeZone: TIME_ZONE,
  };
}
export function demoState(): StoredWorkspace {
  const month = bahrainDate().slice(0, 7);
  const tx = (
    id: string,
    name: string,
    category: string,
    amount: number,
    day: number,
    type: TransactionType = "expense",
    accountId = "current",
  ): Transaction => ({
    id,
    name,
    category,
    amount,
    date: `${month}-${String(day).padStart(2, "0")}`,
    type,
    accountId,
  });
  return {
    ...blankState(),
    accounts: [
      {
        id: "current",
        name: "NBB current account",
        type: "Current account",
        balance: 1240.5,
        last4: "4829",
      },
      {
        id: "savings",
        name: "BBK savings",
        type: "Savings",
        balance: 6500.25,
        last4: "9016",
      },
      {
        id: "cash",
        name: "Everyday cash",
        type: "Cash",
        balance: 85.75,
        last4: "",
      },
    ],
    transactions: [
      tx("1", "Alosra supermarket", "Food & drink", 32.475, 15),
      tx("2", "Monthly salary", "Income", 1800, 14, "income"),
      tx("3", "Batelco mobile bill", "Utilities", 11, 14),
      tx("4", "Coffee in Adliya", "Food & drink", 2.85, 13),
      tx("5", "City Centre Bahrain", "Shopping", 24.9, 12),
      tx("6", "Manama apartment rent", "Home", 350, 1),
      tx("7", "Bapco petrol", "Transport", 8.25, 10),
      tx("8", "Lulu Hypermarket", "Food & drink", 45.125, 8),
      tx("9", "Dinner in Muharraq", "Food & drink", 18.5, 6),
      tx("10", "EWA electricity & water", "Utilities", 35.75, 5),
      tx("11", "Gym membership", "Health", 25, 3),
      tx("12", "Freelance project", "Income", 150, 4, "income"),
      tx("13", "Family lunch in Riffa", "Food & drink", 22, 2),
      // Illustrative history makes the six-month report useful in a fresh demo.
      ...Array.from({ length: 5 }, (_, i) => {
        const date = new Date(`${month}-01T12:00:00Z`);
        date.setUTCMonth(date.getUTCMonth() - i - 1);
        const period = date.toISOString().slice(0, 7);
        const rows: [string, string, number, number, TransactionType][] = [
          ["Monthly salary", "Income", 1800, 14, "income"],
          ["Manama apartment rent", "Home", 350, 1, "expense"],
          [
            "Weekly groceries",
            "Food & drink",
            must([155, 172, 148, 165, 190][i], "demo amount"),
            8,
            "expense",
          ],
          ["Bapco petrol", "Transport", 35 + i * 2, 10, "expense"],
          ["EWA electricity & water", "Utilities", 48 + i * 3, 5, "expense"],
          [
            "City Centre Bahrain",
            "Shopping",
            must([65, 48, 90, 52, 120][i], "demo amount"),
            12,
            "expense",
          ],
        ];
        return rows.map(([name, category, amount, day, type], j) => ({
          ...tx(`history-${i}-${j}`, name, category, amount, day, type),
          date: `${period}-${String(day).padStart(2, "0")}`,
        }));
      }).flat(),
    ],
    budgets: [
      { id: "food", category: "Food & drink", limit: 180 },
      { id: "shopping", category: "Shopping", limit: 100 },
      { id: "transport", category: "Transport", limit: 60 },
      { id: "utilities", category: "Utilities", limit: 80 },
    ],
    recurring: [
      {
        id: "salary-plan",
        name: "Monthly salary",
        type: "income",
        category: "Income",
        amount: 1800,
        accountId: "current",
        frequency: "monthly",
        nextDue: `${month}-28`,
        anchorDay: 28,
        anchorMonth: Number(month.slice(5)),
        paused: false,
      },
      {
        id: "ewa-plan",
        name: "EWA electricity & water",
        type: "expense",
        category: "Utilities",
        amount: 35.75,
        accountId: "current",
        frequency: "monthly",
        nextDue: `${month}-20`,
        anchorDay: 20,
        anchorMonth: Number(month.slice(5)),
        paused: false,
      },
      {
        id: "internet-plan",
        name: "Home internet",
        type: "expense",
        category: "Utilities",
        amount: 18.5,
        accountId: "current",
        frequency: "monthly",
        nextDue: `${month}-25`,
        anchorDay: 25,
        anchorMonth: Number(month.slice(5)),
        paused: false,
      },
    ],
    debts: [
      {
        id: "car-finance",
        name: "Car finance",
        lender: "Sample finance plan",
        originalBalance: 4500,
        balance: 4500,
        installment: 150,
        nextDue: `${month}-27`,
        anchorDay: 27,
      },
    ],
    projects: [
      {
        id: "home-refresh",
        name: "Our home refresh",
        budget: 750,
        targetDate: `${month}-28`,
        notes: "Furniture, paint and the finishing touches.",
        archived: false,
      },
    ],
    goals: [
      {
        id: "emergency",
        name: "Emergency fund",
        saved: 2500,
        target: 5000,
        icon: "shield-check",
      },
      {
        id: "staycation",
        name: "Bahrain staycation",
        saved: 180,
        target: 400,
        icon: "sun",
      },
      {
        id: "home",
        name: "A home in Bahrain",
        saved: 8000,
        target: 25000,
        icon: "house",
      },
    ],
  };
}
