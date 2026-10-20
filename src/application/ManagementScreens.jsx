import { AccountChoices } from "./OrganizingScreens.jsx";
import React, { useState } from "react";
import { View, Image, Platform } from "react-native";
import {
  Card,
  Stack,
  Row,
  Heading,
  Label,
  Muted,
  Button,
  Empty,
  Progress,
  Stat,
} from "./ui.tsx";
import Field from "./Field";
import { categoryPaths } from "../domain/commands.ts";
import {
  budgetStats,
  budgetHistory,
  budgetMatches,
  accumulatedSavings,
  cycleKey,
  recurringForecast,
} from "../domain/cycles.ts";
import { backupText, parseBackup, importCSV } from "../domain/imports.ts";
import { reportRange, reportData } from "../domain/reports.ts";
import { parseReceipt } from "../domain/receipt.ts";
import { convert, recordValue } from "../domain/model.ts";
import { formatMoney as money, bahrainDate, formatDate } from "../locale.ts";
import { exportFile, native } from "../platform/runtime";
import {
  pickFile,
  scanReceipt,
  downloadAttachment,
  requestWidget,
} from "../platform/files";
export function AdvancedBudgets({ workspace: w, open }) {
  const [selected, setSelected] = useState("");
  const budgets = w.state.cycleBudgets || [],
    current = budgets.find((b) => b.id === selected) || budgets.at(-1),
    savings = accumulatedSavings(w.state);
  return (
    <Stack>
      <Row>
        <Button onPress={() => open("cycleBudget")}>New cycle budget</Button>
        {current ? (
          <>
            <Button secondary onPress={() => open("cycleBudget", current.id)}>
              Edit cycle budget
            </Button>
            <Button secondary onPress={() => open("copyCycle", current.id)}>
              Copy to another cycle
            </Button>
            <Button secondary onPress={() => open("deleteCycle", current.id)}>
              Delete cycle budget
            </Button>
          </>
        ) : null}
      </Row>
      {budgets.length ? (
        <Field
          label="Cycle budget"
          type="select"
          value={current.id}
          onChange={setSelected}
          options={budgets.map((b) => ({
            value: b.id,
            label: `${b.key} · ${b.name}`,
          }))}
        />
      ) : (
        <Card>
          <Empty>
            Create a salary-aligned cycle budget, then divide its categories and
            weekly allocations.
          </Empty>
        </Card>
      )}
      {current ? (
        <CycleDetails workspace={w} budget={current} open={open} />
      ) : null}
      <Card>
        <Heading>Accumulated cycle savings</Heading>
        <Label>{money(savings.reduce((n, r) => n + r.amount, 0))}</Label>
        {savings.map((r) => (
          <Row key={r.key} style={{ justifyContent: "space-between" }}>
            <Muted>
              {r.key} · {r.name}
            </Muted>
            <Label>{money(r.amount)}</Label>
          </Row>
        ))}
        <Muted>
          Completed cycles contribute their remaining budget; overspending
          reduces the total. This is a tracker, not a transfer.
        </Muted>
      </Card>
    </Stack>
  );
}
function CycleDetails({ workspace: w, budget: b, open }) {
  const stats = budgetStats(w.state, b),
    [drill, setDrill] = useState("");
  const covered = stats.rows
    .filter((t) => b.children.some((c) => budgetMatches(c, t.category)))
    .reduce((n, t) => n + recordValue(w.state, t, b.currency), 0);
  const history = budgetHistory(w.state, b);
  return (
    <Stack>
      <Card>
        <Heading>{b.name}</Heading>
        <Muted>
          {b.from} → {b.to} · {b.currency}
        </Muted>
        <Row>
          <Stat title="SPENT" value={money(stats.spent, b.currency)} />
          <Stat title="REMAINING" value={money(stats.remaining, b.currency)} />
          <Stat
            title="PROJECTED SPEND"
            value={money(stats.forecast, b.currency)}
          />
        </Row>
        <Progress value={stats.percent} />
        <Label>Daily room: {money(stats.daily, b.currency)}</Label>
        <Muted>
          Projection follows recorded spending pace. Future transactions are
          excluded.
        </Muted>
        <Heading>Four-week plan</Heading>
        {stats.weeks.map((week, i) => (
          <View key={i} style={{ gap: 6 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Label>
                Week {i + 1} · {week.from}
              </Label>
              <Muted>
                {money(week.spent, b.currency)} /{" "}
                {money(week.limit, b.currency)}
              </Muted>
            </Row>
            <Progress
              value={week.limit ? (week.spent / week.limit) * 100 : 0}
            />
          </View>
        ))}
      </Card>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Heading>Category sub-budgets</Heading>
          <Button
            secondary
            onPress={() => open("subBudget", null, { parentId: b.id })}
          >
            New sub-budget
          </Button>
        </Row>
        {b.children.map((c) => {
          const value = budgetStats(w.state, b, c);
          return (
            <View key={c.id} style={{ gap: 9, paddingVertical: 12 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Heading>{c.name}</Heading>
                <Label>
                  {money(value.spent, b.currency)} /{" "}
                  {money(c.limit, b.currency)}
                </Label>
              </Row>
              <Progress value={value.percent} />
              <Muted>
                Included: {c.include.join(", ") || "All"} · Excluded:{" "}
                {c.exclude.join(", ") || "None"}
              </Muted>
              <Row>
                <Button
                  secondary
                  onPress={() => open("subBudget", c.id, { parentId: b.id })}
                >
                  Edit
                </Button>
                <Button
                  secondary
                  onPress={() =>
                    open("deleteSubBudget", c.id, { parentId: b.id })
                  }
                >
                  Delete
                </Button>
                <Button
                  secondary
                  onPress={() => setDrill(drill === c.id ? "" : c.id)}
                >
                  Transactions
                </Button>
              </Row>
              {drill === c.id
                ? value.rows.map((t) => (
                    <Label key={t.id}>
                      {t.date} · {t.name} ·{" "}
                      {money(recordValue(w.state, t, b.currency), b.currency)}
                    </Label>
                  ))
                : null}
            </View>
          );
        })}
        <Label>
          Allocated:{" "}
          {money(
            b.children.reduce((n, c) => n + c.limit, 0),
            b.currency,
          )}
        </Label>
        <Label>Covered recorded spending: {money(covered, b.currency)}</Label>
        <Muted>
          Unallocated budget:{" "}
          {money(
            b.limit - b.children.reduce((n, c) => n + c.limit, 0),
            b.currency,
          )}
        </Muted>
      </Card>
      <Card>
        <Heading>Cycle spending history</Heading>
        {history.map((row) => (
          <Row key={row.key} style={{ justifyContent: "space-between" }}>
            <Muted>{row.key}</Muted>
            <Label>{money(row.spent, b.currency)}</Label>
          </Row>
        ))}
      </Card>
    </Stack>
  );
}
export function Categories({ workspace: w, open }) {
  return (
    <Stack>
      <Button onPress={() => open("category")}>New category</Button>
      <Card>
        <Heading>Categories & subcategories</Heading>
        <Muted>
          Parent category totals include their subcategories. Renaming updates
          linked records.
        </Muted>
        {categoryPaths(w.state).map((path) => (
          <Row key={path} style={{ justifyContent: "space-between" }}>
            <Label
              style={{
                flex: 1,
                color: w.state.settings.categoryStyles?.find(
                  (style) => style.path === path,
                )?.color,
              }}
            >
              {w.state.settings.categoryStyles?.find(
                (style) => style.path === path,
              )?.icon || "◇"}{" "}
              {path}
            </Label>
            <Button
              secondary
              label={`Rename ${path}`}
              onPress={() => open("category", path)}
            >
              Rename
            </Button>
            <Button
              secondary
              label={`Delete ${path}`}
              onPress={() => open("deleteCategory", path)}
            >
              Delete
            </Button>
          </Row>
        ))}
      </Card>
    </Stack>
  );
}
export function Templates({ workspace: w, open }) {
  return (
    <Stack>
      <Muted>
        Save a transaction as a template from its actions. Reusing a template
        opens a draft for review and never posts automatically.
      </Muted>
      {w.state.templates.length ? (
        w.state.templates.map((t) => (
          <Card key={t.id}>
            <Heading>{t.name}</Heading>
            <Muted>
              {t.record.type} · {t.record.category} ·{" "}
              {(t.record.labels || []).join(", ")}
            </Muted>
            <Row>
              <Button
                onPress={() =>
                  open(
                    t.record.type === "transfer" ? "transfer" : "transaction",
                    null,
                    { draft: { ...t.record, date: bahrainDate() } },
                  )
                }
              >
                Use template
              </Button>
              <Button secondary onPress={() => open("deleteTemplate", t.id)}>
                Delete template
              </Button>
            </Row>
          </Card>
        ))
      ) : (
        <Card>
          <Empty>No saved templates yet.</Empty>
        </Card>
      )}
    </Stack>
  );
}
export function Forecast({ workspace: w }) {
  const f = recurringForecast(w.state);
  return (
    <Stack>
      <Row>
        <Stat title="REGULAR INCOME" value={money(f.income)} />
        <Stat title="COMMITMENTS" value={money(f.expenses)} />
        <Stat
          dark
          title={
            f.remaining < 0 ? "MONTHLY SHORTFALL" : "LEFT AFTER COMMITMENTS"
          }
          value={money(Math.abs(f.remaining))}
        />
      </Row>
      <Card>
        <Heading>Income committed</Heading>
        <Label>
          {f.income
            ? `${f.percent.toFixed(1)}%`
            : "Add recurring income to calculate"}
        </Label>
        <Progress value={f.percent} />
        <Muted>
          Monthly amounts count once. Daily × 365 ÷ 12; weekly × 52 ÷ 12; yearly
          ÷ 12. Transfers count as outgoing commitments without counting the
          destination as income. Actual transactions are excluded.
        </Muted>
        {f.rows.map((r) => (
          <Row key={r.id} style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Label>{r.name}</Label>
              <Muted>
                {r.type} · {r.frequency}
              </Muted>
            </View>
            <Label>{money(r.value)}</Label>
          </Row>
        ))}
      </Card>
    </Stack>
  );
}
export function Salary({ workspace: w, open, month }) {
  const [selected, setSelected] = useState(month);
  const rows = w.state.transactions.filter(
      (t) => t.type === "income" && t.salaryMonth === selected,
    ),
    sum = rows.reduce((n, t) => n + recordValue(w.state, t), 0),
    schedules = w.state.recurring.filter(
      (r) => r.type === "income" && r.isSalary,
    );
  return (
    <Stack>
      <Field
        label="Salary month"
        type="month"
        value={selected}
        onChange={setSelected}
      />
      <Stat dark title="RECEIVED FOR SALARY MONTH" value={money(sum)} />
      <Row>
        <Button
          onPress={() =>
            open("recurring", null, {
              draft: { type: "income", isSalary: "yes", category: "Income" },
            })
          }
        >
          Plan salary
        </Button>
        <Button
          secondary
          onPress={() =>
            open("transaction", null, {
              draft: {
                type: "income",
                category: "Income",
                salaryMonth: selected,
              },
            })
          }
        >
          Record other income
        </Button>
      </Row>
      <Card>
        <Heading>Salary schedules</Heading>
        {schedules.length ? (
          schedules.map((r) => (
            <Row key={r.id} style={{ justifyContent: "space-between" }}>
              <View>
                <Heading>{r.name}</Heading>
                <Muted>Next due: {r.nextDue}</Muted>
              </View>
              <Button
                disabled={r.paused}
                onPress={() =>
                  open("record", r.id, { draft: { salaryMonth: selected } })
                }
              >
                Record salary
              </Button>
            </Row>
          ))
        ) : (
          <Empty>Add a recurring income schedule and mark it as salary.</Empty>
        )}
      </Card>
      <Card>
        <Heading>Salary history</Heading>
        {rows.map((t) => (
          <Row key={t.id} style={{ justifyContent: "space-between" }}>
            <Label>
              {t.date} · {t.name}
            </Label>
            <Label>{money(recordValue(w.state, t))}</Label>
          </Row>
        ))}
        <Heading>Assign recorded income</Heading>
        {w.state.transactions
          .filter((t) => t.type === "income")
          .slice(0, 100)
          .map((t) => (
            <Row key={t.id} style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Label>
                  {t.date} · {t.name}
                </Label>
                <Muted>{t.salaryMonth || "Not assigned to salary month"}</Muted>
              </View>
              <Button secondary onPress={() => open("salaryLink", t.id)}>
                Assign month
              </Button>
            </Row>
          ))}
      </Card>
    </Stack>
  );
}
export function Warranties({ workspace: w, open }) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    today = bahrainDate();
  const label = (record) =>
    record.expires < today
      ? "Expired"
      : Math.ceil(
            (Date.parse(record.expires) - Date.parse(today)) / 86400000,
          ) <= 30
        ? "Expiring soon"
        : "Active";
  const rows = w.state.warranties.filter(
    (r) =>
      (status === "all" || label(r) === status) &&
      `${r.name} ${r.brand} ${r.serial} ${r.retailer}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <Stack>
      <Row>
        <Button onPress={() => open("warranty")}>New warranty</Button>
      </Row>
      <Field label="Search warranties" value={query} onChange={setQuery} />
      <Field
        label="Warranty status"
        value={status}
        type="select"
        onChange={setStatus}
        options={["all", "Active", "Expiring soon", "Expired"]}
      />
      {rows.length ? (
        rows.map((r) => (
          <Card key={r.id}>
            <Row style={{ justifyContent: "space-between" }}>
              <Heading>{r.name}</Heading>
              <Label>{label(r)}</Label>
            </Row>
            <Muted>
              {r.brand} · {r.category} · {r.retailer}
            </Muted>
            <Label>Serial: {r.serial || "—"}</Label>
            <Label>
              {r.purchased} → {r.expires}
            </Label>
            <Muted>{r.notes}</Muted>
            {r.receipt ? (
              <Image
                accessibilityLabel={`Receipt for ${r.name}`}
                source={{ uri: r.receipt }}
                style={{ width: "100%", height: 180, resizeMode: "contain" }}
              />
            ) : null}
            <Row>
              <Button secondary onPress={() => open("warranty", r.id)}>
                Edit warranty
              </Button>
              <Button secondary onPress={() => open("deleteWarranty", r.id)}>
                Delete warranty
              </Button>
              {r.receipt ? (
                <Button
                  secondary
                  onPress={() =>
                    downloadAttachment(
                      r.receipt,
                      `${r.name}-receipt.jpg`,
                    ).catch((e) => w.setMessage(e.message))
                  }
                >
                  Download receipt
                </Button>
              ) : null}
            </Row>
          </Card>
        ))
      ) : (
        <Card>
          <Empty>No warranties match this view.</Empty>
        </Card>
      )}
    </Stack>
  );
}
export function Receipts({ workspace: w, open }) {
  const [busy, setBusy] = useState(false),
    [recognized, setRecognized] = useState(""),
    [error, setError] = useState("");
  async function scan(camera) {
    setBusy(true);
    setError("");
    try {
      const result = await scanReceipt(camera);
      if (result) setRecognized(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function review() {
    const parsed = parseReceipt(recognized);
    open("transaction", null, {
      draft: {
        ...parsed,
        accountId:
          w.state.accounts.find((a) => a.currency === parsed.currency)?.id ||
          w.state.accounts[0]?.id,
        date: parsed.date || bahrainDate(),
      },
    });
  }
  return (
    <Stack>
      <Card>
        <Heading>Scan a receipt</Heading>
        <Muted>
          Printed English receipt recognition runs on your device. Check the
          total, merchant, date, currency and account before saving. Scanning
          never posts a transaction.
        </Muted>
        <Row>
          <Button disabled={busy} onPress={() => scan(false)}>
            {busy ? "Recognizing receipt…" : "Choose receipt image"}
          </Button>
          {native ? (
            <Button secondary disabled={busy} onPress={() => scan(true)}>
              Take receipt photo
            </Button>
          ) : null}
        </Row>
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
        <Field
          label="Recognized receipt text"
          type="textarea"
          value={recognized}
          onChange={setRecognized}
        />
        <Button disabled={!recognized.trim() || busy} onPress={review}>
          Review expense
        </Button>
      </Card>
    </Stack>
  );
}
export function DataTools({ workspace: w }) {
  const [preview, setPreview] = useState(null),
    [csv, setCSV] = useState(""),
    [account, setAccount] = useState(w.state.accounts[0]?.id || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function file() {
    setError("");
    try {
      const file = await pickFile();
      if (!file) return;
      if (file.name.toLowerCase().endsWith(".json"))
        setPreview(parseBackup(file.text));
      else setCSV(file.text);
    } catch (e) {
      setError(e.message);
    }
  }
  async function restore() {
    setBusy(true);
    setError("");
    try {
      await w.replace(preview);
      setPreview(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function csvImport() {
    setBusy(true);
    setError("");
    try {
      const result = importCSV(w.state, csv, account);
      await w.replace(result.state);
      w.setMessage(
        `${result.added} records imported; ${result.skipped} duplicates skipped.`,
      );
      setCSV("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack>
      <Card>
        <Heading>Backup & restore</Heading>
        <Muted>
          Backups contain private financial data and attachments in plain JSON.
          Keep them private. Restoring replaces this workspace only after you
          review and confirm.
        </Muted>
        <Row>
          <Button
            secondary
            onPress={() =>
              exportFile(
                backupText(w.state),
                "application/json",
                "financial-advisor-full-backup.json",
              ).catch((e) => setError(e.message))
            }
          >
            Export full backup
          </Button>
          <Button disabled={busy} onPress={file}>
            Choose JSON or CSV file
          </Button>
        </Row>
        {preview ? (
          <Stack>
            <Heading>Review backup before replacing records</Heading>
            {[
              "accounts",
              "transactions",
              "budgets",
              "goals",
              "recurring",
              "debts",
              "projects",
              "warranties",
              "cycleBudgets",
              "templates",
            ].map((key) => (
              <Label key={key}>
                {key}: {preview[key].length}
              </Label>
            ))}
            <Label>Reporting currency: {preview.settings.base}</Label>
            <Row>
              <Button disabled={busy} onPress={restore}>
                Replace workspace with this backup
              </Button>
              <Button
                secondary
                disabled={busy}
                onPress={() => setPreview(null)}
              >
                Cancel restore
              </Button>
            </Row>
          </Stack>
        ) : null}
      </Card>
      <Card>
        <Heading>Import income & expense CSV</Heading>
        <Muted>
          Required columns: date,type,amount. Optional: category,name,note,time.
          Date format YYYY-MM-DD. Exact duplicates are skipped. All rows are
          checked before anything is saved.
        </Muted>
        <Field
          label="Import into account"
          type="select"
          value={account}
          onChange={setAccount}
          options={w.state.accounts.map((a) => ({
            value: a.id,
            label: `${a.name} · ${a.currency}`,
          }))}
        />
        <Field label="CSV data" type="textarea" value={csv} onChange={setCSV} />
        <Button disabled={busy || !account || !csv} onPress={csvImport}>
          Validate and import CSV
        </Button>
      </Card>
      {error ? <Label accessibilityRole="alert">{error}</Label> : null}
    </Stack>
  );
}
export function CustomReports({ workspace: w, month, open }) {
  const [mode, setMode] = useState("month"),
    [from, setFrom] = useState(`${month}-01`),
    [to, setTo] = useState(bahrainDate()),
    [group, setGroup] = useState("category"),
    [kind, setKind] = useState("expense"),
    [account, setAccount] = useState("all"),
    [drill, setDrill] = useState(""),
    [reportAccounts, setReportAccounts] = useState([]);
  let data, error, range;
  try {
    range = reportRange(w.state, mode, month, from, to);
    data = reportData(w.state, range, {
      account,
      accounts: reportAccounts,
      group,
      kind,
    });
  } catch (e) {
    error = e.message;
  }
  return (
    <Card>
      <Heading>Flexible reports & drill-down</Heading>
      <Row>
        <Field
          label="Report period"
          type="select"
          value={mode}
          onChange={setMode}
          options={[
            { value: "month", label: "Selected month" },
            { value: "quarter", label: "Quarter" },
            { value: "year", label: "Year" },
            { value: "last7", label: "Last 7 days" },
            { value: "last30", label: "Last 30 days" },
            { value: "last3months", label: "Last 3 months" },
            { value: "custom", label: "Custom dates" },
          ]}
        />
        <Field
          label="Report direction"
          type="select"
          value={kind}
          onChange={setKind}
          options={["expense", "income"]}
        />
        <Field
          label="Group by"
          type="select"
          value={group}
          onChange={(value) => {
            setGroup(value);
            setDrill("");
          }}
          options={[
            "category",
            "parent",
            "description",
            "account",
            "label",
            "payee",
          ]}
        />
      </Row>
      <Field
        label="Flexible report account"
        type="select"
        value={account}
        onChange={setAccount}
        options={[
          { value: "all", label: "All accounts" },
          ...w.state.accounts.map((a) => ({ value: a.id, label: a.name })),
        ]}
      />
      <AccountChoices
        state={w.state}
        selected={reportAccounts}
        onChange={setReportAccounts}
        label="Chart accounts"
      />
      {mode === "custom" ? (
        <Row>
          <Field
            label="From date"
            type="date"
            value={from}
            onChange={setFrom}
          />
          <Field label="To date" type="date" value={to} onChange={setTo} />
        </Row>
      ) : null}
      {error ? (
        <Label accessibilityRole="alert">{error}</Label>
      ) : (
        <>
          <Muted>
            {range.from} → {range.until} (end exclusive)
          </Muted>
          <Label>
            Income {money(data.income)} · Expenses {money(data.expenses)} · Net{" "}
            {money(data.net)}
          </Label>
          {data.groups.map((g) => (
            <View key={g.name} style={{ gap: 5, paddingVertical: 7 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Button
                  secondary
                  onPress={() => setDrill(drill === g.name ? "" : g.name)}
                >
                  {g.name}
                </Button>
                <Label>{money(g.amount)}</Label>
              </Row>
              <Progress
                value={
                  (g.amount /
                    (kind === "income" ? data.income : data.expenses)) *
                  100
                }
              />
              {drill === g.name
                ? data.rows
                    .filter((t) => {
                      const k =
                        group === "payee"
                          ? w.state.payees.find((p) => p.id === t.payeeId)
                              ?.name || "No contact"
                          : group === "account"
                            ? w.state.accounts.find((a) => a.id === t.accountId)
                                ?.name
                            : group === "description"
                              ? t.name
                              : group === "parent"
                                ? t.category.split(" / ")[0]
                                : group === "label"
                                  ? (t.labels || []).join(", ") || "Unlabeled"
                                  : t.category;
                      return k === g.name && t.type === kind;
                    })
                    .map((t) => (
                      <Row
                        key={t.id}
                        style={{ justifyContent: "space-between" }}
                      >
                        <Label style={{ flex: 1 }}>
                          {t.date} · {t.name} · {money(recordValue(w.state, t))}
                        </Label>
                        <Button
                          secondary
                          onPress={() => open("editTransaction", t.id)}
                        >
                          Edit
                        </Button>
                      </Row>
                    ))
                : null}
            </View>
          ))}
        </>
      )}
    </Card>
  );
}
export function ExtendedSettings({ workspace: w, open }) {
  async function widget() {
    try {
      await w.save("widgetPreferences", {
        enabled: w.state.settings.widgetsEnabled ? "no" : "yes",
      });
      if (!w.state.settings.widgetsEnabled && native) await requestWidget();
    } catch (e) {
      w.setMessage(e.message);
    }
  }
  return (
    <Stack>
      <Card>
        <Heading>Language, appearance & reporting</Heading>
        <Label>
          {w.state.settings.language === "ar" ? "العربية" : "English"} ·{" "}
          {w.state.settings.theme} · {w.state.settings.base}
        </Label>
        <Label>
          Reporting cycle starts on day {w.state.settings.cycleStartDay}
        </Label>
        <Row>
          <Button secondary onPress={() => open("preferences")}>
            Workspace preferences
          </Button>
          <Button secondary onPress={() => open("rates")}>
            Exchange rates
          </Button>
          <Button secondary onPress={() => w.navigate("categories")}>
            Manage categories
          </Button>
          <Button secondary onPress={() => w.navigate("templates")}>
            Transaction templates
          </Button>
          <Button secondary onPress={() => w.navigate("data")}>
            Import & restore
          </Button>
        </Row>
      </Card>
      <Card>
        <Heading>Quick entry & Android widgets</Heading>
        <Muted>
          Widgets show quick-entry buttons and up to four saved template names.
          Balances and amounts stay inside the app. Widget actions open a draft
          after verifying your account.
        </Muted>
        <Row>
          <Button
            secondary
            onPress={() =>
              open("transaction", null, { draft: { type: "expense" } })
            }
          >
            Quick expense
          </Button>
          <Button
            secondary
            onPress={() =>
              open("transaction", null, {
                draft: { type: "income", category: "Income" },
              })
            }
          >
            Quick income
          </Button>
          {native && Platform.OS === "android" ? (
            <Button secondary onPress={widget}>
              {w.state.settings.widgetsEnabled
                ? "Disable widgets"
                : "Enable Android widget"}
            </Button>
          ) : null}
        </Row>
      </Card>
    </Stack>
  );
}
