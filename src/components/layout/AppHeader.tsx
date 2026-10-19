"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Settings, MoreVertical, Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";
import { shiftMonthKey } from "@/lib/dates/dates";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  greeting?: string;
  showBack?: boolean;
  backHref?: string;
  action?: "settings" | "overflow" | "bell" | "none";
  onOverflowClick?: () => void;
  showMonthSelector?: boolean;
  monthPlacement?: "right" | "subtitle";
}

export function AppHeader({
  title = "Overview",
  subtitle,
  greeting,
  showBack = false,
  backHref,
  action = "settings",
  onOverflowClick,
  showMonthSelector = true,
  monthPlacement = "right",
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
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const [yearStr, monthStr] = selectedMonth.split("-");
  const monthDate = new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1));
  const monthName = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate);
  const shortMonthName = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate);

  return (
    <header className="sticky top-0 z-30 bg-[#F7F8FC]/95 backdrop-blur-md px-4 pt-4 pb-2.5 flex items-center justify-between border-b border-slate-100/60 md:border-b-0 md:bg-transparent">
      {/* Left: Greeting / Title */}
      <div className="flex items-center space-x-2.5 min-w-0">
        {showBack && (
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#0B1D3A] hover:bg-slate-200/60 active:scale-95 transition-transform"
            aria-label="Go Back"
          >
            <ChevronLeft size={22} strokeWidth={2.4} />
          </button>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0B1D3A] truncate">
            {greeting || title}
          </h1>
          {monthPlacement === "subtitle" && showMonthSelector ? (
            <div className="flex items-center space-x-1.5 mt-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="text-slate-400 hover:text-[#0B1D3A] p-0.5 rounded"
                aria-label="Previous Month"
              >
                <ChevronLeft size={13} strokeWidth={2.5} />
              </button>
              <span className="text-xs font-semibold text-slate-500 hover:text-[#0B1D3A] select-none">
                {monthName}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="text-slate-400 hover:text-[#0B1D3A] p-0.5 rounded"
                aria-label="Next Month"
              >
                <ChevronRight size={13} strokeWidth={2.5} />
              </button>
            </div>
          ) : subtitle ? (
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right: Month Selector Pill + Settings / Overflow Action */}
      <div className="flex items-center space-x-2 shrink-0">
        {showMonthSelector && monthPlacement === "right" && (
          <div className="flex items-center bg-white border border-[#E7EBF2] rounded-full px-1.5 py-1 shadow-[0_1px_2px_rgba(0,56,255,0.03)]">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-50 text-slate-400 hover:text-[#0B1D3A] rounded-full transition-colors"
              aria-label="Previous Month"
            >
              <ChevronLeft size={14} strokeWidth={2.4} />
            </button>
            <span className="text-[11px] font-bold px-1.5 text-[#0B1D3A] min-w-[65px] text-center select-none">
              {shortMonthName}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-50 text-slate-400 hover:text-[#0B1D3A] rounded-full transition-colors"
              aria-label="Next Month"
            >
              <ChevronRight size={14} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* Bell Action with red notification dot */}
        {action === "bell" && (
          <Link
            href="/settings"
            className="w-9 h-9 rounded-full bg-white border border-[#E7EBF2] flex items-center justify-center text-slate-600 hover:text-[#0B1D3A] hover:bg-slate-50 shadow-[0_1px_2px_rgba(0,56,255,0.03)] transition-colors relative"
            aria-label="Notifications & Settings"
          >
            <Bell size={17} strokeWidth={2.2} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          </Link>
        )}

        {action === "settings" && (
          <Link
            href="/settings"
            className="w-9 h-9 rounded-full sm:rounded-xl bg-white border border-[#E7EBF2] flex items-center justify-center text-slate-600 hover:text-[#0B1D3A] hover:bg-slate-50 shadow-[0_1px_2px_rgba(0,56,255,0.03)] transition-colors"
            aria-label="Settings"
          >
            <Settings size={18} strokeWidth={2} />
          </Link>
        )}

        {action === "overflow" && (
          <button
            onClick={onOverflowClick}
            className="w-9 h-9 rounded-full sm:rounded-xl bg-white border border-[#E7EBF2] flex items-center justify-center text-slate-600 hover:text-[#0B1D3A] hover:bg-slate-50 shadow-[0_1px_2px_rgba(0,56,255,0.03)] transition-colors"
            aria-label="More Options"
          >
            <MoreVertical size={18} strokeWidth={2} />
          </button>
        )}
      </div>
    </header>
  );
}
