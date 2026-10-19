"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabaseConfigured = isSupabaseConfigured();

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (!supabaseConfigured) {
      setSubmitted(true);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Password recovery request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md space-y-5">
        <Link
          href="/login"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#0F766E] hover:underline"
        >
          <ArrowLeft size={14} />
          <span>Back to Sign In</span>
        </Link>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#17211E]">Password Recovery</h1>
          <p className="text-xs text-[#64716B] mt-1">
            Enter your email to receive recovery instructions.
          </p>
        </div>

        {submitted ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
              <CheckCircle2 size={16} />
              <span>Recovery Link Sent</span>
            </div>
            <p className="text-xs text-emerald-700">
              If an account with {email} exists, an email has been sent with instructions to reset your password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRecover} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-[#C24141] text-xs font-semibold rounded-xl">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="your.name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs rounded-xl shadow-sm transition-colors touch-target"
            >
              Send Recovery Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
