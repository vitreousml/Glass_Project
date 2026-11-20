"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { discoverCompositions, getBankSummary } from "@/lib/api";
import { MODELS, formula, rangeRegion, type Composition } from "@/lib/chem";
import { SPRING, T, staggerStep } from "@/lib/motion";
import { cToK, fixed, kToC } from "@/lib/units";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tg } from "@/components/ui/Tg";
import { Section } from "@/components/seer/SetupStep";
import { TernaryDiagram } from "@/components/viz/TernaryDiagram";

interface Candidate {
  composition: Composition; // mol %
  predicted_tg: number; // K
  difference: number; // K, same size in °C
  warnings: string[];
}

interface Query {
  targetC: number;
  tolerance: number;
  model: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; query: Query; candidates: Candidate[]; total: number };

type Ranges = Record<string, { min: number; max: number }>;

/** Build a CSS grid class for 1 index col + N oxide cols + Tg col + Δ col */
function rowClass(n: number) {
  return `grid grid-cols-[1.25rem_repeat(${n},minmax(0,1fr))_minmax(0,1.2fr)_2.5rem] items-center gap-2`;
}

const idOf = (c: Candidate, oxList: string[]) =>
  oxList.map((ox) => c.composition[ox]).join("-");

export default function ZenModule() {
  const { token } = useAuth();
  const [targetC, setTargetC] = useState(577); // ≈ 850 K
  const [tolerance, setTolerance] = useState(20);
  const [model, setModel] = useState("RF");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [hover, setHover] = useState<string | null>(null);
  const [ranges, setRanges] = useState<Ranges | null>(null);
  // Oxides come from the bank/summary `features` field — no hardcoding
  const [oxides, setOxides] = useState<string[]>([]);

  useEffect(() => {
    getBankSummary()
      .then((s) => {
        setRanges(s.ranges ?? null);
        // features array comes from the model bundle via the backend
        if (Array.isArray(s.features) && s.features.length > 0) {
          setOxides(s.features as string[]);
        }
      })
      .catch(() => {
        setRanges(null);
      });
  }, []);

  const region = useMemo(() => (ranges ? rangeRegion(ranges) : []), [ranges]);
  const tgRangeC = ranges?.Tg ? [kToC(ranges.Tg.min), kToC(ranges.Tg.max)] : null;
  const outside = tgRangeC && (targetC < tgRangeC[0] || targetC > tgRangeC[1]);

  const loading = state.kind === "loading";
  const stale =
    state.kind === "done" &&
    (state.query.targetC !== targetC || state.query.tolerance !== tolerance || state.query.model !== model);

  const discover = async () => {
    const query = { targetC, tolerance, model };
    setState({ kind: "loading" });
    setHover(null);
    try {
      // The API works in Kelvin; a tolerance of ±20 is the same in K and °C.
      const data = await discoverCompositions(cToK(targetC), tolerance, model, token);
      // If the backend returns a features array, keep oxides in sync
      if (Array.isArray(data.features) && data.features.length > 0) {
        setOxides(data.features as string[]);
      }
      setState({ kind: "done", query, candidates: data.candidates ?? [], total: data.candidates_count ?? 0 });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Couldn't reach the server." });
    }
  };

  const candidates = state.kind === "done" ? state.candidates : [];
  const points = candidates.map((c) => ({ id: idOf(c, oxides), comp: c.composition }));
  const closest = candidates[0] ? idOf(candidates[0], oxides) : null;

  // Safe 3-tuple for TernaryDiagram (which requires exactly 3 vertices)
  const ternaryOxides =
    oxides.length === 3 ? (oxides as [string, string, string]) : undefined;

  // Dynamic grid class based on number of oxides
  const ROW = rowClass(oxides.length || 3);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-lg font-semibold">Zen</h1>
        <p className="text-sm text-ink-2">
          Enter the <Tg /> you want. Zen screens the composition space with a model and lists the glasses that land
          closest.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        {/* Target */}
        <form
          className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) discover();
          }}
        >
          <Section title={<>Target <Tg /></>}>
            <div className="flex items-center gap-2">
              <NumberField
                label="Target Tg in degrees Celsius"
                value={targetC}
                onCommit={(v) => setTargetC(Math.round(v))}
                digits={0}
                min={0}
                max={1500}
                step={1}
                className="h-10 w-28 text-base"
              />
              <span className="text-sm text-ink-2">°C</span>
              <span className="num ml-auto text-xs text-ink-3">{fixed(cToK(targetC))} K</span>
            </div>
            <AnimatePresence initial={false}>
              {outside && tgRangeC && (
                <motion.p
                  className="mt-2 flex items-start gap-2 overflow-hidden text-xs text-warn"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto", transition: T.small }}
                  exit={{ opacity: 0, height: 0, transition: T.exit }}
                >
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  Outside the training range ({fixed(tgRangeC[0], 0)}–{fixed(tgRangeC[1], 0)} °C). Expect few or no
                  matches.
                </motion.p>
              )}
            </AnimatePresence>
          </Section>

          <Section title="Tolerance" hint="How far a prediction may land from the target.">
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-2">±</span>
              <NumberField
                label="Tolerance in degrees Celsius"
                value={tolerance}
                onCommit={(v) => setTolerance(Math.min(200, Math.max(1, Math.round(v))))}
                digits={0}
                min={1}
                max={200}
                step={1}
                className="h-10 w-20 text-base"
              />
              <span className="text-sm text-ink-2">°C</span>
            </div>
          </Section>

          <Section title="Model">
            <div role="radiogroup" aria-label="Model" className="grid grid-cols-2 gap-2">
              {MODELS.map((m) => {
                const on = model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setModel(m.id)}
                    className={`relative isolate rounded-md border px-3 py-2 text-left transition-colors duration-200 ${
                      on ? "border-transparent" : "border-line hover:border-line-strong"
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId="zen-model"
                        transition={SPRING}
                        className="absolute inset-0 -z-10 rounded-md border border-ink bg-surface-2/60"
                      />
                    )}
                    <span className="block text-sm font-medium">{m.id}</span>
                    <span className="num mt-0.5 block text-xs text-ink-3">±{fixed(m.mae)} °C</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Button type="submit" variant="primary" size="lg" className="mt-auto overflow-hidden" disabled={loading} aria-busy={loading}>
            {loading ? "Screening…" : "Discover compositions"}
            {!loading && <ArrowRight className="h-4 w-4" aria-hidden />}
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
        </form>

        {/* Candidates */}
        <section className="grid gap-5 rounded-lg border border-line bg-surface p-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <TernaryDiagram
              region={region}
              regionLabel="Training coverage"
              points={points}
              highlightId={hover ?? closest}
              onHover={setHover}
              scanning={loading}
              className="mx-auto w-full max-w-xs md:max-w-none"
              oxides={ternaryOxides}
            />
            <p className="mt-2 text-xs text-ink-3">
              Shaded: training coverage. {candidates.length > 0 && "Orange: the closest match, or the one you point at."}
            </p>
          </div>

          <div className="min-w-0" aria-live="polite">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold">Candidates</h2>
              <AnimatePresence initial={false}>
                {stale && (
                  <motion.span
                    className="text-xs text-ink-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: T.small }}
                    exit={{ opacity: 0, transition: T.exit }}
                  >
                    Inputs changed · press Discover to update
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {state.kind === "idle" && (
                <Fade key="idle">
                  <p className="mt-3 text-sm text-ink-2">
                    Set a target and press Discover. Matches appear here, closest first.
                  </p>
                </Fade>
              )}

              {state.kind === "loading" && (
                <Fade key="loading">
                  <p className="mt-1 text-sm text-ink-2">
                    Screening oxide composition space in 2.5 mol % steps…
                  </p>
                  <div className="mt-3 space-y-2" role="status" aria-label="Searching">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </Fade>
              )}

              {state.kind === "error" && (
                <Fade key="error">
                  <div role="alert" className="mt-3 space-y-3">
                    <p className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {state.message}
                    </p>
                    <Button variant="secondary" size="sm" onClick={discover}>
                      Try again
                    </Button>
                  </div>
                </Fade>
              )}

              {state.kind === "done" && candidates.length === 0 && (
                <Fade key="empty">
                  <p className="mt-3 text-sm text-ink-2">
                    No glass in the screened grid lands within{" "}
                    <span className="num">±{state.query.tolerance} °C</span> of{" "}
                    <span className="num">{state.query.targetC} °C</span> with {state.query.model}. Widen the
                    tolerance
                    {tgRangeC && (
                      <>
                        {" "}
                        or pick a target inside the training range (
                        <span className="num">
                          {fixed(tgRangeC[0], 0)}–{fixed(tgRangeC[1], 0)} °C
                        </span>
                        )
                      </>
                    )}
                    .
                  </p>
                </Fade>
              )}

              {state.kind === "done" && candidates.length > 0 && (
                <Fade key={`done-${JSON.stringify(state.query)}`}>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {candidates.length < state.total
                      ? `Closest ${candidates.length} of ${state.total} found`
                      : `${candidates.length} found`}{" "}
                    with {state.query.model}, closest first.
                  </p>
                  <div
                    className={`mt-3 transition-[filter,opacity] duration-200 ${stale ? "opacity-55 grayscale" : ""}`}
                  >
                    {/* Header row */}
                    <div className={`${ROW} overflow-y-hidden px-3 pb-1 text-xs text-ink-3 [scrollbar-gutter:stable]`} aria-hidden>
                      <span>#</span>
                      {oxides.map((ox) => (
                        <span key={ox} className="text-right">
                          {formula(ox)}
                        </span>
                      ))}
                      <span className="text-right">
                        <Tg />, °C
                      </span>
                      <span className="text-right">Δ</span>
                    </div>
                    <ol className="max-h-[22rem] space-y-0.5 overflow-y-auto [scrollbar-gutter:stable]">
                      {candidates.map((c, i) => {
                        const id = idOf(c, oxides);
                        const on = (hover ?? closest) === id;
                        return (
                          <motion.li
                            key={id}
                            onMouseEnter={() => setHover(id)}
                            onMouseLeave={() => setHover(null)}
                            aria-label={`${oxides.map((ox) => `${ox} ${fixed(c.composition[ox])}`).join(", ")} mol %: ${fixed(kToC(c.predicted_tg))} °C`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0, transition: { ...T.small, delay: i * staggerStep(candidates.length) } }}
                            className={`${ROW} num rounded-md border px-3 py-1.5 text-sm transition-colors duration-200 ${
                              on ? "border-ink bg-surface-2/60" : "border-transparent hover:border-line"
                            }`}
                          >
                            <span className="text-xs text-ink-3">{i + 1}</span>
                            {oxides.map((ox) => (
                              <span key={ox} className="text-right">
                                {fixed(c.composition[ox])}
                              </span>
                            ))}
                            <span className="text-right font-medium">{fixed(kToC(c.predicted_tg))}</span>
                            <span className="text-right text-xs text-ink-3">{fixed(c.difference)}</span>
                          </motion.li>
                        );
                      })}
                    </ol>
                  </div>
                  <p className="mt-2 text-xs text-ink-3">Oxides in mol %. Δ is the distance from the target, °C.</p>
                </Fade>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
}

function Fade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: T.small }}
      exit={{ opacity: 0, transition: T.exit }}
    >
      {children}
    </motion.div>
  );
}
