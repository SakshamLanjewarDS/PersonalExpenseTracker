"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  MoreVertical,
  Trash2,
  X,
  Undo2,
  Calendar,
  Tag,
  CreditCard,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import { Account, Category, Transaction, TransactionType } from "@/types/database";
import { formatPaise, addPaise } from "@/lib/money/paise";
import { formatDateReadable, getPeriodBoundaries, PeriodType } from "@/lib/dates/dates";
import { AppHeader } from "@/components/layout/AppHeader";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CompactTransactionRow } from "@/components/ui/CompactTransactionRow";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";

export default function TransactionsPage() {
  const { userId, selectedMonth, refreshKey, triggerRefresh } = useApp();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [periodPreset, setPeriodPreset] = useState<PeriodType>("this-month");

  // Advanced Filter Sheet
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Transaction Action Dialog
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Undo state
  const [lastDeletedTx, setLastDeletedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [accs, cats, txs] = await Promise.all([
          FinanceRepository.getAccounts(userId),
          FinanceRepository.getCategories(userId),
          FinanceRepository.getTransactions(userId, { includeDeleted: false }),
        ]);

        setAccounts(accs);
        setCategories(cats);
        setTransactions(txs);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [userId, refreshKey]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const boundaries = getPeriodBoundaries(periodPreset);

    return transactions.filter((tx) => {
      // Period filter
      if (tx.date < boundaries.startDate || tx.date > boundaries.endDate) {
        return false;
      }
      // Type filter
      if (selectedType !== "all" && tx.type !== selectedType) {
        return false;
      }
      // Category filter
      if (selectedCategory !== "all" && tx.categoryId !== selectedCategory) {
        return false;
      }
      // Account filter
      if (
        selectedAccount !== "all" &&
        tx.accountId !== selectedAccount &&
        tx.toAccountId !== selectedAccount
      ) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMerchant = tx.merchant?.toLowerCase().includes(q);
        const matchesNote = tx.note?.toLowerCase().includes(q);
        const matchesAmount = (tx.amountPaise / 100).toString().includes(q);
        const cat = categories.find((c) => c.id === tx.categoryId);
        const matchesCat = cat?.name.toLowerCase().includes(q);
        if (!matchesMerchant && !matchesNote && !matchesAmount && !matchesCat) return false;
      }

      return true;
    });
  }, [
    transactions,
    periodPreset,
    selectedType,
    selectedCategory,
    selectedAccount,
    searchQuery,
    categories,
  ]);

  // Total spent in filtered view
  const totalFilteredSpentPaise = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => addPaise(sum, t.amountPaise), 0);
  }, [filteredTransactions]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, { transactions: Transaction[]; totalSpentPaise: number }> = {};
    for (const tx of filteredTransactions) {
      if (!groups[tx.date]) {
        groups[tx.date] = { transactions: [], totalSpentPaise: 0 };
      }
      groups[tx.date].transactions.push(tx);
      if (tx.type === "expense") {
        groups[tx.date].totalSpentPaise = addPaise(groups[tx.date].totalSpentPaise, tx.amountPaise);
      }
    }
    return groups;
  }, [filteredTransactions]);

  const sortedDates = useMemo(
    () => Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a)),
    [groupedTransactions]
  );

  const handleDeleteTransaction = async (tx: Transaction) => {
    await FinanceRepository.softDeleteTransaction(userId, tx.id);
    setLastDeletedTx(tx);
    setSelectedTx(null);
    triggerRefresh();
  };

  const handleUndoDelete = async () => {
    if (!lastDeletedTx) return;
    await FinanceRepository.restoreTransaction(userId, lastDeletedTx.id);
    setLastDeletedTx(null);
    triggerRefresh();
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedType("all");
    setSelectedCategory("all");
    setSelectedAccount("all");
    setPeriodPreset("this-month");
    setIsFilterSheetOpen(false);
  };

  const filterTiles = [
    {
      id: "date",
      label: "Date",
      icon: Calendar,
      onClick: () => setIsFilterSheetOpen(true),
    },
    {
      id: "type",
      label: "Type",
      icon: Tag,
      onClick: () => setIsFilterSheetOpen(true),
    },
    {
      id: "category",
      label: "Category",
      icon: SlidersHorizontal,
      onClick: () => setIsFilterSheetOpen(true),
    },
    {
      id: "account",
      label: "Account",
      icon: CreditCard,
      onClick: () => setIsFilterSheetOpen(true),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F8FC]">
      {/* 1. Header matching Image 3 Right */}
      <AppHeader
        title="Transactions"
        subtitle="View and manage your spending"
        showBack={true}
        backHref="/"
        action="overflow"
        onOverflowClick={() => setIsFilterSheetOpen(true)}
        showMonthSelector={true}
        monthPlacement="right"
      />

      <main className="flex-1 px-4 py-3 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* Undo notification */}
        {lastDeletedTx && (
          <div className="p-3 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between shadow-md">
            <span>Transaction deleted.</span>
            <button
              onClick={handleUndoDelete}
              className="font-bold text-[#5FA8FF] flex items-center space-x-1"
            >
              <Undo2 size={14} />
              <span>Undo</span>
            </button>
          </div>
        )}

        {/* 1. Search Bar matching Image 3 Right */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search merchant, notes, amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#EEF3FF] border-0 pl-11 pr-4 py-3 text-xs text-[#0B1D3A] rounded-2xl shadow-[0_1px_2px_rgba(0,56,255,0.02)] focus:outline-[#0047FF] placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* 2. Four Filter Tiles matching Image 3 Right */}
        <section aria-label="Filter Controls">
          <QuickActionGrid items={filterTiles} />
        </section>

        {/* 3. Summary Card: Total spent & Transactions matching Image 3 Right */}
        <section aria-label="Transaction Totals">
          <div className="bg-[#EEF3FF] p-4 rounded-[22px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] flex items-center justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-slate-500">Total Spent</p>
              <p className="text-2xl font-extrabold text-[#0B1D3A] tracking-tight tabular-nums mt-0.5">
                {formatPaise(totalFilteredSpentPaise)}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-300/60 mx-4" />
            <div className="flex-1 pl-2">
              <p className="text-[11px] font-medium text-slate-500">Transactions</p>
              <p className="text-2xl font-extrabold text-[#0B1D3A] tracking-tight tabular-nums mt-0.5">
                {filteredTransactions.length}
              </p>
            </div>
          </div>
        </section>

        {/* 4. Date Grouped Transactions matching Image 3 Right */}
        <section aria-label="Transaction List" className="space-y-4 pt-1">
          {sortedDates.length === 0 ? (
            <div className="bg-[#EEF3FF] p-8 rounded-[22px] text-center space-y-2">
              <p className="text-sm font-bold text-[#0B1D3A]">No matching transactions</p>
              <p className="text-xs text-slate-400">Try adjusting your filters or search terms.</p>
              <button
                onClick={handleResetFilters}
                className="mt-2 px-4 py-2 bg-[#0047FF] text-white text-xs font-semibold rounded-xl hover:bg-[#0038D1]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            sortedDates.map((dateKey) => {
              const group = groupedTransactions[dateKey];
              const dateObj = new Date(dateKey + "T00:00:00Z");
              const dateHeading = new Intl.DateTimeFormat("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              }).format(dateObj);

              return (
                <div key={dateKey} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-[#0B1D3A]">
                      {dateHeading}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                      Spent: {formatPaise(group.totalSpentPaise)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.transactions.map((tx) => {
                      const cat = categories.find((c) => c.id === tx.categoryId);
                      const acc = accounts.find((a) => a.id === tx.accountId);

                      return (
                        <CompactTransactionRow
                          key={tx.id}
                          transaction={tx}
                          category={cat}
                          account={acc}
                          subtitle={`${acc?.name || "SBI"} • UPI`}
                          rightAction="menu"
                          onMenuClick={() => setSelectedTx(tx)}
                          onClick={() => setSelectedTx(tx)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Transaction Action Modal */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">Transaction Details</h3>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-bold text-[#0B1D3A] tabular-nums">
                    {formatPaise(selectedTx.amountPaise)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Date</span>
                  <span className="font-medium text-[#0B1D3A]">
                    {formatDateReadable(selectedTx.date)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium capitalize text-[#0B1D3A]">{selectedTx.type}</span>
                </div>
                {selectedTx.merchant && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Merchant</span>
                    <span className="font-medium text-[#0B1D3A]">{selectedTx.merchant}</span>
                  </div>
                )}
                {selectedTx.note && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Note</span>
                    <span className="font-medium text-[#0B1D3A]">{selectedTx.note}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  onClick={() => handleDeleteTransaction(selectedTx)}
                  className="w-full py-2.5 bg-red-50 text-red-600 font-semibold text-xs rounded-xl hover:bg-red-100 flex items-center justify-center space-x-1.5"
                >
                  <Trash2 size={16} />
                  <span>Delete Transaction</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Sheet */}
        {isFilterSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">Filter Transactions</h3>
                <button
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account</label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    <option value="all">All Accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  onClick={handleResetFilters}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Reset
                </button>
                <button
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
