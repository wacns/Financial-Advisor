import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankState, addTransfer, addTransaction, summary, totalBalance} from '../../src/finance.ts';
import {accountReport, spendingBreakdown, monthlyTrend, budgetHealth, calendarEntries, shiftMonth} from '../../src/reports.ts';
import {recordRecurring} from '../../src/planning.ts';
import type {Budget, Debt, Recurring, Workspace} from '../../src/domain/types.ts';
import {must} from '../../src/guards.ts';
import {partial} from '../support.ts';
import type {DeepPartial} from '../support.ts';

const workspace = () => partial<Workspace>({...blankState(), accounts:[{id:'a', balance:100}, {id:'b', balance:50}]});
const transfer = {id:'move', accountId:'a', toAccountId:'b', amount:'0.001', date:'2026-10-16', name:'Savings transfer'};

test('transfers preserve total wealth and a single fils without affecting income, spending or budgets', () => {
  const state = workspace();
  state.budgets = partial<Budget[]>([{category:'Shopping', limit:20}]);
  addTransfer(state, transfer);
  assert.deepEqual(state.accounts.map(a => a.balance), [99.999, 50.001]);
  assert.equal(totalBalance(state), 150);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0]?.type, 'transfer');
  assert.deepEqual(summary(state, '2026-10'), {income:0, expenses:0});
  assert.deepEqual(budgetHealth(state,'2026-10'), {limit:20, spent:0, remaining:20, exceeded:0});
  assert.equal(accountReport(state,'b').transactions[0]?.id, 'move');
  assert.equal(accountReport(state,'a').transactions.length, 1);
});

test('invalid transfers leave both accounts and the ledger untouched', () => {
  for (const invalid of [{toAccountId:'a'}, {accountId:'missing'}, {toAccountId:'missing'},
    {amount:'0.0001'}, {amount:0}, {amount:-1}, {amount:Infinity}, {date:'2026-02-30'}, {name:'  '}]) {
    const state = workspace();
    assert.throws(() => addTransfer(state, {...transfer, ...invalid}));
    assert.deepEqual(state, workspace());
  }
  const state = workspace();
  must(state.accounts[1], 'account').balance = 1e12;
  const before = structuredClone(state);
  assert.throws(() => addTransfer(state, transfer));
  assert.deepEqual(state, before);
});

test('scoped reports aggregate exact expenses, retain custom categories, and exclude transfers', () => {
  const state = workspace();
  for (const [id, accountId, category, amount, type] of [
    ['1','a','Custom category',0.101,'expense'], ['2','a','Custom category',0.2,'expense'],
    ['3','b','Shopping',5,'expense'], ['4','a','Income',10,'income']] satisfies [string, string, string, number, string][])
    addTransaction(state,{id,accountId,category,amount,type,date:'2026-10-16'});
  addTransfer(state, transfer);
  const scoped = accountReport(state,'a');
  assert.deepEqual(summary(scoped,'2026-10'),{income:10,expenses:0.301});
  assert.deepEqual(spendingBreakdown(scoped,'2026-10'),[{name:'Custom category',amount:0.301}]);
  const trend = monthlyTrend(scoped,'2026-10');
  assert.equal(trend[0]?.month,'2026-05');
  assert.deepEqual(trend[5],{month:'2026-10',income:10,expenses:0.301});
  state.budgets = partial<Budget[]>([{category:'Custom category',limit:0.3}, {category:'Shopping',limit:10}]);
  assert.deepEqual(budgetHealth(state,'2026-10'),{limit:10.3,spent:5.301,remaining:4.999,exceeded:1});
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
});

const schedule = (extra: DeepPartial<Recurring> = {}) => partial<Recurring>({id:'bill',name:'Bill',type:'expense',amount:2,category:'Utilities',
  accountId:'a',frequency:'monthly',nextDue:'2026-01-31',anchorDay:31,anchorMonth:1,paused:false,...extra});

test('calendar projects month ends and leap years, weekly repeats, and yearly anchors without mutation', () => {
  const state = workspace();
  state.recurring = [schedule(), schedule({id:'weekly',frequency:'weekly',nextDue:'2000-01-03'}),
    schedule({id:'leap',frequency:'yearly',nextDue:'2024-02-29',anchorDay:29,anchorMonth:2}), schedule({id:'paused',paused:true})];
  const before = structuredClone(state);
  const feb = calendarEntries(state,'2028-02');
  assert.equal(feb.find(e => e.id === 'bill')?.date,'2028-02-29');
  assert.equal(feb.find(e => e.id === 'leap')?.date,'2028-02-29');
  assert.deepEqual(feb.filter(e => e.id === 'weekly').map(e => e.date),['2028-02-07','2028-02-14','2028-02-21','2028-02-28']);
  assert(feb.every(e => e.status === 'projected' && !e.actionable));
  assert.equal(feb.some(e => e.id === 'paused'),false);
  assert.equal(calendarEntries(state,'2027-02').find(e => e.id === 'leap')?.date,'2027-02-28');
  assert.equal(calendarEntries(state,'2028-03').find(e => e.id === 'bill')?.date,'2028-03-31');
  assert.equal(calendarEntries(state,'2023-01').some(e => e.id === 'leap'),false);
  assert.deepEqual(state,before);
});

test('calendar distinguishes the next due occurrence from projections and retains payment history', () => {
  const state = workspace();
  state.recurring = [schedule({frequency:'weekly',nextDue:'2026-10-20'})];
  state.debts = partial<Debt[]>([{id:'loan',name:'Car',balance:100,installment:10,nextDue:'2026-10-25'}]);
  let entries = calendarEntries(state,'2026-10');
  assert.equal(entries.find(e => e.date === '2026-10-20')?.actionable,true);
  assert.equal(entries.find(e => e.date === '2026-10-27')?.actionable,false);
  assert.equal(entries.filter(e => e.kind === 'debt').length,1);
  recordRecurring(state,'bill',{scheduledFor:'2026-10-20',date:'2026-10-20',amount:2.345,accountId:'a'},'paid');
  entries = calendarEntries(state,'2026-10');
  assert.equal(entries.find(e => e.id === 'paid')?.status,'recorded');
  assert.equal(entries.find(e => e.id === 'paid')?.amount,2.345);
  assert.equal(entries.find(e => e.date === '2026-10-27')?.actionable,true);
  assert.equal(state.accounts[0]?.balance,97.655);
  assert.equal(calendarEntries(state,'2026-11').some(e => e.kind === 'debt'),false);
});
