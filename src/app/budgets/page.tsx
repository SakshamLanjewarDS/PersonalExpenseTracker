"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  ArrowRightLeft,
  Pencil,
  X,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import {
  Category,
  Transaction,
  BudgetAllocationEntry,
  CategoryReallocation,
  Account,
} from "@/types/database";
import { formatPaise, parseRupeesToPaise, addPaise, subPaise } from "@/lib/money/paise";
import { deriveCategoryBudget } from "@/lib/services/financeService";
import { AppHeader } from "@/components/layout/AppHeader";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export default function BudgetsPage() {
  const { userId, selectedMonth, refreshKey, triggerRefresh } = useApp();

  const [categories, setCategories] = useState<Category[]>([]);
  const [allocations, setAllocations] = useState<BudgetAllocationEntry[]>([]);
  const [reallocations, setReallocations] = useState<CategoryReallocation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Tab: "funded" | "all"
  const [activeTab, setActiveTab] = useState<"funded" | "all">("funded");

  // Salary Pool state (Default ₹12,000 = 1200000 paise)
  const [monthlySalaryPaise, setMonthlySalaryPaise] = useState<number>(1200000);
  const [isEditSalaryOpen, setIsEditSalaryOpen] = useState(false);
  const [salaryInputStr, setSalaryInputStr] = useState("12000");

  // Reallocation Modal state
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [fromCatId, setFromCatId] = useState("");
  const [toCatId, setToCatId] = useState("");
  const [moveAmountStr, setMoveAmountStr] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);

  // Edit Allocation Modal state
  const [isEditAllocOpen, setIsEditAllocOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [allocAmountStr, setAllocAmountStr] = useState("");
  const [allocError, setAllocError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [cats, allocs, reallocs, txs, accs] = await Promise.all([
          FinanceRepository.getCategories(userId),
          FinanceRepository.getAllocations(userId, selectedMonth),
          FinanceRepository.getReallocations(userId, selectedMonth),
          FinanceRepository.getTransactions(userId),
          FinanceRepository.getAccounts(userId),
        ]);

        setCategories(cats);
        setAllocations(allocs);
        setReallocations(reallocs);
        setTransactions(txs);
        setAccounts(accs);

        // Find salary account
        const salaryAcc = accs.find(
          (a) => a.type === "salary" || a.name.toLowerCase().includes("salary")
        );
        if (salaryAcc && salaryAcc.openingBalancePaise > 0) {
          setMonthlySalaryPaise(salaryAcc.openingBalancePaise);
          setSalaryInputStr((salaryAcc.openingBalancePaise / 100).toString());
        } else {
          const savedSalary = localStorage.getItem(
            `pocketplan_salary_${userId}_${selectedMonth}`
          );
          if (savedSalary) {
            const val = parseInt(savedSalary, 10);
            if (!isNaN(val)) {
              setMonthlySalaryPaise(val);
              setSalaryInputStr((val / 100).toString());
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [userId, selectedMonth, refreshKey]);

  // Derive budgets for every category
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

  const totalAllocated = categoryBudgets.reduce((s, b) => addPaise(s, b.allocatedPaise), 0);
  const totalSpent = categoryBudgets.reduce((s, b) => addPaise(s, b.netSpentPaise), 0);
  const unallocatedSalaryPaise = subPaise(monthlySalaryPaise, totalAllocated);

  const fundedBudgets = categoryBudgets.filter((b) => b.allocatedPaise > 0 || b.netSpentPaise > 0);
  const unfundedBudgets = categoryBudgets.filter((b) => b.allocatedPaise === 0 && b.netSpentPaise === 0);

  const displayedBudgets = activeTab === "funded" ? fundedBudgets : categoryBudgets;

  const handleOpenMove = (sourceCatId?: string) => {
    setFromCatId(sourceCatId || categories[0]?.id || "");
    const other = categories.find((c) => c.id !== (sourceCatId || categories[0]?.id));
    setToCatId(other?.id || "");
    setMoveAmountStr("");
    setMoveReason("");
    setMoveError(null);
    setIsMoveModalOpen(true);
  };

  const handleExecuteMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setMoveError(null);

    let amountPaise = 0;
    try {
      amountPaise = parseRupeesToPaise(moveAmountStr);
    } catch {
      setMoveError("Please enter a valid amount");
      return;
    }

    if (amountPaise <= 0) {
      setMoveError("Amount to move must be greater than zero");
      return;
    }

    if (fromCatId === toCatId) {
      setMoveError("Source and target categories must be different");
      return;
    }

    try {
      await FinanceRepository.moveBudget({
        userId,
        periodKey: selectedMonth,
        fromCategoryId: fromCatId,
        toCategoryId: toCatId,
        amountPaise,
        reason: moveReason.trim() || undefined,
      });

      setIsMoveModalOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      setMoveError(err instanceof Error ? err.message : "Failed to move funds");
    }
  };

  const handleOpenEditAlloc = (cat: Category, currentAllocatedPaise: number) => {
    setEditingCat(cat);
    setAllocAmountStr((currentAllocatedPaise / 100).toString());
    setAllocError(null);
    setIsEditAllocOpen(true);
  };

  const handleSaveAlloc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat) return;
    setAllocError(null);

    let targetPaise = 0;
    try {
      targetPaise = parseRupeesToPaise(allocAmountStr);
    } catch {
      setAllocError("Please enter a valid amount");
      return;
    }

    if (targetPaise < 0) {
      setAllocError("Allocation cannot be negative");
      return;
    }

    try {
      await FinanceRepository.setAllocation({
        userId,
        categoryId: editingCat.id,
        periodKey: selectedMonth,
        allocatedAmountPaise: targetPaise,
      });

      setIsEditAllocOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      setAllocError(err instanceof Error ? err.message : "Failed to save allocation");
    }
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const paise = parseRupeesToPaise(salaryInputStr);
      if (paise <= 0) return;

      const salaryAcc = accounts.find(
        (a) => a.type === "salary" || a.name.toLowerCase().includes("salary")
      );
      if (salaryAcc) {
        await FinanceRepository.updateAccount(userId, salaryAcc.id, {
          openingBalancePaise: paise,
        });
      }

      localStorage.setItem(`pocketplan_salary_${userId}_${selectedMonth}`, paise.toString());
      setMonthlySalaryPaise(paise);
      setIsEditSalaryOpen(false);
      triggerRefresh();
    } catch {
      // ignore invalid
    }
  };

  const [yearStr, monthStr] = selectedMonth.split("-");
  const monthDate = new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1));
  const monthName = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F7FA]">
      <AppHeader title="Budgets & Envelopes" showBack={true} backHref="/" action="none" showMonthSelector={true} />

      <main className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* 1. Total Salary (SBI) Card */}
        <section aria-label="Salary Pool Card">
          <div className="bg-white border border-[#E7EBF2] p-5 rounded-2xl shadow-[0_1px_3px_rgba(11,29,58,0.03)] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF5FF] text-[#1E5BFF] flex items-center justify-center shrink-0">
                  <Wallet size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#0B1D3A]">Total Salary (SBI)</h2>
                  <p className="text-xs text-slate-400">Monthly income • {monthName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditSalaryOpen(true)}
                className="px-3 py-1 bg-[#EFF5FF] text-[#1E5BFF] hover:bg-blue-100 text-xs font-semibold rounded-lg transition-colors"
              >
                Edit
              </button>
            </div>

            {/* Big Amount */}
            <div>
              <p className="text-3xl font-extrabold text-[#0B1D3A] tracking-tight tabular-nums">
                {formatPaise(monthlySalaryPaise)}
              </p>
            </div>

            {/* Two stats boxes */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-[#E7EBF2]">
              <div className="p-2.5 bg-slate-50/80 rounded-xl">
                <p className="text-xs font-medium text-slate-500">Allocated to budgets</p>
                <p className="text-base font-bold text-[#0B1D3A] tabular-nums mt-0.5">
                  {formatPaise(totalAllocated)}
                </p>
                <p className="text-[11px] text-slate-400">Across {fundedBudgets.length} categories</p>
              </div>

              <div className="p-2.5 bg-slate-50/80 rounded-xl">
                <p className="text-xs font-medium text-slate-500">Unallocated</p>
                <p
                  className={`text-base font-bold tabular-nums mt-0.5 ${
                    unallocatedSalaryPaise < 0 ? "text-red-600" : "text-[#1E5BFF]"
                  }`}
                >
                  {formatPaise(unallocatedSalaryPaise)}
                </p>
                <p className="text-[11px] text-slate-400">Available to assign</p>
              </div>
            </div>

            {/* Reallocate Button */}
            <button
              onClick={() => handleOpenMove()}
              className="w-full py-2.5 px-4 bg-[#EFF5FF] hover:bg-blue-100/70 text-[#1E5BFF] font-semibold text-xs rounded-xl flex items-center justify-between transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <ArrowRightLeft size={14} strokeWidth={2.4} />
                <span>Reallocate Between Envelopes</span>
              </span>
              <ChevronRight size={15} strokeWidth={2.4} />
            </button>
          </div>
        </section>

        {/* 2. Tabs: Funded (count) & All Categories (count) */}
        <div className="bg-slate-200/60 p-1 rounded-xl flex items-center">
          <button
            onClick={() => setActiveTab("funded")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "funded"
                ? "bg-white text-[#1E5BFF] shadow-xs"
                : "text-slate-600 hover:text-[#0B1D3A]"
            }`}
          >
            Funded ({fundedBudgets.length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "all"
                ? "bg-white text-[#1E5BFF] shadow-xs"
                : "text-slate-600 hover:text-[#0B1D3A]"
            }`}
          >
            All Categories ({categories.length})
          </button>
        </div>

        {/* 3. Category Envelopes List */}
        <section aria-label="Category Envelopes" className="space-y-2.5">
          {displayedBudgets.map(({ category, availablePaise, netSpentPaise, allocatedPaise }) => {
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
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-[#0B1D3A] truncate">
                          {category.name}
                        </h3>
                        {isOver && (
                          <span className="bg-red-50 text-red-600 font-semibold text-[11px] px-2 py-0.5 rounded-full shrink-0">
                            {formatPaise(Math.abs(availablePaise))} over budget
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isNotFunded
                          ? "Not funded"
                          : `Spent: ${formatPaise(netSpentPaise)} of ${formatPaise(allocatedPaise)}`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEditAlloc(category, allocatedPaise)}
                    className="px-2.5 py-1 bg-[#EFF5FF] hover:bg-blue-100 text-[#1E5BFF] text-xs font-semibold rounded-lg flex items-center space-x-1 shrink-0 transition-colors"
                  >
                    <Pencil size={12} strokeWidth={2.4} />
                    <span>Edit</span>
                  </button>
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

          {/* Unfunded Categories Banner when in Funded Tab */}
          {activeTab === "funded" && unfundedBudgets.length > 0 && (
            <button
              onClick={() => setActiveTab("all")}
              className="w-full bg-white border border-[#E7EBF2] p-4 rounded-2xl shadow-[0_1px_3px_rgba(11,29,58,0.03)] flex items-center justify-between hover:border-slate-300 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF5FF] text-[#1E5BFF] flex items-center justify-center shrink-0">
                  <LayoutGrid size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0B1D3A]">
                    {unfundedBudgets.length} categories not funded
                  </p>
                  <p className="text-xs text-slate-400">Allocate amounts to start tracking</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          )}
        </section>

        {/* Edit Salary Modal */}
        {isEditSalaryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">Edit Monthly Salary</h3>
                <button
                  onClick={() => setIsEditSalaryOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSalary} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Salary Amount (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={salaryInputStr}
                    onChange={(e) => setSalaryInputStr(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    This updates your primary salary pool for {monthName}.
                  </p>
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEditSalaryOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                  >
                    Save Salary
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Category Allocation Modal */}
        {isEditAllocOpen && editingCat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">
                  Allocate to {editingCat.name}
                </h3>
                <button
                  onClick={() => setIsEditAllocOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveAlloc} className="space-y-3.5">
                {allocError && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                    {allocError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deduct from Salary & Allocate to {editingCat.name} (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    placeholder="1000.00"
                    value={allocAmountStr}
                    onChange={(e) => setAllocAmountStr(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Available in Salary Pool: <strong>{formatPaise(unallocatedSalaryPaise)}</strong>
                  </p>
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEditAllocOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                  >
                    Save Allocation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Move Money Reallocation Modal */}
        {isMoveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">Reallocate Envelopes</h3>
                <button
                  onClick={() => setIsMoveModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleExecuteMove} className="space-y-3.5">
                {moveError && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                    {moveError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    From Envelope
                  </label>
                  <select
                    value={fromCatId}
                    onChange={(e) => setFromCatId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    To Envelope
                  </label>
                  <select
                    value={toCatId}
                    onChange={(e) => setToCatId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount to Move (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="500.00"
                    value={moveAmountStr}
                    onChange={(e) => setMoveAmountStr(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Extra grocery shopping"
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsMoveModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                  >
                    Execute Reallocation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
