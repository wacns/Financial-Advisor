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
  colors,
} from "./ui.jsx";
import Field from "./Field";
import {
  totalBalance,
  summary,
  categorySpend,
  monthTransactions,
} from "../finance.js";
import { formatMoney as money, formatDate, toFils } from "../locale.js";
import { upcomingPayments, dueStatus } from "../planning.js";
import { budgetHealth, shiftMonth } from "../reports.js";
import TrendChart from "./TrendChart.jsx";
import { transactionCSV } from "./workspace.js";
import { exportFile } from "../platform/runtime";
export function TransactionList({ state, transactions }) {
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
            <Label style={{ fontWeight: "600" }}>{t.name}</Label>
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
          </View>
          <Label
            testID={t.type === "income" ? "positive" : "transaction-amount"}
            style={{
              fontWeight: "600",
              color: t.type === "income" ? "#38745a" : colors.ink,
            }}
          >
            {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
            {money(t.amount)}
          </Label>
        </Row>
      ))}
    </View>
  );
}
export function Overview({ workspace: w, month, open }) {
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
    scheduled.reduce((sum, row) => sum + toFils(row.amount), 0) / 1000;
  return (
    <Stack>
      <Row testID="stats-grid" style={{ alignItems: "stretch" }}>
        <Stat
          dark
          title="TOTAL BALANCE"
          value={money(totalBalance(state))}
          note="Across all your accounts"
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
                <Label>{money(r.amount)}</Label>
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
              <Label>{money(a.balance)}</Label>
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
  return (
    <Stack>
      <Card testID="account-total" style={{ backgroundColor: colors.ink }}>
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
            style={{ flexGrow: 1, flexBasis: 280 }}
          >
            <Muted>{a.type}</Muted>
            <Heading>{a.name}</Heading>
            <Label style={{ fontSize: 27, fontWeight: "600" }}>
              {money(a.balance)}
            </Label>
            <Muted>
              {a.last4 ? `•••• ${a.last4}` : "Manually tracked account"}
            </Muted>
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
  const [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [account, setAccount] = useState("all"),
    [limit, setLimit] = useState(50);
  const transactions = monthTransactions(w.state, month).filter(
    (t) =>
      (type === "all" || t.type === type) &&
      (account === "all" ||
        t.accountId === account ||
        t.toAccountId === account) &&
      `${t.name} ${t.category}`.toLowerCase().includes(search.toLowerCase()),
  );
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
            ]}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Field
            label="Transaction account"
            type="select"
            value={account}
            onChange={setAccount}
            options={[
              { value: "all", label: "All accounts" },
              ...w.state.accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </View>
      </Row>
      <Row style={{ justifyContent: "space-between" }}>
        <Muted>{transactions.length} transactions · BHD</Muted>
        <Row>
          <Button secondary onPress={() => open("transfer")}>
            Record transfer
          </Button>
          <Button secondary onPress={download}>
            Export CSV
          </Button>
        </Row>
      </Row>
      <TransactionList
        state={w.state}
        transactions={transactions.slice(0, limit)}
      />
      {transactions.length > limit ? (
        <Button secondary onPress={() => setLimit(limit + 50)}>
          Show more transactions
        </Button>
      ) : null}
    </Card>
  );
}
export function Budgets({ workspace: w, month }) {
  return (
    <Stack>
      {w.state.budgets.length ? (
        w.state.budgets.map((b) => {
          const spent = categorySpend(w.state, month, b.category),
            percentage = (spent / b.limit) * 100;
          return (
            <Card key={b.id} testID="wide-budget">
              <Row style={{ justifyContent: "space-between" }}>
                <Heading>{b.category}</Heading>
                <Label>
                  {money(spent)} / {money(b.limit)}
                </Label>
              </Row>
              <Progress value={percentage} />
              <Muted>
                {money((toFils(b.limit) - toFils(spent)) / 1000)} remaining ·{" "}
                {Math.round(percentage)}% used
              </Muted>
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
              {money(g.saved)}
            </Label>
            <Muted>
              of {money(g.target)} · {Math.round((g.saved / g.target) * 100)}%
            </Muted>
            <Progress value={(g.saved / g.target) * 100} />
            <Button
              secondary
              label={`Update ${g.name} progress`}
              onPress={() => open("fund", g.id)}
            >
              Update progress
            </Button>
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
