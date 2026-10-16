import {
  frequencies,
  dueStatus,
  projectSpend,
  upcomingPayments,
} from "./planning.js";
import { formatDate, bahrainDate, toFils } from "./locale.js";

const fullDate = (value) =>
  formatDate(value, { day: "2-digit", month: "short", year: "numeric" });
export function planningPage(
  page,
  state,
  { esc, icon, money, heading, month, filter = "all" },
) {
  const button = (kind, label, id = "") =>
    `<button class="button primary" data-plan-form="${kind}" data-id="${esc(id)}">${icon("plus")} ${label}</button>`;
  const stats = (items) =>
    `<div class="planning-stats">${items.map(([label, value, detail]) => `<div class="panel"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join("")}</div>`;
  const empty = (symbol, title, copy) =>
    `<div class="planning-empty">${icon(symbol)}<h2>${title}</h2><p>${copy}</p></div>`;
  const status = (date, paused = false) =>
    `<span class="plan-status ${paused ? "paused" : date < bahrainDate() ? "overdue" : date === bahrainDate() ? "today" : ""}">${paused ? "Paused" : dueStatus(date)}</span>`;
  if (page === "bills") {
    const next = upcomingPayments(state),
      thisMonth = next.filter((r) => r.nextDue.startsWith(month));
    const sum = (type) =>
      thisMonth
        .filter((r) => r.type === type)
        .reduce((total, r) => total + toFils(r.amount), 0) / 1000;
    const rows = state.recurring
      .filter(
        (r) =>
          filter === "all" ||
          filter === r.type ||
          (filter === "overdue" && !r.paused && r.nextDue < bahrainDate()),
      )
      .sort(
        (a, b) =>
          Number(a.paused) - Number(b.paused) ||
          a.nextDue.localeCompare(b.nextDue),
      );
    return `${heading("A little more prepared.", "Bills, subscriptions and salary dates, all on your radar.", button("recurring", "New schedule"))}
      ${stats([
        [
          "Next expenses this month",
          money(sum("expense")),
          "Includes planned loan repayments",
        ],
        [
          "Next income this month",
          money(sum("income")),
          "Expected, not yet received",
        ],
        [
          "Overdue items",
          next.filter((r) => r.nextDue < bahrainDate()).length,
          "Based on Bahrain’s date",
        ],
      ])}
      <section class="panel"><div class="panel-heading"><div><h2>Bills & salary</h2><p>Next occurrence of each schedule. Record payments only after they happen.</p><button class="text-link schedule-calendar-link" data-go="calendar">${icon('calendar-days')} Open payment calendar</button></div><label class="plan-filter">Show<select id="planning-filter" aria-label="Schedule filter">${[
        ["all", "All schedules"],
        ["expense", "Bills & subscriptions"],
        ["income", "Salary & income"],
        ["overdue", "Overdue"],
      ]
        .map(
          ([value, label]) =>
            `<option value="${value}" ${filter === value ? "selected" : ""}>${label}</option>`,
        )
        .join("")}</select></label></div>
      <div class="schedule-list">${rows.length ? rows.map((r) => `<article class="schedule-row" data-schedule="${esc(r.id)}"><span class="plan-symbol ${r.type === "income" ? "positive" : ""}">${icon(r.type === "income" ? "briefcase-business" : "calendar-clock")}</span><div class="schedule-copy"><h3>${esc(r.name)}</h3><p>${frequencies[r.frequency]} · ${esc(state.accounts.find((a) => a.id === r.accountId)?.name || "Choose an account")}</p><span class="schedule-date">${fullDate(r.nextDue)} ${status(r.nextDue, r.paused)}</span></div><strong class="schedule-amount ${r.type === "income" ? "positive" : ""}">${r.type === "income" ? "+" : ""}${money(r.amount)}</strong><div class="schedule-actions"><button class="button secondary" data-plan-form="record" data-id="${esc(r.id)}" ${r.paused ? "disabled" : ""}>${r.type === "income" ? "Record income" : "Record payment"}</button><button class="icon-button" data-plan-form="recurring" data-id="${esc(r.id)}" aria-label="Edit ${esc(r.name)}">${icon("pencil")}</button><button class="icon-button" data-plan-action="pause" data-id="${esc(r.id)}" aria-label="${r.paused ? "Resume" : "Pause"} ${esc(r.name)}">${icon(r.paused ? "play" : "pause")}</button></div></article>`).join("") : empty("calendar-days", "Room for the regular things.", "Add rent, EWA, subscriptions or your next salary date. No matching schedules yet.")}</div></section>
      <div class="planning-footnote">${icon("info")} Recording a payment adds one transaction and advances its due date. Northline never moves money or pays a bill for you.</div>
      ${duePanel(state, { esc, icon, money }, true)}`;
  }
  if (page === "debts") {
    const active = state.debts.filter((d) => d.balance > 0);
    const sum = (key) =>
      active.reduce((total, d) => total + toFils(d[key]), 0) / 1000;
    const payments = state.transactions
      .filter((t) => t.debtId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
    return `${heading("A clearer path to debt-free.", "Track what you owe and give every repayment a purpose.", button("debt", "Add debt"))}
      ${stats([
        [
          "Outstanding principal",
          money(sum("balance")),
          `${active.length} active ${active.length === 1 ? "debt" : "debts"}`,
        ],
        [
          "Planned monthly payments",
          money(sum("installment")),
          "Your entered repayment amounts",
        ],
        [
          "Repaid principal",
          money(
            state.debts.reduce(
              (total, d) =>
                total + toFils(d.originalBalance) - toFils(d.balance),
              0,
            ) / 1000,
          ),
          "Since you started tracking",
        ],
      ])}
      <div class="planning-grid">${state.debts.length ? state.debts.map((d) => `<article class="panel debt-card" data-debt="${esc(d.id)}"><div class="panel-heading"><span class="plan-symbol">${icon(d.balance === 0 ? "circle-check" : "landmark")}</span>${d.balance === 0 ? '<span class="plan-status">Repaid</span>' : status(d.nextDue)}</div><h2>${esc(d.name)}</h2><p class="plan-muted">${esc(d.lender || "Personal debt")}</p><div class="plan-big-number">${money(d.balance)}</div><div class="progress"><div class="c0" style="width:${Math.max(0, Math.min(100, (1 - d.balance / d.originalBalance) * 100))}%"></div></div><p class="plan-muted">${money(d.originalBalance)} when tracking began</p><dl class="plan-details"><div><dt>Monthly plan</dt><dd>${money(d.installment)}</dd></div><div><dt>Next due</dt><dd>${d.balance > 0 ? fullDate(d.nextDue) : "Complete"}</dd></div></dl><button class="button ${d.balance === 0 ? "secondary" : "primary"}" data-plan-form="repayment" data-id="${esc(d.id)}" ${d.balance === 0 ? "disabled" : ""}>${icon("arrow-down-right")} ${d.balance === 0 ? "Debt repaid" : "Record repayment"}</button></article>`).join("") : empty("landmark", "Know where you stand.", "Add a debt or financing plan to track its remaining principal and your payments.")}</div>
      <div class="planning-footnote">${icon("info")} Existing debts are tracked separately from account balances. Repayments reduce your chosen account; only the principal portion reduces the debt. Interest and fees are entered manually.</div>
      ${payments.length ? `<section class="panel planning-history"><div class="panel-heading"><h2>Recent repayments</h2><button class="text-link" data-go="transactions">All transactions ${icon("arrow-right")}</button></div>${payments.map((t) => `<div class="history-row"><div><strong>${esc(t.name)}</strong><small>${fullDate(t.date)} · Principal ${money(t.principal)}</small></div><strong>${money(t.amount)}</strong></div>`).join("")}</section>` : ""}`;
  }
  if (page === "projects") {
    const active = state.projects.filter((p) => !p.archived),
      budget = active.reduce((total, p) => total + toFils(p.budget), 0) / 1000;
    const spent =
      active.reduce(
        (total, p) => total + toFils(projectSpend(state, p.id)),
        0,
      ) / 1000;
    return `${heading("Make room for the big plans.", "A home refresh, a wedding or a new chapter. Keep each budget in focus.", button("project", "New project"))}
      ${stats([
        ["Active projects", active.length, "Each with its own spending plan"],
        ["Total planned", money(budget), "Budgets across active projects"],
        ["Total spent", money(spent), "Linked expenses, across all dates"],
      ])}
      <div class="planning-grid">${
        state.projects.length
          ? state.projects
              .slice()
              .sort((a, b) => Number(a.archived) - Number(b.archived))
              .map((p) => {
                const used = projectSpend(state, p.id),
                  remaining = (toFils(p.budget) - toFils(used)) / 1000;
                return `<article class="panel project-card ${p.archived ? "archived" : ""}" data-project="${esc(p.id)}"><div class="panel-heading"><span class="plan-symbol">${icon("folder-open")}</span><span class="plan-status ${p.archived ? "paused" : remaining < 0 ? "overdue" : ""}">${p.archived ? "Archived" : remaining < 0 ? "Over budget" : "Active"}</span></div><h2>${esc(p.name)}</h2><p class="plan-muted project-note">${esc(p.notes || "A plan worth making space for.")}</p><div class="plan-big-number">${money(used)} <small>spent</small></div><div class="progress"><div class="${remaining < 0 ? "cover" : "c0"}" style="width:${Math.min(100, (used / p.budget) * 100)}%"></div></div><dl class="plan-details"><div><dt>Budget</dt><dd>${money(p.budget)}</dd></div><div><dt>${remaining < 0 ? "Over budget" : "Remaining"}</dt><dd>${money(Math.abs(remaining))}</dd></div>${p.targetDate ? `<div><dt>Target date</dt><dd>${fullDate(p.targetDate)}</dd></div>` : ""}</dl><div class="project-actions"><button class="button primary" data-project-expense="${esc(p.id)}" ${p.archived ? "disabled" : ""}>${icon("plus")} Add expense</button><button class="icon-button" data-plan-form="project" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">${icon("pencil")}</button><button class="icon-button" data-plan-action="archive" data-id="${esc(p.id)}" aria-label="${p.archived ? "Reopen" : "Archive"} ${esc(p.name)}">${icon(p.archived ? "archive-restore" : "archive")}</button></div></article>`;
              })
              .join("")
          : empty(
              "folder-open",
              "A budget for your next chapter.",
              "Create a project, then tag expenses as you go. Spending is counted once in your accounts.",
            )
      }</div>
      <div class="planning-footnote">${icon("info")} Project budgets use all linked expenses, regardless of the selected month. Archiving preserves your project and its transaction history.</div>`;
  }
  return "";
}

export function duePanel(state, { esc, icon, money }, debtsOnly = false) {
  const all = upcomingPayments(state).filter(
    (r) => !debtsOnly || r.kind === "debt",
  );
  if (!all.length) return "";
  return `<section class="panel due-panel"><div class="panel-heading"><div><h2>${debtsOnly ? "Upcoming debt payments" : "On your horizon"}</h2><p>Next scheduled occurrences · ${bahrainDate()} in Bahrain</p></div><button class="text-link" data-go="${debtsOnly ? "debts" : "bills"}">${debtsOnly ? "View debts" : "View schedules"} ${icon("arrow-right")}</button></div>${all
    .slice(0, 4)
    .map(
      (r) =>
        `<div class="due-row"><span class="plan-symbol">${icon(r.type === "income" ? "briefcase-business" : "calendar-clock")}</span><div><strong>${esc(r.name)}</strong><small>${fullDate(r.nextDue)} · ${dueStatus(r.nextDue)}</small></div><strong class="${r.type === "income" ? "positive" : ""}">${r.type === "income" ? "+" : ""}${money(r.amount)}</strong><button class="icon-button" data-plan-form="${r.kind === "debt" ? "repayment" : "record"}" data-id="${esc(r.id)}" aria-label="Record ${esc(r.name)}">${icon("arrow-right")}</button></div>`,
    )
    .join("")}</section>`;
}

export function planningForm(kind, id, state, { esc, field }) {
  const select = (label, name, options, value) =>
    `<label>${label}<select name="${name}" aria-label="${label}" required>${options.map(([v, text]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const amount = (label, name, value = "") =>
    field(
      label,
      name,
      "number",
      value,
      'min="0.001" max="1000000000000" step="0.001"',
    );
  const accounts = (value) =>
    select(
      "Account",
      "accountId",
      state.accounts.map((a) => [a.id, a.name]),
      value,
    );
  const hidden = (name, value) =>
    `<input type="hidden" name="${name}" value="${esc(value)}"/>`;
  if (kind === "recurring") {
    const r = state.recurring.find((r) => r.id === id) || {};
    return {
      title: id ? "Edit schedule" : "Plan a regular payment",
      content: `${field("Schedule name", "name", "text", r.name || "", 'maxlength="80" placeholder="e.g. EWA, rent or monthly salary"')}${select(
        "Direction",
        "type",
        [
          ["expense", "Bill or subscription"],
          ["income", "Salary or income"],
        ],
        r.type || "expense",
      )}<div class="form-grid">${amount("Amount (BHD)", "amount", r.amount || "")}${select("Repeat", "frequency", Object.entries(frequencies), r.frequency || "monthly")}</div>${select(
        "Category",
        "category",
        [
          ["Utilities", "Utilities"],
          ["Home", "Home"],
          ["Food & drink", "Food & drink"],
          ["Shopping", "Shopping"],
          ["Transport", "Transport"],
          ["Health", "Health"],
          ["Entertainment", "Entertainment"],
          ["Income", "Income"],
          ["Other", "Other"],
        ],
        r.category || "Utilities",
      )}${field("Next due date", "nextDue", "date", r.nextDue || bahrainDate())}${accounts(r.accountId)}<p class="helper-note">Month-end dates stay anchored to the original day. Income schedules use the Income category. Saving a schedule does not add a transaction.</p>`,
    };
  }
  if (kind === "record") {
    const r = state.recurring.find((r) => r.id === id);
    if (!r) throw Error("Schedule not found.");
    return {
      title:
        r.type === "income" ? "Record received income" : "Record a paid bill",
      content: `<p class="payment-context"><strong>${esc(r.name)}</strong><br>Scheduled for ${fullDate(r.nextDue)}</p>${hidden("scheduledFor", r.nextDue)}${amount("Actual amount (BHD)", "amount", r.amount)}${field("Payment date", "date", "date", bahrainDate())}${accounts(r.accountId)}<p class="helper-note">This adds one ${r.type === "income" ? "income" : "expense"} transaction and advances the schedule by one period. Confirm only if the money has already moved.</p>`,
    };
  }
  if (kind === "debt")
    return {
      title: "Add a debt to track",
      content: `${field("Debt name", "name", "text", "", 'maxlength="80" placeholder="e.g. Car finance"')}<label>Lender (optional)<input name="lender" maxlength="80" placeholder="Bank, lender or person"/></label>${amount("Outstanding principal (BHD)", "balance")}${amount("Planned monthly payment (BHD)", "installment")}${field("Next due date", "nextDue", "date", bahrainDate())}<p class="helper-note">Enter the principal you currently owe. Adding a debt does not change any account balance. This tracker does not calculate interest.</p>`,
    };
  if (kind === "repayment") {
    const d = state.debts.find((d) => d.id === id);
    if (!d) throw Error("Debt not found.");
    const suggested = Math.min(d.balance, d.installment);
    return {
      title: "Record a debt repayment",
      content: `<p class="payment-context"><strong>${esc(d.name)}</strong><br>Check your statement for the principal portion of this payment.</p>${hidden("scheduledFor", d.nextDue)}${amount("Total payment (BHD)", "amount", d.installment)}${amount("Principal portion (BHD)", "principal", suggested)}${field("Payment date", "date", "date", bahrainDate())}${accounts()}<p class="helper-note">Interest and fees are the total minus principal. Your account is reduced by the total; your debt is reduced by principal only. The next due date advances one month.</p>`,
    };
  }
  if (kind === "project") {
    const p = state.projects.find((p) => p.id === id) || {};
    return {
      title: id ? "Edit project" : "Give your plan a budget",
      content: `${field("Project name", "name", "text", p.name || "", 'maxlength="80" placeholder="e.g. Our home refresh"')}${amount("Project budget (BHD)", "budget", p.budget || "")}<label>Target date (optional)<input type="date" name="targetDate" value="${esc(p.targetDate || "")}"/></label><label>Notes (optional)<textarea name="notes" maxlength="300" rows="3">${esc(p.notes || "")}</textarea></label><p class="helper-note">Add expenses to this project from the project card or transaction form. Each expense updates its account only once.</p>`,
    };
  }
}
