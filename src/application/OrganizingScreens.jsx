import React, { useState } from "react";
import { View } from "react-native";
import Field from "./Field";
import {
  Button,
  Card,
  Empty,
  Heading,
  Label,
  Muted,
  Row,
  Stack,
  Progress,
  Stat,
} from "./ui.tsx";
import { useAppearance } from "./appearance.tsx";
import { formatMoney as money, formatDate, bahrainDate } from "../locale.ts";
import { convert } from "../domain/model.ts";
import { contactSummary } from "../domain/organizing.ts";
import {
  commitmentStats,
  commitmentCalendar,
  commitmentDue,
  installmentAmount,
} from "../domain/commitments.ts";
import { TransactionList } from "./FinancialScreens.jsx";
export { AccountChoices } from "./AccountChoices.tsx";
export function Contacts({ workspace: w, open }) {
  const [search, setSearch] = useState(""),
    [role, setRole] = useState("all"),
    [expanded, setExpanded] = useState("");
  const rows = w.state.payees.filter(
    (p) =>
      (role === "all" || p.role === role || p.role === "both") &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Stack>
      <Row>
        <Button onPress={() => open("payee")}>New payee or payer</Button>
        <Field label="Search contacts" value={search} onChange={setSearch} />
        <Field
          label="Contact direction"
          type="select"
          value={role}
          onChange={setRole}
          options={[
            { value: "all", label: "All contacts" },
            { value: "payee", label: "Payees" },
            { value: "payer", label: "Payers" },
          ]}
        />
      </Row>
      {rows.map((p) => {
        const stats = contactSummary(w.state, p.id);
        return (
          <Card key={p.id} testID="contact-card">
            <Row style={{ justifyContent: "space-between" }}>
              <Heading>{p.name}</Heading>
              <Muted>{p.role}</Muted>
            </Row>
            {p.note ? <Muted>{p.note}</Muted> : null}
            <Row>
              <Label>Paid: {money(stats.expenses)}</Label>
              <Label>Received: {money(stats.income)}</Label>
              <Muted>{stats.rows.length} transactions</Muted>
            </Row>
            <Row>
              <Button secondary onPress={() => open("payee", p.id)}>
                Edit contact
              </Button>
              <Button
                secondary
                onPress={() => setExpanded(expanded === p.id ? "" : p.id)}
              >
                View contact transactions
              </Button>
              <Button secondary onPress={() => open("deletePayee", p.id)}>
                Delete contact
              </Button>
            </Row>
            {expanded === p.id ? (
              <TransactionList
                state={w.state}
                transactions={stats.rows}
                open={open}
              />
            ) : null}
          </Card>
        );
      })}
      {!rows.length ? (
        <Card>
          <Empty>
            Add the people or businesses you pay and receive money from. Link
            them when reviewing a transaction.
          </Empty>
        </Card>
      ) : null}
    </Stack>
  );
}
export function Tags({ workspace: w, open }) {
  const [expanded, setExpanded] = useState("");
  const names = [
    ...new Set([
      ...w.state.tags.map((t) => t.name),
      ...w.state.transactions.flatMap((t) => t.labels || []),
    ]),
  ];
  return (
    <Stack>
      <Button onPress={() => open("tag")}>New tag</Button>
      <Muted>
        Use up to five tags per transaction. Existing free-text labels appear
        here too.
      </Muted>
      {names.map((name) => {
        const tag = w.state.tags.find((t) => t.name === name),
          rows = w.state.transactions.filter((t) => t.labels?.includes(name));
        return (
          <Card key={name}>
            <Row style={{ justifyContent: "space-between" }}>
              <Heading>{name}</Heading>
              <View
                style={{
                  height: 18,
                  width: 18,
                  borderRadius: 9,
                  backgroundColor: tag?.color || "#214b39",
                }}
              />
            </Row>
            <Muted>{rows.length} linked transactions</Muted>
            <Row>
              {tag ? (
                <>
                  <Button secondary onPress={() => open("tag", tag.id)}>
                    Edit tag
                  </Button>
                  <Button secondary onPress={() => open("deleteTag", tag.id)}>
                    Delete tag
                  </Button>
                </>
              ) : (
                <Button secondary onPress={() => open("tag", null, { name })}>
                  Customize tag
                </Button>
              )}
              <Button
                secondary
                onPress={() => setExpanded(expanded === name ? "" : name)}
              >
                View tagged transactions
              </Button>
            </Row>
            {expanded === name ? (
              <TransactionList
                state={w.state}
                transactions={rows}
                open={open}
              />
            ) : null}
          </Card>
        );
      })}
      {!names.length ? (
        <Card>
          <Empty>
            Create tags for trips, households, work or any purpose that matters
            to you.
          </Empty>
        </Card>
      ) : null}
    </Stack>
  );
}
function Plans({ workspace: w, open, kind, month }) {
  const [status, setStatus] = useState("active"),
    [search, setSearch] = useState(""),
    [expanded, setExpanded] = useState(""),
    [view, setView] = useState("list"),
    [calendarMonth, setCalendarMonth] = useState(
      month || bahrainDate().slice(0, 7),
    );
  const isInstallment = kind === "installment",
    key = isInstallment ? "installments" : "subscriptions",
    plans = w.state[key];
  const rows = plans.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      `${p.name} ${p.provider}`.toLowerCase().includes(search.toLowerCase()),
  );
  const active = plans.filter((p) => p.status === "active");
  const total = active.reduce((n, p) => {
    const stats = commitmentStats(w.state, p, kind);
    return (
      n +
      convert(
        w.state,
        isInstallment ? stats.remaining : stats.monthly,
        p.currency,
      )
    );
  }, 0);
  async function action(name, id) {
    try {
      await w.save(name, {}, id);
    } catch (e) {
      w.setMessage(e.message);
    }
  }
  const calendar = commitmentCalendar(w.state, calendarMonth).filter(
    (row) => row.kind === kind,
  );
  return (
    <Stack>
      <Row>
        <Stat
          title={
            isInstallment
              ? "REMAINING INSTALLMENTS"
              : "MONTHLY SUBSCRIPTION EQUIVALENT"
          }
          value={money(total)}
          note={
            isInstallment
              ? "Scheduled principal still unpaid; no new debt is posted."
              : "Annualized active plans, converted to reporting currency."
          }
        />
        <Stat title="ACTIVE PLANS" value={active.length} />
      </Row>
      <Row>
        <Button onPress={() => open(kind)}>New {kind}</Button>
        <Field label={`Search ${key}`} value={search} onChange={setSearch} />
        <Field
          label="Plan status"
          type="select"
          value={status}
          onChange={setStatus}
          options={["active", "paused", "cancelled", "all"]}
        />
        <Field
          label="Plan view"
          type="select"
          value={view}
          onChange={setView}
          options={["list", "calendar"]}
        />
      </Row>
      {view === "calendar" ? (
        <Card>
          <Heading>
            {isInstallment ? "Installment" : "Subscription"} calendar
          </Heading>
          <Field
            label="Plan calendar month"
            type="month"
            value={calendarMonth}
            onChange={(v) => {
              if (/^\d{4}-\d{2}$/.test(v)) setCalendarMonth(v);
            }}
          />
          {calendar.length ? (
            calendar.map((row) => (
              <Row
                key={`${row.key}-${row.status}`}
                style={{ justifyContent: "space-between" }}
              >
                <Label>
                  {row.date} · {row.name}
                </Label>
                <Muted>{row.status}</Muted>
                <Label>{money(row.amount, row.currency)}</Label>
                {row.status === "due" ? (
                  <Button
                    secondary
                    onPress={() => open(`${kind}Payment`, row.id)}
                  >
                    Record payment
                  </Button>
                ) : null}
              </Row>
            ))
          ) : (
            <Empty>No payments in this month.</Empty>
          )}
          <Muted>Projected occurrences never change balances.</Muted>
        </Card>
      ) : (
        rows.map((p) => {
          const stats = commitmentStats(w.state, p, kind);
          return (
            <Card key={p.id} testID={`${kind}-card`}>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Muted>
                    {p.provider || "PERSONAL PLAN"} · {p.status}
                  </Muted>
                  <Heading>{p.name}</Heading>
                </View>
                <Label style={{ fontSize: 25, fontWeight: "600" }}>
                  {money(isInstallment ? p.total : p.amount, p.currency)}
                </Label>
              </Row>
              {isInstallment ? (
                <>
                  <Progress value={(p.payments.length / p.count) * 100} />
                  <Muted>
                    {p.payments.length} / {p.count} paid ·{" "}
                    {money(stats.paid, p.currency)} paid ·{" "}
                    {money(stats.remaining, p.currency)} remaining
                  </Muted>
                </>
              ) : (
                <Muted>
                  Every {p.interval} {p.frequency} ·{" "}
                  {money(stats.monthly, p.currency)} / month equivalent
                </Muted>
              )}
              <Label>
                {stats.complete
                  ? "All installments paid"
                  : `${stats.overdue ? "Overdue" : "Next payment"}: ${formatDate(stats.due, { day: "2-digit", month: "short", year: "numeric" })} · ${money(stats.amount, p.currency)}`}
              </Label>
              {p.trialEnds ? (
                <Muted>
                  Trial ends:{" "}
                  {formatDate(p.trialEnds, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Muted>
              ) : null}
              {p.note ? <Muted>{p.note}</Muted> : null}
              <Row>
                <Button
                  disabled={stats.complete || p.status !== "active" || w.saving}
                  onPress={() => open(`${kind}Payment`, p.id)}
                >
                  Record {kind} payment
                </Button>
                <Button secondary onPress={() => open(kind, p.id)}>
                  Edit plan
                </Button>
                {!isInstallment ? (
                  <Button
                    secondary
                    disabled={w.saving}
                    onPress={() =>
                      action(
                        p.status === "active"
                          ? "pauseSubscription"
                          : "resumeSubscription",
                        p.id,
                      )
                    }
                  >
                    {p.status === "active" ? "Pause" : "Resume"}
                  </Button>
                ) : null}
                {!isInstallment && p.status !== "cancelled" ? (
                  <Button
                    secondary
                    onPress={() => action("cancelSubscription", p.id)}
                  >
                    Cancel renewal
                  </Button>
                ) : null}
                <Button
                  secondary
                  onPress={() => setExpanded(expanded === p.id ? "" : p.id)}
                >
                  Schedule & payment history
                </Button>
                {!p.payments.length ? (
                  <Button
                    secondary
                    onPress={() =>
                      open(
                        isInstallment
                          ? "deleteInstallment"
                          : "deleteSubscription",
                        p.id,
                      )
                    }
                  >
                    Delete plan
                  </Button>
                ) : null}
              </Row>
              {expanded === p.id ? (
                <Stack>
                  <Heading>Payment history</Heading>
                  {p.payments.length ? (
                    p.payments.map((payment) => (
                      <Row
                        key={payment.id}
                        style={{ justifyContent: "space-between" }}
                      >
                        <Label>
                          #{payment.index + 1} · {payment.date}
                        </Label>
                        <Label>{money(payment.amount, p.currency)}</Label>
                        <Muted>
                          {payment.method === "manual"
                            ? "Marked paid — no transaction"
                            : "Expense recorded"}
                        </Muted>
                        {payment.transactionId ? (
                          <Button
                            secondary
                            onPress={() =>
                              open("deleteTransaction", payment.transactionId)
                            }
                          >
                            Reverse payment
                          </Button>
                        ) : null}
                      </Row>
                    ))
                  ) : (
                    <Empty>No payments yet.</Empty>
                  )}
                  {isInstallment ? (
                    <>
                      <Heading>Upcoming installments</Heading>
                      {Array.from({ length: p.count }, (_, index) => index)
                        .filter(
                          (index) =>
                            !p.payments.some(
                              (payment) => payment.index === index,
                            ),
                        )
                        .slice(0, 12)
                        .map((index) => (
                          <Row
                            key={index}
                            style={{ justifyContent: "space-between" }}
                          >
                            <Label>
                              #{index + 1} · {commitmentDue(p, index)}
                            </Label>
                            <Label>
                              {money(installmentAmount(p, index), p.currency)}
                            </Label>
                          </Row>
                        ))}
                      {p.count - stats.index > 12 ? (
                        <Muted>Showing the next 12 payments.</Muted>
                      ) : null}
                    </>
                  ) : null}
                </Stack>
              ) : null}
            </Card>
          );
        })
      )}
      {view === "list" && !rows.length ? (
        <Card>
          <Empty>
            No {key} match this view. Create a plan to track its next payment
            and history.
          </Empty>
        </Card>
      ) : null}
    </Stack>
  );
}
export const Subscriptions = (props) => (
  <Plans {...props} kind="subscription" />
);
export const Installments = (props) => <Plans {...props} kind="installment" />;
