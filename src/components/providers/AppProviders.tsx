"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCurrentMonthKey } from "@/lib/dates/dates";
import { FinanceRepository } from "@/lib/offline/repository";

interface AppContextType {
  userId: string;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  currency: string;
  isQuickAddOpen: boolean;
  setIsQuickAddOpen: (open: boolean) => void;
  isOnline: boolean;
  pendingSyncCount: number;
  refreshKey: number;
  triggerRefresh: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // In this single-user personal deployment, default to "user-primary" or local authenticated id
  const [userId] = useState<string>("user-primary");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);

  useEffect(() => {
    // Initialize starter data on mount
    FinanceRepository.initUserStarterData(userId).then(() => {
      triggerRefresh();
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [userId]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider
        value={{
          userId,
          selectedMonth,
          setSelectedMonth,
          currency: "INR",
          isQuickAddOpen,
          setIsQuickAddOpen,
          isOnline,
          pendingSyncCount,
          refreshKey,
          triggerRefresh,
        }}
      >
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProviders");
  }
  return context;
}
