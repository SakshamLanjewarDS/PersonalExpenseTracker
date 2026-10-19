"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  ArrowRightLeft,
  Pencil,
  X,
  ChevronRight,
  LayoutGrid,
  PieChart,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { NotchedFinancialCard } from "@/components/ui/NotchedFinancialCard";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";

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

  const handleOpenEditAlloc = (cat: Category, currentAllocatedPaise: number = 0) => {
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
        allocatedPaise: targetPaise,
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

  const router = useRouter();

  const budgetActions = [
    {
      id: "allocate",
      label: "Allocate",
      icon: PieChart,
      onClick: () => {
        if (categories.length > 0) {
          const firstCat = categories[0];
          const alloc =
            allocations.find((a) => a.categoryId === firstCat.id)?.allocatedPaise || 0;
          handleOpenEditAlloc(firstCat, alloc);
        }
      },
    },
    {
      id: "reallocate",
      label: "Reallocate",
      icon: ArrowRightLeft,
      onClick: () => handleOpenMove(),
    },
    {
      id: "categories",
      label: "Categories",
      icon: LayoutGrid,
      onClick: () => setActiveTab("all"),
    },
    {
      id: "history",
      label: "History",
      icon: Clock,
      onClick: () => router.push("/transactions"),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F8FC]">
      {/* 1. Header matching Image 1 Middle */}
      <AppHeader
        greeting="Hi Saksham!"
        action="settings"
        showMonthSelector={true}
        monthPlacement="subtitle"
      />

      <main className="flex-1 px-4 py-3 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* 2. Total Salary Notched Card matching Image 1 Middle */}
        <section aria-label="Salary Pool Card">
          <NotchedFinancialCard
            title="Total Salary"
            amount={monthlySalaryPaise}
            subtitle="Monthly fixed income"
            stat1Label="Allocated"
            stat1Value={formatPaise(totalAllocated)}
            stat2Label="Unallocated"
            stat2Value={formatPaise(unallocatedSalaryPaise)}
            actionText="Edit salary"
            onActionClick={() => setIsEditSalaryOpen(true)}
          />
        </section>

        {/* 3. Four-Column Quick-Action Grid */}
        <section aria-label="Quick Actions">
          <QuickActionGrid items={budgetActions} />
        </section>

        {/* 4. Segmented Control: Funded (X) & All (X) */}
        <div className="bg-[#EEF3FF] p-1 rounded-2xl flex items-center">
          <button
            onClick={() => setActiveTab("funded")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "funded"
                ? "bg-[#0047FF] text-white shadow-xs"
                : "text-slate-600 hover:text-[#0B1D3A]"
            }`}
          >
            Funded ({fundedBudgets.length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "all"
                ? "bg-[#0047FF] text-white shadow-xs"
                : "text-slate-600 hover:text-[#0B1D3A]"
            }`}
          >
            All ({categories.length})
          </button>
        </div>

        {/* 5. Category Cards List matching Image 1 Middle */}
        <section aria-label="Category Envelopes" className="space-y-3">
          {displayedBudgets.map(({ category, availablePaise, netSpentPaise, allocatedPaise }) => {
            const pct = allocatedPaise > 0 ? Math.round((netSpentPaise / allocatedPaise) * 100) : 0;
            const isOver = availablePaise < 0;
            const isNotFunded = allocatedPaise === 0;

            return (
              <div
                key={category.id}
                className="bg-[#EEF3FF] p-4 rounded-[22px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] space-y-3"
              >
                {/* Top: Icon + Name + Percentage */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                      <CategoryIcon iconName={category.icon} size={18} className="!bg-transparent" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1D3A] truncate">
                      {category.name}
                    </h3>
                  </div>

                  <span
                    className={`text-xs font-bold tabular-nums shrink-0 ${
                      isOver ? "text-red-600" : "text-slate-500"
                    }`}
                  >
                    {isNotFunded ? "0%" : `${pct}%`}
                  </span>
                </div>

                {/* Middle: 3 Columns: Allocated | Spent | Remaining */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Allocated</span>
                    <span className="font-bold text-[#0B1D3A] tabular-nums">
                      {formatPaise(allocatedPaise)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Spent</span>
                    <span className="font-bold text-[#0B1D3A] tabular-nums">
                      {formatPaise(netSpentPaise)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Remaining</span>
                    <span
                      className={`font-bold tabular-nums ${
                        isOver ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {isOver
                        ? `- ${formatPaise(Math.abs(availablePaise))}`
                        : formatPaise(availablePaise)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/80 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOver ? "bg-red-500" : "bg-[#0047FF]"
                    }`}
                    style={{
                      width: `${isNotFunded ? 0 : Math.min(100, Math.max(0, pct))}%`,
                    }}
                  />
                </div>

                {/* Footer: Over budget text / Left text + Edit Action */}
                <div className="flex items-center justify-between pt-0.5 text-xs">
                  <span
                    className={`font-medium ${
                      isOver
                        ? "text-red-500"
                        : isNotFunded
                        ? "text-slate-400"
                        : "text-emerald-600"
                    }`}
                  >
                    {isOver
                      ? `${formatPaise(Math.abs(availablePaise))} over budget`
                      : isNotFunded
                      ? "Not funded"
                      : `${formatPaise(availablePaise)} left`}
                  </span>

                  <button
                    onClick={() => handleOpenEditAlloc(category, allocatedPaise)}
                    className="text-[#0047FF] font-bold text-xs hover:underline flex items-center space-x-1"
                  >
                    <Pencil size={12} strokeWidth={2.4} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Unfunded Categories Banner matching Image 1 Middle */}
          {activeTab === "funded" && unfundedBudgets.length > 0 && (
            <button
              onClick={() => setActiveTab("all")}
              className="w-full bg-[#EEF3FF] hover:bg-[#E4EDFF] transition-colors p-4 rounded-[22px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] flex items-center justify-between text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white text-slate-500 flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                  <MoreHorizontal size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0B1D3A]">
                    {unfundedBudgets.length} categories not funded
                  </p>
                  <p className="text-xs text-slate-400">Allocate from your salary pool</p>
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
