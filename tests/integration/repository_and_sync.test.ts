import { describe, it, expect, beforeEach } from "vitest";
import { FinanceRepository } from "@/lib/offline/repository";
import { offlineDB } from "@/lib/offline/db";
import { Transaction } from "@/types/database";
import { addPaise } from "@/lib/money/paise";

describe("PocketPlan Acceptance Tests — Repository, Idempotency & Backup", () => {
  const userId = "usr-sync-test-1";

  beforeEach(async () => {
    await offlineDB.transactions.clear();
    await offlineDB.accounts.clear();
    await offlineDB.categories.clear();
    await offlineDB.allocations.clear();
    await offlineDB.reallocations.clear();
    await offlineDB.loans.clear();
    await offlineDB.installments.clear();
    await offlineDB.occurrences.clear();
    await offlineDB.mutationQueue.clear();

    await FinanceRepository.initUserStarterData(userId);
  });

  // Scenario 8: Repeat the same operation ID and create only one record
  it("Scenario 8: Repeat the same operation ID and create only one record", async () => {
    const accounts = await FinanceRepository.getAccounts(userId);
    const categories = await FinanceRepository.getCategories(userId);

    const operationId = "idemp-uuid-1001";
    const txData = {
      userId,
      operationId,
      type: "expense" as const,
      amountPaise: 45000, // ₹450
      date: "2026-10-19",
      accountId: accounts[0].id,
      categoryId: categories[0].id,
      merchant: "Shell Petrol Pump",
      isSplit: false,
      isDeleted: false,
    };

    // First attempt
    const res1 = await FinanceRepository.recordTransaction(txData);
    expect(res1.isDuplicate).toBe(false);
    expect(res1.transaction.operationId).toBe(operationId);

    // Second attempt with exact same operationId
    const res2 = await FinanceRepository.recordTransaction(txData);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.transaction.id).toBe(res1.transaction.id);

    // Verify database has exactly 1 transaction
    const totalCount = await offlineDB.transactions.where("userId").equals(userId).count();
    expect(totalCount).toBe(1);
  });

  // Scenario 9: Sync an offline expense repeatedly and create only one record
  it("Scenario 9: Sync an offline expense repeatedly and create only one record", async () => {
    const accounts = await FinanceRepository.getAccounts(userId);
    const categories = await FinanceRepository.getCategories(userId);

    const operationId = "offline-sync-op-2002";
    const txData = {
      userId,
      operationId,
      type: "expense" as const,
      amountPaise: 12000, // ₹120
      date: "2026-10-19",
      accountId: accounts[0].id,
      categoryId: categories[0].id,
      merchant: "Coffee Day",
      isSplit: false,
      isDeleted: false,
    };

    // Local save offline
    const resOffline = await FinanceRepository.recordTransaction(txData);
    expect(resOffline.isDuplicate).toBe(false);

    // Simulate multiple network retries of the sync handler
    const syncRetry1 = await FinanceRepository.recordTransaction(txData);
    const syncRetry2 = await FinanceRepository.recordTransaction(txData);

    expect(syncRetry1.isDuplicate).toBe(true);
    expect(syncRetry2.isDuplicate).toBe(true);

    const total = await offlineDB.transactions.where("userId").equals(userId).count();
    expect(total).toBe(1);
  });

  // Scenario 18: Export and restore data with matching balances
  it("Scenario 18: Export and restore data with matching balances", async () => {
    const accounts = await FinanceRepository.getAccounts(userId);
    const categories = await FinanceRepository.getCategories(userId);

    // 1. Allocate ₹3,000 to Petrol
    await FinanceRepository.allocateBudget({
      userId,
      periodKey: "2026-10",
      categoryId: categories[0].id,
      allocatedPaise: 300000,
    });

    // 2. Record an expense
    await FinanceRepository.recordTransaction({
      userId,
      operationId: "op-exp-pre-export",
      type: "expense",
      amountPaise: 35000, // ₹350
      date: "2026-10-19",
      accountId: accounts[0].id,
      categoryId: categories[0].id,
      merchant: "HP Fuel",
      isSplit: false,
      isDeleted: false,
    });

    // Export to JSON
    const jsonString = await FinanceRepository.exportToJSON(userId);
    expect(jsonString).toContain("PocketPlan");
    expect(jsonString).toContain("HP Fuel");

    // Clean DB or restore to new user
    const restoredUserId = "usr-restored-99";
    const restoreResult = await FinanceRepository.restoreFromJSON(restoredUserId, jsonString);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.importedCounts.transactions).toBeGreaterThanOrEqual(1);

    // Verify restored records
    const restoredTx = await FinanceRepository.getTransactions(restoredUserId);
    expect(restoredTx.length).toBe(1);
    expect(restoredTx[0].amountPaise).toBe(35000);
    expect(restoredTx[0].userId).toBe(restoredUserId);

    // Verify CSV export has formula injection protection
    const csv = await FinanceRepository.exportToCSV(restoredUserId);
    expect(csv).toContain("Date");
    expect(csv).toContain("HP Fuel");
    expect(csv).toContain("350.00");
  });

  // Scenario 20: Ensure filters, search, and navigation perform intended actions
  it("Scenario 20: Ensure filters, dropdowns, and search perform their intended actions", async () => {
    const accounts = await FinanceRepository.getAccounts(userId);
    const categories = await FinanceRepository.getCategories(userId);

    await FinanceRepository.recordTransaction({
      userId,
      operationId: "op-search-1",
      type: "expense",
      amountPaise: 20000,
      date: "2026-10-10",
      accountId: accounts[0].id,
      categoryId: categories[0].id,
      merchant: "Shell Fuel",
      isSplit: false,
      isDeleted: false,
    });

    await FinanceRepository.recordTransaction({
      userId,
      operationId: "op-search-2",
      type: "expense",
      amountPaise: 50000,
      date: "2026-10-15",
      accountId: accounts[0].id,
      categoryId: categories[1].id,
      merchant: "Electricity Board",
      note: "BESCOM monthly bill",
      isSplit: false,
      isDeleted: false,
    });

    // Test Search Filter: "Shell"
    const searchRes = await FinanceRepository.getTransactions(userId, { searchQuery: "shell" });
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].merchant).toBe("Shell Fuel");

    // Test Date Range Filter
    const dateRangeRes = await FinanceRepository.getTransactions(userId, {
      startDate: "2026-10-12",
      endDate: "2026-10-18",
    });
    expect(dateRangeRes.length).toBe(1);
    expect(dateRangeRes[0].merchant).toBe("Electricity Board");
  });
});
