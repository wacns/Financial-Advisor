import { useAppearance } from "./appearance.jsx";
import React, { useState } from "react";
import { View } from "react-native";
import {
  Card,
  Heading,
  Label,
  Muted,
  Row,
  Stack,
  Stat,
  Button,
  Progress,
  Empty,
} from "./ui.jsx";
import Field from "./Field";
import TrendChart from "./TrendChart.jsx";
import { accountReport, shiftMonth, spendingBreakdown } from "../reports.js";
import { summary, monthTransactions } from "../finance.js";
import { formatMoney as money, formatDate, toFils } from "../locale.js";
import { exportFile, native } from "../platform/runtime";
import { CustomReports, ExtendedSettings } from "./ManagementScreens.jsx";
import { backupText } from "../domain/imports.js";
import { recordValue } from "../domain/model.js";
import AppUpdates from "./AppUpdates.jsx";
export function Insights({ workspace: w, month, open }) {
  const { colors } = useAppearance();
  const [account, setAccount] = useState("all"),
    filtered = accountReport(w.state, account),
    totals = summary(filtered, month),
    breakdown = spendingBreakdown(filtered, month);
  const previous = summary(filtered, shiftMonth(month, -1)).expenses;
  const change = previous
    ? Math.round(((totals.expenses - previous) / previous) * 100)
    : null;
  const descriptions = new Map();
  for (const row of monthTransactions(filtered, month).filter(
    (t) => t.type === "expense",
  ))
    descriptions.set(
      row.name,
      (descriptions.get(row.name) || 0) + toFils(recordValue(w.state, row)),
    );
  const largest = [...descriptions].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <Stack>
      <CustomReports workspace={w} month={month} open={open} />
      <Field
        label="Report account"
        type="select"
        value={account}
        onChange={setAccount}
        options={[
          { value: "all", label: "All accounts" },
          ...w.state.accounts.map((a) => ({ value: a.id, label: a.name })),
        ]}
      />
      <Row testID="report-stats" style={{ alignItems: "stretch" }}>
        <Stat title="INCOME" value={money(totals.income)} />
        <Stat
          title="SPENDING"
          value={money(totals.expenses)}
          note={
            change === null
              ? "No previous-month baseline"
              : `${Math.abs(change)}% ${change <= 0 ? "less" : "more"} than the previous month`
          }
        />
        <Stat
          dark
          title="NET THIS MONTH"
          value={money(
            (toFils(totals.income) - toFils(totals.expenses)) / 1000,
          )}
        />
      </Row>
      <Card testID="spending-legend">
        <Heading>Where your money went</Heading>
        {breakdown.length ? (
          breakdown.map((row) => (
            <Stack key={row.name} style={{ gap: 8 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Label>{row.name}</Label>
                <Label>{money(row.amount)}</Label>
              </Row>
              <Progress value={(row.amount / totals.expenses) * 100} />
            </Stack>
          ))
        ) : (
          <Empty>Record an expense to see your spending breakdown.</Empty>
        )}
      </Card>
      <TrendChart state={filtered} month={month} />
      <Card>
        <Heading>Your largest spending descriptions</Heading>
        {largest.length ? (
          largest.map(([name, fils]) => (
            <Row key={name} style={{ justifyContent: "space-between" }}>
              <Label style={{ flex: 1 }}>{name}</Label>
              <Label>{money(fils / 1000)}</Label>
            </Row>
          ))
        ) : (
          <Empty>No expenses recorded this month.</Empty>
        )}
      </Card>
    </Stack>
  );
}
export function Settings({ workspace: w, open }) {
  const { colors } = useAppearance();
  async function download() {
    try {
      await exportFile(
        backupText(w.state),
        "application/json",
        "financial-advisor-backup.json",
      );
    } catch (error) {
      w.setMessage(error.message);
    }
  }
  async function push(action) {
    try {
      await w.notifications[action]();
      if (action === "test") w.setMessage("Test notification sent.");
    } catch (error) {
      w.setMessage(error.message);
    }
  }
  return (
    <Stack>
      <ExtendedSettings workspace={w} open={open} />
      <Card>
        <Heading>Entry and date preferences</Heading>
        <Row>
          <Button secondary onPress={() => open("defaultAccount")}>
            Default account
          </Button>
          <Button secondary onPress={() => open("datePreferences")}>
            Date format
          </Button>
        </Row>
      </Card>
      <Card testID="regional-settings">
        <Heading>At home in Bahrain</Heading>
        <Label>Region: Bahrain</Label>
        <Label>
          Currency:{" "}
          {w.state.settings.base === "BHD"
            ? "Bahraini dinar (BHD)"
            : w.state.settings.base}
        </Label>
        <Muted>
          Amounts use three decimal places. Dates follow Asia/Bahrain, including
          when you travel.
        </Muted>
      </Card>
      <Card testID="notification-settings">
        <Heading>Notifications</Heading>
        <Button secondary onPress={() => open("reminderPreferences")}>
          Reminder preferences
        </Button>
        {!native ? (
          <>
            <Label>Mobile app feature</Label>
            <Muted>
              Open the installed mobile app and sign in to enable payment
              reminders.
            </Muted>
          </>
        ) : w.demo ? (
          <Muted>
            Sign in to the mobile app to enable notifications. Demo mode never
            registers your device.
          </Muted>
        ) : (
          <>
            <Label>
              {w.push.enabled
                ? "Payment reminders are enabled."
                : "Choose whether to receive payment reminders."}
            </Label>
            <Muted>
              Notifications contain general reminders without account names,
              balances, or amounts.
            </Muted>
            {w.push.error ? (
              <Label accessibilityRole="alert" style={{ color: colors.danger }}>
                {w.push.error}
              </Label>
            ) : null}
            <Row>
              <Button
                disabled={w.push.busy}
                onPress={() => push(w.push.enabled ? "disable" : "enable")}
              >
                {w.push.enabled
                  ? "Disable notifications"
                  : "Enable notifications"}
              </Button>
              {w.push.enabled ? (
                <Button
                  secondary
                  disabled={w.push.busy}
                  onPress={() => push("test")}
                >
                  Send test notification
                </Button>
              ) : null}
            </Row>
          </>
        )}
      </Card>
      <Card>
        <Heading>Your data, in your hands</Heading>
        <Muted>
          {w.demo
            ? "Demo changes are saved on this device."
            : "Your signed-in workspace is stored privately in Supabase and shared across your devices."}
        </Muted>
        <Button secondary onPress={download}>
          Download backup
        </Button>
        {w.demo ? (
          <Button secondary disabled={w.saving} onPress={w.reset}>
            Reset demo data
          </Button>
        ) : null}
      </Card>
      <Card>
        <Heading>Personal account</Heading>
        <Label>{w.demo ? "Demo workspace" : w.user?.email}</Label>
        <Button secondary onPress={w.signout}>
          {w.demo ? "Leave demo" : "Sign out"}
        </Button>
      </Card>
      <AppUpdates />
    </Stack>
  );
}
