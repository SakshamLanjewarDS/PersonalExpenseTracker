"use client";

import React from "react";
import { formatPaise } from "@/lib/money/paise";
import { formatDateReadable } from "@/lib/dates/dates";
import { Transaction, Category, Account } from "@/types/database";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

import { ChevronRight, MoreVertical } from "lucide-react";

interface CompactTransactionRowProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  subtitle?: string;
  rightAction?: "chevron" | "menu" | "type" | "none";
  onMenuClick?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  className?: string;
}

export function CompactTransactionRow({
  transaction,
  category,
  account,
  subtitle,
  rightAction = "type",
  onMenuClick,
  onClick,
  className = "",
}: CompactTransactionRowProps) {
  const isExpense = transaction.type === "expense";
  const isIncome = transaction.type === "income";

  const defaultSubtitle = `${formatDateReadable(transaction.date)}${
    account?.name ? ` • ${account.name}` : ""
  }`;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`bg-[#EEF3FF] hover:bg-[#E4EDFF] transition-colors rounded-[20px] p-3.5 flex items-center justify-between ${
        onClick ? "cursor-pointer active:scale-[0.99]" : ""
      } ${className}`}
    >
      {/* Left: White icon tile + Title & Date stacked */}
      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-white text-[#0047FF] flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,56,255,0.06)]">
          <CategoryIcon
            iconName={category?.icon || "tag"}
            size={18}
            className="!bg-transparent !w-full !h-full"
          />
        </div>
        <div className="min-w-0 pr-2">
          <h4 className="text-sm font-bold text-[#0B1D3A] truncate">
            {category?.name || transaction.merchant || "Transaction"}
          </h4>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
            {subtitle || defaultSubtitle}
          </p>
        </div>
      </div>

      {/* Right: Amount + Action (chevron or menu or type) */}
      <div className="flex items-center space-x-2 shrink-0 pl-1 text-right">
        <div>
          <span
            className={`text-sm font-extrabold tabular-nums block ${
              isExpense
                ? "text-[#0B1D3A]"
                : isIncome
                ? "text-emerald-600"
                : "text-[#0047FF]"
            }`}
          >
            {isExpense ? "- " : isIncome ? "+ " : ""}
            {formatPaise(transaction.amountPaise)}
          </span>
          {rightAction === "type" && (
            <span className="text-[11px] font-medium text-slate-400 capitalize block mt-0.5">
              {transaction.type}
            </span>
          )}
        </div>

        {rightAction === "chevron" && (
          <ChevronRight size={16} strokeWidth={2.4} className="text-slate-400 shrink-0" />
        )}

        {rightAction === "menu" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick?.(e);
            }}
            className="p-1 hover:bg-white/80 rounded-lg text-slate-400 hover:text-[#0B1D3A] transition-colors"
            aria-label="Transaction Options"
          >
            <MoreVertical size={16} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}
