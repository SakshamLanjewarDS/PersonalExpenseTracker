import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { QuickAddModal } from "@/components/transactions/QuickAddModal";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

export const metadata: Metadata = {
  title: "PocketPlan — Personal Expense & Budget Planner",
  description: "Private, mobile-first personal finance application for disciplined envelope budgeting, recurring bills, and offline tracking.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PocketPlan",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0F766E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-[#F7F7FA] text-[#0B1D3A] antialiased">
        <AppProviders>
          <div className="flex min-h-screen">
            <DesktopSidebar />
            <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
              {children}
            </div>
          </div>
          <QuickAddModal />
          <MobileBottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
