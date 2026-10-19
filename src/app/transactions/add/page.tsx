"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers/AppProviders";

export default function AddTransactionPage() {
  const router = useRouter();
  const { setIsQuickAddOpen } = useApp();

  useEffect(() => {
    setIsQuickAddOpen(true);
    router.replace("/transactions");
  }, [setIsQuickAddOpen, router]);

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-[#F7F7FA]">
      <p className="text-xs text-slate-400 font-medium">Opening Add Transaction...</p>
    </div>
  );
}
