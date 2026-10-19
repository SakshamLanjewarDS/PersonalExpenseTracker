"use client";

import React from "react";
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";

export interface QuickActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  onClick?: () => void;
  badge?: string | number;
}

interface QuickActionGridProps {
  items?: QuickActionItem[];
  onExpenseClick?: () => void;
  onIncomeClick?: () => void;
  onTransferClick?: () => void;
}

export function QuickActionGrid({
  items,
  onExpenseClick,
  onIncomeClick,
  onTransferClick,
}: QuickActionGridProps) {
  const router = useRouter();
  const { setIsQuickAddOpen } = useApp();

  const defaultActions: QuickActionItem[] = [
    {
      id: "income",
      label: "Income",
      icon: ArrowDownLeft,
      onClick: onIncomeClick || (() => setIsQuickAddOpen(true)),
    },
    {
      id: "transfer",
      label: "Transfer",
      icon: ArrowRightLeft,
      onClick: onTransferClick || (() => router.push("/accounts")),
    },
    {
      id: "budgets",
      label: "Budgets",
      icon: Wallet,
      onClick: () => router.push("/budgets"),
    },
    {
      id: "accounts",
      label: "Accounts",
      icon: Wallet,
      onClick: () => router.push("/accounts"),
    },
  ];

  const actions = items && items.length > 0 ? items : defaultActions;

  return (
    <div className="grid grid-cols-4 gap-2.5 sm:gap-3 py-1">
      {actions.map((act) => {
        const Icon = act.icon;
        return (
          <button
            key={act.id}
            type="button"
            onClick={act.onClick}
            className="flex flex-col items-center justify-center group focus:outline-none touch-target"
            aria-label={act.label}
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[20px] bg-[#EEF3FF] group-hover:bg-[#E2ECFF] group-active:scale-95 text-[#0B1D3A] flex items-center justify-center transition-all shadow-[0_1px_2px_rgba(0,56,255,0.04)]">
              <Icon size={22} strokeWidth={2.4} />
            </div>
            <span className="text-xs font-semibold text-slate-600 group-hover:text-[#0B1D3A] mt-1.5 text-center truncate max-w-full">
              {act.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
