"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  ArrowRightLeft,
  Building2,
  Wallet,
  PiggyBank,
  Pencil,
  MoreVertical,
  X,
  Trash2,
  Settings,
  AlertTriangle,
  Clock,
  LayoutGrid,
  Landmark,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import { Account, Transaction, AccountType } from "@/types/database";
import { formatPaise, parseRupeesToPaise, addPaise } from "@/lib/money/paise";
import { deriveAccountBalance } from "@/lib/services/financeService";
import { getTodayDateString } from "@/lib/dates/dates";
import { AppHeader } from "@/components/layout/AppHeader";
import { NotchedFinancialCard } from "@/components/ui/NotchedFinancialCard";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";

export default function AccountsPage() {
  const { userId, refreshKey, triggerRefresh } = useApp();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Transfer modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [transferAmountStr, setTransferAmountStr] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);

  // Add account modal
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<AccountType>("bank");
  const [newAccBalanceStr, setNewAccBalanceStr] = useState("0");
  const [newAccDesc, setNewAccDesc] = useState("");
  const [addAccError, setAddAccError] = useState<string | null>(null);

  // Edit account modal
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editAccName, setEditAccName] = useState("");
  const [editAccType, setEditAccType] = useState<AccountType>("bank");
  const [editAccBalanceStr, setEditAccBalanceStr] = useState("");
  const [editAccDesc, setEditAccDesc] = useState("");
  const [editAccError, setEditAccError] = useState<string | null>(null);

  // Clean Slate Confirmation modal
  const [isCleanSlateConfirmOpen, setIsCleanSlateConfirmOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [accs, txs] = await Promise.all([
          FinanceRepository.getAccounts(userId),
          FinanceRepository.getTransactions(userId),
        ]);
        setAccounts(accs);
        setTransactions(txs);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [userId, refreshKey]);

  // Derived balances
  const accountsWithBalances = accounts.map((acc) => ({
    account: acc,
    ...deriveAccountBalance(acc, transactions),
  }));

  const totalLiquidPaise = accountsWithBalances.reduce(
    (sum, a) => addPaise(sum, a.balancePaise),
    0
  );

  const handleOpenTransfer = (defaultFromId?: string) => {
    setFromAccountId(defaultFromId || accounts[0]?.id || "");
    const other = accounts.find((a) => a.id !== (defaultFromId || accounts[0]?.id));
    setToAccountId(other?.id || "");
    setTransferAmountStr("");
    setTransferNote("");
    setTransferError(null);
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    let amountPaise = 0;
    try {
      amountPaise = parseRupeesToPaise(transferAmountStr);
    } catch {
      setTransferError("Please enter a valid transfer amount");
      return;
    }

    if (amountPaise <= 0) {
      setTransferError("Transfer amount must be greater than zero");
      return;
    }

    if (fromAccountId === toAccountId) {
      setTransferError("Source and destination accounts must be different");
      return;
    }

    try {
      const operationId = `op-transf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await FinanceRepository.recordTransaction({
        userId,
        operationId,
        type: "transfer",
        amountPaise,
        date: getTodayDateString(),
        accountId: fromAccountId,
        toAccountId,
        note: transferNote.trim() || "Account Transfer",
        isSplit: false,
        isDeleted: false,
      });

      setIsTransferModalOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : "Transfer failed");
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAccError(null);

    if (!newAccName.trim()) {
      setAddAccError("Account name is required");
      return;
    }

    let openingPaise = 0;
    try {
      openingPaise = parseRupeesToPaise(newAccBalanceStr || "0");
    } catch {
      setAddAccError("Invalid opening balance format");
      return;
    }

    try {
      const newAcc: Account = {
        id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        name: newAccName.trim(),
        type: newAccType,
        openingBalancePaise: openingPaise,
        currency: "INR",
        description: newAccDesc.trim() || undefined,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FinanceRepository.saveAccount(newAcc);
      setIsAddAccountOpen(false);
      setNewAccName("");
      setNewAccBalanceStr("0");
      setNewAccDesc("");
      triggerRefresh();
    } catch (err: unknown) {
      setAddAccError(err instanceof Error ? err.message : "Failed to create account");
    }
  };

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setEditAccName(acc.name);
    setEditAccType(acc.type);
    setEditAccBalanceStr((acc.openingBalancePaise / 100).toString());
    setEditAccDesc(acc.description || "");
    setEditAccError(null);
  };

  const handleSaveEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditAccError(null);

    if (!editAccName.trim()) {
      setEditAccError("Account name is required");
      return;
    }

    let openingPaise = 0;
    try {
      openingPaise = parseRupeesToPaise(editAccBalanceStr || "0");
    } catch {
      setEditAccError("Invalid opening balance format");
      return;
    }

    try {
      await FinanceRepository.updateAccount(userId, editingAccount.id, {
        name: editAccName.trim(),
        type: editAccType,
        openingBalancePaise: openingPaise,
        description: editAccDesc.trim() || undefined,
      });

      setEditingAccount(null);
      triggerRefresh();
    } catch (err: unknown) {
      setEditAccError(err instanceof Error ? err.message : "Failed to update account");
    }
  };

  const handleDeleteAccount = async (accId: string) => {
    if (!window.confirm("Are you sure you want to delete this account?")) return;
    await FinanceRepository.deleteAccount(userId, accId);
    setEditingAccount(null);
    triggerRefresh();
  };

  const handleCleanSlateWipe = async () => {
    await FinanceRepository.clearAllUserData(userId);
    setIsCleanSlateConfirmOpen(false);
    triggerRefresh();
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case "salary":
      case "bank":
        return Building2;
      case "savings":
        return PiggyBank;
      default:
        return Wallet;
    }
  };

  const router = useRouter();

  const totalAccountSpendingPaise = accountsWithBalances.reduce(
    (sum, a) => addPaise(sum, a.totalExpensesPaise),
    0
  );

  const accountQuickActions = [
    {
      id: "transfer",
      label: "Transfer",
      icon: ArrowRightLeft,
      onClick: () => handleOpenTransfer(),
    },
    {
      id: "edit",
      label: "Edit",
      icon: Pencil,
      onClick: () => {
        if (accounts.length > 0) handleOpenEditAccount(accounts[0]);
      },
    },
    {
      id: "history",
      label: "History",
      icon: Clock,
      onClick: () => router.push("/transactions"),
    },
    {
      id: "more",
      label: "More",
      icon: LayoutGrid,
      onClick: () => setIsCleanSlateConfirmOpen(true),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F8FC]">
      {/* 1. Header matching Image 3 Left */}
      <AppHeader
        title="Accounts"
        subtitle="Manage your accounts"
        showBack={true}
        backHref="/"
        action="settings"
        showMonthSelector={true}
        monthPlacement="right"
      />

      <main className="flex-1 px-4 py-3 md:px-6 md:py-6 max-w-md md:max-w-5xl mx-auto w-full space-y-4">
        {/* 2. Total Balance Notched Card matching Image 3 Left */}
        <section aria-label="Total Account Balance">
          <NotchedFinancialCard
            title="TOTAL BALANCE"
            amount={totalLiquidPaise}
            subtitle="Reflects all bank accounts and cash in hand."
            stat1Label="Accounts"
            stat1Value={accounts.length.toString()}
            stat2Label="Account spending"
            stat2Value={formatPaise(totalAccountSpendingPaise)}
            actionText="Add account"
            onActionClick={() => setIsAddAccountOpen(true)}
          />
        </section>

        {/* 3. Four-Column Quick-Action Grid */}
        <section aria-label="Quick Actions">
          <QuickActionGrid items={accountQuickActions} />
        </section>

        {/* 4. Accounts List Section matching Image 3 Left */}
        <section aria-label="Accounts List" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-[#0B1D3A]">Accounts</h2>
            <button
              onClick={() => setIsAddAccountOpen(true)}
              className="text-xs font-bold text-[#0047FF] hover:underline"
            >
              See all &gt;
            </button>
          </div>

          {accountsWithBalances.map(({ account, balancePaise, totalExpensesPaise }) => {
            const IconComponent = getAccountIcon(account.type);
            const isMain =
              account.type === "salary" ||
              account.name.toLowerCase().includes("salary");

            return (
              <div
                key={account.id}
                className="bg-[#EEF3FF] p-4 rounded-[22px] shadow-[0_1px_3px_rgba(0,56,255,0.03)] space-y-3"
              >
                {/* Top Row: Icon + Name/Badge + Menu */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
                      <IconComponent size={20} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-[#0B1D3A] truncate">
                          {account.name}
                        </h3>
                        {isMain ? (
                          <span className="bg-white/90 text-[#0047FF] border border-[#0047FF]/20 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                            Main Salary
                          </span>
                        ) : account.type === "savings" ? (
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                            Savings
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 capitalize">
                        {account.type === "salary"
                          ? "Salary Account"
                          : `${account.type} Account`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEditAccount(account)}
                    className="p-1.5 text-slate-400 hover:text-[#0B1D3A] hover:bg-white/80 rounded-lg transition-colors shrink-0"
                    aria-label="Account Options"
                  >
                    <MoreVertical size={18} strokeWidth={2.2} />
                  </button>
                </div>

                {/* Bottom Row: Current Balance (Left) & Opening / Spending (Right) */}
                <div className="flex items-end justify-between pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">
                      Current Balance
                    </span>
                    <span className="text-xl font-extrabold text-[#0B1D3A] tabular-nums block mt-0.5">
                      {formatPaise(balancePaise)}
                    </span>
                  </div>

                  <div className="text-right text-xs">
                    <p className="text-[11px] text-slate-400">
                      Opening: <span className="font-semibold text-slate-600">{formatPaise(account.openingBalancePaise)}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Account spending: <span className="font-semibold text-slate-600">{formatPaise(totalExpensesPaise)}</span>
                    </p>
                  </div>
                </div>

                {/* Footnote */}
                <p className="text-[10px] text-slate-400 pt-1 border-t border-white/60">
                  Balances reflect recorded account activity.
                </p>
              </div>
            );
          })}
        </section>

        {/* Transfer Modal */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">Transfer Between Accounts</h3>
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleExecuteTransfer} className="space-y-3.5">
                {transferError && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                    {transferError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    From Account
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
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
                    To Account
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
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
                    Amount (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="1000.00"
                    value={transferAmountStr}
                    onChange={(e) => setTransferAmountStr(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Moved to emergency fund"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                  >
                    Execute Transfer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Account Modal */}
        {isAddAccountOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">Add New Account</h3>
                <button
                  onClick={() => setIsAddAccountOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-3.5">
                {addAccError && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                    {addAccError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Savings, Cash Wallet"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Type
                  </label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="salary">Salary Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="cash">Cash Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newAccBalanceStr}
                    onChange={(e) => setNewAccBalanceStr(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddAccountOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Account Modal */}
        {editingAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-[#0B1D3A]">Edit Account</h3>
                <button
                  onClick={() => setEditingAccount(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEditAccount} className="space-y-3.5">
                {editAccError && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs font-medium rounded-xl">
                    {editAccError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={editAccName}
                    onChange={(e) => setEditAccName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Type
                  </label>
                  <select
                    value={editAccType}
                    onChange={(e) => setEditAccType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="salary">Salary Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="cash">Cash Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editAccBalanceStr}
                    onChange={(e) => setEditAccBalanceStr(e.target.value)}
                    className="w-full px-3 py-2.5 text-base font-bold tabular-nums bg-slate-50 border border-[#E7EBF2] rounded-xl focus:outline-[#1E5BFF]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between space-x-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(editingAccount.id)}
                    className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    aria-label="Delete Account"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#1E5BFF] text-white font-semibold text-xs rounded-xl hover:bg-[#1546CC]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Clean Slate Confirmation Modal */}
        {isCleanSlateConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center space-x-3 text-amber-600">
                <AlertTriangle size={24} />
                <h3 className="font-bold text-base text-[#0B1D3A]">Clear Sample Data</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will reset dummy transactions while preserving your primary accounts so you can input your real data manually.
              </p>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCleanSlateConfirmOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCleanSlateWipe}
                  className="flex-1 py-2.5 bg-red-600 text-white font-semibold text-xs rounded-xl hover:bg-red-700"
                >
                  Reset Sample Data
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
