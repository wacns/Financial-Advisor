// Shapes of the workspace as the app stores and uses it. Field lists follow what
// normalizeWorkspace fills in and what validateWorkspace / validateEnhancements accept.

export type CurrencyCode =
  | "BHD"
  | "USD"
  | "EUR"
  | "GBP"
  | "SAR"
  | "AED"
  | "KWD"
  | "OMR"
  | "QAR"
  | "INR";

/** Exchange rates keyed by currency code, BHD per unit. */
export type Rates = Record<string, number>;

export type TransactionType = "expense" | "income" | "transfer" | "adjustment";
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: CurrencyCode;
  last4?: string;
  apr?: number;
  limit?: number;
  cost?: number;
  installment?: number;
  loanOriginal?: number;
  startDate?: string;
  maturity?: string;
  color?: string;
  icon?: string;
  includeInTotal?: boolean;
  rewardRate?: number;
}

export interface Transaction {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  type: TransactionType;
  accountId: string;
  toAccountId?: string;
  received?: number;
  currency?: CurrencyCode;
  labels?: string[];
  time?: string;
  salaryMonth?: string;
  note?: string;
  projectId?: string;
  debtId?: string;
  principal?: number;
  payeeId?: string;
  captureFingerprint?: string;
  pinned?: boolean;
  location?: string;
  rewardPoints?: number;
  receipt?: string;
  commitmentId?: string;
  commitmentType?: CommitmentKind;
  commitmentOccurrence?: number;
  recurringId?: string;
  scheduledFor?: string;
  contractId?: string;
  milestoneId?: string;
}

/** A transaction-shaped record that has no id or date of its own yet (templates, plans). */
export type TransactionDraft = Omit<Transaction, "id" | "date"> &
  Partial<Pick<Transaction, "id" | "date">>;

export interface Budget {
  id: string;
  category: string;
  limit: number;
  currency?: CurrencyCode;
  period?: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  currency: CurrencyCode;
  icon?: string;
}

export interface Recurring extends Omit<Transaction, "date"> {
  frequency: Frequency;
  nextDue: string;
  anchorDay: number;
  anchorMonth?: number;
  paused?: boolean;
  loanInstallment?: boolean;
  interest?: number;
  isSalary?: boolean;
}

export interface Debt {
  id: string;
  name: string;
  lender?: string;
  originalBalance: number;
  balance: number;
  installment: number;
  nextDue: string;
  anchorDay?: number;
  direction?: "lent" | "borrowed";
  currency?: CurrencyCode;
}

export interface Template {
  id: string;
  name: string;
  record: TransactionDraft;
}

export interface Warranty {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  serial?: string;
  retailer?: string;
  notes?: string;
  purchased: string;
  expires: string;
  receipt?: string;
}

export interface ProjectCategory {
  id: string;
  name: string;
  budget: number;
}

export interface ContractVariation {
  id?: string;
  name: string;
  amount: number;
  date: string;
}

export interface Contract {
  id: string;
  name: string;
  vendor?: string;
  categoryId: string;
  notes?: string;
  original: number;
  startDate?: string;
  endDate?: string;
  variations: ContractVariation[];
}

export interface Milestone {
  id: string;
  name: string;
  contractId: string;
  amount: number;
  due: string;
  kind?: string;
  complete?: boolean;
}

export interface ProjectDocument {
  id: string;
  name: string;
  file: string;
  fileName?: string;
  createdAt?: string;
  contractId?: string;
  transactionId?: string;
}

export interface Project {
  id: string;
  name: string;
  budget: number;
  reserve: number;
  currency: CurrencyCode;
  startDate?: string;
  targetDate?: string;
  notes?: string;
  archived?: boolean;
  categories: ProjectCategory[];
  contracts: Contract[];
  milestones: Milestone[];
  documents: ProjectDocument[];
}

export type CategoryMode = "selected" | "all";

export interface CycleBudgetEntry {
  id: string;
  name: string;
  limit: number;
  /** Four weekly allocations that add up to no more than limit. */
  weeks: number[];
  include: string[];
  exclude: string[];
  categoryMode: CategoryMode;
}

export interface CycleBudget extends CycleBudgetEntry {
  /** The cycle's month, YYYY-MM. */
  key: string;
  currency: CurrencyCode;
  day: number;
  from: string;
  /** First day after the cycle. */
  until: string;
  /** Last day of the cycle. */
  to: string;
  children: CycleBudgetEntry[];
}

export interface Payee {
  id: string;
  name: string;
  role: "payee" | "payer" | "both";
  note?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type CommitmentKind = "subscription" | "installment";
export type CommitmentStatus = "active" | "paused" | "cancelled";

export interface CommitmentPayment {
  id?: string;
  index: number;
  date: string;
  due: string;
  amount: number;
  method: "transaction" | "manual";
  /** null for manual payments, which post no transaction. */
  transactionId?: string | null;
}

export interface CommitmentBase {
  id: string;
  name: string;
  status: CommitmentStatus;
  accountId: string;
  currency: CurrencyCode;
  category: string;
  firstDue: string;
  frequency: Frequency;
  interval: number;
  payments: CommitmentPayment[];
  payeeId?: string;
  provider?: string;
  note?: string;
}

export interface Subscription extends CommitmentBase {
  amount: number;
  trialEnds?: string;
  website?: string;
}

export interface Installment extends CommitmentBase {
  total: number;
  count: number;
}

export interface Reminders {
  hour: number;
  frequency: "daily" | "weekly";
  expenses: boolean;
  salary: boolean;
  advice: boolean;
}

export interface RateQuote {
  asOf: string;
  source: "ExchangeRate-API";
  savedAt: string;
  rates: Rates;
}

export interface CategoryStyle {
  path: string;
  color: string;
  icon: string;
}

export interface Settings {
  base: CurrencyCode;
  language: "en" | "ar";
  theme: "light" | "dark" | "system";
  motion: boolean;
  cycleStartDay: number;
  rates: Rates;
  categories: string[];
  reminders?: Reminders;
  defaultAccountId?: string;
  dateFormat?: "dmy" | "mdy" | "ymd" | "";
  rateHistory?: RateQuote[];
  categoryStyles?: CategoryStyle[];
  /** Deleting a category with no id hides `undefined`, as it always has; see typescript-findings.md. */
  hiddenCategories?: (string | null | undefined)[];
  widgetsEnabled?: boolean;
  ratesAsOf?: string;
  ratesSource?: string;
}

/** A workspace after normalizeWorkspace: every collection and setting is present. */
export interface Workspace {
  currency: "BHD";
  region?: string;
  timeZone?: string;
  schemaVersion: 2;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];
  debts: Debt[];
  projects: Project[];
  warranties: Warranty[];
  cycleBudgets: CycleBudget[];
  templates: Template[];
  payees: Payee[];
  tags: Tag[];
  subscriptions: Subscription[];
  installments: Installment[];
  settings: Settings;
}

export type CollectionKey =
  | "accounts"
  | "transactions"
  | "budgets"
  | "goals"
  | "recurring"
  | "debts"
  | "projects"
  | "warranties"
  | "cycleBudgets"
  | "templates"
  | "payees"
  | "tags"
  | "subscriptions"
  | "installments";

/** Some fields of T may be missing until normalizeWorkspace fills them in. */
type Loose<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type StoredCycleBudgetEntry = Loose<
  CycleBudgetEntry,
  "include" | "exclude" | "categoryMode"
>;

export type StoredCycleBudget = Loose<
  Omit<CycleBudget, "children">,
  "include" | "exclude" | "categoryMode" | "day"
> & { children?: StoredCycleBudgetEntry[] };

/** A workspace as it arrives from storage, a backup or the demo, before normalizeWorkspace. */
export interface StoredWorkspace {
  currency: string;
  region?: string;
  timeZone?: string;
  schemaVersion?: number;
  accounts?: Loose<Account, "currency">[];
  transactions?: Transaction[];
  budgets?: Budget[];
  goals?: Loose<Goal, "currency">[];
  recurring?: Recurring[];
  debts?: Debt[];
  projects?: Loose<
    Project,
    "reserve" | "currency" | "categories" | "contracts" | "milestones" | "documents"
  >[];
  warranties?: Warranty[];
  cycleBudgets?: StoredCycleBudget[];
  templates?: Template[];
  payees?: Payee[];
  tags?: Tag[];
  subscriptions?: Subscription[];
  installments?: Installment[];
  settings?: Partial<Settings>;
}
