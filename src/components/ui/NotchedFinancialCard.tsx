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
  title = "TOTAL BALANCE",
  amount,
  subtitle = "Reflects all bank accounts and cash in hand.",
  topRightIcon,
  stat1Label = "Accounts",
  stat1Value,
  stat2Label = "Account spending",
  stat2Value,
  actionText = "Add account",
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
      : "₹9,500";

  const displayStat1Val =
    stat1Value !== undefined
      ? stat1Value
      : "1";

  const displayStat2Val =
    stat2Value !== undefined
      ? stat2Value
      : spentPaise !== undefined
      ? formatPaise(spentPaise)
      : undefined;

  const handleAction = onActionClick || onAddClick;

  return (
    <div className={`relative w-full select-none ${className}`}>
      {/* 1. Upper Blue Block: Title, Amount, Subtitle with rounded top and curved lower-right */}
      <div
        className="w-full bg-[#0047FF] text-white pt-5 px-5 pb-3.5 rounded-t-[26px] rounded-br-[24px] shadow-[0_8px_24px_rgba(0,71,255,0.2)]"
        style={{ backgroundColor: "#0047FF" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">
              {title}
            </p>
            <p className="text-3xl sm:text-[34px] font-extrabold tracking-tight tabular-nums text-white mt-1">
              {displayAmount}
            </p>
            {subtitle && (
              <p className="text-xs font-normal text-white/90 mt-1 max-w-[270px] leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {topRightIcon && (
            <div className="text-white/80 pt-1 shrink-0">{topRightIcon}</div>
          )}
        </div>
      </div>

      {/* 2. Lower Section: Left Blue Stats & Right Recessed Cutout with Dark Button */}
      <div className="relative flex items-center justify-between -mt-px">
        {/* Left Blue Stats Container with Fillet on top-right */}
        <div
          className="relative bg-[#0047FF] text-white px-5 pt-2 pb-4 rounded-bl-[26px] rounded-br-[16px] flex items-center shrink-0 shadow-[0_8px_24px_rgba(0,71,255,0.15)]"
          style={{ backgroundColor: "#0047FF" }}
        >
          <div className="flex items-center space-x-3.5">
            <div>
              <p className="text-[11px] font-medium text-white/70">{stat1Label}</p>
              <p className="text-sm font-bold tabular-nums text-white mt-0.5">
                {displayStat1Val}
              </p>
            </div>

            {displayStat2Val && (
              <>
                <div className="h-5 w-px bg-white/20 self-center" />
                <div>
                  <p className="text-[11px] font-medium text-white/70">{stat2Label}</p>
                  <p className="text-sm font-bold tabular-nums text-white mt-0.5">
                    {displayStat2Val}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Mathematically Perfect Inward Concave Fillet Curve */}
          <div className="absolute top-0 -right-5 w-5 h-5 pointer-events-none">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="w-5 h-5 text-[#0047FF]"
              style={{ color: "#0047FF" }}
            >
              <path
                d="M 0 0 H 20 A 20 20 0 0 0 0 20 Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        {/* Recessed Notch Cutout Area containing the Dark Button */}
        <div className="flex-1 flex justify-end items-center pl-6 pt-1.5 pb-0.5 pr-0.5">
          <button
            type="button"
            onClick={handleAction}
            className="h-[44px] px-4 sm:px-5 bg-[#1E2226] hover:bg-[#15181B] active:scale-[0.98] text-white rounded-[20px] flex items-center justify-center space-x-1.5 font-bold text-xs sm:text-[13px] shadow-[0_4px_16px_rgba(0,0,0,0.22)] transition-all touch-target cursor-pointer shrink-0"
            style={{ backgroundColor: "#1E2226" }}
          >
            {actionIcon ? (
              actionIcon
            ) : (
              <Plus size={16} strokeWidth={2.4} />
            )}
            <span>{actionText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotchedFinancialCard;
