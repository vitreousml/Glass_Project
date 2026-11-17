"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowLeft, ArrowRight, X } from "lucide-react";
import { PERIODIC_ELEMENTS, type ElementData } from "@/data/elements";
import { getBankSummary, predictProperties, type CompositionBasis } from "@/lib/api";
import { convertBasis, rangeRegion, rebalance, setOne, type Composition } from "@/lib/chem";
import { DURATION, EASE_IN, SPRING, T } from "@/lib/motion";
import { kToC } from "@/lib/units";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { PeriodicTable } from "@/components/seer/PeriodicTable";
import { SelectionBar } from "@/components/seer/SelectionBar";
import { SetupStep } from "@/components/seer/SetupStep";
import { CompositionStep } from "@/components/seer/CompositionStep";
import { Results, type PredictResponse } from "@/components/seer/Results";

const ELEMENT_BY_SYMBOL = Object.fromEntries(PERIODIC_ELEMENTS.map((e) => [e.symbol, e]));

const oxidesFor = (symbols: string[], excluded: string[]) =>
  symbols
    .map((s) => ELEMENT_BY_SYMBOL[s]?.oxide)
    .filter((ox): ox is string => !!ox && !excluded.includes(ox));

type Ranges = Record<string, { min: number; max: number }>;

// Steps slide horizontally in the direction of travel.
const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0, transition: T.panel },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24, transition: { duration: DURATION.press, ease: EASE_IN } }),
};

export default function SeerModule() {
  const { token } = useAuth();

  const [selected, setSelected] = useState<string[]>([]); // element symbols, in click order
  const [excluded, setExcluded] = useState<string[]>([]);
  const [properties, setProperties] = useState<string[]>(["Tg"]);
  const [model, setModel] = useState("RF");
  const [basis, setBasis] = useState<CompositionBasis>("mol");
  const [composition, setComposition] = useState<Composition>({}); // in `basis`, sums to 100

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<{ n: 1 | 2; dir: number }>({ n: 1, dir: 0 });

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<PredictResponse | null>(null);
  const [responseKey, setResponseKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ranges, setRanges] = useState<Ranges | null>(null);

  // Training ranges (public summary; no individual rows) for the ternary and the temperature scale.
  useEffect(() => {
    getBankSummary()
      .then((s) => setRanges(s.ranges ?? null))
      .catch(() => setRanges(null));
  }, []);

  const allOxides = oxidesFor(selected, []);
  const activeOxides = oxidesFor(selected, excluded);
  const canContinue = activeOxides.length > 0 && properties.length > 0;
  const currentStep = canContinue ? step.n : 1;

  const region = useMemo(() => (ranges ? rangeRegion(ranges) : []), [ranges]);
  const rangeC: [number, number] | undefined = ranges?.Tg ? [kToC(ranges.Tg.min), kToC(ranges.Tg.max)] : undefined;

  // Identifies the inputs, so an old result can show it's out of date.
  const requestKey = JSON.stringify({
    c: activeOxides.map((ox) => [ox, (composition[ox] ?? 0).toFixed(2)]),
    basis,
    model,
    properties,
  });
  const stale = response !== null && responseKey !== requestKey;

  const updateSelection = (symbols: string[], nextExcluded: string[]) => {
    setSelected(symbols);
    setExcluded(nextExcluded);
    setComposition((prev) => rebalance(prev, oxidesFor(symbols, nextExcluded)));
    if (symbols.length === 0) setOpen(false);
  };

  const toggleElement = (el: ElementData) => {
    if (!el.supported) return;
    const symbols = selected.includes(el.symbol) ? selected.filter((s) => s !== el.symbol) : [...selected, el.symbol];
    updateSelection(symbols, excluded.filter((ox) => ox !== el.oxide));
  };

  const toggleOxide = (ox: string) =>
    updateSelection(selected, excluded.includes(ox) ? excluded.filter((o) => o !== ox) : [...excluded, ox]);

  const toggleProperty = (id: string) =>
    setProperties((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const switchBasis = (to: CompositionBasis) => {
    if (to === basis) return;
    setComposition((c) => convertBasis(c, to));
    setBasis(to);
  };

  const goStep = (n: 1 | 2) => setStep((s) => ({ n, dir: n > s.n ? 1 : -1 }));

  const predict = async () => {
    setLoading(true);
    setError(null);
    try {
      const comp: Composition = {};
      activeOxides.forEach((ox) => (comp[ox] = Number((composition[ox] ?? 0).toFixed(4))));
      const data: PredictResponse = await predictProperties(comp, basis, model, properties, token);
      setResponse(data);
      setResponseKey(requestKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the prediction server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-[460px] flex-col">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3">
        <div>
          <h1 className="text-lg font-semibold">Seer</h1>
          <p className="text-sm text-ink-2">Select the elements in your glass, then set up the prediction.</p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
          <Legend swatch="pt-supported" label="Has model data" />
          <Legend swatch="pt-selected" label="Selected" />
          <Legend swatch="pt-implicit" label="Oxygen, in every oxide" />
          <Legend swatch="pt-off" label="No data yet" />
        </ul>
      </header>

      <div className="min-h-[300px] flex-1 md:min-h-0">
        <PeriodicTable selected={selected} onToggle={toggleElement} />
      </div>

      <SelectionBar
        selected={selected}
        onRemove={(sym) => toggleElement(ELEMENT_BY_SYMBOL[sym])}
        onClear={() => updateSelection([], [])}
        onContinue={() => setOpen(true)}
      />

      <Drawer open={open} onClose={() => setOpen(false)} label="Prediction setup">
        {/* Header */}
        <div className="shrink-0 border-b border-line px-5 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Prediction setup</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {selected.map((sym) => (
                  <span key={sym} className="rounded-sm bg-ink px-1.5 py-0.5 text-xs font-semibold text-paper">
                    {sym}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-1 text-xs text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
                >
                  Edit elements
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <nav aria-label="Steps" className="mt-3 flex gap-5">
            {(
              [
                { n: 1, label: "Oxides, property, model" },
                { n: 2, label: "Composition and result" },
              ] as const
            ).map((s) => {
              const on = currentStep === s.n;
              return (
                <button
                  key={s.n}
                  type="button"
                  disabled={s.n === 2 && !canContinue}
                  aria-current={on ? "step" : undefined}
                  onClick={() => goStep(s.n)}
                  className={`relative pb-2 text-sm transition-colors disabled:opacity-40 ${
                    on ? "text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  <span className="num mr-1.5 text-ink-3">{s.n}</span>
                  {s.label}
                  {on && (
                    <motion.span
                      layoutId="seer-step"
                      transition={SPRING}
                      className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-ink"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Body */}
        <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait" initial={false} custom={step.dir}>
            <motion.div
              key={currentStep}
              custom={step.dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-6"
            >
              {currentStep === 1 ? (
                <SetupStep
                  oxides={allOxides}
                  excluded={excluded}
                  onToggleOxide={toggleOxide}
                  properties={properties}
                  onToggleProperty={toggleProperty}
                  model={model}
                  onModel={setModel}
                />
              ) : (
                <>
                  <CompositionStep
                    oxides={activeOxides}
                    composition={composition}
                    basis={basis}
                    onBasis={switchBasis}
                    onSet={(ox, v) => setComposition((c) => setOne(c, ox, v))}
                    region={region}
                  />
                  <AnimatePresence initial={false}>
                    {error && (
                      <motion.p
                        role="alert"
                        className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0, transition: T.small }}
                        exit={{ opacity: 0, transition: T.exit }}
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  {response && <Results response={response} stale={stale} rangeC={rangeC} />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
          {currentStep === 1 ? (
            <Button variant="primary" size="lg" className="flex-1" disabled={!canContinue} onClick={() => goStep(2)}>
              Next: composition
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="lg" onClick={() => goStep(1)}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1 overflow-hidden"
                disabled={loading}
                aria-busy={loading}
                onClick={predict}
              >
                {loading ? "Predicting…" : `Predict${model === "ALL" ? " with all four" : ` with ${model}`}`}
                {!loading && <ArrowRight className="h-4 w-4" aria-hidden />}
                {/* The button is the progress indicator while the request runs */}
                {loading && (
                  <motion.span
                    aria-hidden
                    className="absolute bottom-0 left-0 h-0.5 w-1/3 bg-paper/80"
                    initial={{ x: "-100%" }}
                    animate={{ x: "300%" }}
                    transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
                  />
                )}
              </Button>
            </>
          )}
        </div>
      </Drawer>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-[3px] border ${swatch}`} aria-hidden />
      {label}
    </li>
  );
}
