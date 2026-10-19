"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  BarChart2,
  FileText,
  Plus,
  CheckCircle2,
  ChevronRight,
  X,
  CreditCard,
  Clock,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import { Loan, Installment, PaymentOccurrence, Account, Category } from "@/types/database";
import { formatPaise, parseRupeesToPaise, subPaise, addPaise } from "@/lib/money/paise";
import { formatDateReadable, getTodayDateString } from "@/lib/dates/dates";
import { AppHeader } from "@/components/layout/AppHeader";

export default function PaymentsPage() {
  const { userId, selectedMonth, refreshKey, triggerRefresh } = useApp();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [occurrences, setOccurrences] = useState<PaymentOccurrence[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pay Installment Modal
  const [payingInst, setPayingInst] = useState<Installment | null>(null);
  const [payAmountStr, setPayAmountStr] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  // Create Loan Modal
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [loanName, setLoanName] = useState("");
  const [lender, setLender] = useState("");
  const [installmentAmountStr, setInstallmentAmountStr] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("12");
  const [historicalPaidCount, setHistoricalPaidCount] = useState("0");
  const [dueDay, setDueDay] = useState("5");
  const [loanCategoryId, setLoanCategoryId] = useState("");
  const [addLoanError, setAddLoanError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [ls, insts, occs, accs, cats] = await Promise.all([
          FinanceRepository.getLoans(userId),
          FinanceRepository.getInstallments(userId),
          FinanceRepository.getOccurrences(userId, selectedMonth),
          FinanceRepository.getAccounts(userId),
          FinanceRepository.getCategories(userId),
        ]);

        setLoans(ls);
        setInstallments(insts);
        setOccurrences(occs);
        setAccounts(accs);
        setCategories(cats);
        if (accs.length > 0) setPayAccountId(accs[0].id);
        if (cats.length > 0) setLoanCategoryId(cats[0].id);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [userId, selectedMonth, refreshKey]);

  const handleOpenPayInstallment = (inst: Installment) => {
    setPayingInst(inst);
    const unpaid = subPaise(inst.amountPaise, inst.paidAmountPaise);
    setPayAmountStr((unpaid / 100).toString());
    setPayError(null);
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInst) return;

    let amountPaise = 0;
    try {
      amountPaise = parseRupeesToPaise(payAmountStr);
    } catch {
      setPayError("Invalid payment amount format");
      return;
    }

    if (amountPaise <= 0) {
      setPayError("Payment amount must be greater than zero");
      return;
    }

    const unpaid = subPaise(payingInst.amountPaise, payingInst.paidAmountPaise);
    if (amountPaise > unpaid) {
      setPayError(
        `Payment cannot exceed remaining due amount (${formatPaise(unpaid)}).`
      );
      return;
    }

    if (!payAccountId) {
      setPayError("Please select a payment account");
      return;
    }

    try {
      await FinanceRepository.payInstallment({
        userId,
        installmentId: payingInst.id,
        accountId: payAccountId,
        paidAmountPaise: amountPaise,
        paymentDate: getTodayDateString(),
      });

      setPayingInst(null);
      triggerRefresh();
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : "Failed to record installment payment");
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoanError(null);

    if (!loanName.trim() || !lender.trim()) {
      setAddLoanError("Loan name and lender are required");
      return;
    }

    let instAmtPaise = 0;
    try {
      instAmtPaise = parseRupeesToPaise(installmentAmountStr);
    } catch {
      setAddLoanError("Invalid installment amount");
      return;
    }

    const totalCount = parseInt(totalInstallments, 10);
    const histCount = parseInt(historicalPaidCount, 10);
    const day = parseInt(dueDay, 10);

    if (isNaN(totalCount) || totalCount <= 0) {
      setAddLoanError("Total installments must be a positive integer");
      return;
    }
    if (isNaN(histCount) || histCount < 0 || histCount >= totalCount) {
      setAddLoanError("Historical paid count must be between 0 and total installments - 1");
      return;
    }
    if (isNaN(day) || day < 1 || day > 31) {
      setAddLoanError("Due day must be between 1 and 31");
      return;
    }

    try {
      const loan: Loan = {
        id: `loan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        name: loanName.trim(),
        lender: lender.trim(),
        installmentAmountPaise: instAmtPaise,
        totalInstallments: totalCount,
        historicalPaidCount: histCount,
        dueDay: day,
        categoryId: loanCategoryId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FinanceRepository.createLoanWithInstallments(loan);
      setIsAddLoanOpen(false);
      setLoanName("");
      setLender("");
      setInstallmentAmountStr("");
      triggerRefresh();
    } catch (err: unknown) {
      setAddLoanError(err instanceof Error ? err.message : "Failed to create EMI loan");
    }
  };

  const totalMonthlyEMIPaise = loans.reduce(
    (sum, l) => addPaise(sum, l.installmentAmountPaise),
    0
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F8FC]">
      {/* 1. Header matching Image 4 Right */}
      <AppHeader
        title="Payments & Loans (EMI)"
        action="settings"
        showMonthSelector={true}
        monthPlacement="right"
      />

      <main className="flex-1 px-4 py-3 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* Main EMI Card */}
        {loans.length === 0 ? (
          /* Empty State matching Image 4 Right */
          <section aria-label="No EMI Plans" className="space-y-4">
            <div className="relative w-full rounded-[26px] overflow-hidden select-none">
              <div className="bg-[#0047FF] text-white pt-6 px-6 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-white mb-3 shadow-inner">
                  <Calendar size={26} strokeWidth={2.2} />
                </div>
                <h2 className="text-2xl font-extrabold text-white">No EMI plans yet</h2>
                <p className="text-xs text-white/80 mt-1 max-w-[260px] leading-relaxed">
                  Keep due dates and repayments in one place.
                </p>
              </div>

              {/* Bottom split with recessed action button */}
              <div className="flex items-end bg-transparent">
                <div className="flex-1 bg-[#0047FF] h-12 rounded-bl-[26px]" />
                <div className="w-5 h-12 bg-[#0047FF] relative shrink-0">
                  <div className="absolute inset-0 bg-[#F7F8FC] rounded-tl-[20px]" />
                </div>
                <div className="w-[142px] h-12 bg-transparent flex items-center justify-end pr-0.5 shrink-0 relative">
                  <div className="absolute -top-3 right-0 w-3 h-3 bg-[#0047FF]">
                    <div className="w-full h-full bg-[#F7F8FC] rounded-br-[12px]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddLoanOpen(true)}
                    className="w-full h-11 bg-[#121316] hover:bg-black text-white rounded-2xl flex items-center justify-center space-x-1.5 font-bold text-xs shadow-[0_4px_12px_rgba(0,0,0,0.22)] active:scale-95 transition-transform touch-target"
                  >
                    <Plus size={15} strokeWidth={2.8} />
                    <span>Add plan</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Three feature rows matching Image 4 Right */}
            <div className="space-y-3 pt-1">
              <div className="bg-[#EEF3FF] p-4 rounded-[22px] flex items-center justify-between shadow-[0_1px_3px_rgba(0,56,255,0.03)]">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                    <Calendar size={20} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#0B1D3A]">Repayment schedule</h3>
                    <p className="text-xs text-slate-400 mt-0.5">View upcoming due dates.</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </div>

              <div className="bg-[#EEF3FF] p-4 rounded-[22px] flex items-center justify-between shadow-[0_1px_3px_rgba(0,56,255,0.03)]">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                    <BarChart2 size={20} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#0B1D3A]">Payment progress</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Track completed and pending payments.</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </div>

              <div className="bg-[#EEF3FF] p-4 rounded-[22px] flex items-center justify-between shadow-[0_1px_3px_rgba(0,56,255,0.03)]">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                    <FileText size={20} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#0B1D3A]">Partial payments</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Make or track partial repayments.</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </div>
            </div>
          </section>
        ) : (
          /* Populated EMI Plans */
          <section aria-label="Active EMI Plans" className="space-y-4">
            <div className="bg-[#0047FF] text-white p-5 rounded-[26px] shadow-[0_4px_16px_rgba(0,71,255,0.22)] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Monthly Commitment
                </p>
                <p className="text-3xl font-extrabold tracking-tight tabular-nums mt-1">
                  {formatPaise(totalMonthlyEMIPaise)}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Across {loans.length} active EMI plan{loans.length > 1 ? "s" : ""}
                </p>
              </div>

              <button
                onClick={() => setIsAddLoanOpen(true)}
                className="py-2.5 px-4 bg-[#121316] hover:bg-black text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all"
              >
                + Add plan
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-[#0B1D3A]">Active Plans ({loans.length})</h3>
              </div>

              {loans.map((loan) => {
                const loanInsts = installments.filter((i) => i.loanId === loan.id);
                const paidInsts = loanInsts.filter((i) => i.status === "paid");
                const nextDue = loanInsts.find((i) => i.status !== "paid");
                const totalPaidPaise = loanInsts.reduce(
                  (sum, i) => addPaise(sum, i.paidAmountPaise),
                  0
                );
                const totalLoanPaise = loan.installmentAmountPaise * loan.totalInstallments;
                const pct = totalLoanPaise > 0 ? Math.round((totalPaidPaise / totalLoanPaise) * 100) : 0;

                return (
                  <div
                    key={loan.id}
                    className="bg-[#EEF3FF] p-4 rounded-[22px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-[#0B1D3A]">{loan.name}</h4>
                        <p className="text-xs text-slate-400">{loan.lender}</p>
                      </div>
                      <span className="text-sm font-extrabold text-[#0B1D3A] tabular-nums">
                        {formatPaise(loan.installmentAmountPaise)}/mo
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500 font-medium">
                        <span>{paidInsts.length} of {loan.totalInstallments} paid</span>
                        <span className="font-bold text-[#0047FF]">{pct}%</span>
                      </div>
                      <div className="w-full bg-white/80 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#0047FF] h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>

                    {nextDue && (
                      <div className="pt-2 flex items-center justify-between border-t border-white/80">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Next Due</span>
                          <span className="text-xs font-bold text-[#0B1D3A]">
                            {formatDateReadable(nextDue.dueDate)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenPayInstallment(nextDue)}
                          className="py-2 px-3.5 bg-[#0047FF] hover:bg-[#0038D1] text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all"
                        >
                          Pay EMI
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Add EMI Loan Modal */}
        {isAddLoanOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">Add EMI Plan</h3>
                <button
                  onClick={() => setIsAddLoanOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateLoan} className="space-y-3">
                {addLoanError && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                    {addLoanError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Loan / EMI Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Phone EMI, Two Wheeler Loan"
                    value={loanName}
                    onChange={(e) => setLoanName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lender / Bank
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank, Bajaj Finserv"
                    value={lender}
                    onChange={(e) => setLender(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monthly EMI (₹)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="2500.00"
                      value={installmentAmountStr}
                      onChange={(e) => setInstallmentAmountStr(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Total Months
                    </label>
                    <input
                      type="number"
                      value={totalInstallments}
                      onChange={(e) => setTotalInstallments(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Already Paid Months
                    </label>
                    <input
                      type="number"
                      value={historicalPaidCount}
                      onChange={(e) => setHistoricalPaidCount(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Due Day (1-31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddLoanOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                  >
                    Create Plan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pay Installment Modal */}
        {payingInst && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">
                  Pay Installment #{payingInst.installmentNumber}
                </h3>
                <button
                  onClick={() => setPayingInst(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleExecutePayment} className="space-y-3.5">
                {payError && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                    {payError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pay from Account
                  </label>
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount to Pay (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={payAmountStr}
                    onChange={(e) => setPayAmountStr(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setPayingInst(null)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                  >
                    Record Payment
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
