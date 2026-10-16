import { summary } from './finance.js';
import { formatDate, bahrainDate, toFils } from './locale.js';
import { upcomingPayments, dueStatus } from './planning.js';
import { shiftMonth, accountReport, spendingBreakdown, monthlyTrend, budgetHealth, calendarEntries } from './reports.js';

const colors = ['#37816d', '#b3c897', '#8baebc', '#c7ad87', '#909ac2', '#c58f87', '#6e948a', '#a9ada1', '#d3b85e', '#9590a4'];
const sum = (items, type) => items.filter(r => r.type === type).reduce((total, r) => total + toFils(r.amount), 0) / 1000;
const periodName = month => formatDate(`${month}-01`, {month: 'short', year: 'numeric'});

export function financialPulse(state, month, {icon, money}) {
  const budget = budgetHealth(state, month);
  const previous = summary(state, shiftMonth(month, -1)).expenses;
  const current = summary(state, month).expenses;
  const difference = previous ? Math.round(((current - previous) / previous) * 100) : null;
  const upcoming = upcomingPayments(state).filter(r => r.nextDue.startsWith(month) && r.type === 'expense');
  return `<section class="financial-pulse" aria-label="Financial pulse">
    <button class="pulse-item" data-go="insights"><span class="pulse-symbol">${icon('chart-pie')}</span><span><small>SPENDING CHECK-IN</small><strong>${difference === null ? 'Your story is taking shape' : `${Math.abs(difference)}% ${difference <= 0 ? 'less' : 'more'} spending`}</strong><span>Recorded totals vs ${periodName(shiftMonth(month, -1))}</span></span>${icon('arrow-up-right')}</button>
    <button class="pulse-item" data-go="budgets"><span class="pulse-symbol">${icon('chart-no-axes-combined')}</span><span><small>YOUR BUDGET ROOM</small><strong>${state.budgets.length ? money(Math.abs(budget.remaining)) : 'A little plan goes a long way'}</strong><span>${state.budgets.length ? `${budget.remaining < 0 ? 'Over' : 'Remaining across'} ${state.budgets.length} category budgets${budget.exceeded ? ` · ${budget.exceeded} over limit` : ''}` : 'Set your first category budget'}</span></span>${icon('arrow-up-right')}</button>
    <button class="pulse-item" data-go="calendar"><span class="pulse-symbol">${icon('calendar-days')}</span><span><small>ON THE CALENDAR</small><strong>${money(sum(upcoming, 'expense'))}</strong><span>${upcoming.length} next payments due in ${formatDate(`${month}-01`, {month:'long'})}</span></span>${icon('arrow-up-right')}</button>
  </section>`;
}

function spendingRing(spending, total, {esc, money}) {
  let offset = 0;
  const arcs = spending.map((s, i) => {
    const percent = s.amount / total * 100;
    const arc = `<circle cx="100" cy="100" r="78" fill="none" stroke="${colors[i % colors.length]}" stroke-width="23" pathLength="100" stroke-dasharray="${percent} ${100 - percent}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"/>`;
    offset += percent;
    return arc;
  }).join('');
  return `<div class="spending-visual"><div class="spending-ring"><svg viewBox="0 0 200 200" role="img" aria-label="Category spending chart: ${esc(money(total))} total expenses"><circle cx="100" cy="100" r="78" fill="none" stroke="#edf1ea" stroke-width="23"/>${arcs}</svg><div><small>TOTAL SPENT</small><strong>${money(total)}</strong><span>${spending.length} categories</span></div></div><div class="spending-legend">${spending.map((s, i) => `<div><span class="report-dot" style="background:${colors[i % colors.length]}"></span><span>${esc(s.name)}</span><strong>${money(s.amount)}</strong><small>${Math.round(s.amount / total * 100)}%</small></div>`).join('') || '<p class="empty">Record an expense to see where your money goes.</p>'}</div></div>`;
}

export function reportsPage(state, month, accountId, {esc, icon, money, heading}) {
  const scoped = accountReport(state, accountId);
  const {income, expenses} = summary(scoped, month);
  const spending = spendingBreakdown(scoped, month);
  const trend = monthlyTrend(scoped, month);
  const max = Math.max(1, ...trend.flatMap(t => [t.income, t.expenses]));
  const previous = summary(scoped, shiftMonth(month, -1)).expenses;
  const change = previous ? Math.round((expenses - previous) / previous * 100) : null;
  const merchantTotals = new Map();
  for (const t of scoped.transactions.filter(t => t.type === 'expense' && t.date.startsWith(month)))
    merchantTotals.set(t.name, (merchantTotals.get(t.name) || 0) + toFils(t.amount));
  const merchants = [...merchantTotals].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `${heading('Find your financial rhythm.', 'Understand the patterns. Make room for what matters.')}
    <div class="report-toolbar"><div class="report-intro">${icon('chart-pie')}<span>Your money, from a different angle.</span></div><label>Report account<select id="report-account" aria-label="Report account"><option value="all">All accounts</option>${state.accounts.map(a => `<option value="${esc(a.id)}" ${accountId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label></div>
    <div class="planning-stats report-stats"><article class="panel"><span>Income</span><strong class="positive">${money(income)}</strong><small>Recorded in ${periodName(month)}</small></article><article class="panel"><span>Expenses</span><strong>${money(expenses)}</strong><small>${change === null ? 'No spending baseline in the previous month' : `${Math.abs(change)}% ${change <= 0 ? 'less' : 'more'} than ${periodName(shiftMonth(month, -1))}`}</small></article><article class="panel"><span>Net cash flow</span><strong>${money((toFils(income) - toFils(expenses)) / 1000)}</strong><small>Income minus expenses · transfers excluded</small></article></div>
    <div class="reports-grid"><section class="panel category-report"><div class="panel-heading"><div><p class="eyebrow">THE BIG PICTURE</p><h2>Where your money goes</h2><p>Your recorded spending by category.</p></div><span class="report-badge">${periodName(month)}</span></div>${spendingRing(spending, expenses, {esc, money})}</section>
    <section class="panel trend-report"><div class="panel-heading"><div><p class="eyebrow">A LITTLE PERSPECTIVE</p><h2>Six months in view</h2><p>Recorded monthly totals, including the selected month.</p></div></div><div class="chart-legend"><span><i class="legend-dot green"></i>Income</span><span><i class="legend-dot pale"></i>Expenses</span></div><div class="trend-chart" role="img" aria-label="Six-month income and spending chart">${trend.map(t => `<div class="trend-column"><div class="trend-bars"><div style="height:${t.income ? Math.max(2, t.income / max * 100) : 0}%" class="income-bar" title="${periodName(t.month)} income: ${money(t.income)}"></div><div style="height:${t.expenses ? Math.max(2, t.expenses / max * 100) : 0}%" class="expense-bar" title="${periodName(t.month)} expenses: ${money(t.expenses)}"></div></div><span>${formatDate(`${t.month}-01`, {month:'short'})}</span></div>`).join('')}</div><details class="trend-details"><summary>View exact monthly amounts</summary><div class="table-scroll"><table><thead><tr><th>Month</th><th>Income</th><th>Expenses</th></tr></thead><tbody>${trend.map(t => `<tr><td>${periodName(t.month)}</td><td>${money(t.income)}</td><td>${money(t.expenses)}</td></tr>`).join('')}</tbody></table></div></details></section>
    <section class="panel merchant-report"><div class="panel-heading"><div><h2>Your biggest spending moments</h2><p>Descriptions grouped by their total amount.</p></div>${icon('receipt')}</div>${merchants.map(([name, fils], i) => `<div class="merchant-rank"><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(name)}</b><strong>${money(fils / 1000)}</strong></div>`).join('') || '<div class="empty">Your most frequent spending will appear here.</div>'}</section>
    <section class="report-takeaway"><span class="takeaway-icon">${icon('lightbulb')}</span><p class="eyebrow">ONE SMALL NEXT STEP</p><h2>${spending.length ? `Make a plan for ${esc(spending[0].name.toLowerCase())}.` : 'Start with your everyday spending.'}</h2><p>${spending.length ? `At ${money(spending[0].amount)}, this is your largest spending category for the selected account scope and month. A category budget can help you keep it in view.` : 'Record a few expenses to discover your patterns. Every little detail helps you build a clearer picture.'}</p><button class="button primary" data-go="${spending.length ? 'budgets' : 'transactions'}">${spending.length ? 'Explore budgets' : 'View transactions'} ${icon('arrow-right')}</button></section></div><p class="helper-note">Comparisons use recorded totals for each calendar month, which may be incomplete. Transfers are excluded from income and expenses.</p>`;
}

export function calendarPage(state, month, selected, {esc, icon, money, heading}) {
  const entries = calendarEntries(state, month);
  const today = bahrainDate();
  const date = selected.startsWith(month) ? selected : today.startsWith(month) ? today : entries[0]?.date || `${month}-01`;
  const dayEntries = entries.filter(e => e.date === date);
  const planned = entries.filter(e => e.status !== 'recorded');
  const first = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const dayCount = new Date(new Date(`${shiftMonth(month, 1)}-01T12:00:00Z`).getTime() - 86400000).getUTCDate();
  const cells = Array.from({length:first}, () => '<div class="calendar-blank" aria-hidden="true"></div>');
  for (let day = 1; day <= dayCount; day++) {
    const civil = `${month}-${String(day).padStart(2, '0')}`;
    const items = entries.filter(e => e.date === civil);
    cells.push(`<button class="calendar-day ${civil === date ? 'selected' : ''} ${civil === today ? 'today' : ''}" data-calendar-date="${civil}" aria-pressed="${civil === date}" aria-label="${formatDate(civil, {day:'numeric',month:'long',year:'numeric'})}, ${items.length} payments"><span class="day-number">${day}</span><span class="calendar-events">${items.slice(0, 2).map(e => `<span class="calendar-event ${e.type} ${e.status === 'recorded' ? 'recorded' : ''}"><i></i><span>${esc(e.name)}</span></span>`).join('')}${items.length > 2 ? `<small>+${items.length - 2} more</small>` : ''}</span><span class="calendar-dots">${items.slice(0, 4).map(e => `<i class="${e.type}"></i>`).join('')}</span></button>`);
  }
  return `${heading('A date with your finances.', 'Bills, subscriptions and payday. See what’s coming, before it arrives.', `<button class="button primary" data-plan-form="recurring">${icon('plus')} New schedule</button>`)}
    <div class="calendar-summary"><div><span class="report-dot" style="background:#b3c897"></span><span>Planned income<strong>${money(sum(planned, 'income'))}</strong></span></div><div><span class="report-dot" style="background:#c7ad87"></span><span>Planned payments<strong>${money(sum(planned, 'expense'))}</strong></span></div><div><span class="report-dot" style="background:#8baebc"></span><span>Recorded payments<strong>${entries.filter(e => e.status === 'recorded').length}</strong></span></div></div>
    <div class="calendar-layout"><section class="panel calendar-panel"><div class="panel-heading"><div><h2>${formatDate(`${month}-01`, {month:'long',year:'numeric'})}</h2><p>Choose a day to see the details.</p></div><div class="calendar-controls"><button class="icon-button" data-month-offset="-1" aria-label="Previous month">${icon('chevron-left')}</button><button class="text-link" data-action="calendar-today">Today</button><button class="icon-button" data-month-offset="1" aria-label="Next month">${icon('chevron-right')}</button></div></div><div class="calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<span>${d}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div><div class="calendar-key"><span><i class="report-dot" style="background:#37816d"></i>Income</span><span><i class="report-dot" style="background:#b98a52"></i>Expense</span><span>${icon('circle-check')}Recorded</span></div></section>
    <section class="panel day-agenda" aria-live="polite"><p class="eyebrow">YOUR DAY AT A GLANCE</p><h2>${formatDate(date, {weekday:'long',day:'numeric',month:'short'})}</h2><p class="agenda-subtitle">${dayEntries.length} ${dayEntries.length === 1 ? 'payment' : 'payments'} on the calendar</p>${dayEntries.map(e => `<article class="agenda-item"><span class="plan-symbol">${icon(e.status === 'recorded' ? 'circle-check' : e.type === 'income' ? 'briefcase-business' : 'calendar-clock')}</span><div><h3>${esc(e.name)}</h3><p>${esc(e.kind === 'debt' ? 'Loan repayment' : state.accounts.find(a => a.id === e.accountId)?.name || 'Manual account')}</p><strong class="${e.type === 'income' ? 'positive' : ''}">${e.type === 'income' ? '+' : '−'}${money(e.amount)}</strong><span class="plan-status ${e.status === 'due' && e.date < today ? 'overdue' : ''}">${e.status === 'recorded' ? 'Recorded' : e.status === 'projected' ? 'Projected' : dueStatus(e.date)}</span>${e.actionable ? `<button class="button secondary" data-plan-form="${e.kind === 'debt' ? 'repayment' : 'record'}" data-id="${esc(e.id)}">${e.type === 'income' ? 'Record income' : 'Record payment'}</button>` : ''}</div></article>`).join('') || `<div class="agenda-empty">${icon('sun')}<h3>A little breathing room.</h3><p>No scheduled or recorded payments on this day.</p><button class="text-link" data-plan-form="recurring">Add a schedule ${icon('plus')}</button></div>`}</section></div>
    <div class="planning-footnote">${icon('info')}<span>Recurring schedules are projected from their next due date; loans show only the next repayment. Paused schedules are hidden. Only the next due occurrence can be recorded. Projections never change balances or send reminders.</span></div><button class="text-link" data-go="bills">Manage your schedules ${icon('arrow-right')}</button>`;
}
