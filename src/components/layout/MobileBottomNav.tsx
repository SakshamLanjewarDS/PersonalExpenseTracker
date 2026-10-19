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

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E7EBF2] px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-2px_10px_rgba(11,29,58,0.03)]"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          if (item.isAction) {
            return (
              <button
                key="add-button"
                onClick={() => setIsQuickAddOpen(true)}
                className="flex flex-col items-center justify-center -mt-6 focus:outline-none group touch-target"
                aria-label="Add Transaction"
              >
                <div className="w-12 h-12 rounded-full bg-[#1E5BFF] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(30,91,255,0.38)] active:scale-95 hover:bg-[#1546CC] transition-all">
                  <Plus size={24} strokeWidth={2.6} />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 mt-1">Add</span>
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
                  ? "text-[#1E5BFF] font-semibold"
                  : "text-slate-500 hover:text-[#0B1D3A]"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.9} />
              <span className="text-[11px] mt-1">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 w-4 h-0.5 bg-[#1E5BFF] rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
