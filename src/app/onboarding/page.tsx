"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowRight, Wallet, Tag, Sparkles } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import { parseRupeesToPaise } from "@/lib/money/paise";
import { getTodayDateString, getCurrentMonthKey } from "@/lib/dates/dates";
import { DEFAULT_CATEGORIES } from "@/lib/services/financeService";

export default function OnboardingPage() {
  const router = useRouter();
  const { userId, triggerRefresh } = useApp();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [bankBalanceStr, setBankBalanceStr] = useState("25000");
  const [cashBalanceStr, setCashBalanceStr] = useState("3000");
  const [selectedCats, setSelectedCats] = useState<string[]>(
    DEFAULT_CATEGORIES.map((c) => c.name)
  );

  const toggleCategory = (catName: string) => {
    if (selectedCats.includes(catName)) {
      setSelectedCats(selectedCats.filter((c) => c !== catName));
    } else {
      setSelectedCats([...selectedCats, catName]);
    }
  };

  const handleFinishOnboarding = async () => {
    const today = getTodayDateString();
    const periodKey = getCurrentMonthKey();
    const now = new Date().toISOString();

    const bankPaise = parseRupeesToPaise(bankBalanceStr || "0");
    const cashPaise = parseRupeesToPaise(cashBalanceStr || "0");

    // 1. Create customized accounts
    await FinanceRepository.createAccount({
      id: `acc-bank-${userId}`,
      userId,
      name: "Primary Bank Account",
      type: "bank",
      openingBalancePaise: bankPaise,
      openingDate: today,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    await FinanceRepository.createAccount({
      id: `acc-cash-${userId}`,
      userId,
      name: "Cash in Hand",
      type: "cash",
      openingBalancePaise: cashPaise,
      openingDate: today,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create selected categories
    const chosenCategories = DEFAULT_CATEGORIES.filter((c) => selectedCats.includes(c.name));
    for (let i = 0; i < chosenCategories.length; i++) {
      const c = chosenCategories[i];
      const catId = `cat-${userId}-${i + 1}`;
      await FinanceRepository.createCategory({
        ...c,
        id: catId,
        userId,
        createdAt: now,
        updatedAt: now,
      });

      // Allocate initial monthly target
      if (c.targetPaise > 0) {
        await FinanceRepository.allocateBudget({
          userId,
          periodKey,
          categoryId: catId,
          allocatedPaise: c.targetPaise,
        });
      }
    }

    triggerRefresh();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#F7F8F5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md space-y-6">
        {/* Progress Dots */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  step === s
                    ? "w-8 bg-[#0F766E]"
                    : step > s
                    ? "w-2 bg-[#0F766E]/50"
                    : "w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-bold text-slate-400">Step {step} of 3</span>
        </div>

        {/* Step 1: Profile & Defaults */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#17211E]">Welcome to PocketPlan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Let&apos;s set up your private financial planner.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Display Name
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
              <p className="font-semibold text-slate-800">Default Currency & Timezone</p>
              <p className="text-slate-500">
                Primary Currency: <strong className="text-slate-700">INR (₹)</strong>
              </p>
              <p className="text-slate-500">
                Timezone: <strong className="text-slate-700">Asia/Kolkata (IST)</strong>
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-1.5"
            >
              <span>Next: Set Opening Balances</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Step 2: Opening Balances */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#17211E]">Opening Balances</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your real opening cash and bank balances as of today.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Bank Balance (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={bankBalanceStr}
                onChange={(e) => setBankBalanceStr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cash in Hand / Wallet (₹)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={cashBalanceStr}
                onChange={(e) => setCashBalanceStr(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="pt-2 flex space-x-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 bg-[#0F766E] text-white font-bold text-xs rounded-xl hover:bg-[#0D655E] flex items-center justify-center space-x-1"
              >
                <span>Choose Categories</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Categories */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#17211E]">Select Expense Categories</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the spending envelopes you want in your plan.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
              {DEFAULT_CATEGORIES.map((c) => {
                const isSelected = selectedCats.includes(c.name);
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggleCategory(c.name)}
                    className={`p-2.5 rounded-xl border text-left text-xs flex items-center justify-between transition-all ${
                      isSelected
                        ? "border-[#0F766E] bg-teal-50/50 text-[#0F766E] font-bold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {isSelected && <Check size={14} className="text-[#0F766E]" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex space-x-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Back
              </button>
              <button
                onClick={handleFinishOnboarding}
                className="flex-1 py-3 bg-[#0F766E] text-white font-bold text-xs rounded-xl hover:bg-[#0D655E] shadow-sm flex items-center justify-center space-x-1"
              >
                <Sparkles size={14} />
                <span>Complete Setup</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
