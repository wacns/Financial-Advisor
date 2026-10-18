import test from "node:test";
import assert from "node:assert/strict";
import { blankState } from "../../src/finance.js";
import { applyEntry } from "../../src/application/workspace.js";
import {
  normalizeWorkspace,
  convert,
  validateWorkspace,
} from "../../src/domain/model.js";
import {
  cycleRange,
  cycleKey,
  budgetStats,
  validateCycleBudgets,
  accumulatedSavings,
  recurringForecast,
} from "../../src/domain/cycles.js";
import {
  backupText,
  parseBackup,
  importCSV,
} from "../../src/domain/imports.js";
import { projectTotals, milestonePaid } from "../../src/domain/projects.js";
import { reportRange, reportData } from "../../src/domain/reports.js";
import { parseReceipt } from "../../src/domain/receipt.js";
import { entryForm } from "../../src/application/forms.js";
let seq = 0;
const save = (s, k, d, id) => applyEntry(s, k, d, id, () => `test-${++seq}`);
const base = () =>
  normalizeWorkspace({
    ...blankState(),
    accounts: [
      { id: "bank", name: "Bank", type: "Current account", balance: 1000 },
      {
        id: "usd",
        name: "Dollar account",
        type: "Savings",
        currency: "USD",
        balance: 100,
      },
    ],
  });
const expense = {
  type: "expense",
  accountId: "bank",
  amount: "10.001",
  date: "2026-10-15",
  name: "Groceries",
  category: "Food & drink",
};
test("editing and deleting a currency transfer reverse both original effects exactly once", () => {
  let s = save(base(), "transfer", {
      accountId: "bank",
      toAccountId: "usd",
      amount: "3.760",
      received: "10",
      date: expense.date,
      name: "FX transfer",
    }),
    id = s.transactions[0].id;
  assert.equal(s.accounts[0].balance, 996.24);
  assert.equal(s.accounts[1].balance, 110);
  s = save(
    s,
    "editTransaction",
    { ...s.transactions[0], amount: "7.520", received: "20" },
    id,
  );
  assert.equal(s.accounts[0].balance, 992.48);
  assert.equal(s.accounts[1].balance, 120);
  s = save(s, "deleteTransaction", {}, id);
  assert.equal(s.accounts[0].balance, 1000);
  assert.equal(s.accounts[1].balance, 100);
});
test("failed edits never mutate the caller and reconciliation uses a single visible difference", () => {
  let s = save(base(), "transaction", expense),
    id = s.transactions[0].id,
    snapshot = JSON.stringify(s);
  assert.throws(() =>
    save(s, "editTransaction", { ...expense, accountId: "missing" }, id),
  );
  assert.equal(JSON.stringify(s), snapshot);
  s = save(s, "reconcile", { balance: "950", date: expense.date }, "bank");
  assert.equal(s.accounts[0].balance, 950);
  assert.equal(s.transactions[0].amount, -39.999);
  s = save(s, "reconcile", { balance: "950", date: expense.date }, "bank");
  assert.equal(s.transactions.length, 2);
});
test("templates and copies open review drafts and preserve source data without reposting", () => {
  let s = save(base(), "transaction", {
      ...expense,
      time: "13:30",
      labels: "home, weekly",
    }),
    id = s.transactions[0].id;
  s = save(s, "template", { transactionId: id, name: "Weekly groceries" });
  assert.equal(s.transactions.length, 1);
  assert.equal(s.templates[0].record.id, undefined);
  const form = entryForm("transaction", undefined, s, {
    draft: s.templates[0].record,
  });
  assert.equal(form.values.amount, 10.001);
  assert.deepEqual(form.values.labels, ["home", "weekly"]);
});
test("category renaming updates descendants, plans, templates and disallows deletion while in use", () => {
  let s = save(base(), "category", {
    name: "Groceries",
    parent: "Food & drink",
  });
  s = save(s, "transaction", {
    ...expense,
    category: "Food & drink / Groceries",
  });
  s = save(s, "category", { name: "Dining", parent: "" }, "Food & drink");
  assert.equal(s.transactions[0].category, "Dining / Groceries");
  assert.throws(() => save(s, "deleteCategory", {}, "Dining"), /unused/);
});
test("salary-aligned cycles use ending-month labels and clamp short months", () => {
  const s = base();
  s.settings.cycleStartDay = 31;
  assert.deepEqual(cycleRange(s, "2027-03"), {
    from: "2027-02-28",
    until: "2027-03-31",
    to: "2027-03-30",
  });
  assert.equal(cycleKey(s, "2027-03-31"), "2027-04");
  assert.equal(cycleKey(s, "2027-03-30"), "2027-03");
});
test("four-week budgets reject overlapping categories and over-allocation atomically", () => {
  let s = save(base(), "cycleBudget", {
      key: "2026-10",
      name: "October",
      limit: "100",
      categoryMode: "all",
    }),
    id = s.cycleBudgets[0].id;
  s = save(s, "subBudget", {
    parentId: id,
    name: "Food",
    limit: 40,
    categoryMode: "selected",
    include: "Food & drink",
  });
  const snapshot = JSON.stringify(s);
  assert.throws(
    () =>
      save(s, "subBudget", {
        parentId: id,
        name: "Duplicate",
        limit: 20,
        categoryMode: "selected",
        include: "Food & drink / Groceries",
      }),
    /overlap/,
  );
  assert.equal(JSON.stringify(s), snapshot);
  assert.throws(
    () =>
      save(s, "subBudget", {
        parentId: id,
        name: "Too much",
        limit: 80,
        categoryMode: "selected",
        include: "Home",
      }),
    /exceed/,
  );
  s = save(s, "transaction", expense);
  assert.equal(
    budgetStats(s, s.cycleBudgets[0], s.cycleBudgets[0], "2026-10-18").spent,
    10.001,
  );
  assert.equal(accumulatedSavings(s, "2026-11-01")[0].amount, 89.999);
});
test("currency conversion, forecast frequency averages and explicit salary-month labels", () => {
  let s = base();
  assert.equal(convert(s, 10, "USD"), 3.76);
  s = save(s, "recurring", {
    name: "Weekly cash",
    type: "expense",
    amount: 12,
    accountId: "usd",
    category: "Other",
    frequency: "weekly",
    nextDue: "2026-10-20",
  });
  assert.equal(recurringForecast(s).expenses, 19.552);
  s = save(s, "transaction", {
    ...expense,
    type: "income",
    salaryMonth: "2026-11",
  });
  s = save(s, "salaryLink", { salaryMonth: "2026-12" }, s.transactions[0].id);
  assert.equal(s.transactions.length, 1);
  assert.equal(s.transactions[0].salaryMonth, "2026-12");
});
function planned() {
  let s = save(base(), "project", {
      name: "Kitchen",
      budget: 500,
      currency: "BHD",
      startDate: "2026-10-01",
      targetDate: "2026-12-01",
    }),
    p = s.projects[0],
    context = { projectId: p.id };
  s = save(s, "projectCategory", { ...context, name: "Works", budget: 400 });
  s = save(s, "projectContract", {
    ...context,
    name: "Installer",
    categoryId: s.projects[0].categories[0].id,
    original: 300,
    startDate: "2026-10-01",
    endDate: "2026-11-30",
  });
  s = save(s, "projectMilestone", {
    ...context,
    name: "Deposit",
    contractId: s.projects[0].contracts[0].id,
    amount: 100,
    due: "2026-10-20",
  });
  return { s, context };
}
test("project agreements enforce allocation, variations, dates and paid milestone limits", () => {
  let { s, context } = planned();
  const p = s.projects[0],
    m = p.milestones[0];
  assert.throws(
    () =>
      save(s, "projectVariation", {
        ...context,
        contractId: p.contracts[0].id,
        name: "Overspend",
        amount: 200,
        date: expense.date,
      }),
    /allocation/,
  );
  s = save(s, "projectPayment", {
    ...context,
    milestoneId: m.id,
    accountId: "bank",
    amount: 60,
    date: expense.date,
  });
  assert.equal(s.accounts[0].balance, 940);
  assert.equal(milestonePaid(s, s.projects[0], m), 60);
  assert.throws(
    () =>
      save(s, "projectPayment", {
        ...context,
        milestoneId: m.id,
        accountId: "bank",
        amount: 41,
        date: expense.date,
      }),
    /remaining/,
  );
  assert.throws(
    () =>
      save(
        s,
        "editTransaction",
        { ...s.transactions[0], amount: 101 },
        s.transactions[0].id,
      ),
    /milestone/,
  );
  assert.equal(projectTotals(s, s.projects[0]).paid, 60);
});
test("linking and unlinking existing project expenses never changes an account balance", () => {
  let { s, context } = planned();
  s = save(s, "transaction", expense);
  const id = s.transactions[0].id,
    balance = s.accounts[0].balance;
  s = save(s, "projectLink", {
    ...context,
    transactionId: id,
    milestoneId: s.projects[0].milestones[0].id,
  });
  assert.equal(s.accounts[0].balance, balance);
  assert.equal(s.transactions.length, 1);
  s = save(s, "projectUnlink", context, id);
  assert.equal(s.accounts[0].balance, balance);
  assert.equal(projectTotals(s, s.projects[0]).paid, 0);
});
test("full backup round-trips attachments and nested project/cycle data and rejects corrupt records", () => {
  let { s, context } = planned();
  s = save(s, "projectDocument", {
    ...context,
    name: "Contract",
    file: "data:text/plain;base64,SGVsbG8=",
    fileName: "contract.txt",
  });
  s = save(s, "cycleBudget", {
    name: "October",
    key: "2026-10",
    limit: 100,
    categoryMode: "all",
  });
  assert.deepEqual(parseBackup(backupText(s)), s);
  const corrupt = structuredClone(s);
  corrupt.projects[0].milestones[0].contractId = "missing";
  assert.throws(() => parseBackup(JSON.stringify(corrupt)), /agreement/);
  corrupt.goals = [{ id: "g", name: "Invalid", target: -1, saved: 0 }];
  assert.throws(() => parseBackup(JSON.stringify(corrupt)));
});
test("CSV imports quoted commas and duplicate rows atomically and rejects malformed dates", () => {
  const content =
    'date,type,amount,category,name\n2026-10-15,expense,10.001,Other,"Food, local"\n2026-10-15,expense,10.001,Other,"Food, local"';
  const imported = importCSV(base(), content, "bank");
  assert.equal(imported.added, 1);
  assert.equal(imported.skipped, 1);
  assert.equal(imported.state.accounts[0].balance, 989.999);
  const s = base(),
    snapshot = JSON.stringify(s);
  assert.throws(() =>
    importCSV(s, content + "\n2026-99-99,income,20,Other,bad", "bank"),
  );
  assert.equal(JSON.stringify(s), snapshot);
});
test("receipt parser leaves conflicting totals and ambiguous dates empty for review", () => {
  assert.equal(parseReceipt("Shop\nTOTAL 12.300\nTOTAL 15.000").amount, "");
  const r = parseReceipt(
    "City supermarket\nSubtotal 10.000\nGrand total BHD 10.500\n2026-10-18 14:05",
  );
  assert.equal(r.amount, "10.500");
  assert.equal(r.date, "2026-10-18");
  assert.equal(r.time, "14:05");
  assert.equal(parseReceipt("Shop\nTOTAL 3.000\n2026-99-99").date, "");
  assert.equal(parseReceipt("Shop\n04/05/2026").date, "");
  assert.equal(parseReceipt("Shop\n18/10/2026").date, "2026-10-18");
});
test("custom reports convert currencies, exclude transfers and include the selected last date", () => {
  let s = save(base(), "transaction", {
    ...expense,
    accountId: "usd",
    amount: 10,
  });
  s = save(s, "transfer", {
    accountId: "bank",
    toAccountId: "usd",
    amount: 3.76,
    date: expense.date,
    name: "Transfer",
  });
  const r = reportData(
    s,
    reportRange(s, "custom", "2026-10", "2026-10-01", "2026-10-15"),
  );
  assert.equal(r.expenses, 3.76);
  assert.equal(r.income, 0);
  assert.equal(r.groups[0].amount, 3.76);
});
test("foreign currency debt repayments compare principal in debt currency and deleting restores it", () => {
  let s = save(base(), "debt", {
      name: "Friend",
      direction: "lent",
      currency: "USD",
      balance: 100,
      installment: 10,
      nextDue: "2026-10-20",
    }),
    id = s.debts[0].id;
  s = save(
    s,
    "repayment",
    {
      accountId: "bank",
      amount: 3.76,
      principal: 10,
      date: expense.date,
      scheduledFor: "2026-10-20",
    },
    id,
  );
  assert.equal(s.accounts[0].balance, 1003.76);
  assert.equal(s.debts[0].balance, 90);
  assert.equal(s.transactions[0].type, "income");
  s = save(s, "deleteTransaction", {}, s.transactions[0].id);
  assert.equal(s.accounts[0].balance, 1000);
  assert.equal(s.debts[0].balance, 100);
});
test("loan account installments separate principal transfers and interest and retain month-end anchors", () => {
  let s = save(base(), "account", {
    name: "Car loan",
    type: "Loan",
    currency: "BHD",
    balance: -100,
    loanOriginal: 100,
    installment: 10,
    startDate: "2026-01-31",
    tenure: 12,
  });
  const loan = s.accounts.at(-1);
  assert.equal(loan.maturity, "2027-01-31");
  s = save(s, "loanInstallment", {
    loanId: loan.id,
    accountId: "bank",
    amount: 10,
    interest: 1,
    nextDue: "2026-10-31",
  });
  const plan = s.recurring.at(-1);
  s = save(
    s,
    "record",
    {
      accountId: "bank",
      amount: 10,
      date: "2026-10-18",
      scheduledFor: plan.nextDue,
    },
    plan.id,
  );
  assert.equal(s.accounts[0].balance, 989);
  assert.equal(s.accounts.at(-1).balance, -90);
  assert.equal(s.transactions.filter((t) => t.type === "transfer").length, 1);
  assert.equal(s.transactions.filter((t) => t.type === "expense")[0].amount, 1);
  assert.equal(s.recurring.at(-1).nextDue, "2026-11-30");
});
test("reference backup converts integer ledger/project/cycle units while retaining decimal basic budgets and goals", () => {
  const raw = {
    format: "financial-advisor-backup",
    backupVersion: 1,
    data: {
      version: 1,
      accounts: [
        {
          id: "a",
          name: "Bank",
          type: "Bank",
          opening: 1000000,
          currency: "BHD",
          apr: 0,
          limit: 0,
          cost: 0,
          start: "",
          maturity: "",
        },
      ],
      transactions: [
        {
          id: "t",
          type: "expense",
          account: "a",
          amount: 25000,
          note: "Deposit",
          category: "Other",
          date: "2026-10-18",
          projectId: "p",
          contractId: "c",
          milestoneId: "m",
        },
      ],
      recurring: [],
      budgets: [{ id: "b", category: "Other", limit: 180, period: "Monthly" }],
      goals: [
        {
          id: "g",
          name: "Reserve",
          target: 6000,
          saved: 3200,
          date: "2027-10-18",
        },
      ],
      settings: {
        base: "BHD",
        rates: { BHD: 1 },
        language: "en",
        theme: "dark",
        animations: false,
        templates: [],
        categoryCatalog: { parents: ["Other"], children: [] },
      },
      projects: [
        {
          id: "p",
          name: "Kitchen",
          currency: "BHD",
          start: "2026-10-01",
          end: "2026-12-01",
          budget: 500000,
          reserve: 10000,
          archived: false,
          categories: [{ id: "pc", name: "Works", budget: 400000 }],
          contracts: [
            {
              id: "c",
              categoryId: "pc",
              name: "Installer",
              original: 300000,
              start: "2026-10-01",
              end: "2026-11-30",
              variations: [],
            },
          ],
          milestones: [
            {
              id: "m",
              contractId: "c",
              name: "Deposit",
              due: "2026-10-20",
              amount: 100000,
              kind: "Advance",
              complete: false,
            },
          ],
          documents: [],
        },
      ],
      cycleBudgets: [
        {
          id: "cycle",
          key: "2026-10",
          name: "October",
          day: 1,
          from: "2026-10-01",
          until: "2026-11-01",
          to: "2026-10-31",
          currency: "BHD",
          limit: 100000,
          weeks: [25000, 25000, 25000, 25000],
          include: [],
          exclude: [],
          children: [],
        },
      ],
      warranties: [],
    },
  };
  const s = parseBackup(JSON.stringify(raw));
  assert.equal(s.accounts[0].balance, 975);
  assert.equal(s.budgets[0].limit, 180);
  assert.equal(s.goals[0].target, 6000);
  assert.equal(s.projects[0].budget, 500);
  assert.equal(s.cycleBudgets[0].limit, 100);
  assert.equal(
    milestonePaid(s, s.projects[0], s.projects[0].milestones[0]),
    25,
  );
  assert.equal(s.settings.motion, false);
});
test("renaming a built-in category hides the previous name and reconciliation is outside financial flow totals", () => {
  let s = save(
    base(),
    "category",
    { name: "Dining", parent: "" },
    "Food & drink",
  );
  assert.ok(s.settings.hiddenCategories.includes("Food & drink"));
  assert.ok(s.settings.categories.includes("Dining"));
  s = save(s, "reconcile", { balance: 950, date: "2026-10-18" }, "bank");
  const report = reportData(s, reportRange(s, "month", "2026-10"));
  assert.equal(report.income, 0);
  assert.equal(report.expenses, 0);
});
test("updating a loan account installment updates its linked schedule without dropping interest metadata", () => {
  let s = save(base(), "account", {
    name: "Loan",
    type: "Loan",
    currency: "BHD",
    balance: -100,
    installment: 10,
  });
  const id = s.accounts.at(-1).id;
  s = save(s, "loanInstallment", {
    loanId: id,
    accountId: "bank",
    amount: 10,
    interest: 1,
    nextDue: "2026-10-31",
  });
  s = save(s, "editAccount", { ...s.accounts.at(-1), installment: 15 }, id);
  assert.equal(s.recurring[0].amount, 15);
  assert.equal(s.recurring[0].received, 15);
  s = save(
    s,
    "recurring",
    { ...s.recurring[0], name: "Renamed installment" },
    s.recurring[0].id,
  );
  assert.equal(s.recurring[0].loanInstallment, true);
  assert.equal(s.recurring[0].interest, 1);
});
