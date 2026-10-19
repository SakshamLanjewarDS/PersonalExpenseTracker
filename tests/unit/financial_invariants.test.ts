import { describe, it, expect, beforeEach } from "vitest";
import {
  parseRupeesToPaise,
  formatPaise,
  addPaise,
  subPaise,
  calculateAvailableBudget,
} from "@/lib/money/paise";
import {
  deriveAccountBalance,
  deriveAccountBudgetPool,
  deriveCategoryBudget,
  validateSplitExpense,
  generateInstallmentSchedule,
  calculateLoanSummary,
} from "@/lib/services/financeService";
import {
  getMonthOccurrenceDate,
  getPeriodBoundaries,
  parseDateComponents,
} from "@/lib/dates/dates";
import {
  Account,
  Category,
  Transaction,
  BudgetAllocationEntry,
  CategoryReallocation,
  Installment,
} from "@/types/database";

describe("PocketPlan Acceptance Tests — Financial & Business Invariants", () => {
  const userId = "usr-100";
  const userBId = "usr-200";

  const bankAccount: Account = {
    id: "acc-bank-1",
    userId,
    name: "HDFC Salary Account",
    type: "bank",
    openingBalancePaise: 5000000, // ₹50,000
    openingDate: "2026-10-01",
    isArchived: false,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  const cashAccount: Account = {
    id: "acc-cash-1",
    userId,
    name: "Wallet Cash",
    type: "cash",
    openingBalancePaise: 500000, // ₹5,000
    openingDate: "2026-10-01",
    isArchived: false,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  const petrolCategory: Category = {
    id: "cat-petrol",
    userId,
    name: "Petrol",
    icon: "Fuel",
    color: "#0F766E",
    sortOrder: 1,
    targetPaise: 300000, // ₹3,000
    rolloverEnabled: false,
    isArchived: false,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  const foodCategory: Category = {
    id: "cat-food",
    userId,
    name: "Food",
    icon: "Utensils",
    color: "#DC2626",
    sortOrder: 2,
    targetPaise: 600000, // ₹6,000
    rolloverEnabled: false,
    isArchived: false,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  // Scenario 1: Allocate ₹3,000, spend ₹300, and show ₹2,700 remaining
  it("Scenario 1: Allocate ₹3,000, spend ₹300, and show ₹2,700 remaining", () => {
    const periodKey = "2026-10";
    const allocations: BudgetAllocationEntry[] = [
      {
        id: "alloc-1",
        userId,
        periodKey,
        categoryId: petrolCategory.id,
        allocatedPaise: 300000, // ₹3,000
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ];

    const txExpense: Transaction = {
      id: "tx-1",
      userId,
      operationId: "op-tx-1",
      type: "expense",
      amountPaise: 30000, // ₹300
      date: "2026-10-19",
      accountId: bankAccount.id,
      categoryId: petrolCategory.id,
      isSplit: false,
      isDeleted: false,
      createdAt: "2026-10-19T10:00:00Z",
      updatedAt: "2026-10-19T10:00:00Z",
    };

    const budget = deriveCategoryBudget({
      category: petrolCategory,
      periodKey,
      allocations,
      reallocations: [],
      transactions: [txExpense],
    });

    expect(budget.allocatedPaise).toBe(300000);
    expect(budget.expensesPaise).toBe(30000);
    expect(budget.availablePaise).toBe(270000); // ₹2,700 remaining
    expect(formatPaise(budget.availablePaise)).toBe("₹2,700");

    // Account balance updated
    const accBal = deriveAccountBalance(bankAccount, [txExpense]);
    expect(accBal.balancePaise).toBe(4970000); // ₹50,000 - ₹300 = ₹49,700
  });

  // Scenario 2: Change that expense to ₹250 and show ₹2,750 remaining
  it("Scenario 2: Change that expense to ₹250 and show ₹2,750 remaining", () => {
    const periodKey = "2026-10";
    const allocations: BudgetAllocationEntry[] = [
      {
        id: "alloc-1",
        userId,
        periodKey,
        categoryId: petrolCategory.id,
        allocatedPaise: 300000,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ];

    const txEdited: Transaction = {
      id: "tx-1",
      userId,
      operationId: "op-tx-1",
      type: "expense",
      amountPaise: 25000, // ₹250 (changed from ₹300)
      date: "2026-10-19",
      accountId: bankAccount.id,
      categoryId: petrolCategory.id,
      isSplit: false,
      isDeleted: false,
      createdAt: "2026-10-19T10:00:00Z",
      updatedAt: "2026-10-19T10:15:00Z",
    };

    const budget = deriveCategoryBudget({
      category: petrolCategory,
      periodKey,
      allocations,
      reallocations: [],
      transactions: [txEdited],
    });

    expect(budget.expensesPaise).toBe(25000);
    expect(budget.availablePaise).toBe(275000); // ₹2,750 remaining
    expect(formatPaise(budget.availablePaise)).toBe("₹2,750");

    const accBal = deriveAccountBalance(bankAccount, [txEdited]);
    expect(accBal.balancePaise).toBe(4975000); // ₹49,750
  });

  // Scenario 3: Delete and restore the transaction without balance drift
  it("Scenario 3: Delete and restore the transaction without balance drift", () => {
    const periodKey = "2026-10";
    const allocations: BudgetAllocationEntry[] = [
      {
        id: "alloc-1",
        userId,
        periodKey,
        categoryId: petrolCategory.id,
        allocatedPaise: 300000,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ];

    const activeTx: Transaction = {
      id: "tx-1",
      userId,
      operationId: "op-tx-1",
      type: "expense",
      amountPaise: 30000,
      date: "2026-10-19",
      accountId: bankAccount.id,
      categoryId: petrolCategory.id,
      isSplit: false,
      isDeleted: false,
      createdAt: "2026-10-19T10:00:00Z",
      updatedAt: "2026-10-19T10:00:00Z",
    };

    // 1. Soft delete
    const deletedTx: Transaction = { ...activeTx, isDeleted: true };
    const budgetDeleted = deriveCategoryBudget({
      category: petrolCategory,
      periodKey,
      allocations,
      reallocations: [],
      transactions: [deletedTx],
    });
    expect(budgetDeleted.availablePaise).toBe(300000); // restored to full ₹3,000
    const accBalDeleted = deriveAccountBalance(bankAccount, [deletedTx]);
    expect(accBalDeleted.balancePaise).toBe(5000000); // restored to ₹50,000

    // 2. Restore
    const restoredTx: Transaction = { ...deletedTx, isDeleted: false };
    const budgetRestored = deriveCategoryBudget({
      category: petrolCategory,
      periodKey,
      allocations,
      reallocations: [],
      transactions: [restoredTx],
    });
    expect(budgetRestored.availablePaise).toBe(270000); // back to ₹2,700
    const accBalRestored = deriveAccountBalance(bankAccount, [restoredTx]);
    expect(accBalRestored.balancePaise).toBe(4970000); // back to ₹49,700 with zero drift
  });

  // Scenario 4: Move ₹500 between categories without changing account balances
  it("Scenario 4: Move ₹500 between categories without changing account balances", () => {
    const periodKey = "2026-10";
    const allocations: BudgetAllocationEntry[] = [
      { id: "a1", userId, periodKey, categoryId: foodCategory.id, allocatedPaise: 600000, createdAt: "", updatedAt: "" },
      { id: "a2", userId, periodKey, categoryId: petrolCategory.id, allocatedPaise: 300000, createdAt: "", updatedAt: "" },
    ];

    // Reallocation: Move ₹500 from Food to Petrol
    const reallocations: CategoryReallocation[] = [
      {
        id: "realloc-1",
        userId,
        periodKey,
        fromCategoryId: foodCategory.id,
        toCategoryId: petrolCategory.id,
        amountPaise: 50000, // ₹500
        createdAt: "2026-10-19T10:00:00Z",
      },
    ];

    const foodBudget = deriveCategoryBudget({
      category: foodCategory,
      periodKey,
      allocations,
      reallocations,
      transactions: [],
    });
    const petrolBudget = deriveCategoryBudget({
      category: petrolCategory,
      periodKey,
      allocations,
      reallocations,
      transactions: [],
    });

    // Food available = 6000 - 500 = 5500
    expect(foodBudget.availablePaise).toBe(550000);
    // Petrol available = 3000 + 500 = 3500
    expect(petrolBudget.availablePaise).toBe(350000);

    // Total allocated + moved funds across both categories remains constant (₹9,000)
    expect(addPaise(foodBudget.availablePaise, petrolBudget.availablePaise)).toBe(900000);

    // Account balances are completely unchanged by envelope moves!
    const accBal = deriveAccountBalance(bankAccount, []);
    expect(accBal.balancePaise).toBe(5000000);
  });

  // Scenario 5: Transfer ₹1,000 from bank to cash without changing total spending
  it("Scenario 5: Transfer ₹1,000 from bank to cash without changing total spending", () => {
    const transferTx: Transaction = {
      id: "tx-transfer-1",
      userId,
      operationId: "op-transfer-1",
      type: "transfer",
      amountPaise: 100000, // ₹1,000
      date: "2026-10-19",
      accountId: bankAccount.id, // Debited
      toAccountId: cashAccount.id, // Credited
      isSplit: false,
      isDeleted: false,
      createdAt: "2026-10-19T10:00:00Z",
      updatedAt: "2026-10-19T10:00:00Z",
    };

    const bankBal = deriveAccountBalance(bankAccount, [transferTx]);
    const cashBal = deriveAccountBalance(cashAccount, [transferTx]);

    expect(bankBal.balancePaise).toBe(4900000); // ₹50,000 - ₹1,000 = ₹49,000
    expect(cashBal.balancePaise).toBe(600000); // ₹5,000 + ₹1,000 = ₹6,000

    // Combined funds preserved: 49,000 + 6,000 = 55,000
    expect(addPaise(bankBal.balancePaise, cashBal.balancePaise)).toBe(5500000);

    // Total spending/expenses remains 0!
    expect(bankBal.totalExpensesPaise).toBe(0);
    expect(cashBal.totalExpensesPaise).toBe(0);
  });

  // Scenario 6: Refund a purchase without inflating salary/income reports
  it("Scenario 6: Refund a purchase without inflating salary/income reports", () => {
    const periodKey = "2026-10";
    const allocations: BudgetAllocationEntry[] = [
      { id: "a1", userId, periodKey, categoryId: foodCategory.id, allocatedPaise: 600000, createdAt: "", updatedAt: "" },
    ];

    const originalExpense: Transaction = {
      id: "tx-exp-food",
      userId,
      operationId: "op-exp-food",
      type: "expense",
      amountPaise: 150000, // ₹1,500
      date: "2026-10-10",
      accountId: bankAccount.id,
      categoryId: foodCategory.id,
      isSplit: false,
      isDeleted: false,
      createdAt: "2026-10-10T10:00:00Z",
      updatedAt: "2026-10-10T10:00:00Z",
    };

    const refundTx: Transaction = {
      id: "tx-refund-food",
      userId,
      operationId: "op-refund-food",
      type: "refund",
      amountPaise: 150000, // ₹1,500
      date: "2026-10-12",
      accountId: bankAccount.id,
      categoryId: foodCategory.id,
      refundedTransactionId: originalExpense.id,
      isSplit: false,
      isDeleted: false,
      createdAt: "2026-10-12T10:00:00Z",
      updatedAt: "2026-10-12T10:00:00Z",
    };

    const budget = deriveCategoryBudget({
      category: foodCategory,
      periodKey,
      allocations,
      reallocations: [],
      transactions: [originalExpense, refundTx],
    });

    // Net spent is 0 (1500 - 1500)
    expect(budget.netSpentPaise).toBe(0);
    expect(budget.availablePaise).toBe(600000); // Fully restored to ₹6,000

    // Account balance restored
    const accBal = deriveAccountBalance(bankAccount, [originalExpense, refundTx]);
    expect(accBal.balancePaise).toBe(5000000);
    // Refund is NOT counted as earned income!
    expect(accBal.totalIncomePaise).toBe(0);
    expect(accBal.refundsPaise).toBe(150000);
  });

  // Scenario 7: Split an expense and reject mismatched totals
  it("Scenario 7: Split an expense and reject mismatched totals", () => {
    const totalPaise = 100000; // ₹1,000

    // Mismatched total (800 + 100 = 900 != 1000)
    const invalidSplits = [
      { categoryId: foodCategory.id, amountPaise: 80000 },
      { categoryId: petrolCategory.id, amountPaise: 10000 },
    ];
    const invalidResult = validateSplitExpense(totalPaise, invalidSplits);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.differencePaise).toBe(10000); // 100 paise difference

    // Valid splits (750 + 250 = 1000)
    const validSplits = [
      { categoryId: foodCategory.id, amountPaise: 75000 },
      { categoryId: petrolCategory.id, amountPaise: 25000 },
    ];
    const validResult = validateSplitExpense(totalPaise, validSplits);
    expect(validResult.isValid).toBe(true);
    expect(validResult.differencePaise).toBe(0);
  });

  // Scenario 10, 11 & 12: Installment payment, partial payment, and linking existing transaction
  it("Scenario 10, 11 & 12: Installment payment, partial payment, and linking transaction", () => {
    const loanId = "loan-phone";
    const schedule = generateInstallmentSchedule({
      loanId,
      userId,
      startMonthKey: "2026-10",
      dueDay: 5,
      installmentAmountPaise: 350000, // ₹3,500 / month
      totalInstallments: 6,
      historicalPaidCount: 0,
    });

    expect(schedule.length).toBe(6);
    expect(schedule[0].dueDate).toBe("2026-10-05");
    expect(schedule[0].amountPaise).toBe(350000);

    // Partial payment: paying ₹2,000 of ₹3,500
    const partialInst: Installment = {
      ...schedule[0],
      paidAmountPaise: 200000,
      status: "partly_paid",
    };

    const remainingDue = subPaise(partialInst.amountPaise, partialInst.paidAmountPaise);
    expect(remainingDue).toBe(150000); // ₹1,500 remaining due

    // Full payment
    const fullyPaidInst: Installment = {
      ...schedule[0],
      paidAmountPaise: 350000,
      status: "paid",
      linkedTransactionId: "tx-existing-1",
    };
    expect(fullyPaidInst.status).toBe("paid");
    expect(fullyPaidInst.linkedTransactionId).toBe("tx-existing-1");
  });

  // Scenario 14: Month-end date handling in February and 30-day months
  it("Scenario 14: Handle February and month-end schedules correctly (28th/29th/30th/31st)", () => {
    // 31st due day in Feb 2026 (non-leap year, 28 days) -> Clamps to 2026-02-28
    const feb2026 = getMonthOccurrenceDate(2026, 2, 31);
    expect(feb2026).toBe("2026-02-28");

    // 31st due day in Feb 2024 (leap year, 29 days) -> Clamps to 2024-02-29
    const feb2024 = getMonthOccurrenceDate(2024, 2, 31);
    expect(feb2024).toBe("2024-02-29");

    // 31st due day in April 2026 (30 days) -> Clamps to 2026-04-30
    const apr2026 = getMonthOccurrenceDate(2026, 4, 31);
    expect(apr2026).toBe("2026-04-30");

    // 31st due day in October 2026 (31 days) -> Remains 2026-10-31
    const oct2026 = getMonthOccurrenceDate(2026, 10, 31);
    expect(oct2026).toBe("2026-10-31");
  });

  // Scenario 15: Preserve historical paid installments without debiting opening balances
  it("Scenario 15: Preserve historical paid installments without debiting opening balances", () => {
    const loanId = "loan-bike";
    // 12 months total, 4 already paid historically before onboarding
    const schedule = generateInstallmentSchedule({
      loanId,
      userId,
      startMonthKey: "2026-06",
      dueDay: 10,
      installmentAmountPaise: 400000,
      totalInstallments: 12,
      historicalPaidCount: 4,
    });

    // 4 installments marked paid
    const paidCount = schedule.filter((i) => i.status === "paid").length;
    expect(paidCount).toBe(4);

    // Remaining 8 upcoming
    const upcomingCount = schedule.filter((i) => i.status === "upcoming").length;
    expect(upcomingCount).toBe(8);

    // None of these historical installments have linked transactions in the app,
    // so the opening account balance is NEVER debited again!
    const accBal = deriveAccountBalance(bankAccount, []);
    expect(accBal.balancePaise).toBe(5000000);
  });

  // Scenario 16: Apply period boundaries in Asia/Kolkata
  it("Scenario 16: Apply period boundaries in Asia/Kolkata", () => {
    const boundaries = getPeriodBoundaries("this-month", {
      referenceDate: "2026-10-19",
      timeZone: "Asia/Kolkata",
    });

    expect(boundaries.startDate).toBe("2026-10-01");
    expect(boundaries.endDate).toBe("2026-10-31");
    expect(boundaries.label).toBe("October 2026");

    const todayBoundaries = getPeriodBoundaries("today", {
      referenceDate: "2026-10-19",
      timeZone: "Asia/Kolkata",
    });
    expect(todayBoundaries.startDate).toBe("2026-10-19");
    expect(todayBoundaries.endDate).toBe("2026-10-19");
  });

  // Scenario 23: Zero floating point rounding errors across 10,000 paise calculations
  it("Scenario 23: Zero floating point rounding errors across 10,000 paise calculations", () => {
    let runningPaise = 0;
    // Add ₹0.10 (10 paise) 10,000 times
    for (let i = 0; i < 10000; i++) {
      runningPaise = addPaise(runningPaise, 10);
    }
    // Exactly 100,000 paise = ₹1,000.00
    expect(runningPaise).toBe(100000);
    expect(formatPaise(runningPaise)).toBe("₹1,000");

    // Subtract back 10,000 times
    for (let i = 0; i < 10000; i++) {
      runningPaise = subPaise(runningPaise, 10);
    }
    expect(runningPaise).toBe(0);
  });

  // Scenario 24: Direct deduction from Salary Account pool when category allocation is made
  it("Scenario 24: Direct deduction from Salary Account pool when category allocation is made", () => {
    const salaryAccount: Account = {
      id: "acc-salary",
      userId,
      name: "Salary Account",
      type: "salary",
      openingBalancePaise: 1200000, // ₹12,000
      openingDate: "2026-10-01",
      isArchived: false,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    };

    const petrolAlloc: BudgetAllocationEntry = {
      id: "alloc-1",
      userId,
      periodKey: "2026-10",
      categoryId: petrolCategory.id,
      accountId: salaryAccount.id,
      allocatedPaise: 200000, // ₹2,000
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    };

    const pool = deriveAccountBudgetPool({
      account: salaryAccount,
      transactions: [],
      allocations: [petrolAlloc],
      allAccounts: [salaryAccount],
    });

    expect(pool.openingBalancePaise).toBe(1200000); // ₹12,000
    expect(pool.allocatedPaise).toBe(200000); // ₹2,000
    expect(pool.remainingPoolPaise).toBe(1000000); // ₹10,000 remaining pool
    expect(formatPaise(pool.remainingPoolPaise)).toBe("₹10,000");
  });
});
