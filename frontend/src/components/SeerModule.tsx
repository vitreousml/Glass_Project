"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, X } from "lucide-react";
import { PERIODIC_ELEMENTS, type ElementData } from "@/data/elements";
import { getBankSummary, predictProperties, type CompositionBasis } from "@/lib/api";
import {
  GLASS_FORMERS,
  MAX_ELEMENTS,
  convertBasis,
  formula,
  isModelled,
  normalize,
  rangeRegion,
  rebalance,
  setOne,
  type Composition,
} from "@/lib/chem";
import { DURATION, EASE_IN, SPRING, T } from "@/lib/motion";
import { kToC } from "@/lib/units";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { PeriodicTable } from "@/components/seer/PeriodicTable";
import { SelectionBar, type CompositionMode } from "@/components/seer/SelectionBar";
import { SetupStep } from "@/components/seer/SetupStep";
import { CompositionStep } from "@/components/seer/CompositionStep";
import { Results, type PredictResponse } from "@/components/seer/Results";
import { MultiCompositionStep, MAX_ROWS, rowValid, type CompositionRow } from "@/components/seer/MultiCompositionStep";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import type { PredictedGlass } from "@/components/seer/report";
import { ProjectBanner } from "@/components/seer/ProjectBanner";
import { ProjectModal } from "@/components/seer/ProjectModal";

const ELEMENT_BY_SYMBOL = Object.fromEntries(PERIODIC_ELEMENTS.map((e) => [e.symbol, e]));

const oxidesFor = (symbols: string[], excluded: string[]) =>
  symbols
    .map((s) => ELEMENT_BY_SYMBOL[s]?.oxide)
    .filter((ox): ox is string => !!ox && !excluded.includes(ox));

type Ranges = Record<string, { min: number; max: number }>;

/** Only the given oxides, from a row or composition. */
const pick = (c: Composition, oxides: string[]): Composition =>
  Object.fromEntries(oxides.map((ox) => [ox, c[ox] ?? 0]));

// Below this an amount shows as 0.0 and counts as zero.
const ZERO = 0.05;

const ELEMENT_OF_OXIDE = Object.fromEntries(
  PERIODIC_ELEMENTS.filter((e) => e.oxide).map((e) => [e.oxide as string, e]),
);
/** Oxides of glass-forming elements, among the given ones. */
const formerOxides = (oxides: string[]) =>
  oxides.filter((ox) => (GLASS_FORMERS as readonly string[]).includes(ELEMENT_OF_OXIDE[ox]?.symbol ?? ""));

const listText = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

interface ZeroAlert {
  oxides: string[];
  /** Multiple mode: which row (1-based) and its id. */
  glass?: number;
  rowId?: number;
  /** Puts the amounts back as they were. */
  undo?: () => void;
  /** Every glass former is 0: there's no glass to predict. */
  blocking?: boolean;
}

const NOT_A_GLASS = `None of the selected elements is a glass former. Add at least one of ${GLASS_FORMERS.slice(0, -1).join(", ")} or ${GLASS_FORMERS[GLASS_FORMERS.length - 1]}.`;

// Steps slide horizontally in the direction of travel.
const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0, transition: T.panel },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24, transition: { duration: DURATION.press, ease: EASE_IN } }),
};

export default function SeerModule() {
  const { token } = useAuth();
  const { activeProject, refreshActiveProject } = useProject();
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  const [selected, setSelected] = useState<string[]>([]); // element symbols, in click order
  const [excluded, setExcluded] = useState<string[]>([]);
  const [properties, setProperties] = useState<string[]>(["Tg"]);
  const [model, setModel] = useState("RF");
  const [basis, setBasis] = useState<CompositionBasis>("mol");
  const [composition, setComposition] = useState<Composition>({}); // in `basis`, sums to 100
  const [mode, setMode] = useState<CompositionMode>("single");
  const [rows, setRows] = useState<CompositionRow[]>([]); // multiple mode, in `basis`
  const nextRowId = useRef(1);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [zeroAlert, setZeroAlert] = useState<ZeroAlert | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<{ n: 1 | 2; dir: number }>({ n: 1, dir: 0 });

  const [loading, setLoading] = useState(false);
  const [glasses, setGlasses] = useState<PredictedGlass[] | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
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
  const inputs = mode === "single" ? [pick(composition, activeOxides)] : rows.map((r) => pick(r.values, activeOxides));
  const requestKey = JSON.stringify({
    mode,
    c: inputs.map((c) => activeOxides.map((ox) => (c[ox] ?? 0).toFixed(2))),
    basis,
    model,
    properties,
  });
  const stale = glasses !== null && resultKey !== requestKey;
  const rowsReady = rows.length > 0 && rows.every((r) => rowValid(r, activeOxides));
  const formers = formerOxides(activeOxides);
  const unmodelled = activeOxides.filter((ox) => !isModelled(ox));
  const canPredict = activeOxides.length > 0 && unmodelled.length === 0 && (mode === "single" || rowsReady);

  // --- Glass former set to 0 -------------------------------------------------
  // While a pointer is down (dragging a slider), wait for the release before asking,
  // and then only if the amount is still 0.
  const latest = useRef({ composition, rows });
  useEffect(() => {
    latest.current = { composition, rows };
  });
  const pointer = useRef<{ down: boolean; snapshot: Composition | null }>({ down: false, snapshot: null });
  const pendingZero = useRef<ZeroAlert | null>(null);
  useEffect(() => {
    const down = () => {
      pointer.current = { down: true, snapshot: latest.current.composition };
    };
    const up = () => {
      pointer.current.down = false;
      const z = pendingZero.current;
      pendingZero.current = null;
      if (!z) return;
      const values =
        z.rowId !== undefined ? latest.current.rows.find((r) => r.id === z.rowId)?.values : latest.current.composition;
      const still = z.oxides.filter((ox) => (values?.[ox] ?? 0) <= ZERO);
      if (still.length) setZeroAlert({ ...z, oxides: still });
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);

  const raiseZero = (z: ZeroAlert) => {
    if (pointer.current.down) pendingZero.current = pendingZero.current ?? z;
    else setZeroAlert(z);
  };

  const setSingle = (ox: string, v: number) => {
    const prev = composition;
    const next = setOne(prev, ox, v);
    setComposition(next);
    const hitZero = formers.filter((f) => (prev[f] ?? 0) > ZERO && (next[f] ?? 0) <= ZERO);
    if (hitZero.length) {
      // Undo goes back to before the drag, not to the last step of it.
      const before = pointer.current.down && pointer.current.snapshot ? pointer.current.snapshot : prev;
      raiseZero({ oxides: hitZero, undo: () => setComposition(before) });
    }
  };

  const resetAll = () => {
    setSelected([]);
    setExcluded([]);
    setProperties(["Tg"]);
    setModel("RF");
    setBasis("mol");
    setComposition({});
    setMode("single");
    setRows([]);
    setGlasses(null);
    setResultKey(null);
    setError(null);
    setSelectionError(null);
    setZeroAlert(null);
    setStep({ n: 1, dir: 0 });
  };

  // Closing the panel after a prediction starts over from a blank table.
  // ("Edit elements" goes back without clearing.)
  const closePanel = () => {
    setOpen(false);
    if (glasses) resetAll();
  };

  // Multiple mode starts with the single composition as its first row.
  const ensureRows = () =>
    setRows((r) => (r.length > 0 ? r : [{ id: nextRowId.current++, values: { ...composition } }]));

  const chooseMode = (m: CompositionMode) => {
    setMode(m);
    if (m === "multiple") ensureRows();
  };

  const proceed = () => {
    if (!selected.some((s) => (GLASS_FORMERS as readonly string[]).includes(s))) {
      setSelectionError(NOT_A_GLASS);
      return;
    }
    setSelectionError(null);
    if (mode === "multiple") ensureRows();
    setOpen(true);
  };

  const updateSelection = (symbols: string[], nextExcluded: string[]) => {
    setSelected(symbols);
    setExcluded(nextExcluded);
    setComposition((prev) => rebalance(prev, oxidesFor(symbols, nextExcluded)));
    if (symbols.length === 0) setOpen(false);
  };

  const toggleElement = (el: ElementData) => {
    if (!el.supported) return;
    const adding = !selected.includes(el.symbol);
    if (adding && selected.length >= MAX_ELEMENTS) {
      setSelectionError(`Up to ${MAX_ELEMENTS} elements at a time. Remove one to add ${el.symbol}.`);
      return;
    }
    setSelectionError(null);
    const symbols = adding ? [...selected, el.symbol] : selected.filter((s) => s !== el.symbol);
    updateSelection(symbols, excluded.filter((ox) => ox !== el.oxide));
  };

  const toggleOxide = (ox: string) =>
    updateSelection(selected, excluded.includes(ox) ? excluded.filter((o) => o !== ox) : [...excluded, ox]);

  const toggleProperty = (id: string) =>
    setProperties((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const switchBasis = (to: CompositionBasis) => {
    if (to === basis) return;
    setComposition((c) => convertBasis(c, to));
    // Same glasses in the other unit (only rows with something in them).
    setRows((rs) =>
      rs.map((r) => {
        const part = pick(r.values, activeOxides);
        if (Object.values(part).reduce((a, b) => a + b, 0) <= 0) return r;
        return { ...r, values: { ...r.values, ...convertBasis(part, to) } };
      }),
    );
    setBasis(to);
  };

  const goStep = (n: 1 | 2) => setStep((s) => ({ n, dir: n > s.n ? 1 : -1 }));

  const setRowValue = (id: number, ox: string, v: number) => {
    const value = Math.min(100, Math.max(0, v));
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) return;
    const was = rows[index].values[ox] ?? 0;
    const put = (amount: number) =>
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, values: { ...r.values, [ox]: amount } } : r)));
    put(value);
    if (formers.includes(ox) && was > ZERO && value <= ZERO) {
      raiseZero({ oxides: [ox], glass: index + 1, rowId: id, undo: () => put(was) });
    }
  };

  const addRow = () =>
    setRows((rs) =>
      rs.length >= MAX_ROWS ? rs : [...rs, { id: nextRowId.current++, values: { ...(rs[rs.length - 1]?.values ?? composition) } }],
    );

  const scaleRows = () =>
    setRows((rs) =>
      rs.map((r) => {
        const part = pick(r.values, activeOxides);
        if (Object.values(part).reduce((a, b) => a + b, 0) <= 0) return r;
        return { ...r, values: { ...r.values, ...normalize(part) } };
      }),
    );

  const predict = async () => {
    if (!activeProject) {
      setError("A project must be created and selected before performing a prediction.");
      setProjectModalOpen(true);
      return;
    }

    setError(null);
    if (formers.length === 0) {
      setError(NOT_A_GLASS);
      return;
    }
    // A composition with every glass former at 0 isn't a glass.
    const bad = inputs.findIndex((c) => formers.every((ox) => (c[ox] ?? 0) <= ZERO));
    if (bad >= 0) {
      setZeroAlert({ oxides: formers, glass: mode === "multiple" ? bad + 1 : undefined, blocking: true });
      return;
    }
    setLoading(true);
    const key = requestKey;
    try {
      const comps = inputs.map((c) =>
        Object.fromEntries(activeOxides.map((ox) => [ox, Number((c[ox] ?? 0).toFixed(4))])),
      );
      const responses: PredictResponse[] = await Promise.all(
        comps.map((c) => predictProperties(activeProject.id, c, basis, model, properties, token)),
      );
      setGlasses(comps.map((c, i) => ({ composition: c, response: responses[i] })));
      setResultKey(key);
      await refreshActiveProject();
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
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2" aria-label="Legend">
          <Legend swatch="pt-supported" label="Has model data" />
          <Legend swatch="pt-supported pt-nomodel" label="Glass former, no model yet" />
          <Legend swatch="pt-selected" label="Selected" />
          <Legend swatch="pt-implicit" label="Oxygen, in every oxide" />
          <Legend swatch="pt-off" label="No data yet" />
        </ul>
      </header>

      <ProjectBanner className="mb-3 shrink-0" />

      <div className="min-h-[300px] flex-1 md:min-h-0">
        <PeriodicTable selected={selected} onToggle={toggleElement} />
      </div>

      <SelectionBar
        selected={selected}
        onRemove={(sym) => toggleElement(ELEMENT_BY_SYMBOL[sym])}
        onClear={() => updateSelection([], [])}
        onContinue={proceed}
        mode={mode}
        onMode={chooseMode}
        error={selectionError}
      />

      <Drawer
        open={open}
        onClose={closePanel}
        label="Prediction setup"
        className={mode === "multiple" ? "sm:w-[min(760px,100vw)]" : "sm:w-[500px]"}
      >
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
              onClick={closePanel}
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
                { n: 2, label: mode === "single" ? "Composition and result" : "Compositions and results" },
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
                  <ProjectBanner className="mb-2" />
                  <SegmentedToggle
                    id="mode-drawer"
                    label="How many compositions"
                    value={mode}
                    onChange={chooseMode}
                    options={[
                      { value: "single", label: "Single composition" },
                      { value: "multiple", label: `Multiple (up to ${MAX_ROWS})` },
                    ]}
                  />
                  {mode === "single" ? (
                    <CompositionStep
                      oxides={activeOxides}
                      composition={composition}
                      basis={basis}
                      onBasis={switchBasis}
                      onSet={setSingle}
                      region={region}
                    />
                  ) : (
                    <MultiCompositionStep
                      oxides={allOxides}
                      excluded={excluded}
                      onToggleOxide={toggleOxide}
                      rows={rows}
                      onSet={setRowValue}
                      onAdd={addRow}
                      onRemove={(id) => setRows((rs) => rs.filter((r) => r.id !== id))}
                      onScale={scaleRows}
                      basis={basis}
                      onBasis={switchBasis}
                    />
                  )}
                  {unmodelled.length > 0 && (
                    <div
                      role="note"
                      className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md bg-warn-bg px-3 py-2 text-sm text-warn"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <p className="min-w-0 flex-1">
                        No trained model covers {listText(unmodelled.map(formula))} yet, so this glass can&apos;t be
                        predicted. Leave {unmodelled.length > 1 ? "them" : "it"} out to predict with the rest.
                      </p>
                      <button
                        type="button"
                        onClick={() => updateSelection(selected, [...excluded, ...unmodelled])}
                        className="font-medium underline underline-offset-2"
                      >
                        Leave out {listText(unmodelled.map(formula))}
                      </button>
                    </div>
                  )}
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
                  {glasses && (
                    <Results
                      glasses={glasses}
                      oxides={activeOxides}
                      basis={basis}
                      multiple={glasses.length > 1 || mode === "multiple"}
                      stale={stale}
                      rangeC={rangeC}
                    />
                  )}
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
                disabled={loading || !canPredict}
                aria-busy={loading}
                onClick={activeProject ? predict : () => setProjectModalOpen(true)}
              >
                {!activeProject
                  ? "Select Project to Predict"
                  : loading
                  ? "Predicting…"
                  : `Predict${mode === "multiple" ? ` ${rows.length} glass${rows.length === 1 ? "" : "es"}` : ""}${
                      model === "ALL" ? " with all four" : ` with ${model}`
                    }`}
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

      <Dialog
        open={zeroAlert !== null}
        onClose={() => setZeroAlert(null)}
        title={
          zeroAlert?.blocking
            ? `No glass former${zeroAlert.glass ? ` in glass ${zeroAlert.glass}` : ""}`
            : `${listText((zeroAlert?.oxides ?? []).map(formula))} set to 0${zeroAlert?.glass ? ` in glass ${zeroAlert.glass}` : ""}`
        }
        actions={
          zeroAlert?.blocking ? (
            <Button variant="primary" onClick={() => setZeroAlert(null)}>
              Change amounts
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setZeroAlert(null)}>
                Keep 0
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  zeroAlert?.undo?.();
                  setZeroAlert(null);
                }}
              >
                Undo
              </Button>
            </>
          )
        }
      >
        {zeroAlert && (() => {
          const names = listText(zeroAlert.oxides.map((ox) => ELEMENT_OF_OXIDE[ox]?.name ?? ox));
          const many = zeroAlert.oxides.length > 1;
          return zeroAlert.blocking ? (
            <p>
              Every glass former in this composition ({listText(zeroAlert.oxides.map(formula))}) is 0, so it
              wouldn&apos;t form a glass. Give at least one of them an amount above 0, then predict again.
            </p>
          ) : (
            <p>
              {names} {many ? "are glass formers" : "is a glass former"}: {many ? "they build" : "it builds"} the glass
              network. At 0 {many ? "they are" : "it is"} not in the glass at all, and the prediction will be for a glass
              without {many ? "them" : "it"}.
            </p>
          );
        })()}
      </Dialog>

      <ProjectModal open={projectModalOpen} onClose={() => setProjectModalOpen(false)} />
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block h-4 w-4 rounded-[4px] border ${swatch}`} aria-hidden />
      {label}
    </li>
  );
}
