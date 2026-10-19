"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ListOrdered,
  Wallet,
  PieChart,
  CalendarClock,
  BarChart3,
  Settings,
  Plus,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";

export function DesktopSidebar() {
  const pathname = usePathname();
  const { setIsQuickAddOpen, isOnline, pendingSyncCount } = useApp();

  const links = [
    { label: "Home", href: "/", icon: Home },
    { label: "Transactions", href: "/transactions", icon: ListOrdered },
    { label: "Accounts", href: "/accounts", icon: Wallet },
    { label: "Budgets", href: "/budgets", icon: PieChart },
    { label: "Payments & EMI", href: "/payments", icon: CalendarClock },
    { label: "Insights", href: "/insights", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white min-h-screen px-4 py-6 justify-between shrink-0">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center space-x-2.5 px-2">
          <div className="w-8 h-8 rounded-xl bg-[#1E5BFF] text-white flex items-center justify-center font-bold text-base shadow-sm">
            P
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-[#0B1D3A]">PocketPlan</h1>
            <p className="text-[11px] text-slate-500">Personal Finance</p>
          </div>
        </div>

        {/* Quick Add Button */}
        <button
          onClick={() => setIsQuickAddOpen(true)}
          className="w-full flex items-center justify-center space-x-2 bg-[#1E5BFF] text-white py-2.5 px-4 rounded-xl font-semibold text-sm shadow-sm hover:bg-[#1546CC] transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#1E5BFF]"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Add Transaction</span>
        </button>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-[#EFF5FF] text-[#1E5BFF] font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Connectivity & Offline Sync Status */}
      <div className="border-t border-slate-100 pt-4 px-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center space-x-1.5">
            {isOnline ? (
              <span className="flex items-center space-x-1 text-emerald-600">
                <Wifi size={14} />
                <span>Online</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-amber-600">
                <WifiOff size={14} />
                <span>Offline</span>
              </span>
            )}
          </span>
          {pendingSyncCount > 0 && (
            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-medium">
              {pendingSyncCount} pending
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
