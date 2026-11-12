"use client";

import React, { useState } from "react";
import { PERIODIC_ELEMENTS, ElementData } from "@/data/elements";
import { Sparkles, Layers, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { predictTg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface PredictResult {
  property: string;
  model: string;
  value: number;
  unit: string;
  warnings: string[];
  composition_basis: string;
}

const MODEL_CHOICES = [
  { id: "RF", name: "Random Forest", mae: "14.85 K", r2: "0.878", desc: "Top accuracy across 80/20 test split.", colorClass: "clay-butter" },
  { id: "XGB", name: "XGBoost", mae: "15.75 K", r2: "0.873", desc: "Gradient boosted decision trees.", colorClass: "clay-mint" },
  { id: "KNN", name: "K-Nearest Neighbors", mae: "17.82 K", r2: "0.840", desc: "Distance-weighted composition regression.", colorClass: "clay-sky" },
  { id: "SVM", name: "Support Vector Machine", mae: "22.37 K", r2: "0.785", desc: "Non-linear kernel boundary estimation.", colorClass: "clay-rose" },
];

export default function SeerModule() {
  const { token } = useAuth();
  const [selectedElements, setSelectedElements] = useState<string[]>(["Si", "B", "Na"]);
  const [composition, setComposition] = useState<{ [key: string]: number }>({
    SiO2: 60,
    B2O3: 20,
    Na2O: 20,
  });

  const [chosenModel, setChosenModel] = useState<string>("RF");
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<PredictResult[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleElement = (el: ElementData) => {
    if (!el.supported) return;
    const isSelected = selectedElements.includes(el.symbol);
    if (isSelected) {
      if (selectedElements.length <= 1) return;
      const updated = selectedElements.filter((s) => s !== el.symbol);
      setSelectedElements(updated);
      if (el.oxide) {
        const nextComp = { ...composition };
        delete nextComp[el.oxide];
        normalizeComposition(nextComp);
      }
    } else {
      setSelectedElements([...selectedElements, el.symbol]);
      if (el.oxide) {
        const nextComp = { ...composition, [el.oxide]: 10 };
        normalizeComposition(nextComp);
      }
    }
  };

  const normalizeComposition = (comp: { [key: string]: number }) => {
    const keys = Object.keys(comp);
    if (keys.length === 0) return;
    const currentSum = keys.reduce((acc, k) => acc + (comp[k] || 0), 0);
    if (currentSum === 0) {
      const equalShare = parseFloat((100 / keys.length).toFixed(1));
      const res: { [key: string]: number } = {};
      keys.forEach((k) => (res[k] = equalShare));
      setComposition(res);
      return;
    }
    const scaled: { [key: string]: number } = {};
    keys.forEach((k) => {
      scaled[k] = parseFloat(((comp[k] / currentSum) * 100).toFixed(1));
    });
    setComposition(scaled);
  };

  const handleSliderChange = (oxide: string, val: number) => {
    const nextComp = { ...composition, [oxide]: val };
    const otherOxides = Object.keys(nextComp).filter((k) => k !== oxide);
    const rem = 100 - val;
    if (otherOxides.length === 1) {
      nextComp[otherOxides[0]] = Math.max(0, parseFloat(rem.toFixed(1)));
    } else if (otherOxides.length > 1) {
      const currentOthersSum = otherOxides.reduce((acc, k) => acc + (composition[k] || 0), 0);
      otherOxides.forEach((k) => {
        const ratio = currentOthersSum > 0 ? (composition[k] || 0) / currentOthersSum : 1 / otherOxides.length;
        nextComp[k] = Math.max(0, parseFloat((rem * ratio).toFixed(1)));
      });
    }
    setComposition(nextComp);
  };

  const executePrediction = async () => {
    setLoading(true);
    setErrorMsg(null);
    setResults(null);
    try {
      const comp = {
        SiO2: composition["SiO2"] || 0,
        B2O3: composition["B2O3"] || 0,
        Na2O: composition["Na2O"] || 0,
      };

      const data = await predictTg(comp, chosenModel, token);
      setResults(data.results);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reach prediction server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner in User's Butter Yellow #FFEE8C */}
      <div className="clay-card clay-butter p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-black/30 shadow-sm shrink-0">
            <Sparkles className="w-7 h-7 text-amber-900 dark:text-amber-200" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-amber-100">
              Seer: Interactive Periodic Table & $T_g$ Predictor
            </h2>
            <p className="text-xs sm:text-sm opacity-80 mt-1 font-semibold">
              Select elements, adjust composition in <strong>mol %</strong>, choose which of the 4 models to evaluate, and inspect Glass Transition Temperature ($T_g$) in <strong>Kelvin (K)</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Periodic Table in Lavender Clay Card */}
      <div className="clay-card clay-lavender p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-xl clay-btn-accent text-white text-xs font-black">1</span>
              Select Periodic Table Elements
            </h3>
            <p className="text-xs opacity-75 mt-0.5 font-medium">
              Active models accept <strong>Si (SiO₂)</strong>, <strong>B (B₂O₃)</strong>, and <strong>Na (Na₂O)</strong> with implicit <strong>O</strong> matrix.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-black">
            <span className="px-3 py-1 rounded-xl clay-butter">
              ● Supported Element
            </span>
            <span className="px-3 py-1 rounded-xl clay-peach">
              ● Implicit Oxygen Matrix
            </span>
          </div>
        </div>

        {/* Periodic Table Grid */}
        <div className="overflow-x-auto pb-3 pt-1">
          <div className="grid grid-cols-18 gap-1.5 min-w-[760px]">
            {PERIODIC_ELEMENTS.map((el) => {
              const isSelected = selectedElements.includes(el.symbol);
              const isSupported = el.supported;
              const isImplicit = el.implicit;

              return (
                <button
                  key={el.number}
                  disabled={!isSupported && !isImplicit}
                  onClick={() => toggleElement(el)}
                  style={{ gridRow: el.row, gridColumn: el.col }}
                  title={
                    isSupported
                      ? `${el.name} (${el.symbol}) -> maps to ${el.oxide}`
                      : isImplicit
                      ? `${el.name} (Implicit Oxygen Matrix)`
                      : `${el.name} (${el.symbol}) - Not in training dataset`
                  }
                  className={`
                    relative flex flex-col items-center justify-center p-1.5 rounded-xl text-center transition-all duration-150
                    ${
                      isSupported && isSelected
                        ? "clay-btn-accent scale-105 z-10 font-black shadow-lg"
                        : isSupported
                        ? "clay-btn clay-butter font-black hover:scale-102"
                        : isImplicit
                        ? "clay-peach opacity-90 cursor-default font-bold"
                        : "opacity-30 cursor-not-allowed bg-black/5 dark:bg-white/5 text-slate-400"
                    }
                  `}
                >
                  <span className="text-[9px] opacity-70 leading-none">{el.number}</span>
                  <span className="text-xs font-black">{el.symbol}</span>
                  <span className="text-[7.5px] truncate w-full font-bold">{el.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step 2 & 3: Sliders (Mint) & Model Selection (Sky) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sliders in Mint Pastel */}
        <div className="clay-card clay-mint p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-6 h-6 rounded-xl bg-emerald-600 text-white text-xs font-black">2</span>
              Configure Composition (mol %)
            </h3>
            <p className="text-xs opacity-75 mb-6 font-semibold">
              Sliders maintain sum-constraint at <strong>100.0 mol %</strong>.
            </p>

            <div className="space-y-6">
              {["SiO2", "B2O3", "Na2O"].map((ox) => {
                const val = composition[ox] || 0;
                return (
                  <div key={ox} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span>{ox}</span>
                      <span className="px-3 py-1 rounded-xl clay-btn clay-butter font-mono font-black text-slate-900">
                        {val.toFixed(1)} mol %
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={val}
                      onChange={(e) => handleSliderChange(ox, parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs font-black">
            <span className="opacity-75">Total Basis:</span>
            <span className="px-3 py-1 rounded-xl clay-btn font-mono font-black">
              {(Object.values(composition).reduce((a, b) => a + b, 0)).toFixed(1)} mol %
            </span>
          </div>
        </div>

        {/* Model Selection in Sky Pastel */}
        <div className="clay-card clay-sky p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-6 h-6 rounded-xl bg-sky-600 text-white text-xs font-black">3</span>
              Select Machine Learning Model
            </h3>
            <p className="text-xs opacity-75 mb-4 font-semibold">
              Pick which of the 4 models to run, or compare all 4:
            </p>

            {/* 4 Models with Distinct Clay Color Badges */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {MODEL_CHOICES.map((m) => {
                const isSelected = chosenModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setChosenModel(m.id)}
                    className={`p-3.5 rounded-2xl text-left transition-all ${
                      isSelected
                        ? "clay-btn-accent scale-102 font-black"
                        : "clay-btn " + m.colorClass
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-xs">{m.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg ${isSelected ? "bg-white/20 text-white" : "bg-black/10 dark:bg-white/20"} font-black`}>
                        MAE {m.mae}
                      </span>
                    </div>
                    <p className={`text-[11px] font-semibold leading-snug line-clamp-2 ${isSelected ? "text-white/90" : "opacity-75"}`}>
                      {m.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setChosenModel("ALL")}
              className={`w-full py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                chosenModel === "ALL"
                  ? "clay-btn-accent"
                  : "clay-btn clay-butter"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Compare All 4 Models (RF, XGB, KNN, SVM)
            </button>
          </div>

          <div className="mt-8 pt-4 border-t border-black/10 dark:border-white/10">
            <button
              disabled={loading}
              onClick={executePrediction}
              className="w-full py-3.5 px-4 clay-btn-accent font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Calculating $T_g$...</span>
              ) : (
                <>
                  <span>Run Prediction ({chosenModel})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Card */}
      {errorMsg && (
        <div className="clay-card clay-rose p-4 text-xs font-black flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-700" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Results in High-Contrast Clay Cards */}
      {results && (
        <div className="clay-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/10 dark:border-white/10">
            <div>
              <h3 className="text-lg font-black flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Prediction Results ($T_g$ in Kelvin)
              </h3>
              <p className="text-xs opacity-75 font-semibold mt-0.5">
                Evaluated for SiO₂: {composition.SiO2}%, B₂O₃: {composition.B2O3}%, Na₂O: {composition.Na2O}% (mol %)
              </p>
            </div>
            <span className="px-3.5 py-1.5 rounded-xl clay-card clay-butter font-mono text-xs font-black text-slate-900">
              Unit: Kelvin (K)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {results.map((res, i) => {
              const pastelOrder = ["clay-butter", "clay-mint", "clay-sky", "clay-peach"];
              const colorClass = pastelOrder[i % pastelOrder.length];
              return (
                <div key={res.model} className={`clay-card ${colorClass} p-5 flex flex-col justify-between`}>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-sm">{res.model}</span>
                      <span className="text-[10px] font-black opacity-60">Glass Transition</span>
                    </div>
                    <div className="text-3xl font-black font-mono tracking-tight my-2">
                      {res.value.toFixed(2)} <span className="text-sm font-bold opacity-75">K</span>
                    </div>
                  </div>

                  {res.warnings && res.warnings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
                      {res.warnings.map((w, idx) => (
                        <p key={idx} className="text-[10px] font-black text-amber-700 dark:text-amber-300 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
