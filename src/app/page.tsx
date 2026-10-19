"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Plus,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import {
  Account,
  Category,
  Transaction,
  BudgetAllocationEntry,
  CategoryReallocation,
  PaymentOccurrence,
  Installment,
} from "@/types/database";
import { formatPaise, addPaise, subPaise } from "@/lib/money/paise";
import {
  deriveAccountBalance,
  deriveCategoryBudget,
} from "@/lib/services/financeService";
import { formatDateReadable } from "@/lib/dates/dates";
import { AppHeader } from "@/components/layout/AppHeader";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export default function HomePage() {
  const { userId, selectedMonth, refreshKey, setIsQuickAddOpen } = useApp();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allocations, setAllocations] = useState<BudgetAllocationEntry[]>([]);
  const [reallocations, setReallocations] = useState<CategoryReallocation[]>([]);
  const [occurrences, setOccurrences] = useState<PaymentOccurrence[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [accs, cats, txs, allocs, reallocs, occs, insts] = await Promise.all([
          FinanceRepository.getAccounts(userId),
          FinanceRepository.getCategories(userId),
          FinanceRepository.getTransactions(userId),
          FinanceRepository.getAllocations(userId, selectedMonth),
          FinanceRepository.getReallocations(userId, selectedMonth),
          FinanceRepository.getOccurrences(userId, selectedMonth),
          FinanceRepository.getInstallments(userId),
        ]);

        setAccounts(accs);
        setCategories(cats);
        setTransactions(txs);
        setAllocations(allocs);
        setReallocations(reallocs);
        setOccurrences(occs);
        setInstallments(insts);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [userId, selectedMonth, refreshKey]);

  // Derive Account balances
  const accountBalances = accounts.map((acc) => ({
    account: acc,
    ...deriveAccountBalance(acc, transactions),
  }));

  const totalLiquidFundsPaise = accountBalances.reduce(
    (sum, a) => addPaise(sum, a.balancePaise),
    0
  );

  // Derive Category Budgets for the selected month
  const categoryBudgets = categories.map((cat) => ({
    category: cat,
    ...deriveCategoryBudget({
      category: cat,
      periodKey: selectedMonth,
      allocations,
      reallocations,
      transactions,
    }),
  }));

  // Aggregate Budget Figures
  const totalAllocatedPaise = categoryBudgets.reduce(
    (sum, b) => addPaise(sum, b.allocatedPaise),
    0
  );
  const totalSpentPaise = categoryBudgets.reduce(
    (sum, b) => addPaise(sum, b.netSpentPaise),
    0
  );
  const totalAvailableBudgetPaise = subPaise(totalAllocatedPaise, totalSpentPaise);
  const utilizedPct =
    totalAllocatedPaise > 0
      ? Math.round((totalSpentPaise / totalAllocatedPaise) * 100)
      : totalSpentPaise > 0
      ? 100
      : 0;

  // Filter transactions for selected month
  const monthTransactions = transactions.filter(
    (t) => t.date.startsWith(selectedMonth) && !t.isDeleted
  );
  const recentTransactions = monthTransactions.slice(0, 5);

  // Prioritize categories with spending or allocation
  const priorityBudgets = [...categoryBudgets].sort((a, b) => {
    // Over budget first
    if (a.availablePaise < 0 && b.availablePaise >= 0) return -1;
    if (b.availablePaise < 0 && a.availablePaise >= 0) return 1;
    // Then highest spent
    if (b.netSpentPaise !== a.netSpentPaise) return b.netSpentPaise - a.netSpentPaise;
    // Then allocated
    return b.allocatedPaise - a.allocatedPaise;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F7FA]">
      <AppHeader title="Overview" action="settings" showMonthSelector={true} />

      <main className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* 1. Hero: Budget remaining Card (Navy to Blue Gradient) */}
        <section aria-label="Budget Remaining Card">
          <div className="bg-gradient-to-br from-[#0B1D3A] via-[#0E2854] to-[#1E5BFF] text-white p-5 rounded-2xl shadow-[0_4px_20px_rgba(11,29,58,0.12)] relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-medium text-white/80 mb-1">
              <span>Budget remaining</span>
              <span className="font-semibold text-white/90">
                Allocated: {formatPaise(totalAllocatedPaise)}
              </span>
            </div>

            <div className="mt-1">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums block">
                {formatPaise(totalAvailableBudgetPaise)}
              </span>
              <span className="text-xs text-white/70 mt-0.5 block">
                {totalAvailableBudgetPaise < 0
                  ? "Over budget in envelopes"
                  : "Left to spend in envelopes"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 space-y-1.5">
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#5FA8FF] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, utilizedPct))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/90 font-medium">
                <span>Spent: {formatPaise(totalSpentPaise)}</span>
                <span>{utilizedPct}% utilized</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Bank balance Card */}
        <section aria-label="Bank Balance">
          <div className="bg-white border border-[#E7EBF2] p-4 rounded-2xl flex items-center justify-between shadow-[0_1px_3px_rgba(11,29,58,0.03)]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF5FF] text-[#1E5BFF] flex items-center justify-center shrink-0">
                <Building2 size={20} strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Bank balance</p>
                <p className="text-lg font-bold text-[#0B1D3A] tabular-nums">
                  {formatPaise(totalLiquidFundsPaise)}
                </p>
              </div>
            </div>
            <Link
              href="/accounts"
              className="text-xs font-semibold text-[#1E5BFF] hover:underline flex items-center space-x-1"
            >
              <span>View Accounts</span>
              <ChevronRight size={14} strokeWidth={2.4} />
            </Link>
          </div>
        </section>

        {/* 3. Category Budgets */}
        <section aria-label="Category Budgets" className="space-y-2.5">
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-base font-bold text-[#0B1D3A]">Category Budgets</h2>
            <Link
              href="/budgets"
              className="text-xs font-semibold text-[#1E5BFF] hover:underline flex items-center space-x-0.5"
            >
              <span>View All</span>
              <ChevronRight size={14} strokeWidth={2.4} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {priorityBudgets.slice(0, 4).map(({ category, availablePaise, netSpentPaise, allocatedPaise }) => {
              const pct = allocatedPaise > 0 ? Math.round((netSpentPaise / allocatedPaise) * 100) : 0;
              const isOver = availablePaise < 0;
              const isNotFunded = allocatedPaise === 0;

              return (
                <div
                  key={category.id}
                  className="bg-white border border-[#E7EBF2] p-4 rounded-2xl shadow-[0_1px_3px_rgba(11,29,58,0.03)] space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <CategoryIcon iconName={category.icon} size={18} />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#0B1D3A] truncate">
                          {category.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {isNotFunded
                            ? "Not funded"
                            : `Spent: ${formatPaise(netSpentPaise)} of ${formatPaise(allocatedPaise)}`}
                        </p>
                      </div>
                    </div>

                    {isOver ? (
                      <span className="bg-red-50 text-red-600 font-semibold text-xs px-2.5 py-0.5 rounded-full shrink-0">
                        {formatPaise(Math.abs(availablePaise))} over budget
                      </span>
                    ) : isNotFunded ? (
                      <span className="bg-slate-100 text-slate-500 font-medium text-xs px-2 py-0.5 rounded-full shrink-0">
                        Not funded
                      </span>
                    ) : null}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOver ? "bg-red-500" : "bg-[#1E5BFF]"
                      }`}
                      style={{
                        width: `${isNotFunded ? 0 : Math.min(100, Math.max(0, pct))}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      {isNotFunded ? "0% spent" : `${pct}% spent`}
                    </span>
                    <span
                      className={`font-bold tabular-nums ${
                        isOver ? "text-red-600" : "text-[#0B1D3A]"
                      }`}
                    >
                      {isOver
                        ? `- ${formatPaise(Math.abs(availablePaise))}`
                        : `${formatPaise(availablePaise)} left`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Recent Activity */}
        <section aria-label="Recent Activity" className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0B1D3A]">Recent Activity</h2>
            <Link
              href="/transactions"
              className="text-xs font-semibold text-[#1E5BFF] hover:underline flex items-center space-x-0.5"
            >
              <span>See All ({monthTransactions.length})</span>
              <ChevronRight size={14} strokeWidth={2.4} />
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="bg-white border border-[#E7EBF2] p-6 rounded-2xl text-center space-y-2">
              <p className="text-sm font-semibold text-[#0B1D3A]">No transactions this month</p>
              <p className="text-xs text-slate-500">Tap the + button below to add your first expense.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const isExpense = tx.type === "expense";
                const isIncome = tx.type === "income";

                return (
                  <Link
                    key={tx.id}
                    href="/transactions"
                    className="bg-white border border-[#E7EBF2] p-3.5 rounded-2xl flex items-center justify-between shadow-[0_1px_3px_rgba(11,29,58,0.03)] hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <CategoryIcon iconName={cat?.icon || "tag"} size={18} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0B1D3A] truncate">
                          {cat?.name || tx.merchant || "Transaction"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDateReadable(tx.date)} • {tx.paymentMethod?.toUpperCase() || "UPI"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          isExpense
                            ? "text-[#0B1D3A]"
                            : isIncome
                            ? "text-emerald-600"
                            : "text-[#1E5BFF]"
                        }`}
                      >
                        {isExpense ? "- " : isIncome ? "+ " : ""}
                        {formatPaise(tx.amountPaise)}
                      </span>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
