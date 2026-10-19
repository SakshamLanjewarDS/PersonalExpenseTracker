"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Calendar,
  X,
  Fuel,
  Home,
  Zap,
  Utensils,
  ShoppingCart,
  Smartphone,
  Tag,
  ArrowRightLeft,
  CreditCard,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import { parseRupeesToPaise } from "@/lib/money/paise";
import { getTodayDateString } from "@/lib/dates/dates";
import { Account, Category, TransactionType, PaymentMethod } from "@/types/database";

export function QuickAddModal() {
  const { userId, isQuickAddOpen, setIsQuickAddOpen, triggerRefresh } = useApp();

  const [type, setType] = useState<TransactionType>("expense");
  const [amountInput, setAmountInput] = useState("");
  const [date, setDate] = useState(() => getTodayDateString());
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isQuickAddOpen) {
      FinanceRepository.getAccounts(userId).then((accs) => {
        setAccounts(accs);
        if (accs.length > 0 && !accountId) {
          setAccountId(accs[0].id);
          if (accs.length > 1) setToAccountId(accs[1].id);
        }
      });
      FinanceRepository.getCategories(userId).then((cats) => {
        setCategories(cats);
        if (cats.length > 0 && !categoryId) {
          // Default to Room rent or first
          const defaultCat = cats.find((c) => c.name.toLowerCase().includes("rent")) || cats[0];
          setCategoryId(defaultCat.id);
        }
      });
      setErrorMsg(null);
    }
  }, [isQuickAddOpen, userId, accountId, categoryId]);

  if (!isQuickAddOpen) return null;

  const handleClose = () => {
    if (amountInput.trim() && parseFloat(amountInput) > 0) {
      if (!window.confirm("Discard uncompleted transaction?")) return;
    }
    setIsQuickAddOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let amountPaise = 0;
    try {
      amountPaise = parseRupeesToPaise(amountInput);
    } catch {
      setErrorMsg("Please enter a valid amount");
      return;
    }

    if (amountPaise <= 0) {
      setErrorMsg("Amount must be greater than zero");
      return;
    }

    if (!accountId) {
      setErrorMsg("Please select an account");
      return;
    }

    if (type === "transfer") {
      if (!toAccountId || toAccountId === accountId) {
        setErrorMsg("Please choose a different destination account for transfer");
        return;
      }
    }

    if (type === "expense" && !categoryId) {
      setErrorMsg("Please choose a category");
      return;
    }

    setIsSubmitting(true);
    try {
      const operationId = `op-quick-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      await FinanceRepository.recordTransaction({
        userId,
        operationId,
        type,
        amountPaise,
        date,
        accountId,
        toAccountId: type === "transfer" ? toAccountId : undefined,
        categoryId: type !== "transfer" ? categoryId : undefined,
        paymentMethod,
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        isSplit: false,
        isDeleted: false,
      });

      // Reset and close
      setAmountInput("");
      setMerchant("");
      setNote("");
      setIsQuickAddOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryIconComponent = (catName: string) => {
    const n = catName.toLowerCase();
    if (n.includes("petrol") || n.includes("fuel")) return Fuel;
    if (n.includes("rent") || n.includes("room")) return Home;
    if (n.includes("elect") || n.includes("power")) return Zap;
    if (n.includes("food") || n.includes("din")) return Utensils;
    if (n.includes("groc") || n.includes("market")) return ShoppingCart;
    if (n.includes("rech") || n.includes("phone")) return Smartphone;
    return Tag;
  };

  // Top 6 categories for primary grid
  const primaryCategories = categories.slice(0, 6);
  const displayedCategories = showAllCategories ? categories : primaryCategories;

  const saveButtonLabel =
    type === "expense"
      ? "Save expense"
      : type === "income"
      ? "Save income"
      : type === "transfer"
      ? "Save transfer"
      : "Save refund";

  const typeTiles = [
    { type: "expense" as TransactionType, label: "Expense", icon: CreditCard },
    { type: "income" as TransactionType, label: "Income", icon: ArrowDown },
    { type: "transfer" as TransactionType, label: "Transfer", icon: ArrowRightLeft },
    { type: "refund" as TransactionType, label: "Refund", icon: RotateCcw },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white flex flex-col justify-between">
      {/* Container max-w-md matching mobile shell */}
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-4 pt-4 pb-6 justify-between space-y-4">
        <div className="space-y-4">
          {/* 1. Header with X close button on left matching Image 4 Left */}
          <div className="flex items-center justify-between py-1 relative">
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[#0B1D3A] hover:bg-slate-100 active:scale-95 transition-transform"
              aria-label="Close"
            >
              <X size={22} strokeWidth={2.4} />
            </button>
            <h1 className="text-base font-bold text-[#0B1D3A] absolute left-1/2 -translate-x-1/2">
              Add Transaction
            </h1>
            <div className="w-10" />
          </div>

          {/* 2. Four Type Selector Tiles in a Row matching Image 4 Left */}
          <div className="grid grid-cols-4 gap-2">
            {typeTiles.map((t) => {
              const isSelected = type === t.type;
              const Icon = t.icon;

              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setType(t.type)}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl transition-all ${
                    isSelected
                      ? "bg-white border-2 border-[#0047FF] text-[#0047FF] shadow-xs"
                      : "bg-[#EEF3FF] border-2 border-transparent text-slate-600 hover:text-[#0B1D3A]"
                  }`}
                >
                  <Icon size={18} strokeWidth={2.2} />
                  <span className="text-[11px] font-bold mt-1 capitalize">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* 3. Royal Blue Amount Card matching Image 4 Left */}
          <div className="bg-[#0047FF] text-white p-5 rounded-[24px] shadow-[0_4px_20px_rgba(0,71,255,0.25)] space-y-1">
            <div className="flex items-center space-x-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-white">₹</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-3xl sm:text-4xl font-extrabold text-white placeholder:text-white/60 focus:outline-none tabular-nums"
              />
            </div>
            <p className="text-xs text-white/80 font-medium">Enter amount</p>
          </div>

          {/* 4. Account & Date Two-Column Row matching Image 4 Left */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                {type === "transfer" ? "From Account" : "Account"}
              </label>
              <div className="relative">
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full appearance-none bg-[#EEF3FF] border-0 px-3.5 py-3 text-xs font-bold text-[#0B1D3A] rounded-2xl focus:outline-[#0047FF]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {type === "transfer" ? (
              <div>
                <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                  To Account
                </label>
                <div className="relative">
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full appearance-none bg-[#EEF3FF] border-0 px-3.5 py-3 text-xs font-bold text-[#0B1D3A] rounded-2xl focus:outline-[#0047FF]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#0B1D3A] mb-1">Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#EEF3FF] border-0 px-3.5 py-2.5 text-xs font-bold text-[#0B1D3A] rounded-2xl focus:outline-[#0047FF]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Category Section (3x2 Grid) matching Image 4 Left */}
          {type !== "transfer" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <label className="text-xs font-bold text-[#0B1D3A]">Category</label>
                {categories.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="text-xs font-bold text-[#0047FF] hover:underline"
                  >
                    {showAllCategories ? "Show less" : "See all"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {displayedCategories.map((cat) => {
                  const isSelected = categoryId === cat.id;
                  const Icon = getCategoryIconComponent(cat.name);

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                        isSelected
                          ? "bg-white border-2 border-[#0047FF] text-[#0047FF] shadow-xs"
                          : "bg-[#EEF3FF] border-2 border-transparent text-[#0B1D3A] hover:bg-[#E4EDFF]"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                        <Icon size={20} strokeWidth={2.2} />
                      </div>
                      <span className="text-xs font-bold mt-1 truncate max-w-[85px] text-center">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Payment Method & Merchant Two-Column Row matching Image 4 Left */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                Payment Method
              </label>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full appearance-none bg-[#EEF3FF] border-0 px-3.5 py-3 text-xs font-bold text-[#0B1D3A] rounded-2xl focus:outline-[#0047FF]"
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="netbanking">Net Banking</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                Merchant (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Amazon, Swiggy"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full bg-[#EEF3FF] border-0 px-3.5 py-3 text-xs font-semibold text-[#0B1D3A] rounded-2xl focus:outline-[#0047FF] placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
          </div>

          {/* 7. Note (Optional) matching Image 4 Left */}
          <div>
            <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Monthly rent"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#EEF3FF] border-0 px-3.5 py-3 text-xs font-semibold text-[#0B1D3A] rounded-2xl focus:outline-[#0047FF] placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
        </div>

        {/* 8. Full-Width Charcoal Save Action Button matching Image 4 Left */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-4 bg-[#121316] hover:bg-black text-white font-bold text-sm rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.2)] disabled:opacity-50 active:scale-98 transition-all touch-target"
          >
            {isSubmitting ? "Saving..." : saveButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
