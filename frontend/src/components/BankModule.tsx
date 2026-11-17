"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, Lock } from "lucide-react";
import { getBankSummary } from "@/lib/api";
import { MODELS, OXIDES, rangeRegion } from "@/lib/chem";
import { DURATION, EASE_OUT, T, useAnimatedNumber } from "@/lib/motion";
import { fixed, kToC } from "@/lib/units";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Formula, Tg } from "@/components/ui/Tg";
import { TernaryDiagram } from "@/components/viz/TernaryDiagram";

type Range = { min: number; max: number };
interface BankSummary {
  sample_count: number;
  ranges: Record<string, Range>;
}

// °C axis for the Tg range bar.
const TG_AXIS: [number, number] = [0, 800];

export default function BankModule() {
  const [summary, setSummary] = useState<BankSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getBankSummary()
      .then((s: BankSummary) => live && setSummary(s))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't reach the server."));
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  const region = useMemo(() => (summary ? rangeRegion(summary.ranges) : []), [summary]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-lg font-semibold">Bank</h1>
        <p className="text-sm text-ink-2">
          What the training data covers. Predictions inside these ranges are interpolations; outside them, treat
          them with care.
        </p>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {error ? (
          <motion.div
            key="error"
            role="alert"
            className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: T.small }}
            exit={{ opacity: 0, transition: T.exit }}
          >
            <p className="flex items-start gap-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Couldn&apos;t load the training summary: {error}
            </p>
            <Button variant="secondary" size="sm" onClick={retry}>
              Try again
            </Button>
          </motion.div>
        ) : !summary ? (
          <motion.div key="loading" exit={{ opacity: 0, transition: T.exit }} aria-label="Loading" role="status">
            <BankSkeleton />
          </motion.div>
        ) : (
          <motion.div
            key="data"
            className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: T.small }}
          >
            {/* Coverage on the triangle */}
            <section className="rounded-lg border border-line bg-surface p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Composition coverage</h2>
                <span className="text-xs text-ink-3">mol %</span>
              </div>
              <TernaryDiagram
                region={region}
                regionLabel="Inside every oxide's training range"
                className="mx-auto mt-2 w-full max-w-sm"
                title="Training coverage on the SiO₂–B₂O₃–Na₂O triangle"
              />
              <p className="mt-2 text-sm text-ink-2">
                Shaded: glasses inside every oxide&apos;s training range. Gridlines every 20 mol %.
              </p>
              <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
                <div>
                  <Count to={summary.sample_count} className="text-2xl font-medium tracking-tight" />
                  <p className="text-sm text-ink-2">
                    training glasses, Na<sub>2</sub>O–B<sub>2</sub>O<sub>3</sub>–SiO<sub>2</sub>
                  </p>
                </div>
                <p className="flex max-w-[14rem] items-start gap-1.5 text-xs text-ink-3">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  The rows themselves stay private on the server. Only these ranges are shared.
                </p>
              </div>
            </section>

            <div className="space-y-5">
              {/* Oxide ranges */}
              <section className="rounded-lg border border-line bg-surface p-5">
                <h2 className="text-sm font-semibold">Oxide ranges</h2>
                <p className="mt-0.5 text-sm text-ink-2">Lowest and highest amount among the training glasses.</p>
                <div className="mt-4 space-y-3">
                  {OXIDES.map((ox, i) => (
                    <RangeRow
                      key={ox}
                      label={<Formula>{ox}</Formula>}
                      range={summary.ranges[ox]}
                      domain={[0, 100]}
                      delay={i * 0.06}
                      unit="mol %"
                    />
                  ))}
                  <Axis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="mol %" />
                </div>
              </section>

              {/* Tg range */}
              {summary.ranges.Tg && (
                <section className="rounded-lg border border-line bg-surface p-5">
                  <h2 className="text-sm font-semibold">
                    <Tg /> range
                  </h2>
                  <div className="mt-4 space-y-3">
                    <RangeRow
                      label={<Tg />}
                      range={{ min: kToC(summary.ranges.Tg.min), max: kToC(summary.ranges.Tg.max) }}
                      domain={TG_AXIS}
                      delay={0.2}
                      unit="°C"
                      heat
                      secondary={`${fixed(summary.ranges.Tg.min)}–${fixed(summary.ranges.Tg.max)} K`}
                    />
                    <Axis domain={TG_AXIS} ticks={[0, 200, 400, 600, 800]} unit="°C" />
                  </div>
                </section>
              )}

              {/* Models */}
              <section className="rounded-lg border border-line bg-surface p-5">
                <h2 className="text-sm font-semibold">Models trained on this data</h2>
                <p className="mt-0.5 text-sm text-ink-2">Scored on test glasses they never saw.</p>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-3">
                      <th className="py-1.5 font-normal">Model</th>
                      <th className="py-1.5 font-normal">Typical error</th>
                      <th className="w-16 py-1.5 text-right font-normal">R²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODELS.map((m, i) => (
                      <tr key={m.id} className="border-t border-line">
                        <td className="py-2 pr-3">
                          <span className="num mr-2 text-ink-3">{m.id}</span>
                          {m.name}
                        </td>
                        <td className="py-2 pr-3">
                          <ErrorBar mae={m.mae} delay={0.25 + i * 0.05} />
                        </td>
                        <td className="num py-2 text-right">{m.r2.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Count({ to, className = "" }: { to: number; className?: string }) {
  const n = useAnimatedNumber(to, DURATION.data, 0);
  return <div className={`num ${className}`}>{Math.round(n)}</div>;
}

/** A min–max span on a track, growing out from the left edge. */
function RangeRow({
  label,
  range,
  domain,
  delay,
  unit,
  heat = false,
  secondary,
}: {
  label: React.ReactNode;
  range: Range;
  domain: [number, number];
  delay: number;
  unit: string;
  heat?: boolean;
  secondary?: string;
}) {
  const reduce = useReducedMotion();
  const pct = (v: number) => ((v - domain[0]) / (domain[1] - domain[0])) * 100;
  const left = pct(range.min);
  const width = Math.max(pct(range.max) - left, 0.8);
  const transition = { duration: DURATION.data, ease: EASE_OUT, delay: reduce ? 0 : delay };

  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_9rem]">
      <span className="text-sm font-medium">{label}</span>
      <div className="relative h-2.5 rounded-full bg-surface-2">
        <motion.div
          className="absolute inset-y-0 rounded-full"
          style={{
            background: heat
              ? "linear-gradient(90deg, var(--heat-1), var(--heat-2), var(--heat-3), var(--heat-4))"
              : "var(--ink)",
          }}
          initial={reduce ? false : { left: "0%", width: "0%" }}
          animate={{ left: `${left}%`, width: `${width}%` }}
          transition={transition}
        />
      </div>
      <span className="text-right text-sm">
        <span className="num">
          {fixed(range.min, unit === "°C" ? 0 : 1)}–{fixed(range.max, unit === "°C" ? 0 : 1)}
        </span>{" "}
        <span className="text-ink-3">{unit}</span>
        {secondary && <span className="num block text-xs text-ink-3">{secondary}</span>}
      </span>
    </div>
  );
}

function Axis({ domain, ticks, unit }: { domain: [number, number]; ticks: number[]; unit: string }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_9rem]">
      <span />
      <div className="relative h-4">
        {ticks.map((t) => {
          const p = ((t - domain[0]) / (domain[1] - domain[0])) * 100;
          return (
            <span
              key={t}
              className="num absolute top-0 -translate-x-1/2 text-xs text-ink-3 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${p}%` }}
            >
              {t}
            </span>
          );
        })}
      </div>
      <span className="text-right text-xs text-ink-3">{unit}</span>
    </div>
  );
}

// Widest error among the models sets the scale.
const MAX_MAE = Math.max(...MODELS.map((m) => m.mae));

function ErrorBar({ mae, delay }: { mae: number; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2 sm:w-28">
        <motion.div
          className="h-full rounded-full bg-ink-2"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${(mae / MAX_MAE) * 100}%` }}
          transition={{ duration: DURATION.data, ease: EASE_OUT, delay: reduce ? 0 : delay }}
        />
      </div>
      <span className="num">±{fixed(mae)} °C</span>
    </div>
  );
}

function BankSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="rounded-lg border border-line bg-surface p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mx-auto mt-4 aspect-[120/112] w-full max-w-sm" />
        <Skeleton className="mt-5 h-9 w-24" />
      </div>
      <div className="space-y-5">
        {[3, 1, 4].map((rows, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-line bg-surface p-5">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: rows }).map((_, j) => (
              <Skeleton key={j} className="h-3 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
