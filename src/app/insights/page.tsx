"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowUpRight,
  Building2,
  ArrowRightLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import { Transaction, Category } from "@/types/database";
import { formatPaise, addPaise, subPaise } from "@/lib/money/paise";
import { getPeriodBoundaries, PeriodType, formatDateReadable } from "@/lib/dates/dates";
import { AppHeader } from "@/components/layout/AppHeader";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export default function InsightsPage() {
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
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F7FA]">
      <AppHeader title="Insights & Spending Trends" showBack={true} backHref="/" action="none" showMonthSelector={true} />

      <main className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* 1. Period Selector (Day | Week | Month | Year) */}
        <div className="bg-slate-200/60 p-1 rounded-xl flex items-center">
          <button
            onClick={() => setPeriodPreset("today")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              periodPreset === "today"
                ? "bg-white text-[#0B1D3A] shadow-xs"
                : "text-slate-500 hover:text-[#0B1D3A]"
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setPeriodPreset("this-week")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              periodPreset === "this-week"
                ? "bg-white text-[#0B1D3A] shadow-xs"
                : "text-slate-500 hover:text-[#0B1D3A]"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setPeriodPreset("this-month")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              periodPreset === "this-month"
                ? "bg-white text-[#0B1D3A] shadow-xs"
                : "text-slate-500 hover:text-[#0B1D3A]"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setPeriodPreset("this-year")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              periodPreset === "this-year"
                ? "bg-white text-[#0B1D3A] shadow-xs"
                : "text-slate-500 hover:text-[#0B1D3A]"
            }`}
          >
            Year
          </button>
        </div>

        {/* 2. Net Spending Card */}
        <section aria-label="Net Spending">
          <div className="bg-white border border-[#E7EBF2] p-5 rounded-2xl shadow-[0_1px_3px_rgba(11,29,58,0.03)] relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Net Spending</p>
                <p className="text-3xl font-extrabold text-[#0B1D3A] tracking-tight tabular-nums mt-1">
                  {formatPaise(totalSpendingPaise)}
                </p>
                <p className="text-xs text-slate-400 mt-1">Based on recorded transactions</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#EFF5FF] text-[#1E5BFF] flex items-center justify-center shrink-0">
                <ArrowUpRight size={18} strokeWidth={2.4} />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Two side-by-side cards: Recorded Income & Net Cash Flow */}
        <div className="grid grid-cols-2 gap-3">
          {/* Recorded Income */}
          <div className="bg-white border border-[#E7EBF2] p-4 rounded-2xl shadow-[0_1px_3px_rgba(11,29,58,0.03)]">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-slate-500">Recorded Income</p>
              <div className="w-7 h-7 rounded-lg bg-[#EFF5FF] text-[#1E5BFF] flex items-center justify-center">
                <Building2 size={14} strokeWidth={2.2} />
              </div>
            </div>
            <p className="text-lg font-bold text-emerald-600 tabular-nums">
              {formatPaise(totalIncomePaise)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Salary & other deposits</p>
          </div>

          {/* Net Cash Flow */}
          <div className="bg-white border border-[#E7EBF2] p-4 rounded-2xl shadow-[0_1px_3px_rgba(11,29,58,0.03)]">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-slate-500">Net Cash Flow</p>
              <div className="w-7 h-7 rounded-lg bg-[#EFF5FF] text-[#1E5BFF] flex items-center justify-center">
                <ArrowRightLeft size={14} strokeWidth={2.2} />
              </div>
            </div>
            <p
              className={`text-lg font-bold tabular-nums ${
                netCashFlowPaise < 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {netCashFlowPaise < 0 ? "- " : "+ "}
              {formatPaise(Math.abs(netCashFlowPaise))}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Income - Spending</p>
          </div>
        </div>

        {/* 4. Category Spending Breakdown */}
        <section aria-label="Category Spending Breakdown" className="space-y-3 pt-1">
          <h2 className="text-base font-bold text-[#0B1D3A]">Category Spending Breakdown</h2>

          {categoryBreakdown.length === 0 ? (
            <div className="bg-white border border-[#E7EBF2] p-6 rounded-2xl text-center">
              <p className="text-xs text-slate-500">No recorded spending for this period.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E7EBF2] p-4 rounded-2xl shadow-[0_1px_3px_rgba(11,29,58,0.03)] space-y-4">
              {categoryBreakdown.map(({ category, amountPaise, percentage }) => (
                <div key={category.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <CategoryIcon iconName={category.icon} size={16} />
                      <span className="text-xs font-bold text-[#0B1D3A] truncate">
                        {category.name}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-[#0B1D3A] tabular-nums">
                        {formatPaise(amountPaise)}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1.5 font-medium">
                        {percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#1E5BFF] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. Top Spending Transactions */}
        <section aria-label="Top Spending Transactions" className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0B1D3A]">Top Spending Transactions</h2>
            <Link
              href="/transactions"
              className="text-xs font-semibold text-[#1E5BFF] hover:underline flex items-center space-x-0.5"
            >
              <span>See All ({topTransactions.length})</span>
              <ChevronRight size={14} strokeWidth={2.4} />
            </Link>
          </div>

          {topTransactions.length === 0 ? (
            <div className="bg-white border border-[#E7EBF2] p-6 rounded-2xl text-center">
              <p className="text-xs text-slate-500">No transactions recorded for this period.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);

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
                          {formatDateReadable(tx.date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="text-sm font-bold tabular-nums text-[#0B1D3A]">
                        - {formatPaise(tx.amountPaise)}
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
