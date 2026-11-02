"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  ArrowRightLeft,
  Pencil,
  X,
  ChevronRight,
  PieChart,
  Clock,
  MoreHorizontal,
  Plus,
  Trash2,
  ArrowUpRight,
  Check,
  Tag,
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
import { deriveCategoryBudget, deriveAccountBudgetPool } from "@/lib/services/financeService";
import { AppHeader } from "@/components/layout/AppHeader";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { NotchedFinancialCard } from "@/components/ui/NotchedFinancialCard";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";

const BUDGET_PRESETS = [
  { name: "Gym & Fitness", icon: "Dumbbell", color: "#10B981", target: "1500" },
  { name: "Entertainment", icon: "Film", color: "#8B5CF6", target: "2000" },
  { name: "Travel & Trips", icon: "Plane", color: "#06B6D4", target: "5000" },
  { name: "Education & Books", icon: "GraduationCap", color: "#F59E0B", target: "2500" },
  { name: "Gifts & Celebrations", icon: "Gift", color: "#EC4899", target: "1000" },
  { name: "Dining & Cafes", icon: "Coffee", color: "#EA580C", target: "1500" },
  { name: "Investments", icon: "TrendingUp", color: "#059669", target: "5000" },
  { name: "Personal Care", icon: "Sparkles", color: "#6366F1", target: "1200" },
];

const AVAILABLE_ICONS = [
  "Dumbbell",
  "Film",
  "Plane",
  "GraduationCap",
  "Gift",
  "Coffee",
  "Sparkles",
  "TrendingUp",
  "ShoppingBag",
  "ShoppingCart",
  "Utensils",
  "HeartPulse",
  "Bus",
  "Car",
  "Home",
  "Zap",
  "Fuel",
  "Smartphone",
  "CreditCard",
  "Tag",
];

const AVAILABLE_COLORS = [
  "#0047FF",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#EF4444",
  "#64748B",
];

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
  const [allocAccountId, setAllocAccountId] = useState("");
  const [allocError, setAllocError] = useState<string | null>(null);

  // Add Budget Modal state
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState("");
  const [newBudgetIcon, setNewBudgetIcon] = useState("ShoppingBag");
  const [newBudgetColor, setNewBudgetColor] = useState("#0047FF");
  const [newBudgetTargetStr, setNewBudgetTargetStr] = useState("");
  const [newBudgetAllocStr, setNewBudgetAllocStr] = useState("");
  const [newBudgetAllocAccountId, setNewBudgetAllocAccountId] = useState("");
  const [newBudgetRollover, setNewBudgetRollover] = useState(true);
  const [addBudgetError, setAddBudgetError] = useState<string | null>(null);

  // Delete Category Confirmation Modal state
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleOpenAddBudget = (preset?: typeof BUDGET_PRESETS[0]) => {
    if (preset) {
      setNewBudgetName(preset.name);
      setNewBudgetIcon(preset.icon);
      setNewBudgetColor(preset.color);
      setNewBudgetTargetStr(preset.target);
      setNewBudgetAllocStr(preset.target);
    } else {
      setNewBudgetName("");
      setNewBudgetIcon("ShoppingBag");
      setNewBudgetColor("#0047FF");
      setNewBudgetTargetStr("");
      setNewBudgetAllocStr("");
    }
    const defaultAcc =
      accounts.find((a) => a.type === "salary" || a.name.toLowerCase().includes("salary")) ||
      accounts[0];
    setNewBudgetAllocAccountId(defaultAcc?.id || "");
    setNewBudgetRollover(true);
    setAddBudgetError(null);
    setIsAddBudgetOpen(true);
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddBudgetError(null);

    const trimmedName = newBudgetName.trim();
    if (!trimmedName) {
      setAddBudgetError("Please enter a budget name");
      return;
    }

    // Check if category name already exists
    const nameExists = categories.some(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (nameExists) {
      setAddBudgetError(`A budget category named "${trimmedName}" already exists`);
      return;
    }

    let targetPaise = 0;
    if (newBudgetTargetStr.trim()) {
      try {
        targetPaise = parseRupeesToPaise(newBudgetTargetStr);
      } catch {
        setAddBudgetError("Please enter a valid target amount");
        return;
      }
      if (targetPaise < 0) {
        setAddBudgetError("Target amount cannot be negative");
        return;
      }
    }

    let allocPaise = 0;
    if (newBudgetAllocStr.trim()) {
      try {
        allocPaise = parseRupeesToPaise(newBudgetAllocStr);
      } catch {
        setAddBudgetError("Please enter a valid allocated amount");
        return;
      }
      if (allocPaise < 0) {
        setAddBudgetError("Allocated amount cannot be negative");
        return;
      }
    }

    try {
      const now = new Date().toISOString();
      const newCat: Category = {
        id: `cat-${userId}-${Date.now()}`,
        userId,
        name: trimmedName,
        icon: newBudgetIcon,
        color: newBudgetColor,
        sortOrder: categories.length + 1,
        targetPaise,
        rolloverEnabled: newBudgetRollover,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      await FinanceRepository.createCategory(newCat);

      if (allocPaise > 0) {
        await FinanceRepository.setAllocation({
          userId,
          periodKey: selectedMonth,
          categoryId: newCat.id,
          allocatedPaise: allocPaise,
          accountId: newBudgetAllocAccountId || accounts[0]?.id,
        });
      }

      setIsAddBudgetOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      setAddBudgetError(err instanceof Error ? err.message : "Failed to create budget");
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCat) return;
    setDeleteError(null);
    try {
      await FinanceRepository.deleteCategory(userId, deletingCat.id);
      setDeletingCat(null);
      triggerRefresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete budget");
    }
  };

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
    const existingAlloc = allocations.find((a) => a.categoryId === cat.id);
    const defaultAcc =
      accounts.find((a) => a.type === "salary" || a.name.toLowerCase().includes("salary")) ||
      accounts[0];
    setAllocAccountId(existingAlloc?.accountId || defaultAcc?.id || "");
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
        accountId: allocAccountId || undefined,
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
      id: "add-budget",
      label: "Add Budget",
      icon: Plus,
      onClick: () => handleOpenAddBudget(),
    },
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
      id: "history",
      label: "History",
      icon: Clock,
      onClick: () => router.push("/transactions"),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F8FC]">
      {/* 1. Header */}
      <AppHeader
        greeting="Hi Saksham!"
        action="settings"
        showMonthSelector={true}
        monthPlacement="subtitle"
      />

      <main className="flex-1 px-4 py-3 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* 2. Total Salary Notched Card */}
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

        {/* 4. Segmented Control + Add Budget Button */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-[#EEF3FF] p-1 rounded-2xl flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab("funded")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "funded"
                  ? "bg-[#0047FF] text-white shadow-xs"
                  : "text-slate-600 hover:text-[#0B1D3A]"
              }`}
            >
              Funded ({fundedBudgets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-[#0047FF] text-white shadow-xs"
                  : "text-slate-600 hover:text-[#0B1D3A]"
              }`}
            >
              All ({categories.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenAddBudget()}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white text-xs font-bold rounded-2xl shadow-xs transition-colors shrink-0 cursor-pointer touch-target"
          >
            <Plus size={15} strokeWidth={2.6} />
            <span>Add Budget</span>
          </button>
        </div>

        {/* 5. Category Cards List */}
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
                {/* Top: Icon + Name + Percentage + Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]"
                      style={{ color: category.color || "#0047FF" }}
                    >
                      <CategoryIcon iconName={category.icon} size={18} className="!bg-transparent" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[#0B1D3A] truncate">
                        {category.name}
                      </h3>
                      {category.targetPaise > 0 && (
                        <p className="text-[10px] text-slate-400 font-medium">
                          Target: {formatPaise(category.targetPaise)}/mo
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        isOver ? "text-red-600" : "text-slate-500"
                      }`}
                    >
                      {isNotFunded ? "0%" : `${pct}%`}
                    </span>

                    <button
                      type="button"
                      onClick={() => setDeletingCat(category)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
                      title="Delete Budget Category"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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

                {/* Footer: Left status text + Action Links */}
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

                  <div className="flex items-center space-x-3">
                    {/* View Transactions Link */}
                    <button
                      type="button"
                      onClick={() => router.push(`/transactions?category=${category.id}`)}
                      className="text-slate-500 hover:text-[#0047FF] font-semibold text-xs flex items-center space-x-0.5 transition-colors cursor-pointer py-1 px-1.5 rounded-lg hover:bg-white/50"
                      title="View all transactions for this budget"
                    >
                      <span>History</span>
                      <ArrowUpRight size={12} strokeWidth={2.4} />
                    </button>

                    {/* Reallocate Link */}
                    <button
                      type="button"
                      onClick={() => handleOpenMove(category.id)}
                      className="text-slate-500 hover:text-[#0047FF] font-semibold text-xs flex items-center space-x-0.5 transition-colors cursor-pointer py-1 px-1.5 rounded-lg hover:bg-white/50"
                      title="Move funds to/from this envelope"
                    >
                      <ArrowRightLeft size={11} strokeWidth={2.2} />
                      <span>Move</span>
                    </button>

                    {/* Edit Allocation */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditAlloc(category, allocatedPaise)}
                      className="text-[#0047FF] font-bold text-xs hover:underline flex items-center space-x-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-white/50"
                    >
                      <Pencil size={12} strokeWidth={2.4} />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bottom Add Budget Button */}
          <button
            type="button"
            onClick={() => handleOpenAddBudget()}
            className="w-full py-3.5 px-4 border-2 border-dashed border-[#0047FF]/30 hover:border-[#0047FF] bg-white/60 hover:bg-[#EEF3FF]/50 rounded-[22px] text-[#0047FF] text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-[0_1px_3px_rgba(0,56,255,0.02)] cursor-pointer touch-target"
          >
            <Plus size={16} strokeWidth={2.4} />
            <span>Add Another Budget Envelope</span>
          </button>

          {/* Unfunded Categories Banner */}
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

        {/* --- MODAL: Add New Budget Category --- */}
        {isAddBudgetOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsAddBudgetOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF5FF] text-[#0047FF] flex items-center justify-center">
                    <Plus size={18} strokeWidth={2.6} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#0B1D3A]">Add Budget Envelope</h3>
                    <p className="text-[11px] text-slate-400">Create & allocate a new spending category</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddBudgetOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateBudget} className="space-y-3.5">
                {addBudgetError && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                    {addBudgetError}
                  </div>
                )}

                {/* Quick Presets */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Quick Suggestions
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BUDGET_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleOpenAddBudget(preset)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors flex items-center space-x-1 ${
                          newBudgetName === preset.name
                            ? "bg-[#0047FF] text-white"
                            : "bg-slate-100 hover:bg-[#EFF5FF] hover:text-[#0047FF] text-slate-700"
                        }`}
                      >
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Budget / Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gym & Fitness, Vacation, Education"
                    value={newBudgetName}
                    onChange={(e) => setNewBudgetName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                {/* Icon Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Choose Icon
                  </label>
                  <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-1 bg-slate-50 border border-[#E7EBF2] rounded-xl">
                    {AVAILABLE_ICONS.map((iconName) => {
                      const isSelected = newBudgetIcon === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setNewBudgetIcon(iconName)}
                          className={`p-2 rounded-lg flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? "bg-[#0047FF] text-white shadow-xs"
                              : "hover:bg-white text-slate-600"
                          }`}
                        >
                          <CategoryIcon
                            iconName={iconName}
                            size={16}
                            className={`!w-7 !h-7 !bg-transparent ${isSelected ? "!text-white" : ""}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Theme Color
                  </label>
                  <div className="flex items-center space-x-2">
                    {AVAILABLE_COLORS.map((hex) => {
                      const isSelected = newBudgetColor === hex;
                      return (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setNewBudgetColor(hex)}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative"
                          style={{ backgroundColor: hex }}
                        >
                          {isSelected && <Check size={14} className="text-white drop-shadow-xs" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly Target Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Target Budget (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 2500"
                    value={newBudgetTargetStr}
                    onChange={(e) => setNewBudgetTargetStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Your planned spending limit for this envelope.
                  </p>
                </div>

                {/* Allocate for Current Month */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fund / Allocate for {monthName} (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 2500 (leave 0 if not funded yet)"
                    value={newBudgetAllocStr}
                    onChange={(e) => setNewBudgetAllocStr(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                {/* Source Account for Allocation */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fund from Account
                  </label>
                  <select
                    value={newBudgetAllocAccountId}
                    onChange={(e) => setNewBudgetAllocAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    {accounts.map((acc) => {
                      const pool = deriveAccountBudgetPool({
                        account: acc,
                        transactions,
                        allocations,
                        allAccounts: accounts,
                      });
                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatPaise(pool.remainingPoolPaise)} available)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Rollover Toggle */}
                <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newBudgetRollover}
                    onChange={(e) => setNewBudgetRollover(e.target.checked)}
                    className="rounded text-[#0047FF] focus:ring-[#0047FF]"
                  />
                  <span>Roll over unspent balance to next month</span>
                </label>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddBudgetOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#0047FF] text-white font-semibold text-xs rounded-xl hover:bg-[#0038CC] shadow-xs"
                  >
                    Create & Save Budget
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL: Delete Budget Confirmation --- */}
        {deletingCat && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeletingCat(null);
            }}
          >
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-red-600 flex items-center space-x-2">
                  <Trash2 size={18} />
                  <span>Delete Budget Envelope</span>
                </h3>
                <button
                  onClick={() => setDeletingCat(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove the budget category{" "}
                <strong className="text-[#0B1D3A]">"{deletingCat.name}"</strong>? Its allocations for
                this period will be released back into your available pool.
              </p>

              {deleteError && (
                <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                  {deleteError}
                </div>
              )}

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setDeletingCat(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCategory}
                  className="flex-1 py-2.5 bg-red-600 text-white font-semibold text-xs rounded-xl hover:bg-red-700"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL: Edit Salary --- */}
        {isEditSalaryOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsEditSalaryOpen(false);
            }}
          >
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

        {/* --- MODAL: Edit Category Allocation --- */}
        {isEditAllocOpen && editingCat && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsEditAllocOpen(false);
            }}
          >
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
                    Deduct from Account
                  </label>
                  <select
                    value={allocAccountId}
                    onChange={(e) => setAllocAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    {accounts.map((acc) => {
                      const pool = deriveAccountBudgetPool({
                        account: acc,
                        transactions,
                        allocations,
                        allAccounts: accounts,
                      });
                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatPaise(pool.remainingPoolPaise)} remaining)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Allocate to {editingCat.name} (₹)
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
                  {(() => {
                    const selectedAcc = accounts.find((a) => a.id === allocAccountId);
                    if (selectedAcc) {
                      const pool = deriveAccountBudgetPool({
                        account: selectedAcc,
                        transactions,
                        allocations,
                        allAccounts: accounts,
                      });
                      return (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Available pool in {selectedAcc.name}:{" "}
                          <strong className="text-[#0B1D3A]">{formatPaise(pool.remainingPoolPaise)}</strong>
                        </p>
                      );
                    }
                    return (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Available in Salary Pool: <strong>{formatPaise(unallocatedSalaryPaise)}</strong>
                      </p>
                    );
                  })()}
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

        {/* --- MODAL: Move Money Reallocation --- */}
        {isMoveModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMoveModalOpen(false);
            }}
          >
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
