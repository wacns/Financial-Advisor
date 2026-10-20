import { useAppearance } from "./appearance.jsx";
import React, { useState } from "react";
import { View, Pressable } from "react-native";
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
} from "./ui.jsx";
import Field from "./Field";
import {
  formatMoney as money,
  formatDate,
  bahrainDate,
  toFils,
} from "../locale.ts";
import { dueStatus, projectSpend } from "../planning.ts";
import { calendarEntries, shiftMonth } from "../reports.js";
import { TransactionList } from "./FinancialScreens.jsx";
import ProjectDetails from "./ProjectDetails.jsx";
const fullDate = (date) =>
  formatDate(date, { day: "2-digit", month: "short", year: "numeric" });
export function Bills({ workspace: w, open }) {
  const { colors } = useAppearance();
  const [filter, setFilter] = useState("all");
  return (
    <Stack>
      <Field
        label="Schedule filter"
        type="select"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All schedules" },
          "expense",
          "income",
          "paused",
          "transfer",
        ]}
      />
      {w.state.recurring
        .filter(
          (r) =>
            filter === "all" ||
            (filter === "paused" && r.paused) ||
            (filter === r.type && !r.paused),
        )
        .map((r) => (
          <Card testID="schedule-row" key={r.id}>
            <Row
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <View style={{ flex: 1, minWidth: 180, gap: 5 }}>
                <Heading>{r.name}</Heading>
                <Muted>
                  {r.paused ? "Paused" : dueStatus(r.nextDue)} ·{" "}
                  {fullDate(r.nextDue)}
                </Muted>
                <Muted>
                  {r.frequency} · {r.type} · {r.category}
                </Muted>
              </View>
              <Label style={{ fontSize: 24, fontWeight: "600" }}>
                {money(r.amount, r.currency || "BHD")}
              </Label>
            </Row>
            <Row>
              <Button
                disabled={r.paused || w.saving}
                onPress={() => open("record", r.id)}
              >
                {r.type === "income" ? "Record income" : "Record payment"}
              </Button>
              <Button
                secondary
                label={`Edit ${r.name}`}
                onPress={() => open("recurring", r.id)}
              >
                Edit
              </Button>
              <Button
                secondary
                disabled={w.saving}
                label={`${r.paused ? "Resume" : "Pause"} ${r.name}`}
                onPress={() => w.toggle("pause", r.id)}
              >
                {r.paused ? "Resume" : "Pause"}
              </Button>
              <Button secondary onPress={() => open("deleteSchedule", r.id)}>
                Delete schedule
              </Button>
            </Row>
          </Card>
        ))}
      {!w.state.recurring.length ? (
        <Card>
          <Empty>
            Plan your regular bills and income. Schedules never create
            transactions automatically.
          </Empty>
        </Card>
      ) : null}
      <Muted>
        Record payments only after they happen. Pausing a schedule preserves its
        transaction history.
      </Muted>
    </Stack>
  );
}
export function Debts({ workspace: w, open }) {
  const { colors } = useAppearance();
  return (
    <Stack>
      <Row style={{ alignItems: "stretch" }}>
        {w.state.debts.map((d) => (
          <Card
            key={d.id}
            testID="debt-card"
            style={{ flexGrow: 1, flexBasis: 290 }}
          >
            <Muted>
              {d.direction === "lent" ? "Money lent · " : "Money borrowed · "}
              {d.lender || "DEBT TRACKER"}
            </Muted>
            <Heading>{d.name}</Heading>
            <Label
              testID="plan-big-number"
              style={{ fontSize: 30, fontWeight: "600" }}
            >
              {money(d.balance, d.currency || "BHD")}
            </Label>
            <Muted>
              outstanding · {money(d.installment, d.currency || "BHD")} planned
              monthly
            </Muted>
            <Progress value={(1 - d.balance / d.originalBalance) * 100} />
            <Muted>
              {d.balance > 0
                ? `${dueStatus(d.nextDue)} · ${fullDate(d.nextDue)}`
                : "Repaid"}
            </Muted>
            <Button
              disabled={d.balance <= 0}
              onPress={() => open("repayment", d.id)}
            >
              Record repayment
            </Button>
            <Row>
              <Button secondary onPress={() => open("editDebt", d.id)}>
                Edit debt
              </Button>
              <Button secondary onPress={() => open("deleteDebt", d.id)}>
                Delete debt
              </Button>
            </Row>
          </Card>
        ))}
      </Row>
      {!w.state.debts.length ? (
        <Card>
          <Empty>
            Add a debt to track its outstanding principal and repayment history.
          </Empty>
        </Card>
      ) : null}
      <Card testID="planning-history">
        <Heading>Repayment history</Heading>
        <TransactionList
          state={w.state}
          transactions={w.state.transactions
            .filter((t) => t.debtId)
            .slice(0, 50)}
        />
        {w.state.transactions
          .filter((t) => t.debtId)
          .map((t) => (
            <Muted key={t.id}>
              {t.name}: {money(t.principal)} principal · {fullDate(t.date)}
            </Muted>
          ))}
      </Card>
    </Stack>
  );
}
export function Projects({ workspace: w, open }) {
  const { colors } = useAppearance();
  return (
    <Stack>
      {w.state.projects.map((p) => {
        const spent = projectSpend(w.state, p.id);
        return (
          <Card key={p.id} testID="project-card">
            <Row style={{ justifyContent: "space-between" }}>
              <Heading>{p.name}</Heading>
              <Muted>{p.archived ? "Archived" : "In progress"}</Muted>
            </Row>
            <Label
              testID="plan-big-number"
              style={{ fontSize: 29, fontWeight: "600" }}
            >
              {money(spent, p.currency || "BHD")}
            </Label>
            <Muted>
              of {money(p.budget, p.currency || "BHD")} ·{" "}
              {money(
                (toFils(p.budget) - toFils(spent)) / 1000,
                p.currency || "BHD",
              )}{" "}
              remaining
            </Muted>
            <Progress value={(spent / p.budget) * 100} />
            {p.targetDate ? (
              <Muted>Target: {fullDate(p.targetDate)}</Muted>
            ) : null}
            {p.notes ? <Label>{p.notes}</Label> : null}
            <Row>
              <Button
                disabled={p.archived}
                onPress={() => open("transaction", p.id)}
              >
                Add expense
              </Button>
              <Button
                secondary
                label={`Edit ${p.name}`}
                onPress={() => open("project", p.id)}
              >
                Edit
              </Button>
              <Button
                secondary
                disabled={w.saving}
                label={`${p.archived ? "Reopen" : "Archive"} ${p.name}`}
                onPress={() => w.toggle("archive", p.id)}
              >
                {p.archived ? "Reopen" : "Archive"}
              </Button>
            </Row>
            <ProjectDetails workspace={w} project={p} open={open} />
          </Card>
        );
      })}
      {!w.state.projects.length ? (
        <Card>
          <Empty>
            Create a project budget for the plans that matter to you.
          </Empty>
        </Card>
      ) : null}
    </Stack>
  );
}
export function Calendar({ workspace: w, month, setMonth, open }) {
  const { colors } = useAppearance();
  const [selected, setSelected] = useState("");
  const entries = calendarEntries(w.state, month),
    days =
      new Date(`${shiftMonth(month, 1)}-01T12:00:00Z`).getTime() -
      new Date(`${month}-01T12:00:00Z`).getTime();
  const dayCount = Math.round(days / 86400000),
    offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const date = selected.startsWith(month)
      ? selected
      : bahrainDate().startsWith(month)
        ? bahrainDate()
        : `${month}-01`,
    agenda = entries.filter((entry) => entry.date === date);
  function move(n) {
    setMonth(shiftMonth(month, n));
    setSelected("");
  }
  return (
    <Stack>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Button secondary label="Previous month" onPress={() => move(-1)}>
            ←
          </Button>
          <Heading>
            {formatDate(`${month}-15`, { month: "long", year: "numeric" })}
          </Heading>
          <Button secondary label="Next month" onPress={() => move(1)}>
            →
          </Button>
          <Button
            secondary
            onPress={() => {
              const today = bahrainDate();
              setMonth(today.slice(0, 7));
              setSelected(today);
            }}
          >
            Today
          </Button>
        </Row>
        <View
          testID="calendar-grid"
          style={{ flexDirection: "row", flexWrap: "wrap" }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <View
              key={day}
              style={{
                width: "14.2857%",
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Muted>{day}</Muted>
            </View>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <View key={`empty-${i}`} style={{ width: "14.2857%" }} />
          ))}
          {Array.from({ length: dayCount }, (_, i) => {
            const value = `${month}-${String(i + 1).padStart(2, "0")}`,
              count = entries.filter((r) => r.date === value).length;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value}${count ? `, ${count} payments` : ""}`}
                accessibilityState={{ selected: value === date }}
                testID={`calendar-${value}`}
                onPress={() => setSelected(value)}
                style={{
                  width: "14.2857%",
                  minHeight: 57,
                  padding: 4,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  backgroundColor: value === date ? colors.ink : "transparent",
                  borderWidth: 1,
                  borderColor: colors.line,
                  gap: 4,
                }}
              >
                <Label
                  style={{
                    color: value === date ? "white" : colors.ink,
                    fontWeight: "600",
                  }}
                >
                  {i + 1}
                </Label>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: count
                      ? value === date
                        ? "#e7c09c"
                        : colors.accent
                      : "transparent",
                  }}
                />
              </Pressable>
            );
          })}
        </View>
        <Muted>
          Future occurrences are projections. Balances change only when you
          record a payment.
        </Muted>
      </Card>
      <Card testID="day-agenda">
        <Heading>{fullDate(date)}</Heading>
        {agenda.length ? (
          agenda.map((entry, i) => (
            <View
              key={`${entry.id}-${i}`}
              style={{
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: colors.line,
                gap: 9,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Label style={{ fontWeight: "600" }}>{entry.name}</Label>
                  <Muted>
                    {entry.status === "recorded"
                      ? "Recorded"
                      : entry.status === "projected"
                        ? "Projected"
                        : "Due"}{" "}
                    · {entry.type}
                  </Muted>
                </View>
                <Label>{money(entry.amount, entry.currency)}</Label>
              </Row>
              {entry.actionable ? (
                <Button
                  onPress={() =>
                    open(
                      entry.kind === "debt"
                        ? "repayment"
                        : ["subscription", "installment"].includes(entry.kind)
                          ? `${entry.kind}Payment`
                          : "record",
                      entry.id,
                    )
                  }
                >
                  {entry.kind === "debt"
                    ? "Record repayment"
                    : entry.type === "income"
                      ? "Record income"
                      : "Record payment"}
                </Button>
              ) : null}
            </View>
          ))
        ) : (
          <Empty>No payments on this day.</Empty>
        )}
      </Card>
    </Stack>
  );
}
