/**
 * PocketPlan Database & Domain Model Types
 * All amounts are integer Paise.
 */

import { Paise } from "@/lib/money/paise";

export type AccountType = "salary" | "savings" | "cash" | "bank";
export type PaymentMethod = "cash" | "upi" | "debit_card" | "bank_transfer";
export type TransactionType = "expense" | "income" | "transfer" | "refund";
export type OccurrenceStatus = "upcoming" | "due" | "overdue" | "partly_paid" | "paid" | "skipped" | "cancelled";
export type RecurringFrequency = "monthly" | "weekly" | "yearly" | "quarterly";

export interface Profile {
  id: string; // auth.users UUID
  displayName: string;
  currency: string; // default "INR"
  locale: string; // default "en-IN"
  timeZone: string; // default "Asia/Kolkata"
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  openingBalancePaise: Paise;
  openingDate: string; // YYYY-MM-DD
  description?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon: string; // Lucide icon name, e.g. "Fuel", "Home", "Zap", "Utensils"
  color: string; // Hex color code
  sortOrder: number;
  targetPaise: Paise; // Desired monthly target
  rolloverEnabled: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAllocationEntry {
  id: string;
  userId: string;
  periodKey: string; // YYYY-MM
  categoryId: string;
  allocatedPaise: Paise;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryReallocation {
  id: string;
  userId: string;
  periodKey: string; // YYYY-MM
  fromCategoryId: string;
  toCategoryId: string;
  amountPaise: Paise;
  reason?: string;
  createdAt: string;
}

export interface TransactionSplit {
  id: string;
  transactionId: string;
  categoryId: string;
  amountPaise: Paise;
  note?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  operationId: string; // Client-side UUID for idempotency
  type: TransactionType;
  amountPaise: Paise; // Always positive integer
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  accountId: string; // Source account (for expense, transfer, income, refund)
  toAccountId?: string; // Target account (for transfer only)
  categoryId?: string; // Category for expense or refund (nullable for transfers or split parent)
  paymentMethod?: PaymentMethod;
  merchant?: string;
  note?: string;
  isSplit: boolean;
  refundedTransactionId?: string; // For refunds
  linkedInstallmentId?: string; // For EMI payment linking
  linkedOccurrenceId?: string; // For recurring bill linking
  receiptUrl?: string;
  isDeleted: boolean; // Soft delete
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  userId: string;
  name: string;
  categoryId: string;
  expectedAmountPaise: Paise;
  frequency: RecurringFrequency;
  dueDay: number; // 1-31
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  preferredAccountId?: string;
  preferredPaymentMethod?: PaymentMethod;
  reminderDaysBefore: number; // e.g. 1 or 2 days
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOccurrence {
  id: string;
  userId: string;
  ruleId?: string; // Linked recurring rule
  loanId?: string; // Linked loan/installment plan
  name: string;
  categoryId: string;
  periodKey: string; // YYYY-MM
  expectedDate: string; // YYYY-MM-DD
  expectedAmountPaise: Paise;
  actualAmountPaise?: Paise;
  status: OccurrenceStatus;
  linkedTransactionId?: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  userId: string;
  name: string;
  lender: string;
  installmentAmountPaise: Paise;
  totalInstallments: number;
  historicalPaidCount: number; // Installments paid prior to app tracking
  startMonthKey: string; // YYYY-MM
  dueDay: number; // 1-31
  preferredAccountId?: string;
  linkedCategoryId: string;
  principalPaise?: Paise;
  interestRateAnnual?: number;
  referenceNumber?: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: string;
  userId: string;
  loanId: string;
  installmentNumber: number; // 1 to totalInstallments
  periodKey: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  amountPaise: Paise;
  status: OccurrenceStatus;
  paidAmountPaise: Paise;
  linkedTransactionId?: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineMutationQueueItem {
  id: string; // local client UUID
  operationId: string;
  userId: string;
  action: "create_transaction" | "update_transaction" | "delete_transaction" | "allocate_budget" | "move_budget";
  payload: Record<string, unknown>;
  createdAt: number; // timestamp ms
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  retryCount: number;
  errorMessage?: string;
}
