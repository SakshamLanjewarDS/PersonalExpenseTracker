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
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icon-192.png",
  },
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-purge stale service worker caches and unregister on localhost during development
              if (typeof window !== 'undefined') {
                if ('serviceWorker' in navigator && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    for (var i = 0; i < regs.length; i++) {
                      regs[i].unregister();
                    }
                  });
                }
                if ('caches' in window) {
                  caches.keys().then(function(keys) {
                    keys.forEach(function(k) {
                      if (k !== 'pocketplan-v3') {
                        caches.delete(k);
                      }
                    });
                  });
                }
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-[#F7F8FC] text-[#0B1D3A] antialiased">
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
