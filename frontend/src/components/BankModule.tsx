"use client";

import React, { useState, useEffect } from "react";
import { Database, Info } from "lucide-react";
import { getBankSummary } from "@/lib/api";

export default function BankModule() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBankSummary()
      .then((data) => setSummary(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner in User's Butter Pastel */}
      <div className="clay-card clay-butter p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-black/30 shadow-sm shrink-0">
            <Database className="w-7 h-7 text-amber-900 dark:text-amber-200" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-amber-100">
              Bank: Glass Systems & Property Exploration
            </h2>
            <p className="text-xs sm:text-sm opacity-80 mt-1 font-semibold">
              Explore known glass systems and parameter envelopes. Raw records remain private server-side.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Notice in Peach */}
      <div className="clay-card clay-peach p-5 flex items-start gap-3.5 text-xs font-black">
        <Info className="w-5 h-5 flex-shrink-0 text-amber-700 mt-0.5" />
        <div>
          <span className="font-black uppercase tracking-wider">Data Governance Status:</span> <code>glass_data.csv</code> is kept private on the server. Summary boundaries reflect the complete 480 training compositions.
        </div>
      </div>

      {loading ? (
        <div className="clay-card p-10 text-center text-xs font-black opacity-60">
          Loading Bank data envelopes...
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="clay-card clay-mint p-6">
            <span className="text-xs font-black uppercase tracking-wider opacity-75">Glass System</span>
            <div className="text-lg font-black mt-2">
              {summary.system}
            </div>
            <div className="text-xs font-black mt-3 font-mono">
              480 Reference Compositions
            </div>
          </div>

          <div className="clay-card clay-sky p-6">
            <span className="text-xs font-black uppercase tracking-wider opacity-75">Target Property</span>
            <div className="text-lg font-black mt-2">
              Glass Transition ($T_g$)
            </div>
            <div className="text-xs font-black mt-3 font-mono">
              Kelvin (K) Confirmed
            </div>
          </div>

          <div className="clay-card clay-butter p-6">
            <span className="text-xs font-black uppercase tracking-wider opacity-75">Composition Basis</span>
            <div className="text-lg font-black mt-2">
              Mole Percentage (mol %)
            </div>
            <div className="text-xs font-black mt-3 font-mono">
              Sum = 100 mol %
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
