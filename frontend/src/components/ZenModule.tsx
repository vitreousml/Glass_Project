"use client";

import React, { useState } from "react";
import { Compass, ArrowRight } from "lucide-react";
import { discoverCompositions } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ZenModule() {
  const { token } = useAuth();
  const [targetTg, setTargetTg] = useState<number>(850);
  const [tolerance, setTolerance] = useState<number>(20);
  const [model, setModel] = useState<string>("RF");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleDiscover = async () => {
    setLoading(true);
    try {
      const data = await discoverCompositions(targetTg, tolerance, model, token);
      setCandidates(data.candidates || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="clay-card clay-butter p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-black/30 shadow-sm shrink-0">
            <Compass className="w-7 h-7 text-amber-900 dark:text-amber-200" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-amber-100">
              Zen: Inverse Composition Discovery
            </h2>
            <p className="text-xs sm:text-sm opacity-80 mt-1 font-semibold">
              Input target $T_g$ in <strong>Kelvin (K)</strong> and screen candidate formulations in <strong>mol %</strong>.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Controls Card in Lavender */}
        <div className="clay-card clay-lavender p-6 space-y-4">
          <h3 className="font-black text-sm">
            Target Requirements
          </h3>

          <div>
            <label className="text-xs font-black block mb-1">
              Target $T_g$ (Kelvin)
            </label>
            <input
              type="number"
              value={targetTg}
              onChange={(e) => setTargetTg(parseFloat(e.target.value))}
              className="w-full px-3.5 py-2.5 clay-input font-mono font-black text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-black block mb-1">
              Tolerance Band (± K)
            </label>
            <input
              type="number"
              value={tolerance}
              onChange={(e) => setTolerance(parseFloat(e.target.value))}
              className="w-full px-3.5 py-2.5 clay-input font-mono font-black text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-black block mb-1">
              Inverse Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3.5 py-2.5 clay-input text-xs font-black"
            >
              <option value="RF">Random Forest (RF)</option>
              <option value="XGB">XGBoost (XGB)</option>
              <option value="KNN">K-Nearest Neighbors (KNN)</option>
              <option value="SVM">Support Vector Machine (SVM)</option>
            </select>
          </div>

          <button
            onClick={handleDiscover}
            disabled={loading}
            className="w-full py-3.5 px-4 clay-btn-accent font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 mt-4"
          >
            {loading ? "Screening Formulations..." : "Discover Compositions"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Discovery Results in Mint Card */}
        <div className="md:col-span-2 clay-card clay-mint p-6">
          <h3 className="font-black text-sm mb-4">
            Candidate Formulations {candidates.length > 0 && `(${candidates.length} matches)`}
          </h3>

          {candidates.length === 0 ? (
            <div className="clay-card clay-butter p-8 text-center text-xs font-black text-slate-800 dark:text-amber-100">
              No candidates generated yet. Set target and click Discover Compositions.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {candidates.map((c, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl clay-card clay-butter flex items-center justify-between text-xs"
                >
                  <div className="space-x-3 font-mono font-black text-slate-900">
                    <span className="text-indigo-900 font-black">SiO₂: {c.composition.SiO2}%</span>
                    <span className="text-slate-900">B₂O₃: {c.composition.B2O3}%</span>
                    <span className="text-slate-900">Na₂O: {c.composition.Na2O}%</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-emerald-900 font-black text-sm">
                      {c.predicted_tg} K
                    </span>
                    <span className="text-[10px] text-slate-700 font-black">Δ {c.difference} K</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
