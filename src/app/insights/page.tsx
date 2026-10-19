"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowUpRight,
  Building2,
  ArrowRightLeft,
  ChevronRight,
  TrendingUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import { Transaction, Category } from "@/types/database";
import { formatPaise, addPaise, subPaise } from "@/lib/money/paise";
import { getPeriodBoundaries, PeriodType, formatDateReadable } from "@/lib/dates/dates";
import { AppHeader } from "@/components/layout/AppHeader";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CompactTransactionRow } from "@/components/ui/CompactTransactionRow";
import { NotchedFinancialCard } from "@/components/ui/NotchedFinancialCard";

export default function InsightsPage() {
  const router = useRouter();
  const { userId, refreshKey } = useApp();

  // Period Selector: "today" (Day), "this-week" (Week), "this-month" (Month), "this-year" (Year)
  const [periodPreset, setPeriodPreset] = useState<PeriodType>("this-month");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [txs, cats] = await Promise.all([
          FinanceRepository.getTransactions(userId, { includeDeleted: false }),
          FinanceRepository.getCategories(userId),
        ]);
        setTransactions(txs);
        setCategories(cats);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [userId, refreshKey]);

  const boundaries = useMemo(
    () => getPeriodBoundaries(periodPreset),
    [periodPreset]
  );

  // Filter transactions within period
  const periodTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => tx.date >= boundaries.startDate && tx.date <= boundaries.endDate
    );
  }, [transactions, boundaries]);

  // Aggregate metrics
  const { totalSpendingPaise, totalIncomePaise, netCashFlowPaise } = useMemo(() => {
    let expenses = 0;
    let income = 0;
    let refunds = 0;

    for (const tx of periodTransactions) {
      if (tx.type === "expense") {
        expenses = addPaise(expenses, tx.amountPaise);
      } else if (tx.type === "income") {
        income = addPaise(income, tx.amountPaise);
      } else if (tx.type === "refund") {
        refunds = addPaise(refunds, tx.amountPaise);
      }
      // Transfers are excluded from spending
    }

    const netSpending = subPaise(expenses, refunds);
    const netCashFlow = subPaise(income, netSpending);

    return {
      totalSpendingPaise: netSpending,
      totalIncomePaise: income,
      netCashFlowPaise: netCashFlow,
    };
  }, [periodTransactions]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, { category: Category; amountPaise: number }>();

    for (const cat of categories) {
      catMap.set(cat.id, { category: cat, amountPaise: 0 });
    }

    for (const tx of periodTransactions) {
      if (tx.type === "expense" && tx.categoryId) {
        const entry = catMap.get(tx.categoryId);
        if (entry) {
          entry.amountPaise = addPaise(entry.amountPaise, tx.amountPaise);
        }
      } else if (tx.type === "refund" && tx.categoryId) {
        const entry = catMap.get(tx.categoryId);
        if (entry) {
          entry.amountPaise = subPaise(entry.amountPaise, tx.amountPaise);
        }
      }
    }

    const total = totalSpendingPaise > 0 ? totalSpendingPaise : 1;

    return Array.from(catMap.values())
      .filter((c) => c.amountPaise > 0)
      .sort((a, b) => b.amountPaise - a.amountPaise)
      .map((c) => {
        const pct = Math.round((c.amountPaise / total) * 1000) / 10;
        return {
          category: c.category,
          amountPaise: c.amountPaise,
          percentage: pct,
        };
      });
  }, [categories, periodTransactions, totalSpendingPaise]);

  // Top spending transactions
  const topTransactions = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === "expense")
      .sort((a, b) => b.amountPaise - a.amountPaise)
      .slice(0, 5);
  }, [periodTransactions]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F8FC]">
      {/* 1. Header matching Image 1 Right */}
      <AppHeader
        greeting="Hi Saksham!"
        action="settings"
        showMonthSelector={true}
        monthPlacement="subtitle"
      />

      <main className="flex-1 px-4 py-3 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* 2. Period Selector (Today | Week | Month | Year) matching Image 1 Right */}
        <div className="bg-[#EEF3FF] p-1 rounded-2xl flex items-center">
          <button
            onClick={() => setPeriodPreset("today")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              periodPreset === "today"
                ? "bg-white text-[#0B1D3A] shadow-xs"
                : "text-slate-500 hover:text-[#0B1D3A]"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setPeriodPreset("this-week")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              periodPreset === "this-week"
                ? "bg-white text-[#0B1D3A] shadow-xs"
                : "text-slate-500 hover:text-[#0B1D3A]"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setPeriodPreset("this-month")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              periodPreset === "this-month"
                ? "bg-white text-[#0B1D3A] shadow-xs"
                : "text-slate-500 hover:text-[#0B1D3A]"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setPeriodPreset("this-year")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              periodPreset === "this-year"
                ? "bg-white text-[#0B1D3A] shadow-xs"
                : "text-slate-500 hover:text-[#0B1D3A]"
            }`}
          >
            Year
          </button>
        </div>

        {/* 3. Net Spending Notched Card matching Image 1 Right */}
        <section aria-label="Net Spending">
          <NotchedFinancialCard
            title="Net Spending"
            amount={totalSpendingPaise}
            subtitle="Based on recorded transactions"
            actionText="View activity"
            actionIcon={<ChevronRight size={15} strokeWidth={2.8} />}
            onActionClick={() => router.push("/transactions")}
          />
        </section>

        {/* 4. Side-by-Side Cards: Recorded Income & Net Cash Flow matching Image 1 Right */}
        <div className="grid grid-cols-2 gap-3">
          {/* Recorded Income */}
          <div className="bg-[#EEF3FF] p-3.5 rounded-[22px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ArrowDown size={18} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">Recorded Income</p>
              <p className="text-base font-extrabold text-[#0B1D3A] tabular-nums mt-0.5 truncate">
                {formatPaise(totalIncomePaise)}
              </p>
            </div>
          </div>

          {/* Net Cash Flow */}
          <div className="bg-[#EEF3FF] p-3.5 rounded-[22px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                netCashFlowPaise < 0
                  ? "bg-red-100 text-red-600"
                  : "bg-emerald-100 text-emerald-600"
              }`}
            >
              <ArrowUpRight size={18} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">Net Cash Flow</p>
              <p
                className={`text-base font-extrabold tabular-nums mt-0.5 truncate ${
                  netCashFlowPaise < 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {netCashFlowPaise < 0 ? "- " : "+ "}
                {formatPaise(Math.abs(netCashFlowPaise))}
              </p>
            </div>
          </div>
        </div>

        {/* 5. Category Spending Section matching Image 1 Right */}
        <section aria-label="Category Spending" className="space-y-2.5">
          <h2 className="text-sm font-bold text-[#0B1D3A] px-1">Category Spending</h2>

          {categoryBreakdown.length === 0 ? (
            <div className="bg-[#EEF3FF] p-6 rounded-[22px] text-center">
              <p className="text-xs text-slate-500">No recorded spending for this period.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryBreakdown.map(({ category, amountPaise, percentage }) => (
                <div
                  key={category.id}
                  className="bg-[#EEF3FF] p-3.5 rounded-[20px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] flex items-center justify-between space-x-3"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                      <CategoryIcon iconName={category.icon} size={18} className="!bg-transparent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-[#0B1D3A] truncate mb-1">
                        {category.name}
                      </h3>
                      {/* Slim horizontal bar inside */}
                      <div className="w-full bg-white/80 h-2 rounded-full overflow-hidden max-w-[140px]">
                        <div
                          className="bg-[#0047FF] h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-[#0B1D3A] tabular-nums block">
                      {formatPaise(amountPaise)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                      {percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 6. Top Transactions matching Image 1 Right */}
        <section aria-label="Top Transactions" className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-[#0B1D3A]">Top Transactions</h2>
            <Link
              href="/transactions"
              className="text-xs font-bold text-[#0047FF] hover:underline"
            >
              See All ({topTransactions.length})
            </Link>
          </div>

          {topTransactions.length === 0 ? (
            <div className="bg-[#EEF3FF] p-6 rounded-[22px] text-center">
              <p className="text-xs text-slate-500">No transactions recorded for this period.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);

                return (
                  <CompactTransactionRow
                    key={tx.id}
                    transaction={tx}
                    category={cat}
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
