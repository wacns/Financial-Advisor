import "./style.css";
import "./reports.css";
import { hydrateIcons } from "./icons.js";
import { createClient } from "@supabase/supabase-js";
import {
  categories,
  totalBalance,
  summary,
  categorySpend,
  monthTransactions,
  addTransaction,
  addTransfer,
  blankState,
  demoState,
} from "./finance.js";
import {
  bahrainDate,
  formatDate,
  formatMoney,
  DEMO_STORAGE_KEY,
  requireBahrainWorkspace,
  toFils,
} from "./locale.js";
import {
  authRedirectUrl,
  startGoogleSignIn,
  finishAuthRedirect,
} from "./auth.js";
import {
  normalizePlanning,
  saveRecurring,
  recordRecurring,
  addDebt,
  recordRepayment,
  saveProject,
} from "./planning.js";
import { planningPage, planningForm, duePanel } from "./planning-ui.js";
import { financialPulse, reportsPage, calendarPage } from "./reports-ui.js";
import { shiftMonth } from "./reports.js";
const app = document.querySelector("#app");
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client =
  url && key
    ? createClient(url, key, {
        auth: { flowType: "pkce", detectSessionInUrl: false },
      })
    : null;
let routeGeneration = 0;
let authBusy = false,
  authStarting = true;
let user = null,
  state = blankState(),
  demo = false,
  page = "overview",
  search = "",
  filter = "all",
  saving = false;
let planningFilter = "all";
let accountFilter = "all", reportAccount = "all", calendarDate = "";
let month = bahrainDate().slice(0, 7);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name, cls = "") =>
  `<i data-lucide="${esc(name)}" class="${esc(cls)}" aria-hidden="true"></i>`;
const money = formatMoney;
const monthLabel = () =>
  formatDate(`${month}-15`, { month: "long", year: "numeric" });
const logo = `<span class="brand-mark">${icon("move-up-right")}</span><span class="brand-name">Financial<span>Advisor</span></span>`;
const nav = [
  ["overview", "layout-dashboard", "Overview"],
  ["accounts", "wallet", "Accounts"],
  ["transactions", "arrow-left-right", "Transactions"],
  ["budgets", "chart-no-axes-combined", "Budgets"],
  ["goals", "flag", "Goals"],
  ["bills", "calendar-clock", "Bills & salary"],
  ["calendar", "calendar-days", "Calendar"],
  ["debts", "landmark", "Debts & loans"],
  ["projects", "folder-open", "Projects"],
  ["insights", "chart-pie", "Insights"],
];
function hydrate() {
  hydrateIcons();
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 4000);
}
function route(p) {
  location.hash = `/${demo ? "demo" : "app"}/${p}`;
}
function safeDemo() {
  try {
    return normalizePlanning(
      requireBahrainWorkspace(
        JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)) || demoState(),
      ),
    );
  } catch {
    return demoState();
  }
}
async function persist(next) {
  requireBahrainWorkspace(next);
  if (saving) throw Error("Please wait for the current save.");
  saving = true;
  try {
    if (demo) {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
    } else {
      if (!client || !user) throw Error("Sign in before saving.");
      const { error } = await client
        .from("northline_workspaces")
        .upsert({ user_id: user.id, data: next }, { onConflict: "user_id" });
      if (error) throw error;
    }
    state = next;
  } finally {
    saving = false;
  }
}
function shell(content) {
  app.innerHTML = `<div class="workspace"><aside class="sidebar"><a class="brand" href="#/${demo ? "demo" : "app"}/overview" aria-label="FinancialAdvisor home">${logo}</a><div class="workspace-select"><span class="personal-icon">${icon("user-round")}</span><span>Bahrain workspace<small>Bahrain · BHD</small></span>${icon("chevrons-up-down")}</div><p class="nav-label">WORKSPACE</p><nav>${nav.map(([id, ic, title]) => `<a href="#/${demo ? "demo" : "app"}/${id}" class="nav-item ${page === id ? "active" : ""}" ${page === id ? 'aria-current="page"' : ""}>${icon(ic)}${title}${id === "overview" ? '<span class="nav-active-dot"></span>' : ""}</a>`).join("")}</nav><div class="sidebar-bottom"><div class="sidebar-note"><span class="tiny-star">✳</span><h3>Small steps.<br>Brighter horizons.</h3><p>A little intention today goes a long way tomorrow.</p><button class="text-link" data-go="goals">Set your next goal ${icon("arrow-up-right")}</button></div><a href="#/${demo ? "demo" : "app"}/settings" class="nav-item ${page === "settings" ? "active" : ""}">${icon("settings-2")}Settings</a><button class="profile" data-action="signout"><span class="avatar">${demo ? "FA" : esc(user?.email?.slice(0, 2).toUpperCase() || "ME")}</span><span>${demo ? "Fatima Ahmed" : esc(user?.email?.split("@")[0] || "My account")}<small>${demo ? "Demo workspace" : "Personal account"}</small></span>${icon("log-out")}</button></div></aside><div class="main-shell"><header class="topbar"><button class="mobile-menu icon-button" data-action="menu" aria-label="Toggle navigation">${icon("menu")}</button><div class="breadcrumb">My workspace <span>/</span> <strong>${nav.find((n) => n[0] === page)?.[2] || "Settings"}</strong></div><div class="top-actions"><span class="status"><span></span>${demo ? "Demo mode" : "Cloud workspace"}</span><button class="icon-button" data-action="help" aria-label="About FinancialAdvisor">${icon("circle-help")}</button><span class="avatar small">${demo ? "FA" : esc(user?.email?.slice(0, 2).toUpperCase() || "ME")}</span></div></header><main id="main">${demo ? '<div class="demo-banner"><span>You’re exploring FinancialAdvisor with sample data. Make it your own.</span><a href="#/login">Create your workspace <span>↗</span></a></div>' : ""}${content}<footer><span><span class="footer-dot"></span> A little clarity. A lot of possibility.</span><span>Made for life in Bahrain.</span></footer></main></div></div><dialog id="modal" aria-labelledby="modal-title"></dialog>`;
  hydrate();
}
function heading(title, subtitle, action = "") {
  return `<section class="page-heading"><div><p class="eyebrow">YOUR MONEY, AT HOME IN BAHRAIN</p><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${action}<label class="month-picker">${icon("calendar-days")}<span>${monthLabel()}</span><input type="month" value="${month}" aria-label="Selected month" id="month"/>${icon("chevron-down")}</label></div></section>`;
}
function transactionRows(items) {
  return items.length
    ? items
        .map(
          (t) =>
            `<tr><td><div class="merchant"><span class="merchant-icon ${t.type === "income" ? "income" : ""}">${icon(t.type === "transfer" ? "arrow-left-right" : t.type === "income" ? "arrow-down-left" : { Shopping: "shopping-bag", "Food & drink": "coffee", Home: "house", Transport: "car", Utilities: "zap", Entertainment: "music", Health: "heart-pulse" }[t.category] || "receipt")}</span><div><b>${esc(t.name)}</b><small>${esc(state.accounts.find((a) => a.id === t.accountId)?.name || "Account")}${t.type === "transfer" ? " → " + esc(state.accounts.find(a => a.id === t.toAccountId)?.name || "Account") : ""}${t.projectId ? " · " + esc(state.projects.find((p) => p.id === t.projectId)?.name || "Project") : ""}</small></div></div></td><td><span class="category-chip ${t.type === 'transfer' ? 'transfer-chip' : ''}">${esc(t.category)}</span></td><td class="date-cell">${formatDate(t.date)}</td><td class="amount ${t.type === "income" ? "positive" : ""}">${t.type === "transfer" ? "↔ " : t.type === "income" ? "+" : "−"}${money(t.amount, 2)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4"><div class="empty">No transactions here yet.<br><small>Add your first transaction to start seeing the bigger picture.</small></div></td></tr>`;
}
function transactionTable(items) {
  return `<div class="table-scroll"><table><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th class="right">Amount</th></tr></thead><tbody>${transactionRows(items)}</tbody></table></div>`;
}
function budgetCards() {
  return state.budgets.length
    ? state.budgets
        .map((b, i) => {
          const spent = categorySpend(state, month, b.category),
            pct = (spent / b.limit) * 100;
          return `<div class="budget-row"><div class="budget-title"><span><span class="color-dot c${i % 4}"></span>${esc(b.category)}</span><span><b>${money(spent)}</b><small> / ${money(b.limit)}</small></span></div><div class="progress"><div class="c${pct > 100 ? "over" : i % 4}" style="width:${Math.min(pct, 100)}%"></div></div><div class="budget-caption"><span>${pct > 100 ? `${money(spent - b.limit)} over budget` : `${money(b.limit - spent)} left to spend`}</span><span>${Math.round(pct)}%</span></div></div>`;
        })
        .join("")
    : '<div class="empty">Give your spending a little direction.<br>Create your first monthly budget.</div>';
}
function goalsCards(limit = 99) {
  return state.goals.length
    ? state.goals
        .slice(0, limit)
        .map(
          (g, i) =>
            `<article class="goal-card"><span class="goal-icon">${icon(g.icon || "flag")}</span><div class="goal-top"><h3>${esc(g.name)}</h3><button class="icon-button" data-fund="${esc(g.id)}" aria-label="Update ${esc(g.name)} progress">${icon("plus")}</button></div><div class="goal-values"><b>${money(g.saved)}</b><span>of ${money(g.target)}</span></div><div class="progress"><div class="c${i % 4}" style="width:${Math.min((g.saved / g.target) * 100, 100)}%"></div></div><small>${Math.round((g.saved / g.target) * 100)}% of the way there</small></article>`,
        )
        .join("")
    : '<div class="empty">What are you working toward? Add a goal to get started.</div>';
}
function flowChart() {
  const tx = monthTransactions(state, month);
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const buckets = Array.from(
    { length: Math.ceil(daysInMonth / 7) },
    (_, i) => ({
      label: `${i * 7 + 1}–${Math.min((i + 1) * 7, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate())}`,
      income: 0,
      expense: 0,
    }),
  );
  for (const t of tx) {
    if (t.type === "transfer") continue;
    buckets[Math.min(4, Math.floor((Number(t.date.slice(8)) - 1) / 7))][
      t.type
    ] += t.amount;
  }
  const max = Math.max(...buckets.map((b) => Math.max(b.income, b.expense)), 1);
  return `<div class="chart"><div class="chart-axis"><span>${money(max)}</span><span>${money(max / 2)}</span><span>0</span></div><div class="chart-plot"><div class="chart-grid"></div>${buckets.map((b) => `<div class="bar-group"><div class="bar-pair"><div class="bar income-bar" style="height:${Math.max((b.income / max) * 100, 1)}%" title="Income ${money(b.income, 2)}"></div><div class="bar expense-bar" style="height:${Math.max((b.expense / max) * 100, 1)}%" title="Expenses ${money(b.expense, 2)}"></div></div><span>${b.label}</span><span class="sr-only">Income ${money(b.income, 2)}, expenses ${money(b.expense, 2)}</span></div>`).join("")}</div></div>`;
}
function overview() {
  const { income, expenses } = summary(state, month),
    rate = income ? Math.round(((income - expenses) / income) * 100) : 0;
  shell(
    `${heading(`A clearer picture${demo ? ", Fatima" : ""}.`, "A moment to check in. A little more confidence for what’s next.", `<button class="button primary" data-action="transaction">${icon("plus")} Add transaction</button>`)}<div class="stats-grid"><article class="stat-card balance"><div class="stat-label">Total balance ${icon("wallet")}</div><div class="stat-number">${money(totalBalance(state), 2)}</div><div class="stat-bottom"><span class="balance-pill">${state.accounts.length} accounts</span><span>All in one place ${icon("arrow-up-right")}</span></div><div class="balance-decoration"></div></article><article class="stat-card"><div class="stat-label">Money in ${icon("arrow-down-left")}</div><div class="stat-number">${money(income, 2)}</div><div class="stat-bottom"><span class="positive">${icon("circle-arrow-out-down-left")} Income</span><span>This month</span></div></article><article class="stat-card"><div class="stat-label">Money out ${icon("arrow-up-right")}</div><div class="stat-number">${money(expenses, 2)}</div><div class="stat-bottom"><span class="expense-text">${icon("circle-arrow-out-up-right")} Spending</span><span>This month</span></div></article><article class="stat-card"><div class="stat-label">Savings rate ${icon("sprout")}</div><div class="stat-number">${rate}<span class="percent">%</span></div><div class="stat-bottom"><span class="positive">${income ? money(income - expenses) : "No income yet"}</span><span>${income ? "left this month" : "Add a transaction"}</span></div></article></div>${financialPulse(state, month, {icon, money})}<div class="overview-grid"><section class="panel cashflow"><div class="panel-heading"><div><h2>Money in motion</h2><p>Your income and spending, side by side.</p></div><div class="chart-legend"><span><i class="legend-dot green"></i>Income</span><span><i class="legend-dot pale"></i>Expenses</span></div></div>${flowChart()}<div class="chart-foot">${icon("sparkles")}<span>${income > expenses ? `You’ve kept ${money(income - expenses)} of your income this month. Keep the momentum going.` : "Every transaction adds a little clarity to your financial picture."}</span></div></section><section class="panel"><div class="panel-heading"><div><h2>Monthly budgets</h2><p>A plan for the everyday.</p></div><button class="icon-button" data-go="budgets" aria-label="View budgets">${icon("arrow-up-right")}</button></div>${budgetCards()}</section><section class="panel transactions-panel"><div class="panel-heading"><div><h2>Recent transactions</h2><p>The little details behind the big picture.</p></div><button class="text-link" data-go="transactions">View all ${icon("arrow-right")}</button></div>${transactionTable(
      monthTransactions(state, month)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    )}</section><section class="panel account-panel"><div class="panel-heading"><div><h2>Your accounts</h2><p>Everything in its place.</p></div><button class="icon-button" data-go="accounts" aria-label="View accounts">${icon("arrow-up-right")}</button></div>${state.accounts.length ? state.accounts.map((a, i) => `<div class="account-row"><span class="account-icon a${i % 3}">${icon(["landmark", "piggy-bank", "chart-no-axes-combined"][i % 3])}</span><div><b>${esc(a.name)}</b><small>${esc(a.type)} ${a.last4 ? "· •• " + esc(a.last4) : ""}</small></div><strong>${money(a.balance, 2)}</strong></div>`).join("") : '<div class="empty">Add an account to start tracking.</div>'}<button class="add-account" data-action="account">${icon("plus")} Add an account</button></section></div>${duePanel(state, { esc, icon, money })}<section class="goals-section"><div class="panel-heading"><div><h2>A little closer to your goals</h2><p>Big plans start with small steps.</p></div><button class="text-link" data-go="goals">All goals ${icon("arrow-right")}</button></div><div class="goals-grid">${goalsCards(3)}</div></section>`,
  );
}
function render() {
  if (!state.accounts.some(a => a.id === accountFilter)) accountFilter = "all";
  if (!state.accounts.some(a => a.id === reportAccount)) reportAccount = "all";
  if (page === "calendar") {
    shell(calendarPage(state, month, calendarDate, {esc, icon, money, heading}));
    return;
  }
  if (["bills", "debts", "projects"].includes(page)) {
    shell(
      planningPage(page, state, {
        esc,
        icon,
        money,
        heading,
        month,
        filter: planningFilter,
      }),
    );
    return;
  }
  if (page === "overview") return overview();
  if (page === "transactions") {
    shell(
      `${heading("Every move, in view.", "The story of your money, one transaction at a time.", `<button class="button secondary" data-action="transfer">${icon("arrow-left-right")} Record transfer</button><button class="button primary" data-action="transaction">${icon("plus")} Add transaction</button>`)}<section class="panel"><div class="toolbar"><label class="search">${icon("search")}<input id="search" placeholder="Search transactions…" value="${esc(search)}" aria-label="Search transactions"/></label><select id="account-filter" aria-label="Transaction account"><option value="all">All accounts</option>${state.accounts.map(a => `<option value="${esc(a.id)}" ${accountFilter === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select><select id="filter" aria-label="Transaction type"><option value="all">All transactions</option><option value="income" ${filter === "income" ? "selected" : ""}>Income</option><option value="expense" ${filter === "expense" ? "selected" : ""}>Expenses</option><option value="transfer" ${filter === "transfer" ? "selected" : ""}>Transfers</option></select><button class="button secondary" data-action="export">${icon("download")} Export CSV</button></div>${transactionTable(filteredTransactions())}</section>`,
    );
    return;
  }
  if (page === "accounts") {
    shell(
      `${heading("A home for your money.", "Track your balances across accounts. No bank connection required.", `<button class="button secondary" data-action="transfer">${icon("arrow-left-right")} Record transfer</button><button class="button primary" data-action="account">${icon("plus")} Add account</button>`)}<div class="account-total"><span>YOUR TOTAL BALANCE</span><h2>${money(totalBalance(state), 2)}</h2><p>Across ${state.accounts.length} manually managed accounts</p></div><div class="goals-grid">${state.accounts.map((a, i) => `<article class="panel account-detail"><span class="account-icon a${i % 3}">${icon(a.type === "Savings" ? "piggy-bank" : "landmark")}</span><p>${esc(a.type)}</p><h2>${esc(a.name)}</h2><div class="stat-number">${money(a.balance, 2)}</div><small>${a.last4 ? "•••• " + esc(a.last4) : "Manually tracked account"}</small></article>`).join("") || '<div class="empty">Add your first account to begin.</div>'}</div>`,
    );
    return;
  }
  if (page === "budgets") {
    shell(
      `${heading("Room for what matters.", "Set monthly limits that feel right for your life.", `<button class="button primary" data-action="budget">${icon("plus")} Set a budget</button>`)}<section class="panel wide-budget">${budgetCards()}</section>`,
    );
    return;
  }
  if (page === "goals") {
    shell(
      `${heading("Your next chapter starts here.", "Give your plans a name, and watch your progress grow.", `<button class="button primary" data-action="goal">${icon("plus")} New goal</button>`)}<div class="goals-grid">${goalsCards()}</div><p class="helper-note">Goal progress is tracked separately from account balances. Updating a goal does not move money.</p>`,
    );
    return;
  }
  if (page === "insights") {
    shell(reportsPage(state, month, reportAccount, {esc, icon, money, heading}));
    return;
  }
  shell(
    `${heading("Make yourself at home.", "A few preferences for a workspace that feels like yours.")}<section class="panel settings"><h2>Your workspace</h2><p>${demo ? "You are using sample data saved in this browser." : `Signed in as ${esc(user?.email)}`}</p><div class="regional-settings"><div><span>Country</span><strong>Bahrain</strong></div><div><span>Currency</span><strong>Bahraini dinar (BHD)</strong></div><div><span>Precision</span><strong>3 decimal places · 1,000 fils per dinar</strong></div><div><span>Time zone</span><strong>Asia/Bahrain · UTC+03:00</strong></div><div><span>Dates</span><strong>Day / month / year · Gregorian</strong></div></div><p class="helper-note">All accounts, budgets, goals and exports use BHD.</p><hr/><h2>Your data, your control</h2><p>FinancialAdvisor does not connect to your bank or execute payments.</p><button class="button secondary" data-action="backup">${icon("download")} Download backup</button>${demo ? '<button class="button secondary" data-action="reset">Reset sample data</button>' : ""}<hr/><button class="button secondary" data-action="signout">${icon("log-out")} ${demo ? "Leave demo" : "Sign out"}</button></section>`,
  );
}
function filteredTransactions() {
  return monthTransactions(state, month)
    .filter(
      (t) =>
        (filter === "all" || t.type === filter) &&
        (accountFilter === "all" || t.accountId === accountFilter || t.toAccountId === accountFilter) &&
        `${t.name} ${t.category}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
function login() {
  app.innerHTML = `<div class="login-page"><section class="login-story"><a class="brand" href="#/login">${logo}</a><div class="login-story-content"><p class="eyebrow">A LITTLE CLARITY. A LOT OF POSSIBILITY.</p><h1>Your money.<br>Your direction.</h1><p>From everyday spending in Manama to your next big goal. Your financial life in Bahrain, together in BHD.</p><div class="login-features"><span>${icon("wallet")} Every account, together</span><span>${icon("chart-no-axes-combined")} A clearer view of spending</span><span>${icon("flag")} More room for your goals</span></div></div><div class="login-art"><div></div><div></div><div></div><span>Forward looks good on you. ↗</span></div><small>FinancialAdvisor · Personal finance, in focus.</small></section><section class="login-form-wrap"><div class="login-form"><span class="login-badge">${icon("sprout")} Your Bahrain workspace</span><h2>Welcome to FinancialAdvisor.</h2><p>A little intention. A little progress. All yours.</p><form id="auth-form"><button type="button" class="button google-button" data-action="google" ${!client ? "disabled" : ""}><span class="google-mark" aria-hidden="true">G</span> Continue with Google</button><div class="divider">OR CONTINUE WITH EMAIL</div><label>Email address<input type="email" name="email" autocomplete="email" placeholder="you@example.com" required/></label><label>Password<input type="password" name="password" autocomplete="current-password" placeholder="At least 8 characters" minlength="8" required/></label><button class="button primary" ${!client ? "disabled" : ""}>Sign in ${icon("arrow-right")}</button><button type="button" class="button secondary" data-action="signup" ${!client ? "disabled" : ""}>Create an account</button><p id="auth-message" role="status">${!client ? "Live sign-in is pending Supabase project setup. Explore the working demo below." : ""}</p></form><div class="divider">OR TAKE A LOOK AROUND</div><a class="button demo-button" href="#/demo/overview">Explore the demo ${icon("arrow-up-right")}</a><p class="login-privacy">${icon("shield-check")} Your space. Your pace. Your financial life.</p></div></section></div>`;
  hydrate();
}
function field(label, name, type = "text", value = "", extra = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} required/></label>`;
}
function showForm(kind, id) {
  const modal = document.querySelector("#modal");
  let title = "",
    content = "";
  if (kind === "transfer") {
    if (state.accounts.length < 2) {
      toast("Add at least two accounts before recording a transfer.");
      return;
    }
    title = "Give your money a new home";
    const accountSelect = (label, name, selected) => `<label>${label}<select name="${name}" aria-label="${label}">${state.accounts.map(a => `<option value="${esc(a.id)}" ${selected === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>`;
    content = `${accountSelect('From account', 'accountId', state.accounts[0].id)}${accountSelect('To account', 'toAccountId', state.accounts[1].id)}<div class="form-grid">${field('Amount (BHD)', 'amount', 'number', '', 'min="0.001" max="1000000000000" step="0.001"')}${field('Date', 'date', 'date', bahrainDate())}</div>${field('Description', 'name', 'text', 'Account transfer', 'maxlength="80"')}<p class="payment-context">Record a transfer you have already made. This updates both account balances and stays out of income, spending and budgets. FinancialAdvisor does not move real money.</p>`;
  }
  if (
    ["recurring", "record", "repayment"].includes(kind) &&
    !state.accounts.length
  ) {
    toast("Add an account before recording payments.");
    return showForm("account");
  }
  if (["recurring", "record", "debt", "repayment", "project"].includes(kind)) {
    try {
      ({ title, content } = planningForm(kind, id, state, { esc, field }));
    } catch (error) {
      toast(error.message);
      return;
    }
  }

  if (kind === "transaction") {
    if (!state.accounts.length) {
      toast("Add an account before your first transaction.");
      return showForm("account");
    }
    title = "A new money moment";
    content = `<div class="form-grid"><label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label>${field("Amount (BHD)", "amount", "number", "", 'min="0.001" max="1000000000000" step="0.001"')}</div>${field("Description", "name", "text", "", 'maxlength="80" placeholder="e.g. Weekly groceries"')}<div class="form-grid"><label>Category<select name="category" aria-label="Category">${categories.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>${field("Date", "date", "date", bahrainDate())}</div><label>Account<select name="accountId">${state.accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</select></label>`;
  }
  if (kind === "transaction")
    content += `<label>Project (optional)<select name="projectId" aria-label="Project (optional)"><option value="">No project</option>${state.projects
      .filter((p) => !p.archived)
      .map(
        (p) =>
          `<option value="${esc(p.id)}" ${p.id === id ? "selected" : ""}>${esc(p.name)}</option>`,
      )
      .join("")}</select></label>`;
  if (kind === "account") {
    title = "Give your money a home";
    content = `${field("Account name", "name", "text", "", 'maxlength="60" placeholder="e.g. NBB current account"')}<label>Account type<select name="type"><option>Current account</option><option>Savings</option><option>Investment</option><option>Cash</option><option>Credit card</option></select></label>${field("Current balance in BHD (negative for debt)", "balance", "number", "0", 'step="0.001" min="-1000000000000" max="1000000000000"')}<label>Last four digits (optional)<input name="last4" pattern="[0-9]{4}" maxlength="4" inputmode="numeric" placeholder="4829"/></label><p class="helper-note">All balances are in BHD and tracked manually. Never enter bank credentials.</p>`;
  }
  if (kind === "budget") {
    title = "Make a little plan";
    content = `<label>Category<select name="category" aria-label="Category">${categories
      .filter((c) => c !== "Income")
      .map((c) => `<option>${esc(c)}</option>`)
      .join(
        "",
      )}</select></label>${field("Monthly spending limit (BHD)", "limit", "number", "", 'min="1" max="1000000000000" step="0.001"')}<p class="helper-note">Budgets repeat each month. Saving an existing category updates its limit.</p>`;
  }
  if (kind === "goal") {
    title = "What’s on your horizon?";
    content = `${field("Goal name", "name", "text", "", 'maxlength="60" placeholder="e.g. Bahrain staycation"')}${field("Target amount (BHD)", "target", "number", "", 'min="1" max="1000000000000" step="0.001"')}${field("Already saved (BHD)", "saved", "number", "0", 'min="0" max="1000000000000" step="0.001"')}`;
  }
  if (kind === "fund") {
    const goal = state.goals.find((g) => g.id === id);
    if (!goal) return;
    title = `Progress: ${goal.name}`;
    content = `${field("Total saved so far (BHD)", "saved", "number", goal.saved, 'min="0" max="1000000000000" step="0.001"')}<p class="helper-note">This updates your goal tracker only; no money is moved.</p>`;
  }
  modal.innerHTML = `<form id="entry-form" data-kind="${kind}" data-id="${esc(id || "")}"><div class="modal-head"><div><p class="eyebrow">SMALL STEPS, FORWARD</p><h2 id="modal-title">${esc(title)}</h2></div><button type="button" class="icon-button" data-action="close" aria-label="Close dialog">${icon("x")}</button></div>${content}<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button secondary" data-action="close">Cancel</button><button class="button primary">Save ${icon("check")}</button></div></form>`;
  hydrate();
  modal.showModal();
}
async function handleRoute() {
  window.scrollTo(0, 0);
  const generation = ++routeGeneration;
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  if (parts[0] === "demo") {
    demo = true;
    user = null;
    state = safeDemo();
    page =
      nav.some((n) => n[0] === parts[1]) || parts[1] === "settings"
        ? parts[1]
        : "overview";
    render();
    return;
  }
  if (parts[0] !== "app") {
    demo = false;
    state = blankState();
    login();
    return;
  }
  demo = false;
  if (!client) {
    location.hash = "/login";
    return;
  }
  app.innerHTML =
    '<div class="loading">Opening your FinancialAdvisor workspace…</div>';
  try {
    const { data, error } = await client.auth.getUser();
    if (generation !== routeGeneration) return;
    if (error || !data.user) {
      user = null;
      location.hash = "/login";
      return;
    }
    user = data.user;
    const result = await client
      .from("northline_workspaces")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();
    if (generation !== routeGeneration) return;
    if (result.error) throw result.error;
    state = normalizePlanning(
      requireBahrainWorkspace(result.data?.data || blankState()),
    );
    page =
      nav.some((n) => n[0] === parts[1]) || parts[1] === "settings"
        ? parts[1]
        : "overview";
    render();
  } catch (error) {
    if (generation !== routeGeneration) return;
    login();
    document.querySelector("#auth-message").textContent =
      `Unable to load your workspace: ${error.message}`;
  }
}
function setAuthBusy(busy) {
  authBusy = busy;
  document
    .querySelectorAll("#auth-form button")
    .forEach((button) => (button.disabled = busy || !client));
}
async function authenticate(signup = false) {
  const form = document.querySelector("#auth-form");
  if (authBusy || !client || !form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form)),
    msg = document.querySelector("#auth-message");
  setAuthBusy(true);
  msg.textContent = signup ? "Creating your account…" : "Signing in…";
  try {
    const result = signup
      ? await client.auth.signUp({
          ...data,
          options: { emailRedirectTo: authRedirectUrl(location) },
        })
      : await client.auth.signInWithPassword(data);
    if (result.error) throw result.error;
    if (result.data.session) location.hash = "/app/overview";
    else
      msg.textContent =
        "Check your email to confirm your account. Open the confirmation link in this browser.";
  } catch (error) {
    msg.textContent = error.message;
  } finally {
    setAuthBusy(false);
  }
}
async function googleSignIn() {
  if (authBusy || !client) return;
  const msg = document.querySelector("#auth-message");
  setAuthBusy(true);
  msg.textContent = "Taking you to Google…";
  try {
    await startGoogleSignIn(client, location);
  } catch (error) {
    msg.textContent = error.message;
    setAuthBusy(false);
  }
}
document.addEventListener("submit", async (e) => {
  if (e.target.id === "auth-form") {
    e.preventDefault();
    return authenticate();
  }
  if (e.target.id !== "entry-form") return;
  e.preventDefault();
  const form = e.target,
    kind = form.dataset.kind,
    data = Object.fromEntries(new FormData(form)),
    next = structuredClone(state);
  const button = form.querySelector(
    'button[type="submit"], .modal-actions .primary',
  );
  button.disabled = true;
  try {
    for (const name of ["amount", "balance", "limit", "target", "saved"])
      if (name in data) data[name] = toFils(data[name]) / 1000;
    if (kind === "transaction")
      addTransaction(next, {
        ...data,
        id: crypto.randomUUID(),
        amount: Number(data.amount),
      });
    if (kind === "transfer")
      addTransfer(next, {...data, id: crypto.randomUUID()});
    if (kind === "account")
      next.accounts.push({
        ...data,
        id: crypto.randomUUID(),
        balance: Number(data.balance),
      });
    if (kind === "budget") {
      next.budgets = next.budgets.filter((b) => b.category !== data.category);
      next.budgets.push({
        ...data,
        id: crypto.randomUUID(),
        limit: Number(data.limit),
      });
    }
    if (kind === "goal")
      next.goals.push({
        ...data,
        id: crypto.randomUUID(),
        saved: Number(data.saved),
        target: Number(data.target),
        icon: "flag",
      });
    if (kind === "recurring")
      saveRecurring(next, data, form.dataset.id || undefined);
    if (kind === "record") recordRecurring(next, form.dataset.id, data);
    if (kind === "debt") addDebt(next, data);
    if (kind === "repayment") recordRepayment(next, form.dataset.id, data);
    if (kind === "project")
      saveProject(next, data, form.dataset.id || undefined);
    if (kind === "fund")
      next.goals.find((g) => g.id === form.dataset.id).saved = Number(
        data.saved,
      );
    await persist(next);
    document.querySelector("#modal").close();
    render();
    toast("Saved. A little step forward.");
  } catch (error) {
    form.querySelector(".form-error").textContent = error.message;
    button.disabled = false;
  }
});
function download(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener("click", async (e) => {
  const target = e.target.closest(
    "[data-action],[data-go],[data-fund],[data-plan-form],[data-plan-action],[data-project-expense],[data-calendar-date],[data-month-offset]",
  );
  if (!target) return;
  if (target.dataset.calendarDate) {
    calendarDate = target.dataset.calendarDate;
    render();
    document.querySelector(`[data-calendar-date="${calendarDate}"]`)?.focus({preventScroll:true});
    return;
  }
  if (target.dataset.monthOffset) {
    month = shiftMonth(month, Number(target.dataset.monthOffset));
    calendarDate = "";
    return render();
  }
  if (target.dataset.planForm)
    return showForm(target.dataset.planForm, target.dataset.id);
  if (target.dataset.projectExpense)
    return showForm("transaction", target.dataset.projectExpense);
  if (target.dataset.planAction) {
    if (saving) return;
    const next = structuredClone(state),
      id = target.dataset.id;
    try {
      if (target.dataset.planAction === "pause") {
        const record = next.recurring.find((r) => r.id === id);
        if (!record) return;
        record.paused = !record.paused;
      }
      if (target.dataset.planAction === "archive") {
        const project = next.projects.find((p) => p.id === id);
        if (!project) return;
        project.archived = !project.archived;
      }
      target.disabled = true;
      await persist(next);
      render();
      toast("Plan updated. Your transaction history is preserved.");
    } catch (error) {
      target.disabled = false;
      toast(error.message);
    }
    return;
  }
  if (target.dataset.go) return route(target.dataset.go);
  if (target.dataset.fund) return showForm("fund", target.dataset.fund);
  const action = target.dataset.action;
  if (["transaction", "transfer", "account", "budget", "goal"].includes(action))
    return showForm(action);
  if (action === "calendar-today") {
    calendarDate = bahrainDate();
    month = calendarDate.slice(0, 7);
    return render();
  }
  if (action === "close") return document.querySelector("#modal").close();
  if (action === "menu")
    return document.querySelector(".sidebar").classList.toggle("open");
  if (action === "signup") return authenticate(true);
  if (action === "google") return googleSignIn();
  if (action === "help")
    return toast(
      "FinancialAdvisor tracks your finances manually. Demo changes stay in this browser.",
    );
  if (action === "signout") {
    try {
      if (!demo && client) {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      }
      user = null;
      state = blankState();
      location.hash = "/login";
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (action === "export") {
    const csvCell = (s) =>
      '"' +
      String(s)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    download(
      [
        "Date,Description,Category,Type,Amount (BHD),Currency,Account,To Account",
        ...filteredTransactions().map((t) =>
          [t.date, t.name, t.category, t.type, t.amount.toFixed(3), "BHD", state.accounts.find(a => a.id === t.accountId)?.name || "", t.type === 'transfer' ? state.accounts.find(a => a.id === t.toAccountId)?.name || "" : ""]
            .map(csvCell)
            .join(","),
        ),
      ].join("\r\n"),
      "text/csv",
      `financial-advisor-${month}.csv`,
    );
  }
  if (action === "backup")
    download(
      JSON.stringify(state, null, 2),
      "application/json",
      "financial-advisor-backup.json",
    );
  if (
    action === "reset" &&
    confirm("Reset all demo changes and restore the sample workspace?")
  ) {
    try {
      await persist(demoState());
      render();
      toast("A fresh start. Sample data restored.");
    } catch (e) {
      toast(e.message);
    }
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    search = e.target.value;
    const tbody = document.querySelector("tbody");
    tbody.innerHTML = transactionRows(filteredTransactions());
    hydrate();
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "account-filter") {
    accountFilter = e.target.value;
    render();
  }
  if (e.target.id === "report-account") {
    reportAccount = e.target.value;
    render();
  }
  if (e.target.id === "planning-filter") {
    planningFilter = e.target.value;
    render();
  }
  if (e.target.id === "month") {
    if (!e.target.value) return;
    month = e.target.value;
    render();
  }
  if (e.target.id === "filter") {
    filter = e.target.value;
    render();
  }
});
window.addEventListener("hashchange", handleRoute);
client?.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" && !demo) {
    user = null;
    state = blankState();
    location.hash = "/login";
  }
  if (
    !authStarting &&
    event === "SIGNED_IN" &&
    location.hash.includes("/login")
  ) {
    location.hash = "/app/overview";
  }
});
async function startApp() {
  try {
    await finishAuthRedirect(client, location, history);
  } catch (error) {
    authStarting = false;
    login();
    document.querySelector("#auth-message").textContent = error.message;
    return;
  }
  authStarting = false;
  await handleRoute();
}
startApp();
