import { isCivilDate, bahrainDate, toFils } from "../locale.ts";
import {
  normalizeWorkspace,
  validateWorkspace,
  amount,
  text,
  convert,
  accountCurrency,
} from "./model.ts";
import { saveTransaction } from "./ledger.ts";
import { checkedLater } from "../guards.ts";
import type {
  CommitmentBase,
  CommitmentKind,
  CommitmentPayment,
  Installment,
  Subscription,
  Workspace,
} from "./types.ts";
/** A plan together with the collection it belongs to. */
export type CommitmentRef =
  | { kind: "subscription"; plan: Subscription }
  | { kind: "installment"; plan: Installment };
// Subscriptions first, then installments: the order every listing used before.
const allPlans = (s: Partial<Workspace>): CommitmentRef[] => [
  ...(s.subscriptions || []).map((plan) => ({
    kind: "subscription" as const,
    plan,
  })),
  ...(s.installments || []).map((plan) => ({
    kind: "installment" as const,
    plan,
  })),
];
// Callers outside this module pass a plan and the kind of list they took it from.
function refFor(
  plan: Subscription | Installment,
  kind: CommitmentKind,
): CommitmentRef {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: callers pass a plan with the kind of the collection it came from; the pair is not checked at runtime, as before.
  return { kind, plan } as CommitmentRef;
}
export function commitmentDue(
  plan: Pick<CommitmentBase, "firstDue" | "interval" | "frequency">,
  index: number,
): string {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > 10000 ||
    !isCivilDate(plan.firstDue)
  )
    throw Error("Invalid payment occurrence.");
  // A valid civil date always has three parts; NaN defaults match the old undefined arithmetic.
  const [y = NaN, m = NaN, d = NaN] = plan.firstDue.split("-").map(Number),
    step = index * plan.interval;
  let date: Date;
  if (["daily", "weekly"].includes(plan.frequency))
    date = new Date(
      Date.UTC(y, m - 1, d + step * (plan.frequency === "weekly" ? 7 : 1)),
    );
  else {
    date = new Date(
      Date.UTC(
        y + (plan.frequency === "yearly" ? step : 0),
        m - 1 + (plan.frequency === "monthly" ? step : 0),
        1,
      ),
    );
    date.setUTCDate(
      Math.min(
        d,
        new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );
  }
  const result = date.toISOString().slice(0, 10);
  if (!isCivilDate(result))
    throw Error("Payment date is outside the supported calendar.");
  return result;
}
export function nextCommitmentIndex(plan: {
  payments: CommitmentPayment[];
}): number {
  const consumed = new Set(plan.payments.map((p) => p.index));
  let index = 0;
  while (consumed.has(index)) index++;
  return index;
}
export function installmentAmount(
  plan: Pick<Installment, "total" | "count">,
  index: number,
): number {
  const fils = toFils(plan.total),
    base = Math.floor(fils / plan.count);
  return (
    (index === plan.count - 1 ? fils - base * (plan.count - 1) : base) / 1000
  );
}
function statsFor(ref: CommitmentRef, today: string) {
  const { plan } = ref;
  const index = nextCommitmentIndex(plan),
    complete = ref.kind === "installment" && index >= ref.plan.count;
  const amount = complete
    ? 0
    : ref.kind === "installment"
      ? installmentAmount(ref.plan, index)
      : ref.plan.amount;
  const paid = plan.payments.reduce((n, p) => n + toFils(p.amount), 0) / 1000;
  const annual =
    { daily: 365.25, weekly: 365.25 / 7, monthly: 12, yearly: 1 }[
      plan.frequency
    ] / plan.interval;
  return {
    index,
    complete,
    amount,
    due: complete ? "" : commitmentDue(plan, index),
    paid,
    remaining:
      ref.kind === "installment"
        ? (toFils(ref.plan.total) - toFils(paid)) / 1000
        : null,
    monthly: ref.kind === "subscription" ? (ref.plan.amount * annual) / 12 : amount,
    overdue:
      !complete &&
      plan.status === "active" &&
      commitmentDue(plan, index) < today,
    currency: plan.currency,
  };
}
export type CommitmentStats = ReturnType<typeof statsFor>;
export function commitmentStats(
  s: Workspace,
  plan: Subscription,
  kind: "subscription",
  today?: string,
): CommitmentStats;
export function commitmentStats(
  s: Workspace,
  plan: Installment,
  kind: "installment",
  today?: string,
): CommitmentStats;
export function commitmentStats(
  s: Workspace,
  plan: Subscription | Installment,
  kind: CommitmentKind,
  today?: string,
): CommitmentStats;
export function commitmentStats(
  _s: Workspace,
  plan: Subscription | Installment,
  kind: CommitmentKind,
  today: string = bahrainDate(),
): CommitmentStats {
  return statsFor(refFor(plan, kind), today);
}
/** Fields the plan and payment forms submit. */
export type CommitmentInput = {
  accountId?: string;
  firstDue?: string;
  frequency?: string;
  interval?: unknown;
  name?: unknown;
  provider?: unknown;
  category?: string;
  payeeId?: string;
  total?: unknown;
  count?: unknown;
  amount?: unknown;
  trialEnds?: string;
  website?: unknown;
  note?: string;
  index?: unknown;
  date?: string;
  method?: string;
};
export function commitmentCommand(
  input: unknown,
  kind: string,
  data: CommitmentInput,
  id: string | undefined,
  uuid: () => string,
): Workspace | null {
  if (
    ![
      "subscription",
      "installment",
      "subscriptionPayment",
      "installmentPayment",
      "pauseSubscription",
      "cancelSubscription",
      "resumeSubscription",
      "deleteSubscription",
      "deleteInstallment",
    ].includes(kind)
  )
    return null;
  const s = normalizeWorkspace(input),
    installment = kind.toLowerCase().includes("installment"),
    ref: CommitmentRef | undefined = installment
      ? ((plan) => plan && { kind: "installment" as const, plan })(
          s.installments.find((p) => p.id === id),
        )
      : ((plan) => plan && { kind: "subscription" as const, plan })(
          s.subscriptions.find((p) => p.id === id),
        ),
    old = ref?.plan;
  if (kind === "subscription" || kind === "installment") {
    const account = s.accounts.find((a) => a.id === data.accountId);
    if (!account) throw Error("Choose a payment account.");
    if (
      old?.payments.length &&
      (old.currency !== account.currency ||
        old.firstDue !== data.firstDue ||
        old.frequency !== data.frequency ||
        old.interval !== Number(data.interval || 1))
    )
      throw Error(
        "Keep a paid plan's currency and schedule; create a new plan for different terms.",
      );
    const common = {
      id: id || uuid(),
      name: text(data.name),
      provider: String(data.provider || "")
        .trim()
        .slice(0, 80),
      accountId: account.id,
      currency: account.currency,
      category: data.category || "Utilities",
      payeeId: data.payeeId || "",
      firstDue: data.firstDue,
      frequency: data.frequency,
      interval: Number(data.interval || 1),
      status: old?.status || "active",
      payments: old?.payments || [],
      note: String(data.note || "").slice(0, 500),
    };
    if (installment) {
      const prev = ref?.kind === "installment" ? ref.plan : undefined;
      const total = amount(data.total, true);
      const row = checkedLater<Installment>({
        ...common,
        total,
        count: Number(data.count),
      });
      if (
        prev?.payments.length &&
        (row.total !== prev.total || row.count !== prev.count)
      )
        throw Error(
          "Keep paid installment terms; create a new plan for changed amounts.",
        );
      s.installments = [
        ...s.installments.filter((p) => p.id !== row.id),
        row,
      ];
    } else {
      const row = checkedLater<Subscription>({
        ...common,
        amount: amount(data.amount, true),
        trialEnds: data.trialEnds || "",
        website: String(data.website || "").trim(),
      });
      s.subscriptions = [
        ...s.subscriptions.filter((p) => p.id !== row.id),
        row,
      ];
    }
  } else {
    if (!ref) throw Error("This plan no longer exists.");
    const plan = ref.plan;
    if (kind.startsWith("delete")) {
      if (plan.payments.length)
        throw Error(
          "Plans with payment history must be kept. Pause or cancel the plan instead.",
        );
      if (installment)
        s.installments = s.installments.filter((p) => p.id !== id);
      else s.subscriptions = s.subscriptions.filter((p) => p.id !== id);
    } else if (kind.endsWith("Subscription"))
      plan.status = kind.startsWith("pause")
        ? "paused"
        : kind.startsWith("cancel")
          ? "cancelled"
          : "active";
    else {
      if (plan.status !== "active")
        throw Error("Resume the plan before recording a payment.");
      const stats = statsFor(ref, bahrainDate());
      if (stats.complete || Number(data.index) !== stats.index)
        throw Error(
          "This occurrence was already paid or the schedule changed. Refresh before recording.",
        );
      const paidOn = data.date;
      if (!isCivilDate(paidOn) || paidOn > bahrainDate())
        throw Error("Use an actual payment date, no later than today.");
      const manual = data.method === "manual";
      let transactionId: string | null = null;
      if (!manual) {
        if (data.method !== "transaction")
          throw Error("Choose how to record this payment.");
        const account = s.accounts.find((a) => a.id === data.accountId);
        if (!account) throw Error("Choose a payment account.");
        transactionId = uuid();
        saveTransaction(
          s,
          {
            id: transactionId,
            name: plan.name,
            type: "expense",
            accountId: account.id,
            amount: amount(data.amount, true),
            date: paidOn,
            category: plan.category,
            payeeId: plan.payeeId,
            note: data.note || "",
            commitmentId: plan.id,
            commitmentType: installment ? "installment" : "subscription",
            commitmentOccurrence: stats.index,
          },
          transactionId,
          uuid,
        );
      }
      plan.payments.push({
        id: uuid(),
        index: stats.index,
        due: stats.due,
        date: paidOn,
        amount: stats.amount,
        transactionId,
        method: manual ? "manual" : "transaction",
      });
    }
  }
  return validateWorkspace(s);
}
export type CalendarRow = {
  id: string;
  key: string;
  name: string;
  date: string;
  amount: number;
  currency: string;
  status: "recorded" | "due" | "projected";
  kind: CommitmentKind;
  index: number;
};
export function commitmentCalendar(
  s: Partial<Workspace>,
  month: string,
): CalendarRow[] {
  const rows: CalendarRow[] = [];
  for (const ref of allPlans(s)) {
    const { plan, kind } = ref;
    for (const p of plan.payments)
      if (p.date.startsWith(month))
        rows.push({
          id: plan.id,
          key: `${plan.id}-${p.index}`,
          name: plan.name,
          date: p.date,
          amount: p.amount,
          currency: plan.currency,
          status: "recorded",
          kind,
          index: p.index,
        });
    if (plan.status !== "active") continue;
    const next = nextCommitmentIndex(plan);
    for (
      let index = next;
      index < 10000 && (ref.kind !== "installment" || index < ref.plan.count);
      index++
    ) {
      const due = commitmentDue(plan, index);
      if (due.slice(0, 7) > month) break;
      if (plan.payments.some((payment) => payment.index === index)) continue;
      if (due.startsWith(month))
        rows.push({
          id: plan.id,
          key: `${plan.id}-${index}`,
          name: plan.name,
          date: due,
          amount:
            ref.kind === "installment"
              ? installmentAmount(ref.plan, index)
              : ref.plan.amount,
          currency: plan.currency,
          status: index === next ? "due" : "projected",
          kind,
          index,
        });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
export function paymentDraft(
  s: Workspace,
  plan: Subscription | Installment,
  kind: CommitmentKind,
) {
  const stats = statsFor(refFor(plan, kind), bahrainDate());
  return {
    index: stats.index,
    method: "transaction",
    date: bahrainDate(),
    accountId: plan.accountId,
    amount: convert(
      s,
      stats.amount,
      plan.currency,
      accountCurrency(s, plan.accountId),
    ),
  };
}
export function upcomingCommitments(s: Workspace) {
  return allPlans(s)
    .filter((ref) => ref.plan.status === "active")
    .flatMap((ref) => {
      const stats = statsFor(ref, bahrainDate());
      return stats.complete
        ? []
        : [
            {
              ...ref.plan,
              kind: ref.kind,
              type: "expense" as const,
              nextDue: stats.due,
              amount: stats.amount,
            },
          ];
    });
}
