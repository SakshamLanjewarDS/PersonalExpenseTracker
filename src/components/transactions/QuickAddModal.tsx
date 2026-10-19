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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white flex flex-col justify-between">
      {/* Container max-w-md matching mobile shell */}
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col px-4 pt-3 pb-8 justify-between">
        <div className="space-y-4">
          {/* 1. Header with back button */}
          <div className="flex items-center space-x-2 py-1">
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#0B1D3A] hover:bg-slate-100 active:scale-95 transition-transform"
              aria-label="Back"
            >
              <ChevronLeft size={24} strokeWidth={2.4} />
            </button>
            <h1 className="text-xl font-bold text-[#0B1D3A]">Add transaction</h1>
          </div>

          {/* 2. Type Selector Tabs */}
          <div className="bg-slate-100/90 p-1 rounded-xl flex items-center">
            {(["expense", "income", "transfer", "refund"] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
                  type === t
                    ? "bg-[#1E5BFF] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#0B1D3A]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* 3. Amount Input (₹) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">
                ₹
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full bg-[#F7F7FA] border border-[#E7EBF2] pl-10 pr-4 py-3.5 text-2xl font-extrabold text-[#0B1D3A] rounded-2xl tabular-nums focus:outline-[#1E5BFF] placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* 4. Account & Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === "transfer" ? "From Account" : "Account"}
              </label>
              <div className="relative">
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full appearance-none bg-white border border-[#E7EBF2] px-3 py-2.5 text-xs font-medium text-[#0B1D3A] rounded-xl focus:outline-[#1E5BFF]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {type === "transfer" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  To Account
                </label>
                <div className="relative">
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full appearance-none bg-white border border-[#E7EBF2] px-3 py-2.5 text-xs font-medium text-[#0B1D3A] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white border border-[#E7EBF2] px-3 py-2.5 text-xs font-medium text-[#0B1D3A] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Category Tiles (Image 4 format with blue icons on subtle blue background) */}
          {type !== "transfer" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Category</label>
                {categories.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="text-xs font-semibold text-[#1E5BFF] hover:underline"
                  >
                    {showAllCategories ? "Show less" : "See all >"}
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
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? "border-[#1E5BFF] bg-[#EFF5FF] text-[#1E5BFF] shadow-xs"
                          : "border-[#E7EBF2] bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[#1E5BFF]">
                        <Icon size={20} strokeWidth={2.2} />
                      </div>
                      <span className="text-xs font-semibold mt-1.5 truncate max-w-[85px] text-center">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Payment Method Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment method
            </label>
            <div className="relative">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full appearance-none bg-white border border-[#E7EBF2] px-3 py-2.5 text-xs font-medium text-[#0B1D3A] rounded-xl focus:outline-[#1E5BFF]"
              >
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="netbanking">Net Banking</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 7. Merchant / Payee (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Merchant / Payee (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Swiggy, Amazon, Zomato"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full bg-white border border-[#E7EBF2] px-3 py-2.5 text-xs text-[#0B1D3A] rounded-xl focus:outline-[#1E5BFF] placeholder:text-slate-400"
            />
          </div>

          {/* 8. Note (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Monthly rent payment"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-white border border-[#E7EBF2] px-3 py-2.5 text-xs text-[#0B1D3A] rounded-xl focus:outline-[#1E5BFF] placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* 9. Save CTA Button */}
        <div className="pt-6">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#1E5BFF] hover:bg-[#1546CC] text-white font-bold text-sm rounded-xl shadow-[0_4px_14px_rgba(30,91,255,0.3)] disabled:opacity-50 active:scale-98 transition-all"
          >
            {isSubmitting ? "Saving..." : saveButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
