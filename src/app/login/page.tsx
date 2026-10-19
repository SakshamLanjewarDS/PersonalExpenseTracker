"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, ShieldCheck, Database } from "lucide-react";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabaseConfigured = isSupabaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (!supabaseConfigured) {
      // Local mode instant sign-in
      router.push("/");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md space-y-6">
        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center font-extrabold text-xl mx-auto shadow-sm">
            P
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#17211E] pt-2">
            Sign In to PocketPlan
          </h1>
          <p className="text-xs text-[#64716B]">Private personal expense planner</p>
        </div>

        {/* Configuration Notice if Supabase credentials pending */}
        {!supabaseConfigured && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
            <p className="font-semibold flex items-center space-x-1">
              <Database size={14} />
              <span>Standalone Local Mode Active</span>
            </p>
            <p className="text-[11px] text-amber-700">
              Supabase cloud credentials are not yet set in <code className="font-mono">.env.local</code>. Click below to continue directly to your local database.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-[#C24141] text-xs font-semibold rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required={supabaseConfigured}
                placeholder="your.name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <Link href="/recover" className="text-[11px] font-semibold text-[#0F766E] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required={supabaseConfigured}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs rounded-xl shadow-sm transition-colors touch-target flex items-center justify-center space-x-1.5"
          >
            <span>{supabaseConfigured ? "Sign In" : "Continue to PocketPlan"}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-[11px] text-slate-400">
            PocketPlan Single-User Deployment • Strict Data Isolation
          </p>
        </div>
      </div>
    </div>
  );
}
