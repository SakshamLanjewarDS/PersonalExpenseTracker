"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Settings, MoreVertical, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";
import { shiftMonthKey } from "@/lib/dates/dates";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  action?: "settings" | "overflow" | "none";
  onOverflowClick?: () => void;
  showMonthSelector?: boolean;
}

export function AppHeader({
  title = "Overview",
  showBack = false,
  backHref,
  action = "settings",
  onOverflowClick,
  showMonthSelector = true,
}: AppHeaderProps) {
  const router = useRouter();
  const { selectedMonth, setSelectedMonth } = useApp();

  const handlePrevMonth = () => {
    setSelectedMonth(shiftMonthKey(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(shiftMonthKey(selectedMonth, 1));
  };

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const [yearStr, monthStr] = selectedMonth.split("-");
  const monthDate = new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1));
  const monthName = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate);

  return (
    <header className="sticky top-0 z-30 bg-[#F7F7FA]/95 backdrop-blur-md px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-[#E7EBF2] md:border-b-0 md:bg-transparent">
      {/* Left: Back button + Title */}
      <div className="flex items-center space-x-2 min-w-0">
        {showBack && (
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#0B1D3A] hover:bg-slate-200/60 active:scale-95 transition-transform"
            aria-label="Go Back"
          >
            <ChevronLeft size={22} strokeWidth={2.4} />
          </button>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1D3A] truncate">
          {title}
        </h1>
      </div>

      {/* Right: Month Selector + Action Button */}
      <div className="flex items-center space-x-2 shrink-0">
        {showMonthSelector && (
          <div className="flex items-center bg-white border border-[#E7EBF2] rounded-xl px-1 py-0.5 shadow-[0_1px_2px_rgba(11,29,58,0.03)]">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-50 text-slate-500 hover:text-[#0B1D3A] rounded-lg transition-colors"
              aria-label="Previous Month"
            >
              <ChevronLeft size={16} strokeWidth={2.2} />
            </button>
            <span className="text-xs font-semibold px-1.5 text-[#0B1D3A] min-w-[70px] text-center select-none">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-50 text-slate-500 hover:text-[#0B1D3A] rounded-lg transition-colors"
              aria-label="Next Month"
            >
              <ChevronRight size={16} strokeWidth={2.2} />
            </button>
          </div>
        )}

        {/* Action Button: Settings or Overflow */}
        {action === "settings" && (
          <Link
            href="/settings"
            className="w-9 h-9 rounded-xl bg-white border border-[#E7EBF2] flex items-center justify-center text-slate-600 hover:text-[#0B1D3A] hover:bg-slate-50 shadow-[0_1px_2px_rgba(11,29,58,0.03)] transition-colors"
            aria-label="Settings"
          >
            <Settings size={18} strokeWidth={2} />
          </Link>
        )}

        {action === "overflow" && (
          <button
            onClick={onOverflowClick}
            className="w-9 h-9 rounded-xl bg-white border border-[#E7EBF2] flex items-center justify-center text-slate-600 hover:text-[#0B1D3A] hover:bg-slate-50 shadow-[0_1px_2px_rgba(11,29,58,0.03)] transition-colors"
            aria-label="More Options"
          >
            <MoreVertical size={18} strokeWidth={2} />
          </button>
        )}
      </div>
    </header>
  );
}
