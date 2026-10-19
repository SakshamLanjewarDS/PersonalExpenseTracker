"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Plus,
  Download,
  ArrowRightLeft,
  CreditCard,
  Landmark,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import {
  Account,
  Category,
  Transaction,
  BudgetAllocationEntry,
  CategoryReallocation,
} from "@/types/database";
import { formatPaise, addPaise, subPaise } from "@/lib/money/paise";
import { formatDateReadable } from "@/lib/dates/dates";
import {
  deriveAccountBalance,
  deriveCategoryBudget,
} from "@/lib/services/financeService";
import { AppHeader } from "@/components/layout/AppHeader";
import { NotchedFinancialCard } from "@/components/ui/NotchedFinancialCard";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";
import { CompactTransactionRow } from "@/components/ui/CompactTransactionRow";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export default function HomePage() {
  const { userId, selectedMonth, refreshKey, setIsQuickAddOpen } = useApp();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allocations, setAllocations] = useState<BudgetAllocationEntry[]>([]);
  const [reallocations, setReallocations] = useState<CategoryReallocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [accs, cats, txs, allocs, reallocs] = await Promise.all([
          FinanceRepository.getAccounts(userId),
          FinanceRepository.getCategories(userId),
          FinanceRepository.getTransactions(userId),
          FinanceRepository.getAllocations(userId, selectedMonth),
          FinanceRepository.getReallocations(userId, selectedMonth),
        ]);

        setAccounts(accs);
        setCategories(cats);
        setTransactions(txs);
        setAllocations(allocs);
        setReallocations(reallocs);
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

  // Derive Category Budgets
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

  const totalAllocatedPaise = categoryBudgets.reduce(
    (sum, b) => addPaise(sum, b.allocatedPaise),
    0
  );
  const totalSpentPaise = categoryBudgets.reduce(
    (sum, b) => addPaise(sum, b.netSpentPaise),
    0
  );
  const totalAvailableBudgetPaise = subPaise(totalAllocatedPaise, totalSpentPaise);

  // Month transactions
  const monthTransactions = transactions.filter(
    (t) => t.date.startsWith(selectedMonth) && !t.isDeleted
  );
  const recentTransactions = monthTransactions.slice(0, 5);

  const priorityBudgets = [...categoryBudgets].sort((a, b) => {
    if (a.availablePaise < 0 && b.availablePaise >= 0) return -1;
    if (b.availablePaise < 0 && a.availablePaise >= 0) return 1;
    if (b.netSpentPaise !== a.netSpentPaise) return b.netSpentPaise - a.netSpentPaise;
    return b.allocatedPaise - a.allocatedPaise;
  });
  const router = useRouter();

  // Primary account for balance display
  const primaryAccount = accounts[0];
  const primaryAccountBalance = primaryAccount
    ? deriveAccountBalance(primaryAccount, transactions).balancePaise
    : totalLiquidFundsPaise;

  const quickActionItems = [
    {
      id: "income",
      label: "Income",
      icon: Download,
      onClick: () => setIsQuickAddOpen(true),
    },
    {
      id: "transfer",
      label: "Transfer",
      icon: ArrowRightLeft,
      onClick: () => router.push("/accounts"),
    },
    {
      id: "budgets",
      label: "Budgets",
      icon: CreditCard,
      onClick: () => router.push("/budgets"),
    },
    {
      id: "accounts",
      label: "Accounts",
      icon: Landmark,
      onClick: () => router.push("/accounts"),
    },
  ];

  const usedPct =
    totalAllocatedPaise > 0
      ? Math.round((totalSpentPaise / totalAllocatedPaise) * 100)
      : 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F8FC]">
      {/* 1. Compact Header matching Image 1 Left */}
      <AppHeader
        greeting="Hi Saksham!"
        action="settings"
        showMonthSelector={true}
        monthPlacement="subtitle"
      />

      <main className="flex-1 px-4 py-3 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* 2. Distinctive Primary Financial Card with Recessed Action */}
        {/* 2. Top Header Financial Card matching user reference image */}
        <section aria-label="Main Financial Balance Card">
          <NotchedFinancialCard
            title="TOTAL BALANCE"
            amount={totalLiquidFundsPaise}
            subtitle="Reflects all bank accounts and cash in hand."
            stat1Label="Accounts"
            stat1Value={accounts.length.toString()}
            stat2Label="Account spending"
            stat2Value={formatPaise(totalSpentPaise)}
            actionText="Add account"
            onActionClick={() => router.push("/accounts")}
          />
        </section>

        {/* 3. Four-Column Quick-Action Grid */}
        <section aria-label="Quick Actions">
          <QuickActionGrid items={quickActionItems} />
        </section>

        {/* 4. Account Balance Section matching Image 1 Left */}
        <section aria-label="Account Balance" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-[#0B1D3A]">Account Balance</h2>
            <Link
              href="/accounts"
              className="text-xs font-bold text-[#0047FF] hover:underline"
            >
              View All
            </Link>
          </div>

          <Link
            href="/accounts"
            className="block bg-[#EEF3FF] hover:bg-[#E4EDFF] transition-colors p-3.5 rounded-[20px] shadow-[0_1px_3px_rgba(0,56,255,0.03)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                  <Landmark size={20} strokeWidth={2.3} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#0B1D3A] truncate">
                    {primaryAccount?.name || "SBI"}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400 capitalize">
                    {primaryAccount?.type === "salary"
                      ? "Salary Account"
                      : "Savings Account"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0 text-right">
                <span className="text-sm font-extrabold text-[#0B1D3A] tabular-nums">
                  {formatPaise(primaryAccountBalance)}
                </span>
                <ChevronRight size={16} strokeWidth={2.4} className="text-slate-400" />
              </div>
            </div>
          </Link>
        </section>

        {/* 5. Budget Attention Section matching Image 1 Left */}
        <section aria-label="Budget Attention" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-[#0B1D3A]">Budget Attention</h2>
            <Link
              href="/budgets"
              className="text-xs font-bold text-[#0047FF] hover:underline"
            >
              See All
            </Link>
          </div>

          <div className="space-y-2">
            {priorityBudgets.slice(0, 2).map(({ category, availablePaise, netSpentPaise, allocatedPaise }) => {
              const isOver = availablePaise < 0;

              return (
                <Link
                  key={category.id}
                  href="/budgets"
                  className={`block bg-[#EEF3FF] hover:bg-[#E4EDFF] transition-colors p-3.5 rounded-[20px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] relative overflow-hidden ${
                    isOver ? "border-l-4 border-l-red-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                        <CategoryIcon iconName={category.icon} size={18} className="!bg-transparent" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#0B1D3A] truncate">
                          {category.name}
                        </h3>
                        <p className="text-[11px] font-medium text-slate-400">
                          {formatPaise(netSpentPaise)} of {formatPaise(allocatedPaise)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0 text-right">
                      <div>
                        <span
                          className={`text-xs font-extrabold tabular-nums block ${
                            isOver ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {isOver
                            ? formatPaise(Math.abs(availablePaise))
                            : `${formatPaise(availablePaise)}`}
                        </span>
                        <span
                          className={`text-[10px] font-bold block ${
                            isOver ? "text-red-500" : "text-emerald-600"
                          }`}
                        >
                          {isOver ? "Over budget" : "Left"}
                        </span>
                      </div>
                      <ChevronRight size={16} strokeWidth={2.4} className="text-slate-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 6. Recent Activity Section matching Image 1 Left */}
        <section aria-label="Recent Activity" className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-[#0B1D3A]">Recent Activity</h2>
            <Link
              href="/transactions"
              className="text-xs font-bold text-[#0047FF] hover:underline"
            >
              See All ({monthTransactions.length})
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="bg-[#EEF3FF] p-6 rounded-[22px] text-center space-y-2">
              <p className="text-xs font-bold text-[#0B1D3A]">No transactions yet</p>
              <p className="text-[11px] text-slate-400">Tap &apos;Add expense&apos; above to record spending.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const acc = accounts.find((a) => a.id === tx.accountId);

                return (
                  <CompactTransactionRow
                    key={tx.id}
                    transaction={tx}
                    category={cat}
                    account={acc}
                    subtitle={`${formatDateReadable(tx.date)} • UPI`}
                    rightAction="chevron"
                    onClick={() => router.push("/transactions")}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
