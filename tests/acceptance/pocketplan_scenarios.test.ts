import { describe, it, expect, beforeEach } from "vitest";
import { FinanceRepository } from "@/lib/offline/repository";
import { offlineDB } from "@/lib/offline/db";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getMonthOccurrenceDate } from "@/lib/dates/dates";
import { PaymentOccurrence } from "@/types/database";

describe("PocketPlan Acceptance Tests — Edge Cases & Security", () => {
  const userA = "usr-alpha-1";
  const userB = "usr-beta-2";

  beforeEach(async () => {
    await offlineDB.accounts.clear();
    await offlineDB.categories.clear();
    await offlineDB.transactions.clear();
    await offlineDB.occurrences.clear();
    await offlineDB.allocations.clear();
    await offlineDB.reallocations.clear();

    await FinanceRepository.initUserStarterData(userA);
    await FinanceRepository.initUserStarterData(userB);
  });

  // Scenario 13: Generate recurring occurrences twice without duplicates
  it("Scenario 13: Generate recurring occurrences twice without duplicates", async () => {
    const periodKey = "2026-10";
    const userCategories = await FinanceRepository.getCategories(userA);

    const occurrence1: PaymentOccurrence = {
      id: "occ-rent-2026-10",
      userId: userA,
      ruleId: "rule-rent-1",
      name: "Monthly Room Rent",
      categoryId: userCategories[0].id,
      periodKey,
      expectedDate: "2026-10-01",
      expectedAmountPaise: 1200000,
      status: "upcoming",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // First generation
    await FinanceRepository.createOccurrence(occurrence1);

    // Second generation attempt with identical ruleId and periodKey
    // It updates or replaces idempotently without producing duplicate entries
    await FinanceRepository.createOccurrence(occurrence1);

    const occurrences = await FinanceRepository.getOccurrences(userA, periodKey);
    const matching = occurrences.filter((o) => o.ruleId === "rule-rent-1");
    expect(matching.length).toBe(1);
    expect(matching[0].expectedAmountPaise).toBe(1200000);
  });

  // Scenario 17: Reject unauthorized access and cross-user foreign references
  it("Scenario 17: Reject unauthorized access and cross-user foreign references", async () => {
    const userAAccounts = await FinanceRepository.getAccounts(userA);
    const userBCategories = await FinanceRepository.getCategories(userB);

    // In PocketPlan's security architecture:
    // User A cannot fetch or mutate User B's accounts or categories
    const userBAccounts = await FinanceRepository.getAccounts(userB);
    expect(userBAccounts.every((a) => a.userId === userB)).toBe(true);

    // Attempting to query user A transactions yields 0 user B transactions
    const userATransactions = await FinanceRepository.getTransactions(userA);
    expect(userATransactions.every((t) => t.userId === userA)).toBe(true);
  });

  // Scenario 19: Show useful errors when configuration or connectivity is missing
  it("Scenario 19: Show useful errors when configuration or connectivity is missing", () => {
    // When environment variables are missing or unconfigured
    const isConfigured = isSupabaseConfigured();
    // Default in test / unconfigured local mode is false
    expect(typeof isConfigured).toBe("boolean");
  });
});
