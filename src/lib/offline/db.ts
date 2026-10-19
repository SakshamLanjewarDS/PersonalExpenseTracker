import Dexie, { type Table } from "dexie";
import {
  Account,
  Category,
  BudgetAllocationEntry,
  Transaction,
  PaymentOccurrence,
  Loan,
  Installment,
  OfflineMutationQueueItem,
  CategoryReallocation,
} from "@/types/database";

export class PocketPlanDexieDB extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  allocations!: Table<BudgetAllocationEntry, string>;
  reallocations!: Table<CategoryReallocation, string>;
  transactions!: Table<Transaction, string>;
  occurrences!: Table<PaymentOccurrence, string>;
  loans!: Table<Loan, string>;
  installments!: Table<Installment, string>;
  mutationQueue!: Table<OfflineMutationQueueItem, string>;

  constructor() {
    super("PocketPlanDB");

    this.version(1).stores({
      accounts: "id, userId, type, isArchived",
      categories: "id, userId, sortOrder, isArchived",
      allocations: "id, userId, periodKey, categoryId, [userId+periodKey]",
      reallocations: "id, userId, periodKey, fromCategoryId, toCategoryId",
      transactions: "id, userId, operationId, date, accountId, categoryId, type, isDeleted, [userId+date]",
      occurrences: "id, userId, periodKey, expectedDate, status, ruleId, loanId",
      loans: "id, userId, isClosed",
      installments: "id, userId, loanId, periodKey, dueDate, status",
      mutationQueue: "id, operationId, userId, action, syncStatus, createdAt",
    });
  }
}

export const offlineDB = new PocketPlanDexieDB();
