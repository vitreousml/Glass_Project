"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Download, Printer, HeartHandshake, X } from "lucide-react";
import type { CompositionBasis } from "@/lib/api";
import { basisLabel, formula, modelInfo, relevantWarnings } from "@/lib/chem";
import { downloadCsv, printReport } from "@/lib/export";
import { DURATION, T, staggerStep, useAnimatedNumber } from "@/lib/motion";
import { fixed, kToC } from "@/lib/units";
import { Button } from "@/components/ui/Button";
import { Tg } from "@/components/ui/Tg";
import { TemperatureScale } from "@/components/viz/TemperatureScale";
import { buildReport, deg, errorOf, type PredictedGlass } from "@/components/seer/report";

export interface PredictResult {
  property: string;
  model: string;
  value: number; // Kelvin for temperatures
  unit: string;
  warnings: string[];
}

export interface PredictResponse {
  results: PredictResult[];
  input_basis: string;
  composition_mol_percent: Record<string, number>;
  project_id?: string;
  project_name?: string;
  prediction_id?: string;
  created_at?: string;
}

const tgOf = (g: PredictedGlass) => g.response.results.filter((r) => r.property === "Tg" && r.unit === "K");

function CountUp({ k, fromC, className = "" }: { k: number; fromC?: number; className?: string }) {
  const c = useAnimatedNumber(kToC(k), DURATION.data, fromC);
  return <span className={`num ${className}`}>{deg(c)}</span>;
}

export function Results({
  glasses,
  oxides,
  basis,
  multiple,
  stale,
  rangeC,
}: {
  glasses: PredictedGlass[];
  /** The oxides the user chose (and kept). Only these are shown and warned about. */
  oxides: string[];
  basis: CompositionBasis;
  multiple: boolean;
  stale: boolean;
  /** Tg range of the training glasses, °C. */
  rangeC?: [number, number];
}) {
  if (glasses.length === 0) return null;
  const report = () => buildReport(glasses, oxides, basis);
  const allModels = tgOf(glasses[0]).length > 1;
  const [showAckToast, setShowAckToast] = useState(false);

  const handleCsvDownload = () => {
    downloadCsv(report());
    setShowAckToast(true);
  };

  const handlePrint = () => {
    printReport(report());
    setShowAckToast(true);
  };

  const warnings = glasses.flatMap((g, i) =>
    relevantWarnings(
      g.response.results.flatMap((r) => r.warnings),
      oxides,
    ).map((w) => (multiple ? `Glass ${i + 1}: ${w}` : w)),
  );

  return (
    <section aria-live="polite" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Predicted <Tg />
          {allModels && <span className="font-normal text-ink-2"> · {tgOf(glasses[0]).length} models</span>}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleCsvDownload} disabled={stale}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint} disabled={stale}>
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Print
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showAckToast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2.5 rounded-md border border-line bg-surface-2 p-3 text-xs text-ink-2"
          >
            <HeartHandshake className="h-4 w-4 shrink-0 text-ink mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-ink">Thank you for predicting with Glass Studio!</span> If you use these predictions in your research or publication, please cite/acknowledge: <span className="font-medium text-ink">Glass Studio · COE-DSAI, TIET Patiala</span>.
            </div>
            <button
              type="button"
              onClick={() => setShowAckToast(false)}
              className="text-ink-3 hover:text-ink transition-colors ml-1"
              aria-label="Dismiss notice"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stale && (
          <motion.p
            className="-mt-2 text-xs text-ink-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: T.small }}
            exit={{ opacity: 0, transition: T.exit }}
          >
            Inputs changed · press Predict to update
          </motion.p>
        )}
      </AnimatePresence>

      <div className={`transition-[filter,opacity] duration-200 ${stale ? "opacity-55 grayscale" : ""}`}>
        {tgOf(glasses[0]).length > 0 &&
          (multiple ? (
            <MultiTable glasses={glasses} oxides={oxides} basis={basis} />
          ) : (
            <SingleResult glass={glasses[0]} oxides={oxides} rangeC={rangeC} />
          ))}
        <OtherProperties glasses={glasses} multiple={multiple} />
      </div>

      {glasses[0]?.response?.project_name && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-line bg-surface-2/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-3">Saved to project:</span>
            <span className="font-bold text-ink">{glasses[0].response.project_name}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("navigate-screen", { detail: "profile" })
              )
            }
            className="text-xs font-bold text-ink hover:underline shrink-0"
          >
            View in My Projects →
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {warnings.map((w) => (
          <motion.p
            key={w}
            role="note"
            className="flex items-start gap-2 overflow-hidden rounded-md bg-warn-bg px-3 py-2 text-sm text-warn"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0, transition: T.small }}
            exit={{ opacity: 0, height: 0, transition: T.exit }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {w}
          </motion.p>
        ))}
      </AnimatePresence>

      <p className="text-xs text-ink-3">Closing this panel clears the prediction. Download or print it first.</p>
    </section>
  );
}

/** Properties other than Tg (added through the admin portal): each model's value in its own unit. */
function OtherProperties({ glasses, multiple }: { glasses: PredictedGlass[]; multiple: boolean }) {
  const rows = glasses.flatMap((g, i) =>
    g.response.results
      .filter((r) => !(r.property === "Tg" && r.unit === "K"))
      .map((r) => ({ glass: i + 1, ...r })),
  );
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            {multiple && <th className="px-3 py-2 font-medium">Glass</th>}
            <th className="px-3 py-2 font-medium">Property</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 text-right font-medium">Predicted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => {
            const info = modelInfo(r.model, r.property);
            return (
              <tr key={k} className="border-b border-line last:border-0">
                {multiple && <td className="num px-3 py-2">{r.glass}</td>}
                <td className="px-3 py-2">{r.property}</td>
                <td className="px-3 py-2">{info?.name ?? r.model}</td>
                <td className="num px-3 py-2 text-right">
                  {fixed(r.value, 3)} {r.unit}
                  {info?.mae !== undefined && <span className="text-ink-2"> ± {fixed(info.mae, 3)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SingleResult({
  glass,
  oxides,
  rangeC,
}: {
  glass: PredictedGlass;
  oxides: string[];
  rangeC?: [number, number];
}) {
  const tg = tgOf(glass);
  const one = tg.length === 1;
  const mol = glass.response.composition_mol_percent;

  return (
    <div className="space-y-4">
      {one && (
        <div>
          <div className="flex items-baseline gap-2">
            <CountUp k={tg[0].value} fromC={rangeC?.[0]} className="text-2xl font-medium tracking-tight" />
            {errorOf(tg[0].model) !== undefined && (
              <span className="num text-xl text-ink-2">± {deg(errorOf(tg[0].model)!)}</span>
            )}
            <span className="text-lg text-ink-2">°C</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            <span className="num">{deg(tg[0].value)} K</span> · {modelInfo(tg[0].model)?.name ?? tg[0].model} · ± is
            its typical error
          </p>
        </div>
      )}

      {/* With several models, the scale lists each value with its error. */}
      <TemperatureScale
        rangeC={rangeC}
        showValues={!one}
        countFromC={rangeC?.[0]}
        rows={tg.map((r) => ({
          id: r.model,
          label: r.model,
          valueC: kToC(r.value),
          maeC: errorOf(r.model),
          kelvin: r.value,
        }))}
      />

      <p className="text-xs text-ink-3">
        Model input:{" "}
        <span className="num">{oxides.map((ox) => `${formula(ox)} ${fixed(mol[ox] ?? 0)}`).join(" · ")}</span> mol %
        {glass.response.input_basis === "wt %" && ", converted from your weight %"}
      </p>
    </div>
  );
}

function MultiTable({ glasses, oxides, basis }: { glasses: PredictedGlass[]; oxides: string[]; basis: CompositionBasis }) {
  const models = tgOf(glasses[0]).map((r) => r.model);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-ink-3">Input composition basis:</span>
          <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-semibold text-ink border border-line">
            {basisLabel(basis)}
          </span>
        </div>
        {basis === "wt" && (
          <span className="text-[11px] text-ink-3">
            (ML predictions calculated from converted mol % values)
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-3">
              <th className="py-1.5 pr-2 text-left font-normal">#</th>
              {oxides.map((ox) => (
                <th key={ox} className="px-2 py-1.5 text-right font-normal">
                  <span>{formula(ox)}</span>
                  <span className="ml-1 text-[10px] text-ink-3 font-mono">({basisLabel(basis)})</span>
                </th>
              ))}
              {models.map((m) => (
                <th key={m} className="py-1.5 pl-3 text-right font-medium text-ink-2">
                  {models.length > 1 ? m : <Tg />}, °C
                </th>
              ))}
            </tr>
          </thead>
        <tbody>
          {glasses.map((g, i) => (
            <motion.tr
              key={i}
              className="border-t border-line"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { ...T.small, delay: i * staggerStep(glasses.length) } }}
            >
              <td className="num py-2 pr-2 text-ink-3">{i + 1}</td>
              {oxides.map((ox) => (
                <td key={ox} className="num px-2 py-2 text-right text-ink-2">
                  {fixed(g.composition[ox] ?? 0)}
                </td>
              ))}
              {tgOf(g).map((r) => (
                <td key={r.model} className="py-2 pl-3 text-right">
                  <span className="num block font-medium whitespace-nowrap">
                    {deg(kToC(r.value))}
                    {errorOf(r.model) !== undefined && <span className="text-ink-2"> ± {deg(errorOf(r.model)!)}</span>}
                  </span>
                  <span className="num block text-xs text-ink-3">{deg(r.value)} K</span>
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Oxides in {basisLabel(basis)}
        {basis === "wt" && ", converted to mol % for the models"}. ± is each model&apos;s typical error.
      </p>
    </div>
  );
}
