import test from 'node:test';
import assert from 'node:assert/strict';
import {addTransaction, blankState, summary, categorySpend, totalBalance} from '../../src/finance.ts';
import type {Account, Workspace} from '../../src/domain/types.ts';
import {partial} from '../support.ts';
test('transaction updates only selected balance, preserves precision, and counts within month', () => {
 const state=partial<Workspace>(blankState()); state.accounts=partial<Account[]>([{id:'a',balance:100},{id:'b',balance:50}]);
 addTransaction(state,{id:'1',accountId:'a',type:'expense',amount:10.11,date:'2026-10-15',category:'Food & drink'});
 addTransaction(state,{id:'2',accountId:'a',type:'income',amount:20,date:'2026-09-15',category:'Income'});
 assert.equal(state.accounts[0]?.balance,109.89); assert.equal(totalBalance(state),159.89);
 assert.deepEqual(summary(state,'2026-10'),{income:0,expenses:10.11}); assert.equal(categorySpend(state,'2026-10','Food & drink'),10.11);
});
test('invalid amount and missing account do not mutate balances', () => {
 const state=partial<Workspace>(blankState()); state.accounts=partial<Account[]>([{id:'a',balance:100}]);
 for (const amount of [-5,0,NaN,Infinity]) assert.throws(()=>addTransaction(state,{accountId:'a',type:'expense',date:'2026-10-15',amount}));
 assert.throws(()=>addTransaction(state,{accountId:'missing',type:'expense',date:'2026-10-15',amount:5}));
 assert.equal(state.accounts[0]?.balance,100); assert.equal(state.transactions.length,0);
});

test('BHD transactions preserve a single fils and aggregate without floating point drift', () => {
 const state=partial<Workspace>(blankState());state.accounts=partial<Account[]>([{id:'a',balance:1}]);
 for(const [id,amount] of [['1',0.001],['2',0.1],['3',0.2]]) {
  addTransaction(state,{id,accountId:'a',type:'expense',amount,date:'2026-10-15',category:'Transport'});
 }
 assert.equal(state.accounts[0]?.balance,0.699);
 assert.deepEqual(summary(state,'2026-10'),{income:0,expenses:0.301});
 assert.equal(categorySpend(state,'2026-10','Transport'),0.301);
 assert.throws(()=>addTransaction(state,{accountId:'a',type:'expense',amount:0.0001,date:'2026-10-15'}),/three decimal/);
 assert.equal(state.accounts[0]?.balance,0.699);
});
