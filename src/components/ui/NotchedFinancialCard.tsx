"use client";

import React from "react";
import { Plus } from "lucide-react";
import { formatPaise } from "@/lib/money/paise";

interface NotchedFinancialCardProps {
  title?: string;
  amount: string | number;
  subtitle?: string;
  topRightIcon?: React.ReactNode;
  stat1Label?: string;
  stat1Value?: string;
  stat2Label?: string;
  stat2Value?: string;
  actionText?: string;
  actionIcon?: React.ReactNode;
  onActionClick?: () => void;
  // Legacy compatibility props:
  balancePaise?: number;
  allocatedPaise?: number;
  spentPaise?: number;
  onAddClick?: () => void;
  className?: string;
}

export function NotchedFinancialCard({
  title = "Budget Remaining",
  amount,
  subtitle = "of ₹7,000 allocated",
  topRightIcon,
  stat1Label = "Spent",
  stat1Value,
  stat2Label = "used",
  stat2Value,
  actionText = "Add expense",
  actionIcon,
  onActionClick,
  // Legacy
  balancePaise,
  allocatedPaise,
  spentPaise,
  onAddClick,
  className = "",
}: NotchedFinancialCardProps) {
  // Support legacy or new props
  const displayAmount =
    amount !== undefined
      ? typeof amount === "number"
        ? formatPaise(amount)
        : amount
      : balancePaise !== undefined
      ? formatPaise(balancePaise)
      : "₹0";

  const displayStat1Val =
    stat1Value !== undefined
      ? stat1Value
      : spentPaise !== undefined
      ? formatPaise(spentPaise)
      : undefined;

  const displayStat2Val =
    stat2Value !== undefined
      ? stat2Value
      : allocatedPaise !== undefined && spentPaise !== undefined && allocatedPaise > 0
      ? `${Math.round((spentPaise / allocatedPaise) * 100)}%`
      : undefined;

  const handleAction = onActionClick || onAddClick;

  return (
    <div className={`relative w-full select-none ${className}`}>
      {/* 
        The notched card is composed of:
        - Top section: Full width deep blue (#0047FF), rounded top corners (26px)
        - Bottom section:
          - Left: Deep blue (#0047FF) containing supporting stats with divider
          - Fillet: smooth inward concave corner
          - Right: Recessed notch (transparent) containing the dark (#121316) action button
      */}
      <div className="relative rounded-[26px] overflow-hidden">
        {/* Main Blue Card Top */}
        <div className="bg-[#0047FF] text-white pt-5 px-5 pb-2">
          {/* Top row: Title/Amount + Signal/Chart Icon */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                {title}
              </p>
              <p className="text-3xl sm:text-[34px] font-extrabold tracking-tight tabular-nums text-white mt-1">
                {displayAmount}
              </p>
              {subtitle && (
                <p className="text-xs font-medium text-white/80 mt-1">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Top Right Icon (3-bar chart or custom) */}
            <div className="text-white/80 pt-1">
              {topRightIcon ? (
                topRightIcon
              ) : (
                <div className="flex items-end space-x-1 h-5 pt-0.5" aria-hidden="true">
                  <span className="w-1 h-2 bg-white/70 rounded-full" />
                  <span className="w-1 h-3.5 bg-white/70 rounded-full" />
                  <span className="w-1 h-5 bg-white rounded-full" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom split: Left blue stats & Right recessed cutout with dark action button */}
        <div className="flex items-end bg-transparent">
          {/* Left blue segment with stats */}
          <div className="flex-1 bg-[#0047FF] text-white px-5 pb-4 pt-2.5 rounded-bl-[26px]">
            {displayStat1Val ? (
              <div className="flex items-center space-x-4">
                <div>
                  <p className="text-[11px] font-medium text-white/70">{stat1Label}</p>
                  <p className="text-sm font-bold tabular-nums text-white mt-0.5">
                    {displayStat1Val}
                  </p>
                </div>

                {displayStat2Val && (
                  <>
                    <div className="h-6 w-px bg-white/20 self-center" />
                    <div>
                      <p className="text-sm font-bold tabular-nums text-white">
                        {displayStat2Val}
                      </p>
                      <p className="text-[11px] font-medium text-white/70">{stat2Label}</p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="h-6" />
            )}
          </div>

          {/* Curved fillet connecting left blue to notch */}
          <div className="w-5 h-12 bg-[#0047FF] relative shrink-0">
            <div className="absolute inset-0 bg-[#F7F8FC] rounded-tl-[20px]" />
          </div>

          {/* Recessed Notch area on bottom right with the dark button */}
          <div className="w-[142px] h-12 bg-transparent flex items-center justify-end pr-0.5 shrink-0 relative">
            {/* Top-right fillet connecting top blue to right side */}
            <div className="absolute -top-3 right-0 w-3 h-3 bg-[#0047FF]">
              <div className="w-full h-full bg-[#F7F8FC] rounded-br-[12px]" />
            </div>

            <button
              type="button"
              onClick={handleAction}
              className="w-full h-11 bg-[#121316] hover:bg-black text-white rounded-2xl flex items-center justify-center space-x-1.5 font-bold text-xs shadow-[0_4px_12px_rgba(0,0,0,0.22)] active:scale-95 transition-transform touch-target"
            >
              {actionIcon ? (
                actionIcon
              ) : (
                <Plus size={15} strokeWidth={2.8} />
              )}
              <span>{actionText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
