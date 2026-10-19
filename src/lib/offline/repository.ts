/**
 * PocketPlan Offline-First Local Repository
 * Implements deterministic Dexie storage, idempotency, envelope budgeting,
 * recurring scheduling, and CSV/JSON backup/restore.
 */

import { offlineDB } from "./db";
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
  OfflineMutationQueueItem,
  RecurringRule,
} from "@/types/database";
import { Paise, addPaise, subPaise, assertValidPaise } from "@/lib/money/paise";
import {
  DEFAULT_CATEGORIES,
  generateInstallmentSchedule,
  validateSplitExpense,
} from "@/lib/services/financeService";
import {
  getMonthOccurrenceDate,
  getCurrentMonthKey,
  getTodayDateString,
} from "@/lib/dates/dates";

export class FinanceRepository {
  /**
   * Initializes starter categories and default cash & bank accounts if empty
   */
  static async initUserStarterData(userId: string): Promise<void> {
    const existingCats = await offlineDB.categories.where("userId").equals(userId).count();
    if (existingCats === 0) {
      const now = new Date().toISOString();
      const categoriesToInsert: Category[] = DEFAULT_CATEGORIES.map((cat, idx) => ({
        ...cat,
        id: `cat-${userId}-${idx + 1}`,
        userId,
        createdAt: now,
        updatedAt: now,
      }));
      await offlineDB.categories.bulkAdd(categoriesToInsert);
    }

    const existingAccs = await offlineDB.accounts.where("userId").equals(userId).count();
    if (existingAccs === 0) {
      const now = new Date().toISOString();
      const today = getTodayDateString();
      const defaultAccounts: Account[] = [
        {
          id: `acc-salary-${userId}`,
          userId,
          name: "Salary Account",
          type: "salary",
          openingBalancePaise: 1200000, // ₹12,000 fixed salary pool
          openingDate: today,
          description: "Monthly salary wallet / primary account",
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `acc-savings-${userId}`,
          userId,
          name: "Savings Account",
          type: "savings",
          openingBalancePaise: 0, // ₹0 opening savings
          openingDate: today,
          description: "Personal savings & emergency fund",
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `acc-cash-${userId}`,
          userId,
          name: "Cash Wallet",
          type: "cash",
          openingBalancePaise: 0, // ₹0 opening cash
          openingDate: today,
          description: "Physical cash in wallet",
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        },
      ];
      await offlineDB.accounts.bulkAdd(defaultAccounts);
    }
  }

  // --- ACCOUNTS ---

  static async getAccounts(userId: string): Promise<Account[]> {
    return offlineDB.accounts.where("userId").equals(userId).toArray();
  }

  static async createAccount(account: Account): Promise<Account> {
    assertValidPaise(account.openingBalancePaise, "Opening balance");
    await offlineDB.accounts.put(account);
    return account;
  }

  static async saveAccount(account: Account): Promise<Account> {
    return this.createAccount(account);
  }

  static async updateAccount(account: Account): Promise<Account>;
  static async updateAccount(
    userId: string,
    accountId: string,
    updates: Partial<Account>
  ): Promise<Account | null>;
  static async updateAccount(
    accountOrUserId: Account | string,
    accountId?: string,
    updates?: Partial<Account>
  ): Promise<Account | null> {
    if (typeof accountOrUserId === "string") {
      if (!accountId || !updates) return null;
      const existing = await offlineDB.accounts.get(accountId);
      if (!existing || existing.userId !== accountOrUserId) return null;
      const updated: Account = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      if (updated.openingBalancePaise !== undefined) {
        assertValidPaise(updated.openingBalancePaise, "Opening balance");
      }
      await offlineDB.accounts.put(updated);
      return updated;
    } else {
      const account = accountOrUserId;
      assertValidPaise(account.openingBalancePaise, "Opening balance");
      account.updatedAt = new Date().toISOString();
      await offlineDB.accounts.put(account);
      return account;
    }
  }

  static async deleteAccount(userId: string, accountId: string): Promise<void> {
    const acc = await offlineDB.accounts.get(accountId);
    if (acc && acc.userId === userId) {
      await offlineDB.accounts.delete(accountId);
    }
  }

  static async clearAllUserData(userId: string): Promise<void> {
    await offlineDB.transaction(
      "rw",
      [
        offlineDB.accounts,
        offlineDB.categories,
        offlineDB.allocations,
        offlineDB.reallocations,
        offlineDB.transactions,
        offlineDB.loans,
        offlineDB.installments,
        offlineDB.occurrences,
        offlineDB.mutationQueue,
      ],
      async () => {
        await offlineDB.transactions.where("userId").equals(userId).delete();
        await offlineDB.allocations.where("userId").equals(userId).delete();
        await offlineDB.reallocations.where("userId").equals(userId).delete();
        await offlineDB.loans.where("userId").equals(userId).delete();
        await offlineDB.installments.where("userId").equals(userId).delete();
        await offlineDB.occurrences.where("userId").equals(userId).delete();
        await offlineDB.mutationQueue.where("userId").equals(userId).delete();
        const accs = await offlineDB.accounts.where("userId").equals(userId).toArray();
        for (const a of accs) {
          a.openingBalancePaise = 0;
          await offlineDB.accounts.put(a);
        }
      }
    );
  }

  static async wipeEverythingClean(userId: string): Promise<void> {
    await offlineDB.transaction(
      "rw",
      [
        offlineDB.accounts,
        offlineDB.categories,
        offlineDB.allocations,
        offlineDB.reallocations,
        offlineDB.transactions,
        offlineDB.loans,
        offlineDB.installments,
        offlineDB.occurrences,
        offlineDB.mutationQueue,
      ],
      async () => {
        await offlineDB.accounts.where("userId").equals(userId).delete();
        await offlineDB.categories.where("userId").equals(userId).delete();
        await offlineDB.transactions.where("userId").equals(userId).delete();
        await offlineDB.allocations.where("userId").equals(userId).delete();
        await offlineDB.reallocations.where("userId").equals(userId).delete();
        await offlineDB.loans.where("userId").equals(userId).delete();
        await offlineDB.installments.where("userId").equals(userId).delete();
        await offlineDB.occurrences.where("userId").equals(userId).delete();
        await offlineDB.mutationQueue.where("userId").equals(userId).delete();
      }
    );
  }

  // --- CATEGORIES ---

  static async getCategories(userId: string): Promise<Category[]> {
    const cats = await offlineDB.categories.where("userId").equals(userId).toArray();
    return cats.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  static async createCategory(category: Category): Promise<Category> {
    assertValidPaise(category.targetPaise, "Category target");
    await offlineDB.categories.put(category);
    return category;
  }

  static async updateCategory(category: Category): Promise<Category> {
    assertValidPaise(category.targetPaise, "Category target");
    category.updatedAt = new Date().toISOString();
    await offlineDB.categories.put(category);
    return category;
  }

  // --- BUDGET ALLOCATIONS & REALLOCATIONS ---

  static async getAllocations(userId: string, periodKey: string): Promise<BudgetAllocationEntry[]> {
    return offlineDB.allocations
      .where("userId")
      .equals(userId)
      .filter((a) => a.periodKey === periodKey)
      .toArray();
  }

  static async allocateBudget(params: {
    userId: string;
    periodKey: string;
    categoryId: string;
    accountId?: string;
    allocatedPaise?: Paise;
    allocatedAmountPaise?: Paise;
    notes?: string;
  }): Promise<BudgetAllocationEntry> {
    const allocatedPaise =
      params.allocatedPaise !== undefined
        ? params.allocatedPaise
        : params.allocatedAmountPaise !== undefined
        ? params.allocatedAmountPaise
        : 0;
    const { userId, periodKey, categoryId, accountId, notes } = params;
    assertValidPaise(allocatedPaise, "Allocated paise");

    const existing = await offlineDB.allocations
      .where("userId")
      .equals(userId)
      .filter((a) => a.periodKey === periodKey && a.categoryId === categoryId)
      .first();

    const now = new Date().toISOString();
    const entry: BudgetAllocationEntry = {
      id: existing ? existing.id : `alloc-${userId}-${periodKey}-${categoryId}`,
      userId,
      periodKey,
      categoryId,
      accountId: accountId !== undefined ? accountId : existing?.accountId,
      allocatedPaise,
      notes: notes !== undefined ? notes : existing?.notes,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    await offlineDB.allocations.put(entry);
    return entry;
  }

  static async setAllocation(params: {
    userId: string;
    periodKey: string;
    categoryId: string;
    accountId?: string;
    allocatedPaise?: Paise;
    allocatedAmountPaise?: Paise;
    notes?: string;
  }): Promise<BudgetAllocationEntry> {
    return this.allocateBudget(params);
  }

  static async getReallocations(userId: string, periodKey: string): Promise<CategoryReallocation[]> {
    return offlineDB.reallocations
      .where("userId")
      .equals(userId)
      .filter((r) => r.periodKey === periodKey)
      .toArray();
  }

  static async moveBudget(params: {
    userId: string;
    periodKey: string;
    fromCategoryId: string;
    toCategoryId: string;
    amountPaise: Paise;
    reason?: string;
  }): Promise<CategoryReallocation> {
    const { userId, periodKey, fromCategoryId, toCategoryId, amountPaise, reason } = params;
    assertValidPaise(amountPaise, "Move amount");
    if (amountPaise <= 0) {
      throw new Error("Move amount must be greater than zero");
    }
    if (fromCategoryId === toCategoryId) {
      throw new Error("Cannot move money to the same category");
    }

    const realloc: CategoryReallocation = {
      id: `realloc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      periodKey,
      fromCategoryId,
      toCategoryId,
      amountPaise,
      reason,
      createdAt: new Date().toISOString(),
    };

    await offlineDB.reallocations.put(realloc);
    return realloc;
  }

  // --- TRANSACTIONS (IDEMPOTENT) ---

  static async getTransactions(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      accountId?: string;
      type?: string;
      searchQuery?: string;
      includeDeleted?: boolean;
    }
  ): Promise<Transaction[]> {
    let items = await offlineDB.transactions.where("userId").equals(userId).toArray();

    if (!filters?.includeDeleted) {
      items = items.filter((t) => !t.isDeleted);
    }

    if (filters?.startDate) {
      items = items.filter((t) => t.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      items = items.filter((t) => t.date <= filters.endDate!);
    }
    if (filters?.categoryId) {
      items = items.filter((t) => t.categoryId === filters.categoryId);
    }
    if (filters?.accountId) {
      items = items.filter(
        (t) => t.accountId === filters.accountId || t.toAccountId === filters.accountId
      );
    }
    if (filters?.type) {
      items = items.filter((t) => t.type === filters.type);
    }
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      items = items.filter(
        (t) =>
          (t.merchant && t.merchant.toLowerCase().includes(q)) ||
          (t.note && t.note.toLowerCase().includes(q))
      );
    }

    // Sort stable: date descending, then createdAt descending
    return items.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  /**
   * Idempotent Transaction Creation
   * If a transaction with the same operationId already exists for this user,
   * returns the existing record without creating a duplicate!
   */
  static async recordTransaction(
    tx: Omit<Transaction, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): Promise<{ transaction: Transaction; isDuplicate: boolean }> {
    assertValidPaise(tx.amountPaise, "Transaction amount");
    if (tx.amountPaise <= 0) {
      throw new Error("Transaction amount must be greater than zero paise");
    }

    // Check idempotency by operationId
    const existing = await offlineDB.transactions
      .where("userId")
      .equals(tx.userId)
      .filter((t) => t.operationId === tx.operationId)
      .first();

    if (existing) {
      return { transaction: existing, isDuplicate: true };
    }

    const now = new Date().toISOString();
    const id = tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newTx: Transaction = {
      ...tx,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await offlineDB.transactions.put(newTx);

    // Enqueue for background sync if needed
    await offlineDB.mutationQueue.put({
      id: `queue-${newTx.id}`,
      operationId: newTx.operationId,
      userId: newTx.userId,
      action: "create_transaction",
      payload: newTx as unknown as Record<string, unknown>,
      createdAt: Date.now(),
      syncStatus: "pending",
      retryCount: 0,
    });

    return { transaction: newTx, isDuplicate: false };
  }

  static async updateTransaction(tx: Transaction): Promise<Transaction> {
    assertValidPaise(tx.amountPaise, "Transaction amount");
    tx.updatedAt = new Date().toISOString();
    await offlineDB.transactions.put(tx);
    return tx;
  }

  static async softDeleteTransaction(userId: string, txId: string): Promise<void> {
    const tx = await offlineDB.transactions.get(txId);
    if (tx && tx.userId === userId) {
      tx.isDeleted = true;
      tx.updatedAt = new Date().toISOString();
      await offlineDB.transactions.put(tx);
    }
  }

  static async restoreTransaction(userId: string, txId: string): Promise<void> {
    const tx = await offlineDB.transactions.get(txId);
    if (tx && tx.userId === userId) {
      tx.isDeleted = false;
      tx.updatedAt = new Date().toISOString();
      await offlineDB.transactions.put(tx);
    }
  }

  // --- RECURRING RULES & OCCURRENCES ---

  static async getRecurringRules(userId: string): Promise<RecurringRule[]> {
    return offlineDB.table("recurringRules").toArray?.() || [];
  }

  static async getOccurrences(userId: string, periodKey: string): Promise<PaymentOccurrence[]> {
    return offlineDB.occurrences
      .where("userId")
      .equals(userId)
      .filter((o) => o.periodKey === periodKey)
      .toArray();
  }

  static async createOccurrence(occurrence: PaymentOccurrence): Promise<PaymentOccurrence> {
    assertValidPaise(occurrence.expectedAmountPaise, "Expected amount");
    await offlineDB.occurrences.put(occurrence);
    return occurrence;
  }

  static async updateOccurrence(occurrence: PaymentOccurrence): Promise<PaymentOccurrence> {
    occurrence.updatedAt = new Date().toISOString();
    await offlineDB.occurrences.put(occurrence);
    return occurrence;
  }

  // --- LOANS & INSTALLMENTS ---

  static async getLoans(userId: string): Promise<Loan[]> {
    return offlineDB.loans.where("userId").equals(userId).toArray();
  }

  static async createLoanWithSchedule(loan: Loan): Promise<{ loan: Loan; installments: Installment[] }> {
    assertValidPaise(loan.installmentAmountPaise, "Installment amount");
    await offlineDB.loans.put(loan);

    const schedule = generateInstallmentSchedule({
      loanId: loan.id,
      userId: loan.userId,
      startMonthKey: loan.startMonthKey,
      dueDay: loan.dueDay,
      installmentAmountPaise: loan.installmentAmountPaise,
      totalInstallments: loan.totalInstallments,
      historicalPaidCount: loan.historicalPaidCount,
    });

    await offlineDB.installments.bulkPut(schedule);
    return { loan, installments: schedule };
  }

  static async createLoanWithInstallments(loan: Loan): Promise<{ loan: Loan; installments: Installment[] }> {
    return this.createLoanWithSchedule(loan);
  }

  static async getInstallments(userId: string, loanId?: string): Promise<Installment[]> {
    if (loanId) {
      return offlineDB.installments.where("loanId").equals(loanId).toArray();
    }
    return offlineDB.installments.where("userId").equals(userId).toArray();
  }

  static async payInstallment(params: {
    userId: string;
    installmentId: string;
    accountId: string;
    paidAmountPaise: Paise;
    paymentDate: string;
    existingTransactionId?: string;
  }): Promise<{ installment: Installment; transaction?: Transaction }> {
    const { userId, installmentId, accountId, paidAmountPaise, paymentDate, existingTransactionId } = params;
    assertValidPaise(paidAmountPaise, "Paid amount");

    const inst = await offlineDB.installments.get(installmentId);
    if (!inst || inst.userId !== userId) {
      throw new Error("Installment not found");
    }

    const newPaidTotal = addPaise(inst.paidAmountPaise, paidAmountPaise);
    const isFullyPaid = newPaidTotal >= inst.amountPaise;

    let linkedTxId = existingTransactionId || inst.linkedTransactionId;
    let createdTx: Transaction | undefined;

    // If no existing transaction was linked, record a new expense transaction atomically
    if (!linkedTxId) {
      const loan = await offlineDB.loans.get(inst.loanId);
      const catId = loan ? loan.linkedCategoryId : undefined;

      const { transaction } = await this.recordTransaction({
        userId,
        operationId: `op-pay-inst-${inst.id}-${Date.now()}`,
        type: "expense",
        amountPaise: paidAmountPaise,
        date: paymentDate,
        accountId,
        categoryId: catId,
        linkedInstallmentId: inst.id,
        note: `EMI Payment: Installment #${inst.installmentNumber}`,
        isSplit: false,
        isDeleted: false,
      });
      linkedTxId = transaction.id;
      createdTx = transaction;
    }

    inst.paidAmountPaise = newPaidTotal;
    inst.status = isFullyPaid ? "paid" : "partly_paid";
    inst.paidDate = paymentDate;
    inst.linkedTransactionId = linkedTxId;
    inst.updatedAt = new Date().toISOString();

    await offlineDB.installments.put(inst);

    return { installment: inst, transaction: createdTx };
  }

  // --- DATA EXPORT & SAFE VALIDATED RESTORE ---

  /**
   * Generates sanitized CSV with formula injection protection
   */
  static async exportToCSV(userId: string): Promise<string> {
    const transactions = await this.getTransactions(userId, { includeDeleted: false });
    const accounts = await this.getAccounts(userId);
    const categories = await this.getCategories(userId);

    const accMap = new Map(accounts.map((a) => [a.id, a.name]));
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const headers = ["ID", "Date", "Type", "Amount (INR)", "Account", "To Account", "Category", "Merchant", "Note"];

    // Sanitize string to prevent Excel/Calc formula injection:
    // Leading '=', '+', '-', '@', '\t', '\r' are prefixed with a single quote "'"
    const sanitize = (val: string | undefined): string => {
      if (!val) return '""';
      let s = String(val).replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(s)) {
        s = `'${s}`;
      }
      return `"${s}"`;
    };

    const rows = transactions.map((t) => [
      sanitize(t.id),
      sanitize(t.date),
      sanitize(t.type),
      (t.amountPaise / 100).toFixed(2),
      sanitize(accMap.get(t.accountId) || t.accountId),
      sanitize(t.toAccountId ? accMap.get(t.toAccountId) || t.toAccountId : ""),
      sanitize(t.categoryId ? catMap.get(t.categoryId) || t.categoryId : ""),
      sanitize(t.merchant),
      sanitize(t.note),
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  /**
   * Versioned Full-Data JSON Export
   */
  static async exportToJSON(userId: string): Promise<string> {
    const accounts = await offlineDB.accounts.where("userId").equals(userId).toArray();
    const categories = await offlineDB.categories.where("userId").equals(userId).toArray();
    const allocations = await offlineDB.allocations.where("userId").equals(userId).toArray();
    const reallocations = await offlineDB.reallocations.where("userId").equals(userId).toArray();
    const transactions = await offlineDB.transactions.where("userId").equals(userId).toArray();
    const loans = await offlineDB.loans.where("userId").equals(userId).toArray();
    const installments = await offlineDB.installments.where("userId").equals(userId).toArray();
    const occurrences = await offlineDB.occurrences.where("userId").equals(userId).toArray();

    const backup = {
      version: "1.0.0",
      app: "PocketPlan",
      exportedAt: new Date().toISOString(),
      userId,
      data: {
        accounts,
        categories,
        allocations,
        reallocations,
        transactions,
        loans,
        installments,
        occurrences,
      },
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Validated JSON Restore
   */
  static async restoreFromJSON(
    targetUserId: string,
    jsonString: string
  ): Promise<{ success: boolean; importedCounts: Record<string, number> }> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || parsed.app !== "PocketPlan" || !parsed.data) {
      throw new Error("Invalid backup file format. Expected a valid PocketPlan JSON export.");
    }

    const {
      accounts = [],
      categories = [],
      allocations = [],
      reallocations = [],
      transactions = [],
      loans = [],
      installments = [],
      occurrences = [],
    } = parsed.data;

    // Validate data and reassign to targetUserId
    const safeAccounts: Account[] = accounts.map((a: Account) => ({ ...a, userId: targetUserId }));
    const safeCategories: Category[] = categories.map((c: Category) => ({ ...c, userId: targetUserId }));
    const safeAllocations: BudgetAllocationEntry[] = allocations.map((al: BudgetAllocationEntry) => ({
      ...al,
      userId: targetUserId,
    }));
    const safeReallocs: CategoryReallocation[] = reallocations.map((r: CategoryReallocation) => ({
      ...r,
      userId: targetUserId,
    }));
    const safeTransactions: Transaction[] = transactions.map((t: Transaction) => ({
      ...t,
      userId: targetUserId,
    }));
    const safeLoans: Loan[] = loans.map((l: Loan) => ({ ...l, userId: targetUserId }));
    const safeInstallments: Installment[] = installments.map((i: Installment) => ({
      ...i,
      userId: targetUserId,
    }));
    const safeOccurrences: PaymentOccurrence[] = occurrences.map((o: PaymentOccurrence) => ({
      ...o,
      userId: targetUserId,
    }));

    await offlineDB.transaction(
      "rw",
      [
        offlineDB.accounts,
        offlineDB.categories,
        offlineDB.allocations,
        offlineDB.reallocations,
        offlineDB.transactions,
        offlineDB.loans,
        offlineDB.installments,
        offlineDB.occurrences,
      ],
      async () => {
        if (safeAccounts.length > 0) await offlineDB.accounts.bulkPut(safeAccounts);
        if (safeCategories.length > 0) await offlineDB.categories.bulkPut(safeCategories);
        if (safeAllocations.length > 0) await offlineDB.allocations.bulkPut(safeAllocations);
        if (safeReallocs.length > 0) await offlineDB.reallocations.bulkPut(safeReallocs);
        if (safeTransactions.length > 0) await offlineDB.transactions.bulkPut(safeTransactions);
        if (safeLoans.length > 0) await offlineDB.loans.bulkPut(safeLoans);
        if (safeInstallments.length > 0) await offlineDB.installments.bulkPut(safeInstallments);
        if (safeOccurrences.length > 0) await offlineDB.occurrences.bulkPut(safeOccurrences);
      }
    );

    return {
      success: true,
      importedCounts: {
        accounts: safeAccounts.length,
        categories: safeCategories.length,
        allocations: safeAllocations.length,
        reallocations: safeReallocs.length,
        transactions: safeTransactions.length,
        loans: safeLoans.length,
        installments: safeInstallments.length,
        occurrences: safeOccurrences.length,
      },
    };
  }
}
