import { useAppearance } from "./appearance.jsx";
import React, { useState } from "react";
import { View } from "react-native";
import {
  Card,
  Label,
  Heading,
  Muted,
  Row,
  Stack,
  Stat,
  Button,
  Progress,
  Empty,
} from "./ui.jsx";
import Field from "./Field";
import { AccountChoices } from "./AccountChoices.jsx";
import {
  totalBalance,
  summary,
  categorySpend,
  monthTransactions,
} from "../finance.js";
import { formatMoney as money, formatDate, toFils } from "../locale.ts";
import { upcomingPayments, dueStatus } from "../planning.js";
import { budgetHealth, shiftMonth } from "../reports.js";
import TrendChart from "./TrendChart.jsx";
import { transactionCSV } from "./workspace.js";
import { exportFile } from "../platform/runtime";
import { accountDetails, basicBudgetStats } from "../domain/reports.js";
import { filterTransactions, transactionGroups } from "../domain/organizing.js";
import { copyTransaction } from "../domain/ledger.js";
import { convert, recordValue } from "../domain/model.ts";
export function TransactionList({ state, transactions, open, onPin }) {
  const { colors } = useAppearance();
  if (!transactions.length)
    return <Empty>No transactions match this view.</Empty>;
  return (
    <View testID="transaction-list">
      {transactions.map((t) => (
        <Row
          testID="transaction-row"
          key={t.id}
          style={{
            paddingVertical: 15,
            borderBottomWidth: 1,
            borderColor: colors.line,
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1, minWidth: 140, gap: 2 }}>
            <Label style={{ fontWeight: "600" }}>
              {t.pinned ? "★ " : ""}
              {t.name}
            </Label>
            <Muted>
              {formatDate(t.date)} · {t.category}
            </Muted>
            <Muted>
              {state.accounts.find((a) => a.id === t.accountId)?.name ||
                "Account"}
              {t.type === "transfer"
                ? ` → ${state.accounts.find((a) => a.id === t.toAccountId)?.name || "Account"}`
                : ""}
            </Muted>
            {t.payeeId ? (
              <Muted>
                {state.payees?.find((p) => p.id === t.payeeId)?.name}
              </Muted>
            ) : null}
            {t.labels?.length ? <Muted>{t.labels.join(" · ")}</Muted> : null}
            {t.location ? <Muted>{t.location}</Muted> : null}
            {t.rewardPoints > 0 ? (
              <Muted>{t.rewardPoints} reward points</Muted>
            ) : null}
          </View>
          <Label
            testID={t.type === "income" ? "positive" : "transaction-amount"}
            style={{
              fontWeight: "600",
              color: t.type === "income" ? "#38745a" : colors.ink,
            }}
          >
            {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
            {money(
              t.amount,
              t.currency ||
                state.accounts.find((a) => a.id === t.accountId)?.currency ||
                "BHD",
            )}
          </Label>
          {open ? (
            <Row>
              {onPin ? (
                <Button
                  secondary
                  label={`${t.pinned ? "Unpin" : "Pin"} ${t.name}`}
                  onPress={() => onPin(t.id)}
                >
                  {t.pinned ? "Unpin" : "Pin"}
                </Button>
              ) : null}
              <Button
                secondary
                label={`Edit ${t.name}`}
                onPress={() => open("editTransaction", t.id)}
              >
                Edit
              </Button>
              <Button
                secondary
                label={`Copy ${t.name}`}
                onPress={() =>
                  open(
                    t.type === "transfer" ? "transfer" : "transaction",
                    null,
                    { draft: copyTransaction(t) },
                  )
                }
              >
                Copy
              </Button>
              <Button
                secondary
                label={`Template ${t.name}`}
                onPress={() => open("template", null, { transactionId: t.id })}
              >
                Template
              </Button>
              <Button
                secondary
                label={`Delete ${t.name}`}
                onPress={() => open("deleteTransaction", t.id)}
              >
                Delete
              </Button>
            </Row>
          ) : null}
        </Row>
      ))}
    </View>
  );
}
export function Overview({ workspace: w, month, open }) {
  const { colors } = useAppearance();
  const { state } = w,
    totals = summary(state, month),
    health = budgetHealth(state, month),
    upcoming = upcomingPayments(state).slice(0, 4);
  const prior = summary(state, shiftMonth(month, -1)).expenses,
    change = prior
      ? Math.round(((totals.expenses - prior) / prior) * 100)
      : null;
  const scheduled = upcomingPayments(state).filter(
    (row) => row.type === "expense" && row.nextDue.startsWith(month),
  );
  const planned =
    scheduled.reduce((sum, row) => sum + toFils(recordValue(state, row)), 0) /
    1000;
  return (
    <Stack>
      <Row testID="stats-grid" style={{ alignItems: "stretch" }}>
        <Stat
          dark
          title="TOTAL BALANCE"
          value={money(totalBalance(state))}
          note="Across included tracked accounts"
          testID="balance"
        />
        <Stat
          title="MONEY IN"
          value={money(totals.income)}
          note="Recorded this month"
        />
        <Stat
          title="MONEY OUT"
          value={money(totals.expenses)}
          note="Recorded this month"
        />
        <Stat
          title="SAVINGS RATE"
          value={
            totals.income
              ? `${Math.round(((totals.income - totals.expenses) / totals.income) * 100)}%`
              : "—"
          }
          note="Income left after spending"
        />
      </Row>
      <Row style={{ alignItems: "stretch" }}>
        <Card style={{ flex: 1, minWidth: 260 }} testID="financial-pulse">
          <Muted>YOUR FINANCIAL PULSE</Muted>
          <Heading>A little perspective goes a long way.</Heading>
          <Label>
            Net this month:{" "}
            {money((toFils(totals.income) - toFils(totals.expenses)) / 1000)}
          </Label>
          <Label>Budget remaining: {money(health.remaining)}</Label>
          <Muted>
            {change === null
              ? "No spending baseline in the previous month."
              : `${Math.abs(change)}% ${change <= 0 ? "less" : "more"} spending than the previous month.`}
          </Muted>
          <Label>{money(planned)} in next scheduled payments this month</Label>
          <Muted>
            {health.exceeded
              ? `${health.exceeded} ${health.exceeded === 1 ? "category is" : "categories are"} over budget.`
              : "Your everyday plans, in view."}
          </Muted>
        </Card>
        <Card style={{ flex: 1, minWidth: 260 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Heading>Coming up</Heading>
            <Button secondary onPress={() => w.navigate("bills")}>
              View plans
            </Button>
          </Row>
          {upcoming.length ? (
            upcoming.map((r) => (
              <Row
                key={`${r.kind}-${r.id}`}
                style={{ justifyContent: "space-between" }}
              >
                <View style={{ flex: 1 }}>
                  <Label>{r.name}</Label>
                  <Muted>
                    {dueStatus(r.nextDue)} · {formatDate(r.nextDue)}
                  </Muted>
                </View>
                <Label>{money(r.amount, r.currency)}</Label>
              </Row>
            ))
          ) : (
            <Empty>No payments scheduled yet.</Empty>
          )}
        </Card>
      </Row>
      <TrendChart state={state} month={month} />
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Heading>Recent transactions</Heading>
          <Button secondary onPress={() => w.navigate("transactions")}>
            View all
          </Button>
        </Row>
        <TransactionList
          state={state}
          transactions={monthTransactions(state, month).slice(0, 6)}
        />
      </Card>
      <Row style={{ alignItems: "stretch" }}>
        <Card style={{ flex: 1, minWidth: 260 }}>
          <Heading>Your accounts</Heading>
          {state.accounts.map((a) => (
            <Row key={a.id} style={{ justifyContent: "space-between" }}>
              <Label style={{ flex: 1 }}>{a.name}</Label>
              <Label>{money(a.balance, a.currency || "BHD")}</Label>
            </Row>
          ))}
          <Button secondary onPress={() => open("account")}>
            Add account
          </Button>
        </Card>
        <Card style={{ flex: 1, minWidth: 260 }}>
          <Heading>A little closer to your goals</Heading>
          {state.goals.slice(0, 3).map((g) => (
            <Stack key={g.id} style={{ gap: 7 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Label>{g.name}</Label>
                <Muted>{Math.round((g.saved / g.target) * 100)}%</Muted>
              </Row>
              <Progress value={(g.saved / g.target) * 100} />
            </Stack>
          ))}
          <Button secondary onPress={() => w.navigate("goals")}>
            Explore goals
          </Button>
        </Card>
      </Row>
    </Stack>
  );
}
export function Accounts({ workspace: w, open }) {
  const { colors } = useAppearance();
  return (
    <Stack>
      <Card testID="account-total" style={{ backgroundColor: colors.primary }}>
        <Muted style={{ color: "#c7d6c8" }}>TOTAL ACROSS YOUR ACCOUNTS</Muted>
        <Label style={{ color: "white", fontSize: 36, fontWeight: "600" }}>
          {money(totalBalance(w.state))}
        </Label>
        <Muted style={{ color: "#c7d6c8" }}>
          A clear view of where your money lives.
        </Muted>
      </Card>
      <Row style={{ alignItems: "stretch" }}>
        {w.state.accounts.map((a) => (
          <Card
            testID="account-detail"
            key={a.id}
            style={{
              flexGrow: 1,
              flexBasis: 280,
              borderTopWidth: 5,
              borderTopColor: a.color || colors.primary,
            }}
          >
            <Muted>
              {a.icon || "▣"} {a.type}
              {w.state.settings.defaultAccountId === a.id ? " · Default" : ""}
              {a.includeInTotal === false ? " · Excluded from total" : ""}
            </Muted>
            <Heading>{a.name}</Heading>
            <Label style={{ fontSize: 27, fontWeight: "600" }}>
              {money(a.balance, a.currency || "BHD")}
            </Label>
            <Muted>
              {a.last4 ? `•••• ${a.last4}` : "Manually tracked account"}
            </Muted>
            <AccountTerms state={w.state} account={a} />
            {a.rewardRate > 0 ? (
              <Muted>
                {a.rewardRate} reward points per currency unit ·{" "}
                {w.state.transactions
                  .filter((t) => t.accountId === a.id)
                  .reduce((sum, t) => sum + Number(t.rewardPoints || 0), 0)
                  .toFixed(3)}{" "}
                earned points
              </Muted>
            ) : null}
            {a.type === "Loan" ? (
              <Button
                secondary
                onPress={() => open("loanInstallment", null, { loanId: a.id })}
              >
                Schedule installment
              </Button>
            ) : null}
            <Row>
              <Button secondary onPress={() => open("editAccount", a.id)}>
                Edit account
              </Button>
              <Button secondary onPress={() => open("reconcile", a.id)}>
                Reconcile balance
              </Button>
              <Button secondary onPress={() => open("deleteAccount", a.id)}>
                Delete account
              </Button>
            </Row>
          </Card>
        ))}
      </Row>
      {!w.state.accounts.length ? (
        <Card>
          <Empty>Add your first account to start tracking your money.</Empty>
        </Card>
      ) : null}
      <Row>
        <Button onPress={() => open("account")}>Add account</Button>
        <Button secondary onPress={() => open("defaultAccount")}>
          Choose default account
        </Button>
        <Button secondary onPress={() => open("transfer")}>
          Record transfer
        </Button>
      </Row>
      <Muted>
        FinancialAdvisor tracks balances manually. Recording a transfer does not
        move real money.
      </Muted>
    </Stack>
  );
}
export function Transactions({ workspace: w, month, open }) {
  const { colors } = useAppearance();
  const [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [account, setAccount] = useState("all"),
    [accountScopes, setAccountScopes] = useState([]),
    [limit, setLimit] = useState(50);
  const [advanced, setAdvanced] = useState(false),
    [filters, setFilters] = useState({
      query: "",
      type: "all",
      from: "",
      to: "",
      minimum: "",
      maximum: "",
      payeeId: "",
      label: "",
      pinned: false,
    }),
    [allDates, setAllDates] = useState(false);
  let transactions = [],
    filterError = "";
  try {
    transactions = filterTransactions(
      w.state,
      {
        ...filters,
        query: search,
        type,
        accountIds: accountScopes.length
          ? accountScopes
          : account === "all"
            ? []
            : [account],
      },
      allDates ? w.state.transactions : monthTransactions(w.state, month),
    );
  } catch (e) {
    filterError = e.message;
  }
  const updateFilter = (name, value) => {
    setFilters((previous) => ({ ...previous, [name]: value }));
    setLimit(50);
  };
  async function pin(id) {
    try {
      await w.save("pinTransaction", {}, id);
    } catch (e) {
      w.setMessage(e.message);
    }
  }
  async function download() {
    try {
      await exportFile(
        transactionCSV(w.state, transactions),
        "text/csv",
        `financial-advisor-${month}.csv`,
      );
    } catch (error) {
      w.setMessage(error.message);
    }
  }
  return (
    <Card>
      <Row style={{ alignItems: "flex-end" }}>
        <View style={{ flex: 2, minWidth: 180 }}>
          <Field
            label="Search transactions"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setLimit(50);
            }}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Field
            label="Transaction type"
            type="select"
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "All types" },
              "expense",
              "income",
              "transfer",
              "adjustment",
            ]}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Field
            label="Transaction account"
            type="select"
            value={account}
            onChange={(value) => {
              setAccount(value);
              setAccountScopes([]);
              setLimit(50);
            }}
            options={[
              { value: "all", label: "All accounts" },
              ...w.state.accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </View>
      </Row>
      <Row>
        <Button secondary onPress={() => setAdvanced(!advanced)}>
          {advanced ? "Hide advanced filters" : "Advanced filters"}
        </Button>
        <Button
          secondary
          onPress={() => {
            setAllDates(!allDates);
            setLimit(50);
          }}
        >
          {allDates ? "Use selected month" : "Search all dates"}
        </Button>
        <Button
          secondary
          onPress={() => {
            setSearch("");
            setType("all");
            setAccount("all");
            setAccountScopes([]);
            setFilters({});
            setAllDates(false);
          }}
        >
          Clear filters
        </Button>
      </Row>
      {advanced ? (
        <Stack>
          <AccountChoices
            state={w.state}
            selected={accountScopes}
            label="Search accounts"
            onChange={(values) => {
              setAccountScopes(values);
              setAccount("all");
              setLimit(50);
            }}
          />
          <Row>
            <Field
              label="Filter from date"
              type="date"
              value={filters.from || ""}
              onChange={(v) => updateFilter("from", v)}
            />
            <Field
              label="Filter to date"
              type="date"
              value={filters.to || ""}
              onChange={(v) => updateFilter("to", v)}
            />
          </Row>
          <Muted>
            Choose Search all dates to search outside the selected reporting
            month. Amount limits use {w.state.settings.base}.
          </Muted>
          <Row>
            <Field
              label="Minimum amount"
              type="number"
              value={filters.minimum || ""}
              onChange={(v) => updateFilter("minimum", v)}
            />
            <Field
              label="Maximum amount"
              type="number"
              value={filters.maximum || ""}
              onChange={(v) => updateFilter("maximum", v)}
            />
            <Field
              label="Filter contact"
              type="select"
              value={filters.payeeId || ""}
              onChange={(v) => updateFilter("payeeId", v)}
              options={[
                { value: "", label: "All contacts" },
                ...w.state.payees.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <Field
              label="Filter tag"
              type="select"
              value={filters.label || ""}
              onChange={(v) => updateFilter("label", v)}
              options={[
                { value: "", label: "All tags" },
                ...[
                  ...new Set(
                    w.state.transactions.flatMap((t) => t.labels || []),
                  ),
                ].map((name) => ({ value: name, label: name })),
              ]}
            />
          </Row>
          <Button
            secondary
            onPress={() => updateFilter("pinned", !filters.pinned)}
          >
            {filters.pinned ? "Show pinned and unpinned" : "Show pinned only"}
          </Button>
        </Stack>
      ) : null}
      {filterError ? (
        <Label accessibilityRole="alert">{filterError}</Label>
      ) : null}
      <Row style={{ justifyContent: "space-between" }}>
        <Muted>
          {transactions.length} transactions · {w.state.settings.base}
        </Muted>
        <Row>
          <Button secondary onPress={() => open("transfer")}>
            Record transfer
          </Button>
          <Button secondary onPress={download}>
            Export CSV
          </Button>
        </Row>
      </Row>
      {transactionGroups(transactions.slice(0, limit)).map((group) => (
        <View key={group.date}>
          <Heading>
            {group.date === "Pinned"
              ? "Pinned"
              : formatDate(group.date, {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
          </Heading>
          <TransactionList
            state={w.state}
            transactions={group.transactions}
            open={open}
            onPin={pin}
          />
        </View>
      ))}
      {!transactions.length ? (
        <Empty>No transactions match this view.</Empty>
      ) : null}
      {transactions.length > limit ? (
        <Button secondary onPress={() => setLimit(limit + 50)}>
          Show more transactions
        </Button>
      ) : null}
    </Card>
  );
}
export function Budgets({ workspace: w, month, open }) {
  const { colors } = useAppearance();
  return (
    <Stack>
      <Button secondary onPress={() => w.navigate("advanced-budgets")}>
        Cycle budgets & weekly allocations
      </Button>
      {w.state.budgets.length ? (
        w.state.budgets.map((b) => {
          const { spent, limit, daysLeft, dailyAllowance } = basicBudgetStats(
              w.state,
              b,
              month,
            ),
            percentage = (spent / limit) * 100;
          return (
            <Card key={b.id} testID="wide-budget">
              <Row style={{ justifyContent: "space-between" }}>
                <Heading>
                  {b.category}
                  {b.period === "Yearly" ? " · Yearly" : ""}
                </Heading>
                <Label>
                  {money(spent)} /{" "}
                  {money(convert(w.state, b.limit, b.currency || "BHD"))}
                </Label>
              </Row>
              <Progress value={percentage} />
              <Muted>
                {daysLeft} days left · {money(dailyAllowance)} per day available
                {percentage >= 100
                  ? " · Budget limit reached"
                  : percentage >= 80
                    ? " · Approaching the budget limit"
                    : ""}
              </Muted>
              <Muted>
                {money(
                  (toFils(convert(w.state, b.limit, b.currency || "BHD")) -
                    toFils(spent)) /
                    1000,
                )}{" "}
                remaining · {Math.round(percentage)}% used
              </Muted>
              <Button secondary onPress={() => open("deleteBudget", b.id)}>
                Delete budget
              </Button>
            </Card>
          );
        })
      ) : (
        <Card>
          <Empty>
            Set a monthly budget for a category to keep spending in view.
          </Empty>
        </Card>
      )}
    </Stack>
  );
}
export function Goals({ workspace: w, open }) {
  const { colors } = useAppearance();
  return (
    <Row style={{ alignItems: "stretch" }}>
      {w.state.goals.length ? (
        w.state.goals.map((g) => (
          <Card
            key={g.id}
            testID="goal-card"
            style={{ flexBasis: 285, flexGrow: 1 }}
          >
            <Muted>ON YOUR HORIZON</Muted>
            <Heading>{g.name}</Heading>
            <Label style={{ fontSize: 27, fontWeight: "600" }}>
              {money(g.saved, g.currency || "BHD")}
            </Label>
            <Muted>
              of {money(g.target, g.currency || "BHD")} ·{" "}
              {Math.round((g.saved / g.target) * 100)}%
            </Muted>
            <Progress value={(g.saved / g.target) * 100} />
            <Button
              secondary
              label={`Update ${g.name} progress`}
              onPress={() => open("fund", g.id)}
            >
              Update progress
            </Button>
            <Row>
              <Button secondary onPress={() => open("editGoal", g.id)}>
                Edit goal
              </Button>
              <Button secondary onPress={() => open("deleteGoal", g.id)}>
                Delete goal
              </Button>
            </Row>
          </Card>
        ))
      ) : (
        <Card style={{ flex: 1 }}>
          <Empty>Give your next goal a name and a target.</Empty>
        </Card>
      )}
    </Row>
  );
}

function AccountTerms({ state, account: a }) {
  const d = accountDetails(a);
  return (
    <Stack style={{ gap: 5 }}>
      {a.apr > 0 ? (
        <Muted>
          APR: {a.apr}% · Estimated annual interest:{" "}
          {money(d.annualInterest, a.currency)}
        </Muted>
      ) : null}
      {a.limit > 0 ? (
        <Muted>
          Credit utilization: {d.utilization.toFixed(1)}% of{" "}
          {money(a.limit, a.currency)}
        </Muted>
      ) : null}
      {a.cost > 0 ? (
        <Muted>
          Cost basis: {money(a.cost, a.currency)} · Gain:{" "}
          {money(d.valuation, a.currency)}
        </Muted>
      ) : null}
      {a.maturity ? (
        <Muted>
          Maturity: {formatDate(a.maturity)} · {d.daysRemaining} days
        </Muted>
      ) : null}
      {a.type === "Fixed deposit" && d.maturityValue ? (
        <>
          <Progress value={d.termProgress} />
          <Muted>
            Term completed: {d.termProgress.toFixed(1)}% · Estimated maturity:{" "}
            {money(d.maturityValue, a.currency)}
          </Muted>
          <Muted>
            Simple interest, actual/365. Estimate only; balances are unchanged.
          </Muted>
        </>
      ) : null}
      {a.type === "Loan" && a.loanOriginal > 0 ? (
        <>
          <Progress
            value={(1 - Math.max(0, -a.balance) / a.loanOriginal) * 100}
          />
          <Muted>
            Original loan: {money(a.loanOriginal, a.currency)} ·{" "}
            {d.paymentsRemaining || "—"} estimated payments remaining
          </Muted>
        </>
      ) : null}
      <Muted>
        {
          state.transactions.filter(
            (t) => t.accountId === a.id || t.toAccountId === a.id,
          ).length
        }{" "}
        recorded transactions
      </Muted>
    </Stack>
  );
}
