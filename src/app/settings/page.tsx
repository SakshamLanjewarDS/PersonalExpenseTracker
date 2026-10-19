"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Download,
  Upload,
  Smartphone,
  Database,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { FinanceRepository } from "@/lib/offline/repository";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";

export default function SettingsPage() {
  const { userId, triggerRefresh } = useApp();

  const [supabaseStatus, setSupabaseStatus] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSupabaseStatus(isSupabaseConfigured());

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleDownloadCSV = async () => {
    setExportLoading(true);
    try {
      const csvContent = await FinanceRepository.exportToCSV(userId);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `pocketplan_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadJSON = async () => {
    setExportLoading(true);
    try {
      const jsonContent = await FinanceRepository.exportToJSON(userId);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `pocketplan_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExportLoading(false);
    }
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreStatus(null);
    setRestoreError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await FinanceRepository.restoreFromJSON(userId, text);
        setRestoreStatus(
          `Successfully restored: ${res.importedCounts.transactions} transactions, ${res.importedCounts.categories} categories, and ${res.importedCounts.accounts} accounts.`
        );
        triggerRefresh();
      } catch (err: unknown) {
        setRestoreError(err instanceof Error ? err.message : "Failed to restore backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleTriggerInstall = async () => {
    if (installPrompt && typeof (installPrompt as { prompt: () => void }).prompt === "function") {
      (installPrompt as { prompt: () => void }).prompt();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <AppHeader title="Settings & Backups" />

      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Backend & Offline Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2.5">
            <Database size={18} className="text-[#0F766E]" />
            <h3 className="text-sm font-bold text-[#17211E]">Persistence & Backend Status</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">IndexedDB Local Store</p>
                <p className="text-[11px] text-slate-500">Dexie offline engine active</p>
              </div>
              <span className="flex items-center space-x-1 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 size={16} />
                <span>Ready</span>
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Supabase Cloud Sync</p>
                <p className="text-[11px] text-slate-500">
                  {supabaseStatus ? "Connected" : "Local mode (env credentials pending)"}
                </p>
              </div>
              <span
                className={`flex items-center space-x-1 text-xs font-semibold ${
                  supabaseStatus ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {supabaseStatus ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{supabaseStatus ? "Connected" : "Local Mode"}</span>
              </span>
            </div>
          </div>

          {!supabaseStatus && (
            <p className="text-xs text-slate-500 bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl">
              <strong>Note on Cloud Persistence:</strong> PocketPlan is currently operating in local-first IndexedDB mode. All data is persisted locally and immediately usable. To connect Supabase PostgreSQL & Auth, update <code className="font-mono text-slate-700">.env.local</code> with your Supabase URL and anon key, and execute the migration in <code className="font-mono text-slate-700">supabase/migrations/</code>.
            </p>
          )}
        </div>

        {/* Data Export & Backup */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck size={18} className="text-[#1E5BFF]" />
            <h3 className="text-sm font-bold text-[#0B1D3A]">Export & Recoverable Backups</h3>
          </div>
          <p className="text-xs text-slate-500">
            Export your complete financial records. CSV export features spreadsheet formula-injection protection. JSON backup contains all accounts, allocations, loans, and schedules for validated restoration.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownloadCSV}
              disabled={exportLoading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center space-x-2 touch-target"
            >
              <FileSpreadsheet size={16} className="text-emerald-700" />
              <span>Download CSV Report</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              disabled={exportLoading}
              className="px-4 py-2.5 bg-[#1E5BFF] hover:bg-[#1546CC] text-white text-xs font-semibold rounded-xl transition-colors flex items-center space-x-2 shadow-2xs touch-target"
            >
              <FileCode size={16} />
              <span>Full JSON Backup</span>
            </button>
          </div>

          {/* Restore Section */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Restore from JSON Backup</h4>

            {restoreStatus && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
                {restoreStatus}
              </div>
            )}
            {restoreError && (
              <div className="p-3 bg-red-50 border border-red-200 text-[#C24141] text-xs rounded-xl font-medium">
                {restoreError}
              </div>
            )}

            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileRestore}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center space-x-2"
            >
              <Upload size={15} />
              <span>Select Backup File to Restore</span>
            </button>
          </div>
        </div>

        {/* PWA & Mobile Installation Guide */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2.5">
            <Smartphone size={18} className="text-[#1E5BFF]" />
            <h3 className="text-sm font-bold text-[#0B1D3A]">Mobile App Installation (PWA)</h3>
          </div>

          <p className="text-xs text-slate-500">
            PocketPlan is a Progressive Web App (PWA) with offline capabilities. Install it on your home screen for instant access with an app icon.
          </p>

          {installPrompt ? (
            <button
              onClick={handleTriggerInstall}
              className="px-4 py-2.5 bg-[#1E5BFF] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#1546CC] transition-colors"
            >
              Install PocketPlan on this Device
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-800">iPhone / iPad (iOS Safari)</p>
                <p className="text-[11px] text-slate-500">
                  Tap the <strong className="text-slate-700">Share</strong> icon (box with upward arrow) at the bottom of Safari, then select <strong className="text-slate-700">Add to Home Screen</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-800">Android (Chrome)</p>
                <p className="text-[11px] text-slate-500">
                  Tap the three dots menu in Chrome, then choose <strong className="text-slate-700">Install app</strong> or <strong className="text-slate-700">Add to Home screen</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
