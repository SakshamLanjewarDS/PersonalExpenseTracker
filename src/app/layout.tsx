import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { QuickAddModal } from "@/components/transactions/QuickAddModal";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

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
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                // Development: purge and unregister service workers on localhost to avoid stale code
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(regs) {
                      for (var i = 0; i < regs.length; i++) {
                        regs[i].unregister();
                      }
                    });
                  }
                  if ('caches' in window) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(k) {
                        caches.delete(k);
                      });
                    });
                  }
                } else {
                  // Production: register Service Worker for instant app loading (< 50ms) via cache
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js').catch(function(err) {
                        console.warn('[SW] Registration failed:', err);
                      });
                    });
                  }
                  // Clean up legacy cache versions
                  if ('caches' in window) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(k) {
                        if (k !== 'pocketplan-v4') {
                          caches.delete(k);
                        }
                      });
                    });
                  }
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
