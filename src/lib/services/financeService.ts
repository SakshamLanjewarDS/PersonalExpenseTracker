/**
 * PocketPlan Financial Core Service
 * Shared, deterministic financial operations and invariants.
 */

import {
  Account,
  Category,
  BudgetAllocationEntry,
  CategoryReallocation,
  Transaction,
  TransactionSplit,
  PaymentOccurrence,
  Loan,
  Installment,
  OccurrenceStatus,
} from "@/types/database";
import {
  Paise,
  addPaise,
  subPaise,
  assertValidPaise,
  calculateAvailableBudget,
} from "@/lib/money/paise";
import { getMonthOccurrenceDate, parseDateComponents } from "@/lib/dates/dates";

/**
 * Standard Default Categories for PocketPlan (INR / Indian Persona)
 */
export const DEFAULT_CATEGORIES: Omit<Category, "id" | "userId" | "createdAt" | "updatedAt">[] = [
  { name: "Petrol & Fuel", icon: "Fuel", color: "#0F766E", sortOrder: 1, targetPaise: 300000, rolloverEnabled: false, isArchived: false },
  { name: "Room Rent", icon: "Home", color: "#2563EB", sortOrder: 2, targetPaise: 1200000, rolloverEnabled: false, isArchived: false },
  { name: "Electricity", icon: "Zap", color: "#D97706", sortOrder: 3, targetPaise: 150000, rolloverEnabled: false, isArchived: false },
  { name: "Food & Dining", icon: "Utensils", color: "#DC2626", sortOrder: 4, targetPaise: 600000, rolloverEnabled: false, isArchived: false },
  { name: "Groceries", icon: "ShoppingCart", color: "#16A34A", sortOrder: 5, targetPaise: 500000, rolloverEnabled: false, isArchived: false },
  { name: "Mobile & Recharge", icon: "Smartphone", color: "#7C3AED", sortOrder: 6, targetPaise: 80000, rolloverEnabled: false, isArchived: false },
  { name: "Shopping", icon: "ShoppingBag", color: "#DB2777", sortOrder: 7, targetPaise: 200000, rolloverEnabled: false, isArchived: false },
  { name: "Health & Medical", icon: "HeartPulse", color: "#EA580C", sortOrder: 8, targetPaise: 100000, rolloverEnabled: true, isArchived: false },
  { name: "Travel & Commute", icon: "Bus", color: "#0284C7", sortOrder: 9, targetPaise: 150000, rolloverEnabled: false, isArchived: false },
  { name: "EMI & Loans", icon: "CreditCard", color: "#475569", sortOrder: 10, targetPaise: 500000, rolloverEnabled: false, isArchived: false },
  { name: "Other", icon: "MoreHorizontal", color: "#64748B", sortOrder: 11, targetPaise: 100000, rolloverEnabled: false, isArchived: false },
];

/**
 * Derives current Account Balance from opening balance and active transactions.
 * Strict rules:
 * - Expense: subtracts from account
 * - Income: adds to account
 * - Transfer: subtracts from accountId, adds to toAccountId
 * - Refund: adds back to accountId
 * - Deleted transactions (isDeleted = true) are excluded
 */
export function deriveAccountBalance(
  account: Account,
  transactions: Transaction[]
): {
  balancePaise: Paise;
  totalExpensesPaise: Paise;
  totalIncomePaise: Paise;
  transfersInPaise: Paise;
  transfersOutPaise: Paise;
  refundsPaise: Paise;
} {
  let balance = account.openingBalancePaise;
  let totalExpenses = 0;
  let totalIncome = 0;
  let transfersIn = 0;
  let transfersOut = 0;
  let refunds = 0;

  for (const tx of transactions) {
    if (tx.isDeleted) continue;

    if (tx.type === "expense" && tx.accountId === account.id) {
      balance = subPaise(balance, tx.amountPaise);
      totalExpenses = addPaise(totalExpenses, tx.amountPaise);
    } else if (tx.type === "income" && tx.accountId === account.id) {
      balance = addPaise(balance, tx.amountPaise);
      totalIncome = addPaise(totalIncome, tx.amountPaise);
    } else if (tx.type === "refund" && tx.accountId === account.id) {
      balance = addPaise(balance, tx.amountPaise);
      refunds = addPaise(refunds, tx.amountPaise);
    } else if (tx.type === "transfer") {
      if (tx.accountId === account.id) {
        balance = subPaise(balance, tx.amountPaise);
        transfersOut = addPaise(transfersOut, tx.amountPaise);
      }
      if (tx.toAccountId === account.id) {
        balance = addPaise(balance, tx.amountPaise);
        transfersIn = addPaise(transfersIn, tx.amountPaise);
      }
    }
  }

  return {
    balancePaise: balance,
    totalExpensesPaise: totalExpenses,
    totalIncomePaise: totalIncome,
    transfersInPaise: transfersIn,
    transfersOutPaise: transfersOut,
    refundsPaise: refunds,
  };
}

/**
 * Calculates Category Budget Summary for a specific period (e.g. "2026-10")
 * Factors in:
 * - Direct allocations
 * - Reallocations (moves in/out)
 * - Expenses attributed to this category (including splits!)
 * - Refunds attributed to this category
 * - Optional rollover from previous period
 */
export function deriveCategoryBudget(params: {
  category: Category;
  periodKey: string;
  allocations: BudgetAllocationEntry[];
  reallocations: CategoryReallocation[];
  transactions: Transaction[];
  splits?: TransactionSplit[];
  openingRolloverPaise?: Paise;
}): {
  targetPaise: Paise;
  allocatedPaise: Paise;
  netReallocationsPaise: Paise;
  expensesPaise: Paise;
  refundsPaise: Paise;
  netSpentPaise: Paise;
  availablePaise: Paise;
  isOverspent: boolean;
} {
  const {
    category,
    periodKey,
    allocations,
    reallocations,
    transactions,
    splits = [],
    openingRolloverPaise = 0,
  } = params;

  // 1. Direct allocation for this period
  const allocEntry = allocations.find(
    (a) => a.categoryId === category.id && a.periodKey === periodKey
  );
  const allocatedPaise = allocEntry ? allocEntry.allocatedPaise : 0;

  // 2. Net reallocations (moves in minus moves out)
  let reallocIn = 0;
  let reallocOut = 0;
  for (const r of reallocations) {
    if (r.periodKey !== periodKey) continue;
    if (r.toCategoryId === category.id) {
      reallocIn = addPaise(reallocIn, r.amountPaise);
    }
    if (r.fromCategoryId === category.id) {
      reallocOut = addPaise(reallocOut, r.amountPaise);
    }
  }
  const netReallocationsPaise = subPaise(reallocIn, reallocOut);

  // 3. Transactions in this period
  let expensesPaise = 0;
  let refundsPaise = 0;

  // Pre-index splits by transaction ID
  const splitMap = new Map<string, TransactionSplit[]>();
  for (const s of splits) {
    const list = splitMap.get(s.transactionId) || [];
    list.push(s);
    splitMap.set(s.transactionId, list);
  }

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    if (!tx.date.startsWith(periodKey)) continue;

    if (tx.isSplit) {
      // Split attribution
      const txSplits = splitMap.get(tx.id) || [];
      for (const sp of txSplits) {
        if (sp.categoryId === category.id) {
          if (tx.type === "expense") {
            expensesPaise = addPaise(expensesPaise, sp.amountPaise);
          } else if (tx.type === "refund") {
            refundsPaise = addPaise(refundsPaise, sp.amountPaise);
          }
        }
      }
    } else {
      // Direct category attribution
      if (tx.categoryId === category.id) {
        if (tx.type === "expense") {
          expensesPaise = addPaise(expensesPaise, tx.amountPaise);
        } else if (tx.type === "refund") {
          refundsPaise = addPaise(refundsPaise, tx.amountPaise);
        }
      }
    }
  }

  const { availablePaise, netSpentPaise, isOverspent } = calculateAvailableBudget({
    openingRolloverPaise,
    allocatedPaise,
    netReallocationsPaise,
    expensesPaise,
    refundsPaise,
  });

  return {
    targetPaise: category.targetPaise,
    allocatedPaise,
    netReallocationsPaise,
    expensesPaise,
    refundsPaise,
    netSpentPaise,
    availablePaise,
    isOverspent,
  };
}

/**
 * Validates a Split Expense:
 * 1. Must have at least 2 splits
 * 2. Sum of split amounts must exactly equal transaction amount
 */
export function validateSplitExpense(
  totalAmountPaise: Paise,
  splits: { categoryId: string; amountPaise: Paise }[]
): { isValid: boolean; differencePaise: Paise; error?: string } {
  assertValidPaise(totalAmountPaise, "Total amount");
  if (!splits || splits.length < 2) {
    return {
      isValid: false,
      differencePaise: totalAmountPaise,
      error: "Split expenses must contain at least two categories.",
    };
  }

  let splitSum = 0;
  for (const s of splits) {
    assertValidPaise(s.amountPaise, "Split amount");
    if (s.amountPaise <= 0) {
      return {
        isValid: false,
        differencePaise: 0,
        error: "Each split amount must be greater than zero.",
      };
    }
    splitSum = addPaise(splitSum, s.amountPaise);
  }

  const differencePaise = subPaise(totalAmountPaise, splitSum);
  if (differencePaise !== 0) {
    return {
      isValid: false,
      differencePaise,
      error: `Sum of splits (₹${(splitSum / 100).toFixed(2)}) must equal total transaction (₹${(totalAmountPaise / 100).toFixed(2)}). Difference: ₹${(differencePaise / 100).toFixed(2)}`,
    };
  }

  return { isValid: true, differencePaise: 0 };
}

/**
 * Generates Installment Schedule for an EMI / Loan plan.
 * Preserves historical paid installments without re-debiting opening account balance.
 */
export function generateInstallmentSchedule(params: {
  loanId: string;
  userId: string;
  startMonthKey: string; // YYYY-MM
  dueDay: number;
  installmentAmountPaise: Paise;
  totalInstallments: number;
  historicalPaidCount: number;
}): Installment[] {
  const {
    loanId,
    userId,
    startMonthKey,
    dueDay,
    installmentAmountPaise,
    totalInstallments,
    historicalPaidCount,
  } = params;

  const installments: Installment[] = [];
  const [startYearStr, startMonthStr] = startMonthKey.split("-");
  const startYear = parseInt(startYearStr, 10);
  const startMonth = parseInt(startMonthStr, 10);

  for (let i = 1; i <= totalInstallments; i++) {
    // Calculate month for installment i
    let currentMonth = startMonth + (i - 1);
    let currentYear = startYear;
    while (currentMonth > 12) {
      currentYear += 1;
      currentMonth -= 12;
    }

    const periodKey = `${currentYear}-${currentMonth.toString().padStart(2, "0")}`;
    const dueDate = getMonthOccurrenceDate(currentYear, currentMonth, dueDay);

    const isHistorical = i <= historicalPaidCount;

    installments.push({
      id: `inst-${loanId}-${i}`,
      userId,
      loanId,
      installmentNumber: i,
      periodKey,
      dueDate,
      amountPaise: installmentAmountPaise,
      status: isHistorical ? "paid" : "upcoming",
      paidAmountPaise: isHistorical ? installmentAmountPaise : 0,
      paidDate: isHistorical ? dueDate : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return installments;
}

/**
 * Calculates loan summary metrics:
 * - Paid count & amount
 * - Remaining count & amount
 * - Next due date & amount
 * - Overdue amount
 */
export function calculateLoanSummary(
  loan: Loan,
  installments: Installment[],
  referenceDateStr: string
): {
  paidCount: number;
  paidAmountPaise: Paise;
  remainingCount: number;
  remainingAmountPaise: Paise;
  overdueAmountPaise: Paise;
  nextDueInstallment?: Installment;
} {
  let paidCount = 0;
  let paidAmountPaise = 0;
  let remainingCount = 0;
  let remainingAmountPaise = 0;
  let overdueAmountPaise = 0;
  let nextDueInstallment: Installment | undefined;

  for (const inst of installments) {
    if (inst.status === "paid") {
      paidCount += 1;
      paidAmountPaise = addPaise(paidAmountPaise, inst.paidAmountPaise);
    } else {
      remainingCount += 1;
      const unpaid = subPaise(inst.amountPaise, inst.paidAmountPaise);
      remainingAmountPaise = addPaise(remainingAmountPaise, unpaid);

      if (inst.dueDate < referenceDateStr) {
        overdueAmountPaise = addPaise(overdueAmountPaise, unpaid);
      }

      if (!nextDueInstallment && inst.dueDate >= referenceDateStr) {
        nextDueInstallment = inst;
      }
    }
  }

  return {
    paidCount,
    paidAmountPaise,
    remainingCount,
    remainingAmountPaise,
    overdueAmountPaise,
    nextDueInstallment,
  };
}
