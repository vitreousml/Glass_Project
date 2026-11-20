"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  Download,
  Printer,
  X,
} from "lucide-react";
import { PERIODIC_ELEMENTS, type ElementData } from "@/data/elements";
import { queryBankData, type BankQueryResult } from "@/lib/api";
import {
  MAX_ELEMENTS,
  PROPERTIES,
  formula,
} from "@/lib/chem";
import { DURATION, EASE_IN, SPRING, T } from "@/lib/motion";
import { fixed, kToC } from "@/lib/units";
import { downloadCsv, printReport, reportDate, WATERMARK, ACKNOWLEDGEMENT_NOTICE, type Report } from "@/lib/export";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { PeriodicTable } from "@/components/seer/PeriodicTable";
import { Formula, Tg } from "@/components/ui/Tg";
import { Skeleton } from "@/components/ui/Skeleton";
import { Box, Section } from "@/components/seer/SetupStep";

const ELEMENT_BY_SYMBOL = Object.fromEntries(PERIODIC_ELEMENTS.map((e) => [e.symbol, e]));

const getOxideForSymbol = (sym: string, choices: Record<string, string>) =>
  choices[sym] || ELEMENT_BY_SYMBOL[sym]?.oxide || "";

const oxidesFor = (symbols: string[], excluded: string[], choices: Record<string, string> = {}) =>
  symbols
    .map((s) => getOxideForSymbol(s, choices))
    .filter((ox): ox is string => !!ox && !excluded.includes(ox));

/** Max properties the user can select in Bank (max 2). */
const MAX_BANK_PROPERTIES = 2;

const PROPERTY_SYMBOLS: Record<string, React.ReactNode> = {
  Tg: <Tg />,
  density: <span className="font-serif italic text-base">ρ</span>,
  refractive_index: <span className="font-serif italic text-base">n</span>,
  youngs_modulus: <span className="font-serif italic text-base">E</span>,
  cte: <span className="font-serif italic text-base">α</span>,
};

// Steps slide horizontally in the direction of travel.
const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0, transition: T.panel },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -24,
    transition: { duration: DURATION.press, ease: EASE_IN },
  }),
};

export default function BankModule() {
  const { token } = useAuth();

  // --- Element selection (Periodic table) ---
  const [selected, setSelected] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [oxideChoices, setOxideChoices] = useState<Record<string, string>>({
    Fe: "Fe2O3",
    Mn: "MnO2",
  });
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // --- Property selection (max 2) ---
  const [properties, setProperties] = useState<string[]>(["Tg"]);

  // --- Drawer & steps ---
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<{ n: 1 | 2; dir: number }>({ n: 1, dir: 0 });

  // --- Query results ---
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BankQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allOxides = selected
    .map((s) => getOxideForSymbol(s, oxideChoices))
    .filter((ox): ox is string => !!ox);
  const activeOxides = oxidesFor(selected, excluded, oxideChoices);

  const canContinue = activeOxides.length > 0 && properties.length > 0;
  const currentStep = canContinue ? step.n : 1;

  const toggleElement = (el: ElementData) => {
    if (!el.supported) return;
    const adding = !selected.includes(el.symbol);
    if (adding && selected.length >= MAX_ELEMENTS) {
      setSelectionError(
        `Up to ${MAX_ELEMENTS} elements at a time. Remove one to add ${el.symbol}.`
      );
      return;
    }
    setSelectionError(null);
    const symbols = adding
      ? [...selected, el.symbol]
      : selected.filter((s) => s !== el.symbol);
    setSelected(symbols);
    // If element is removed, un-exclude its current oxide
    const currentOx = getOxideForSymbol(el.symbol, oxideChoices);
    if (!adding && currentOx) {
      setExcluded((prev) => prev.filter((o) => o !== currentOx));
    }
    if (symbols.length === 0) setOpen(false);
  };

  const handleOxideChoiceChange = (sym: string, newOx: string) => {
    const oldOx = getOxideForSymbol(sym, oxideChoices);
    setOxideChoices((prev) => ({ ...prev, [sym]: newOx }));
    setExcluded((prev) => prev.map((o) => (o === oldOx ? newOx : o)));
  };

  const toggleOxide = (ox: string) => {
    setExcluded((prev) =>
      prev.includes(ox) ? prev.filter((o) => o !== ox) : [...prev, ox]
    );
  };

  const toggleProperty = (id: string) => {
    setProperties((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= MAX_BANK_PROPERTIES) return p;
      return [...p, id];
    });
  };

  const resetAll = () => {
    setSelected([]);
    setExcluded([]);
    setProperties(["Tg"]);
    setResult(null);
    setError(null);
    setSelectionError(null);
    setStep({ n: 1, dir: 0 });
  };

  const closePanel = () => {
    setOpen(false);
    if (result) resetAll();
  };

  const goStep = (n: 1 | 2) => setStep((s) => ({ n, dir: n > s.n ? 1 : -1 }));

  const proceed = () => {
    if (selected.length === 0) {
      setSelectionError("Select at least one element.");
      return;
    }
    setSelectionError(null);
    setOpen(true);
  };

  const queryData = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await queryBankData(activeOxides, properties, token);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  };

  // --- Report builder for CSV / print ---
  const buildBankReport = (): Report => {
    if (!result) {
      return { title: "Bank", meta: [], columns: [], rows: [] };
    }
    const cols = [
      ...result.oxides.map((ox) => `${ox} (mol %)`),
      ...result.properties.map((p) => (p === "Tg" ? "Tg (°C)" : p)),
    ];

    const rows: (string | number)[][] = result.rows.map((row) => {
      const r: (string | number)[] = [];
      for (const ox of result.oxides) {
        r.push(Number(fixed(row[ox] ?? 0)));
      }
      for (const p of result.properties) {
        const val = row[p];
        if (p === "Tg") {
          r.push(val != null ? Number(fixed(kToC(val), 1)) : "—");
        } else {
          r.push(val != null ? Number(fixed(val, 2)) : "—");
        }
      }
      return r;
    });

    return {
      title: "Glass Studio · Bank — training dataset export",
      meta: [
        `Created ${reportDate()}`,
        `Selected oxides: ${result.oxides.join(", ")} (mol %)`,
        `Selected properties: ${result.properties.join(", ")}`,
        `${result.total} matching row${result.total === 1 ? "" : "s"} found in training bank`,
      ],
      columns: cols,
      rows,
      notes: [
        "Watermarked copy: generated via Glass Studio Bank export.",
        "Rows where data for any one selected property is present are included.",
      ],
    };
  };

  return (
    <div className="flex h-full min-h-[460px] flex-col">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3">
        <div>
          <h1 className="text-lg font-semibold">Bank</h1>
          <p className="text-sm text-ink-2">
            Explore the training dataset. Select elements, configure oxides and properties, and export matching experimental records.
          </p>
        </div>
        <ul
          className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2"
          aria-label="Legend"
        >
          <Legend swatch="pt-supported" label="Has model data" />
          <Legend swatch="pt-supported pt-nomodel" label="Glass former, no model yet" />
          <Legend swatch="pt-selected" label="Selected" />
          <Legend swatch="pt-implicit" label="Oxygen, in every oxide" />
          <Legend swatch="pt-off" label="No data yet" />
        </ul>
      </header>

      <div className="min-h-[300px] flex-1 md:min-h-0">
        <PeriodicTable selected={selected} onToggle={toggleElement} />
      </div>

      {/* Selection bar */}
      <BankSelectionBar
        selected={selected}
        oxideChoices={oxideChoices}
        onRemove={(sym) => toggleElement(ELEMENT_BY_SYMBOL[sym])}
        onClear={() => {
          setSelected([]);
          setExcluded([]);
          setOpen(false);
        }}
        onContinue={proceed}
        error={selectionError}
      />

      {/* Drawer: Oxide Selection & Property Selection (Step 1) → Data Table (Step 2) */}
      <Drawer
        open={open}
        onClose={closePanel}
        label="Bank dataset query"
        className="sm:w-[min(920px,100vw)]"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-line px-5 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Bank query setup</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {selected.map((sym) => (
                  <span
                    key={sym}
                    className="rounded-sm bg-ink px-1.5 py-0.5 text-xs font-semibold text-paper"
                  >
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
                { n: 1, label: "Oxides & properties" },
                { n: 2, label: "Dataset records" },
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
                      layoutId="bank-step"
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
                <BankSetupStep
                  oxides={allOxides}
                  excluded={excluded}
                  onToggleOxide={toggleOxide}
                  properties={properties}
                  onToggleProperty={toggleProperty}
                  selectedElements={selected}
                  oxideChoices={oxideChoices}
                  onOxideChoiceChange={handleOxideChoiceChange}
                />
              ) : (
                <>
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

                  {loading && <BankSkeleton />}

                  {result && !loading && (
                    <BankDataTable result={result} onReport={buildBankReport} />
                  )}

                  {!result && !loading && !error && (
                    <div className="rounded-lg border border-dashed border-line bg-surface/50 p-8 text-center space-y-3">
                      <Database className="h-8 w-8 mx-auto text-ink-3 opacity-40" aria-hidden />
                      <div className="text-sm font-medium text-ink">
                        Ready to search dataset
                      </div>
                      <p className="text-xs text-ink-3 max-w-sm mx-auto">
                        Press &ldquo;Fetch data&rdquo; below to search the bank for glasses containing your selected oxides and properties.
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
          {currentStep === 1 ? (
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={!canContinue}
              onClick={() => {
                goStep(2);
                queryData();
              }}
            >
              Next: view dataset
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
                className="flex-1 overflow-hidden relative"
                disabled={loading}
                aria-busy={loading}
                onClick={queryData}
              >
                {loading ? "Loading records…" : "Refresh records"}
                {!loading && <Database className="h-4 w-4" aria-hidden />}
                {loading && (
                  <motion.span
                    aria-hidden
                    className="absolute bottom-0 left-0 h-0.5 w-1/3 bg-paper/80"
                    initial={{ x: "-100%" }}
                    animate={{ x: "300%" }}
                    transition={{
                      duration: 0.9,
                      ease: "linear",
                      repeat: Infinity,
                    }}
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function BankSetupStep({
  oxides,
  excluded,
  onToggleOxide,
  properties,
  onToggleProperty,
  selectedElements = [],
  oxideChoices = {},
  onOxideChoiceChange,
}: {
  oxides: string[];
  excluded: string[];
  onToggleOxide: (ox: string) => void;
  properties: string[];
  onToggleProperty: (id: string) => void;
  selectedElements?: string[];
  oxideChoices?: Record<string, string>;
  onOxideChoiceChange?: (sym: string, ox: string) => void;
}) {
  const activeOxides = oxides.filter((ox) => !excluded.includes(ox));

  const multiOxideElements = (selectedElements || [])
    .map((sym) => PERIODIC_ELEMENTS.find((e) => e.symbol === sym))
    .filter((e): e is (typeof PERIODIC_ELEMENTS)[0] => !!e && !!e.oxides && e.oxides.length > 1);

  return (
    <div className="space-y-6">
      {/* 1. Oxide Selection */}
      <Section
        title="Oxides selection"
        hint="Select which oxides to include in your dataset query. Untick one to leave it out."
      >
        <div className="flex flex-wrap gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {oxides.map((ox) => {
              const on = !excluded.includes(ox);
              return (
                <motion.button
                  key={ox}
                  layout
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggleOxide(ox)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                  className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-base transition-colors duration-200 ${
                    on
                      ? "border-ink bg-surface text-ink"
                      : "border-line text-ink-3 hover:border-line-strong"
                  }`}
                >
                  <Box on={on} />
                  <span className={on ? "" : "line-through decoration-1"}>
                    <Formula>{ox}</Formula>
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        {activeOxides.length === 0 && (
          <p className="mt-2 text-xs text-danger flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Keep at least one oxide selected.
          </p>
        )}
      </Section>

      {/* Multi-oxide state selector for elements with multiple oxidation states (e.g., Fe, Mn) */}
      {multiOxideElements.length > 0 && (
        <Section
          title="Oxide state selection"
          hint="Select which oxidation state to query for elements with multiple oxides (one active at a time)."
        >
          <div className="space-y-3">
            {multiOxideElements.map((el) => {
              const currentOx = oxideChoices[el.symbol] || el.oxide || "";
              return (
                <div key={el.symbol} className="rounded-md border border-line bg-surface p-3">
                  <div className="mb-2 text-xs font-semibold text-ink">
                    {el.name} ({el.symbol}) oxide state
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(el.oxides || []).map((ox) => {
                      const active = currentOx === ox;
                      return (
                        <button
                          key={ox}
                          type="button"
                          onClick={() => onOxideChoiceChange?.(el.symbol, ox)}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                            active
                              ? "border-ink bg-ink text-paper"
                              : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                          }`}
                        >
                          <Formula>{ox}</Formula>
                          {active && <span className="text-[10px] opacity-80">(Active)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 2. Property Selection (Max 2 properties) */}
      <Section
        title={`Property selection (${properties.length}/${MAX_BANK_PROPERTIES})`}
        hint={`Select up to ${MAX_BANK_PROPERTIES} properties to query. If data for any one selected property is present in a record, that row will be returned.`}
      >
        <div className="space-y-2">
          {PROPERTIES.map((p) => {
            const on = properties.includes(p.id);
            const atLimit = properties.length >= MAX_BANK_PROPERTIES && !on;
            const hasDataInBank = p.id === "Tg";

            return (
              <motion.button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={atLimit}
                onClick={() => onToggleProperty(p.id)}
                whileTap={{ scale: 0.99 }}
                transition={T.press}
                className={`flex h-12 w-full items-center gap-3 rounded-md border px-3 text-left transition-colors duration-200 ${
                  on
                    ? "border-ink bg-surface"
                    : atLimit
                    ? "border-line opacity-40 cursor-not-allowed"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <Box on={on} />
                <span className="w-8 shrink-0 text-center text-sm font-semibold text-ink">
                  {PROPERTY_SYMBOLS[p.id] ?? p.id}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">
                    {p.label}
                  </div>
                  <div className="text-xs text-ink-3">
                    {hasDataInBank
                      ? "Experimental data available in bank (°C)"
                      : "Optional property (not recorded in current ternary CSV)"}
                  </div>
                </div>
                {on && (
                  <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-paper shrink-0">
                    Selected
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
        {properties.length === 0 && (
          <p className="mt-2 text-xs text-danger flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Select at least one property.
          </p>
        )}
      </Section>
    </div>
  );
}

function BankDataTable({
  result,
  onReport,
}: {
  result: BankQueryResult;
  onReport: () => Report;
}) {
  const [page, setPage] = useState(0);
  const [showAckToast, setShowAckToast] = useState(false);
  const perPage = 25;
  const totalPages = Math.ceil(result.rows.length / perPage);
  const paged = result.rows.slice(page * perPage, (page + 1) * perPage);

  const handleDownloadCsv = () => {
    downloadCsv(onReport(), "glass-studio-bank");
    setShowAckToast(true);
  };

  const handlePrint = () => {
    printReport(onReport());
    setShowAckToast(true);
  };

  return (
    <section className="space-y-4">
      {/* Sample Watermark Banner on the table itself */}
      <div className="rounded-md border border-dashed border-line bg-surface-2/40 px-3 py-1.5 text-center text-[11px] font-medium tracking-wider text-ink-3 uppercase select-none">
        {WATERMARK}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Training dataset records
          </h3>
          <p className="text-xs text-ink-3">
            <span className="num font-semibold text-ink">{result.total}</span> matching record
            {result.total === 1 ? "" : "s"} found in bank
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={result.rows.length === 0}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            disabled={result.rows.length === 0}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Print
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showAckToast && (
          <motion.aside
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="rounded-lg border border-line-strong bg-surface-2 p-3 text-xs text-ink-2 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="font-semibold text-ink">Citation & Acknowledgement Request</p>
                <p>{ACKNOWLEDGEMENT_NOTICE}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAckToast(false)}
                aria-label="Dismiss notice"
                className="rounded p-1 text-ink-3 hover:bg-surface hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {result.rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center space-y-2">
          <div className="text-sm font-medium text-ink">No matching data in dataset</div>
          <p className="text-xs text-ink-3 max-w-sm mx-auto">
            None of the records in the training dataset contain measurements for the selected oxides and properties.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/60">
                <tr className="text-xs text-ink-3">
                  <th className="py-2 px-3 text-left font-normal">#</th>
                  {result.oxides.map((ox) => (
                    <th key={ox} className="px-3 py-2 text-right font-normal">
                      <Formula>{ox}</Formula>
                      <span className="ml-1 text-ink-3/70">mol %</span>
                    </th>
                  ))}
                  {result.properties.map((p) => (
                    <th
                      key={p}
                      className="px-3 py-2 text-right font-medium text-ink-2"
                    >
                      {p === "Tg" ? <><Tg /> (°C)</> : p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => (
                  <tr
                    key={page * perPage + i}
                    className="border-t border-line hover:bg-surface-2/30 transition-colors"
                  >
                    <td className="num py-2 px-3 text-ink-3">
                      {page * perPage + i + 1}
                    </td>
                    {result.oxides.map((ox) => (
                      <td key={ox} className="num px-3 py-2 text-right text-ink-2">
                        {fixed(row[ox] ?? 0)}
                      </td>
                    ))}
                    {result.properties.map((p) => (
                      <td
                        key={p}
                        className="num px-3 py-2 text-right font-medium text-ink"
                      >
                        {p === "Tg"
                          ? row[p] != null
                            ? fixed(kToC(row[p] as number), 1)
                            : "—"
                          : row[p] != null
                          ? fixed(row[p] as number, 2)
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-ink-3">
                Page <span className="num font-medium text-ink">{page + 1}</span> of{" "}
                <span className="num font-medium text-ink">{totalPages}</span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bottom watermark notice */}
      <div className="rounded-md border border-dashed border-line bg-surface-2/40 px-3 py-1.5 text-center text-[11px] font-medium tracking-wider text-ink-3 uppercase select-none">
        {WATERMARK}
      </div>

      <p className="text-xs text-ink-3">
        Oxides in mol %. Rows with data for at least one selected property are returned.
        Exports carry the watermark required for academic dissemination.
      </p>
    </section>
  );
}

function BankSelectionBar({
  selected,
  onRemove,
  onClear,
  onContinue,
  error,
  oxideChoices = {},
}: {
  selected: string[];
  onRemove: (symbol: string) => void;
  onClear: () => void;
  onContinue: () => void;
  error: string | null;
  oxideChoices?: Record<string, string>;
}) {
  const ready = selected.length > 0;
  const OXIDE_OF = Object.fromEntries(
    PERIODIC_ELEMENTS.map((e) => [e.symbol, e.oxide ?? ""])
  );

  return (
    <div className="border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-h-9 flex-1 flex-wrap items-center gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {!ready ? (
              <motion.span
                key="hint"
                className="text-sm text-ink-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: T.small }}
                exit={{ opacity: 0, transition: T.exit }}
              >
                Select elements to search the bank (up to 5 elements).
              </motion.span>
            ) : (
              selected.map((sym) => (
                <motion.span
                  key={sym}
                  layout
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6, transition: T.exit }}
                  transition={SPRING}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface pr-1 pl-2.5 text-sm"
                >
                  <span className="font-semibold">{sym}</span>
                  <span className="text-ink-3" aria-hidden>
                    →
                  </span>
                  <span>{formula(oxideChoices[sym] || OXIDE_OF[sym])}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(sym)}
                    aria-label={`Remove ${sym}`}
                    className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </motion.span>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnimatePresence initial={false}>
            {ready && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={T.small}
              >
                <Button variant="ghost" size="sm" onClick={onClear}>
                  Clear
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="primary"
            onClick={onContinue}
            disabled={!ready}
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key={error}
            role="alert"
            className="mt-2 flex items-start gap-2 overflow-hidden text-sm text-danger"
            initial={{ opacity: 0, height: 0 }}
            animate={{
              opacity: 1,
              height: "auto",
              x: [0, -5, 5, -3, 3, 0],
              transition: { ...T.small, x: { duration: 0.36 } },
            }}
            exit={{ opacity: 0, height: 0, transition: T.exit }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
function BankSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-5">
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={`inline-block h-4 w-4 rounded-[4px] border ${swatch}`}
        aria-hidden
      />
      {label}
    </li>
  );
}
