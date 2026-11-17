"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { MODEL_BY_ID, formula } from "@/lib/chem";
import { DURATION, T, useAnimatedNumber } from "@/lib/motion";
import { fixed, kToC } from "@/lib/units";
import { Tg } from "@/components/ui/Tg";
import { TemperatureScale } from "@/components/viz/TemperatureScale";

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
}

function CountUp({ k, fromC, className = "" }: { k: number; fromC?: number; className?: string }) {
  const c = useAnimatedNumber(kToC(k), DURATION.data, fromC);
  return <span className={`num ${className}`}>{fixed(c)}</span>;
}

export function Results({
  response,
  stale,
  rangeC,
}: {
  response: PredictResponse;
  stale: boolean;
  /** Tg range of the training glasses, °C. */
  rangeC?: [number, number];
}) {
  const tg = response.results.filter((r) => r.property === "Tg" && r.unit === "K");
  const warnings = Array.from(new Set(response.results.flatMap((r) => r.warnings)));
  const single = tg.length === 1;

  return (
    <section aria-live="polite" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Predicted <Tg />
          {!single && <span className="font-normal text-ink-2"> · all four models, with typical error bands</span>}
        </h3>
        <AnimatePresence>
          {stale && (
            <motion.span
              className="text-xs text-ink-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: T.small }}
              exit={{ opacity: 0, transition: T.exit }}
            >
              Inputs changed · press Predict to update
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {single ? (
        <div className={`transition-[filter,opacity] duration-200 ${stale ? "opacity-55 grayscale" : ""}`}>
          <div className="flex items-baseline gap-1.5">
            <CountUp k={tg[0].value} fromC={rangeC?.[0]} className="text-2xl font-medium tracking-tight" />
            <span className="text-lg text-ink-2">°C</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            <span className="num">{fixed(tg[0].value)} K</span> from {MODEL_BY_ID[tg[0].model]?.name ?? tg[0].model}
            {MODEL_BY_ID[tg[0].model] && <> · typical error ±{fixed(MODEL_BY_ID[tg[0].model].mae)} °C</>}
          </p>
        </div>
      ) : null}

      {/* With several models, the scale itself lists each value (°C, then K). */}
      <TemperatureScale
        stale={stale}
        rangeC={rangeC}
        showValues={!single}
        countFromC={rangeC?.[0]}
        rows={tg.map((r) => ({
          id: r.model,
          label: r.model,
          valueC: kToC(r.value),
          maeC: MODEL_BY_ID[r.model]?.mae,
          kelvin: r.value,
        }))}
      />

      <p className="text-xs text-ink-3">
        Model input:{" "}
        <span className="num">
          {Object.entries(response.composition_mol_percent)
            .map(([ox, v]) => `${formula(ox)} ${fixed(v)}`)
            .join(" · ")}
        </span>{" "}
        mol %{response.input_basis === "wt %" && ", converted from your weight %"}
      </p>

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
    </section>
  );
}
