import { bahrainDate, CURRENCY, REGION, TIME_ZONE, toFils } from './locale.js';
export const categories = ['Shopping', 'Food & drink', 'Transport', 'Home', 'Health', 'Entertainment', 'Utilities', 'Income', 'Other'];
export function totalBalance(state) {
  return state.accounts.reduce((sum, account) => sum + toFils(account.balance), 0) / 1000;
}
export function monthTransactions(state, month) { return state.transactions.filter(t => t.date.slice(0, 7) === month); }
export function summary(state, month) {
  const transactions = monthTransactions(state, month);
  return { income: transactions.filter(t => t.type === 'income').reduce((s,t) => s + toFils(t.amount),0) / 1000, expenses: transactions.filter(t => t.type === 'expense').reduce((s,t) => s + toFils(t.amount),0) / 1000 };
}
export function categorySpend(state, month, category) { return monthTransactions(state,month).filter(t => t.type === 'expense' && t.category === category).reduce((s,t) => s + toFils(t.amount),0) / 1000; }
export function addTransaction(state, transaction) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw Error('Enter a valid positive amount.');
  if (!['income','expense'].includes(transaction.type)) throw Error('Select a transaction type.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) throw Error('Choose a valid date.');
  const account = state.accounts.find(a => a.id === transaction.accountId);
  if (!account) throw Error('Choose an account first.');
  const fils = toFils(amount);
  account.balance = (toFils(account.balance) + (transaction.type === 'income' ? fils : -fils)) / 1000;
  state.transactions.unshift({...transaction, amount});
  return state;
}
export function blankState() { return {accounts: [], transactions: [], budgets: [], goals: [], currency: CURRENCY, region: REGION, timeZone: TIME_ZONE}; }
export function demoState() {
  const month = bahrainDate().slice(0, 7);
  const tx = (id, name, category, amount, day, type='expense', accountId='current') => ({id, name, category, amount, date:`${month}-${String(day).padStart(2,'0')}`, type, accountId});
  return {...blankState(), accounts:[
    {id:'current',name:'NBB current account',type:'Current account',balance:1240.500,last4:'4829'},
    {id:'savings',name:'BBK savings',type:'Savings',balance:6500.250,last4:'9016'},
    {id:'cash',name:'Everyday cash',type:'Cash',balance:85.750,last4:''}
  ],transactions:[
    tx('1','Alosra supermarket','Food & drink',32.475,15),
    tx('2','Monthly salary','Income',1800,14,'income'),
    tx('3','Batelco mobile bill','Utilities',11,14),
    tx('4','Coffee in Adliya','Food & drink',2.850,13),
    tx('5','City Centre Bahrain','Shopping',24.900,12),
    tx('6','Manama apartment rent','Home',350,1),
    tx('7','Bapco petrol','Transport',8.250,10),
    tx('8','Lulu Hypermarket','Food & drink',45.125,8),
    tx('9','Dinner in Muharraq','Food & drink',18.500,6),
    tx('10','EWA electricity & water','Utilities',35.750,5),
    tx('11','Gym membership','Health',25,3),
    tx('12','Freelance project','Income',150,4,'income'),
    tx('13','Family lunch in Riffa','Food & drink',22,2)
  ],budgets:[
    {id:'food',category:'Food & drink',limit:180},
    {id:'shopping',category:'Shopping',limit:100},
    {id:'transport',category:'Transport',limit:60},
    {id:'utilities',category:'Utilities',limit:80}
  ],goals:[
    {id:'emergency',name:'Emergency fund',saved:2500,target:5000,icon:'shield-check'},
    {id:'staycation',name:'Bahrain staycation',saved:180,target:400,icon:'sun'},
    {id:'home',name:'A home in Bahrain',saved:8000,target:25000,icon:'house'}
  ]};
}
