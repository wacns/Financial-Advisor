import { useAppearance, AppearanceProvider } from "./appearance.tsx";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "../platform/safe-area";
import { Label, Heading, Muted, Button, NavLink, Row, Stack } from "./ui.tsx";
import Field from "./Field";
import PrivacyGate from "../platform/PrivacyGate";
import Login from "./Login.tsx";
import EntryModal from "./EntryModal.tsx";
import { useWorkspace } from "./useWorkspace.ts";
import { entryForm } from "./forms.ts";
import {
  Overview,
  Accounts,
  Transactions,
  Budgets,
  Goals,
} from "./FinancialScreens.tsx";
import { Bills, Debts, Projects, Calendar } from "./PlanningScreens.tsx";
import { Insights, Settings } from "./ReportsSettings.tsx";
import { bahrainDate, isCivilDate, setDisplayPreferences } from "../locale.ts";
import {
  AdvancedBudgets,
  Categories,
  Templates,
  Forecast,
  Salary,
  Warranties,
  Receipts,
  DataTools,
} from "./ManagementScreens.tsx";
import CurrencyTools from "./CurrencyTools.tsx";
import MoneyTools from "./MoneyTools.tsx";
import SharedAccounts from "./SharedAccounts.tsx";
import {
  Contacts,
  Tags,
  Subscriptions,
  Installments,
} from "./OrganizingScreens.tsx";
import { subscribeCapture, subscribeQuickEntry } from "../platform/files";
import { errorMessage, must } from "../guards.ts";
import type { ComponentType } from "react";
import type { FormContext, FormSpec } from "./enhancementForms.ts";
import type { CaptureRequest, QuickEntry } from "../platform/contracts.ts";
import type { ScreenProps } from "./screenTypes.ts";
/** Route id, navigation label and icon for every workspace page. */
const pages: [string, string, string][] = [
  ["overview", "Overview", "◈"],
  ["accounts", "Accounts", "▣"],
  ["shared-accounts", "Shared accounts", "♧"],
  ["transactions", "Transactions", "⇄"],
  ["budgets", "Budgets", "▥"],
  ["goals", "Goals", "⚑"],
  ["bills", "Bills & salary", "◷"],
  ["subscriptions", "Subscriptions", "⟳"],
  ["installments", "Installments", "◴"],
  ["contacts", "Payees & payers", "♧"],
  ["tags", "Tags", "◇"],
  ["calendar", "Calendar", "▦"],
  ["debts", "Debts & loans", "◇"],
  ["projects", "Projects", "▱"],
  ["insights", "Insights", "◔"],
  ["advanced-budgets", "Cycle budgets", "▤"],
  ["salary", "Salary", "◉"],
  ["forecast", "Commitment forecast", "↗"],
  ["currency", "Currency tools", "↔"],
  ["capture", "Capture & assistant", "✧"],
  ["receipts", "Receipt scanner", "▧"],
  ["warranties", "Warranties", "✓"],
  ["categories", "Categories", "⊞"],
  ["templates", "Templates", "⊕"],
  ["data", "Import & restore", "⇅"],
  ["settings", "Settings", "⚙"],
];
const titles: Record<string, string> = {
  accounts: "A home for your money.",
  transactions: "Every little money moment.",
  budgets: "A little intention goes a long way.",
  goals: "Good things on your horizon.",
  bills: "A rhythm for your money.",
  calendar: "Your money, on the calendar.",
  debts: "One step closer to lighter days.",
  projects: "A budget for your next chapter.",
  insights: "A little perspective.",
  settings: "Make yourself at home.",
};
const actions: Record<string, [string, string]> = {
  overview: ["Add transaction", "transaction"],
  transactions: ["Add transaction", "transaction"],
  budgets: ["Set a budget", "budget"],
  goals: ["New goal", "goal"],
  bills: ["New schedule", "recurring"],
  calendar: ["New schedule", "recurring"],
  debts: ["Add debt", "debt"],
  projects: ["New project", "project"],
};
function MonthSelector({
  month,
  setMonth,
}: {
  month: string;
  setMonth: (month: string) => void;
}) {
  const { colors } = useAppearance();
  const [draft, setDraft] = useState(month);
  useEffect(() => setDraft(month), [month]);
  return (
    <Field
      label="Selected month"
      type="month"
      value={draft}
      onChange={(value) => {
        setDraft(value);
        if (/^\d{4}-\d{2}$/.test(value) && isCivilDate(`${value}-01`))
          setMonth(value);
      }}
    />
  );
}
function WorkspaceApp() {
  const { colors, setPreferences, language } = useAppearance();
  const w = useWorkspace(),
    wide = useWindowDimensions().width >= 1000;
  const { navigate, demo, message, setMessage } = w;
  setDisplayPreferences(w.state.settings);
  useEffect(() => {
    setPreferences(w.state.settings || {});
  }, [w.state.settings, setPreferences]);
  const [month, setMonth] = useState(() => bahrainDate().slice(0, 7)),
    [form, setForm] = useState<FormSpec | null>(null),
    [menu, setMenu] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    routeRef = useRef(w.route),
    // Pages visited in this workspace; an entry is undefined if a route had no page segment.
    historyRef = useRef<(string | undefined)[]>([]);
  const rawPage = w.route.split("/")[1],
    // A missing segment matches no page, so this is the same test as before.
    page =
      rawPage !== undefined && pages.some((row) => row[0] === rawPage)
        ? rawPage
        : "overview";
  const login = !w.route.startsWith("demo/") && !w.route.startsWith("app/");
  useEffect(() => {
    setMenu(false);
    setForm(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (routeRef.current !== w.route) {
      if (!login && routeRef.current.split("/")[0] === w.route.split("/")[0])
        historyRef.current.push(routeRef.current.split("/")[1]);
      else historyRef.current = [];
      routeRef.current = w.route;
    }
  }, [w.route, login]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (menu) {
          setMenu(false);
          return true;
        }
        if (historyRef.current.length) {
          const previous = historyRef.current.pop();
          routeRef.current = `${demo ? "demo" : "app"}/${previous}`;
          // String() gives the same route text navigate's template produced from undefined.
          navigate(String(previous));
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [menu, navigate, demo]);
  useEffect(() => {
    if (!message || login) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message, login, setMessage]);
  function open(kind: string, id?: string | null, context: FormContext = {}) {
    try {
      setForm(entryForm(kind, id, w.state, context));
    } catch (error) {
      w.setMessage(errorMessage(error));
    }
  }
  const [quickEntry, setQuickEntry] = useState<QuickEntry | null>(null);
  const [capture, setCapture] = useState<CaptureRequest | null>(null);
  const consumeCapture = useCallback(() => setCapture(null), []);
  useEffect(() => subscribeCapture(setCapture), []);
  useEffect(() => {
    if (capture && !w.loading && w.user && !w.demo && page !== "capture")
      navigate("capture");
  }, [capture, w.loading, w.user, w.demo, page, navigate]);
  useEffect(() => subscribeQuickEntry(setQuickEntry), []);
  useEffect(() => {
    if (!quickEntry || w.loading || !w.user || w.demo) return;
    setQuickEntry(null);
    if (quickEntry.owner !== w.user.id || !w.state.settings.widgetsEnabled) {
      w.setMessage("This widget belongs to another account or is disabled.");
      return;
    }
    try {
      let draft: Record<string, unknown> = {
        type: quickEntry.kind === "income" ? "income" : "expense",
        date: bahrainDate(),
      };
      if (quickEntry.kind === "template") {
        const template = w.state.templates.find(
          (t) => t.id === quickEntry.templateId,
        );
        if (!template) throw Error("This template no longer exists.");
        draft = { ...template.record, date: bahrainDate() };
      }
      setForm(
        entryForm(
          draft.type === "transfer" ? "transfer" : "transaction",
          undefined,
          w.state,
          { draft },
        ),
      );
    } catch (error) {
      w.setMessage(errorMessage(error));
    }
  }, [quickEntry, w]);
  const prefix = w.demo ? "demo" : "app";
  const nav = (
    <View accessibilityLabel="Workspace navigation" style={{ gap: 2 }}>
      {pages.map(([id, label, symbol]) => (
        <NavLink
          key={id}
          label={label}
          href={`#/${prefix}/${id}`}
          onPress={() => w.navigate(id)}
          active={page === id}
        >
          {symbol}　{label}
        </NavLink>
      ))}
    </View>
  );
  const screens: Record<string, ComponentType<ScreenProps>> = {
    overview: Overview,
    accounts: Accounts,
    capture: MoneyTools,
    "shared-accounts": SharedAccounts,
    transactions: Transactions,
    budgets: Budgets,
    goals: Goals,
    bills: Bills,
    subscriptions: Subscriptions,
    installments: Installments,
    contacts: Contacts,
    tags: Tags,
    calendar: Calendar,
    debts: Debts,
    projects: Projects,
    insights: Insights,
    settings: Settings,
    "advanced-budgets": AdvancedBudgets,
    categories: Categories,
    templates: Templates,
    forecast: Forecast,
    currency: CurrencyTools,
    salary: Salary,
    warranties: Warranties,
    receipts: Receipts,
    data: DataTools,
  };
  // Every page in the list has a screen.
  const Screen = must(screens[page], "screen");
  if (login && !w.loading)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
        <Login workspace={w} />
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.cream }}
      edges={["top", "bottom", "left", "right"]}
    >
      <View
        style={{
          flex: 1,
          flexDirection: language === "ar" ? "row-reverse" : "row",
          direction: language === "ar" ? "rtl" : "ltr",
        }}
      >
        {wide ? (
          <View
            style={{
              width: 250,
              padding: 23,
              borderRightWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.white,
            }}
          >
            <Label
              style={{ fontSize: 22, fontWeight: "700", marginVertical: 15 }}
            >
              FinancialAdvisor
            </Label>
            <View
              style={{
                marginVertical: 24,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 10,
              }}
            >
              <Label>Bahrain workspace</Label>
              <Muted>Bahrain · {w.state.settings?.base || "BHD"}</Muted>
            </View>
            <ScrollView>{nav}</ScrollView>
            <View style={{ paddingTop: 20, gap: 7 }}>
              <Muted>SMALL STEPS. BRIGHTER HORIZONS.</Muted>
              <Label>
                {w.demo
                  ? "Demo workspace"
                  : w.user?.email || "Personal account"}
              </Label>
              <Button
                secondary
                label={
                  w.demo ? "Leave demo workspace" : "Sign out of workspace"
                }
                onPress={w.signout}
              >
                {w.demo ? "Leave demo" : "Sign out"}
              </Button>
            </View>
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              paddingHorizontal: wide ? 38 : 18,
              paddingVertical: 17,
              backgroundColor: colors.white,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              {!wide ? (
                <Button
                  secondary
                  label="Toggle navigation"
                  onPress={() => setMenu(!menu)}
                >
                  ☰
                </Button>
              ) : null}
              <Label style={{ fontWeight: "600", flex: 1 }}>
                {wide
                  ? `My workspace / ${pages.find((row) => row[0] === page)?.[1]}`
                  : "FinancialAdvisor"}
              </Label>
              <Muted>{w.demo ? "● Demo mode" : "● Cloud workspace"}</Muted>
            </Row>
          </View>
          {!wide && menu ? (
            <ScrollView
              style={{
                maxHeight: 390,
                backgroundColor: colors.white,
                borderBottomWidth: 1,
                borderColor: colors.line,
              }}
              contentContainerStyle={{ padding: 12 }}
            >
              {nav}
            </ScrollView>
          ) : null}
          {w.loading ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
              }}
            >
              <ActivityIndicator size="large" color={colors.ink} />
              <Label>Opening your FinancialAdvisor workspace…</Label>
            </View>
          ) : (
            <ScrollView
              ref={scroll}
              contentContainerStyle={{
                padding: wide ? 38 : 18,
                paddingBottom: 40,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <Stack
                style={{
                  width: "100%",
                  maxWidth: 1240,
                  alignSelf: "center",
                  gap: 26,
                }}
              >
                <Row
                  style={{
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                  }}
                >
                  <View style={{ flex: 1, minWidth: 240, gap: 7 }}>
                    <Muted style={{ letterSpacing: 1.4 }}>
                      YOUR MONEY, WITH A LITTLE MORE CLARITY
                    </Muted>
                    <Heading level={1}>
                      {page === "overview"
                        ? w.demo
                          ? "A clearer picture, Fatima."
                          : "A clearer picture."
                        : titles[page] ||
                          pages.find((row) => row[0] === page)?.[1]}
                    </Heading>
                    <Muted>
                      {page === "overview"
                        ? "A fresh perspective on where you are, and where you’re going."
                        : "Small steps toward a financial life that feels more like you."}
                    </Muted>
                  </View>
                  <View style={{ gap: 12, minWidth: 170 }}>
                    {[
                      "overview",
                      "transactions",
                      "budgets",
                      "calendar",
                      "insights",
                    ].includes(page) ? (
                      <MonthSelector month={month} setMonth={setMonth} />
                    ) : null}
                    {(() => {
                      const action = actions[page];
                      return action ? (
                        <Button onPress={() => open(action[1])}>
                          {action[0]}
                        </Button>
                      ) : null;
                    })()}
                  </View>
                </Row>
                <Screen
                  capture={page === "capture" ? capture : null}
                  onCaptureConsumed={consumeCapture}
                  key={page}
                  workspace={w}
                  month={month}
                  setMonth={setMonth}
                  open={open}
                />
                <Muted style={{ textAlign: "center" }}>
                  A little intention today. A brighter horizon
                  tomorrow.　·　FinancialAdvisor
                </Muted>
              </Stack>
            </ScrollView>
          )}
          {!wide && !login ? (
            <View
              testID="mobile-tabs"
              style={{
                flexDirection: "row",
                borderTopWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.white,
                paddingVertical: 7,
              }}
            >
              {([
                ["overview", "Home", "◈"],
                ["transactions", "Activity", "⇄"],
                ["calendar", "Calendar", "▦"],
                ["insights", "Insights", "◔"],
              ] as const).map(([id, label, symbol]) => (
                <NavLink
                  key={id}
                  label={label}
                  href={`#/${prefix}/${id}`}
                  onPress={() => w.navigate(id)}
                  active={page === id}
                  style={{
                    flex: 1,
                    paddingHorizontal: 2,
                    alignItems: "center",
                  }}
                >
                  <Label style={{ fontSize: 12 }}>
                    {symbol}
                    {"\n"}
                    {label}
                  </Label>
                </NavLink>
              ))}
              <Button
                secondary
                label="More"
                onPress={() => setMenu(!menu)}
                style={{
                  marginRight: 5,
                  paddingHorizontal: 10,
                  borderWidth: 0,
                }}
              >
                ☰
              </Button>
            </View>
          ) : null}
        </View>
      </View>
      {!login && w.message ? (
        <View
          style={{
            position: "absolute",
            bottom: wide ? 20 : 88,
            left: 18,
            right: 18,
            alignItems: "center",
            pointerEvents: "box-none",
          }}
        >
          <View
            accessibilityLiveRegion="polite"
            {...(Platform.OS === "web" ? { role: "status" } : {})}
            style={{
              backgroundColor: colors.primary,
              padding: 16,
              borderRadius: 12,
              maxWidth: 600,
            }}
          >
            <Label style={{ color: "white" }}>{w.message}</Label>
          </View>
        </View>
      ) : null}
      {form ? (
        <EntryModal
          key={`${form.kind}-${form.id || "new"}`}
          form={form}
          onClose={() => setForm(null)}
          onSave={w.save}
        />
      ) : null}
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <PrivacyGate>
        <AppearanceProvider>
          <WorkspaceApp />
        </AppearanceProvider>
      </PrivacyGate>
    </SafeAreaProvider>
  );
}
