"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PieChart, CalendarCheck, BarChart3, Plus } from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { setIsQuickAddOpen } = useApp();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Budgets", href: "/budgets", icon: PieChart },
    { label: "Add", isAction: true },
    { label: "Payments", href: "/payments", icon: CalendarCheck },
    { label: "Insights", href: "/insights", icon: BarChart3 },
  ];

  if (pathname === "/transactions/add") {
    return null;
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100/80 px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          if (item.isAction) {
            return (
              <button
                key="add-button"
                onClick={() => setIsQuickAddOpen(true)}
                className="flex flex-col items-center justify-center -mt-7 focus:outline-none group touch-target"
                aria-label="Add Transaction"
              >
                <div className="w-14 h-14 rounded-full bg-[#0047FF] text-white flex items-center justify-center shadow-[0_6px_20px_rgba(0,71,255,0.42)] active:scale-95 hover:bg-[#0038D1] transition-all">
                  <Plus size={26} strokeWidth={2.8} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 mt-0.5">Add</span>
              </button>
            );
          }

          const Icon = item.icon!;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl touch-target transition-colors relative ${
                isActive
                  ? "text-[#0047FF] font-bold"
                  : "text-slate-400 hover:text-[#0B1D3A]"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.9} />
              <span className="text-[11px] mt-1 font-medium">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 w-4 h-0.5 bg-[#0047FF] rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
