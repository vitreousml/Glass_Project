"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Check, CircleMinus, CircleX, LoaderCircle } from "lucide-react";
import type { AdminModel, ModelStatus, UploadCheck } from "@/lib/api";
import { T } from "@/lib/motion";
import { fixed } from "@/lib/units";
import { Formula } from "@/components/ui/Tg";

export const inputClass =
  "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none";
export const textareaClass =
  "w-full resize-none rounded-md border border-line bg-surface p-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none";

const STATUS: Record<ModelStatus, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-ink text-paper" },
  ready: { label: "Ready to publish", className: "border border-dashed border-ink text-ink" },
  archived: { label: "Switched off", className: "bg-surface-2 text-ink-3" },
};

export function StatusBadge({ status }: { status: ModelStatus }) {
  const s = STATUS[status];
  return <span className={`inline-flex h-5 items-center rounded-sm px-1.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>;
}

export function OxideChips({ oxides, highlight = [] }: { oxides: string[]; highlight?: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {oxides.map((ox) => {
        const isNew = highlight.includes(ox);
        return (
          <span
            key={ox}
            title={isNew ? "New element on the portal" : undefined}
            className={`inline-flex h-6 items-center rounded-sm px-1.5 text-xs ${
              isNew ? "bg-heat-4/40 font-semibold text-ink ring-1 ring-heat-3" : "bg-surface-2 text-ink"
            }`}
          >
            <Formula>{ox}</Formula>
          </span>
        );
      })}
    </span>
  );
}

/** "±15 °C" for temperatures (1 K = 1 °C), "±0.02 g/cm³" otherwise. */
export function errorText(m: Pick<AdminModel, "metrics" | "unit">) {
  const mae = m.metrics?.mae;
  if (mae === undefined || mae === null) return "not recorded";
  return m.unit === "K" || m.unit === "°C" ? `±${fixed(mae, 0)} °C` : `±${fixed(mae, 3)} ${m.unit}`;
}

/** A predicted value, with °C first for Kelvin results. */
export function valueText(value: number, unit: string) {
  if (unit === "K") return `${fixed(value - 273.15, 0)} °C (${fixed(value, 0)} K)`;
  return `${fixed(value, unit === "°C" ? 0 : 3)} ${unit}`;
}

export const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

// The checks the server runs, in order (labels match the server's).
const CHECK_STEPS = [
  { id: "file", label: "File type and size" },
  { id: "duplicate", label: "Not already in the portal" },
  { id: "loads", label: "Opens safely" },
  { id: "format", label: "Has the standard model details" },
  { id: "versions", label: "Made with the same library versions as the server" },
  { id: "inputs", label: "Inputs are oxide amounts" },
  { id: "predicts", label: "Gives sensible answers" },
  { id: "reference", label: "Agrees with reference measurements" },
];

type RowState = UploadCheck["status"] | "pending" | "running" | "waiting";

function CheckIcon({ status }: { status: RowState }) {
  const base = "mt-0.5 h-4 w-4 shrink-0";
  if (status === "running") return <LoaderCircle className={`${base} animate-spin text-ink-2`} aria-hidden />;
  if (status === "waiting")
    return (
      <span className={`${base} inline-flex items-center justify-center`} aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />
      </span>
    );
  if (status === "pending") return <span className={`${base} rounded-full border border-line-strong`} aria-hidden />;
  if (status === "pass") return <Check className={`${base} text-ink`} strokeWidth={2.6} aria-hidden />;
  if (status === "warn") return <AlertTriangle className={`${base} text-warn`} aria-hidden />;
  if (status === "fail") return <CircleX className={`${base} text-danger`} aria-hidden />;
  return <CircleMinus className={`${base} text-ink-3`} aria-hidden />;
}

/**
 * The upload checklist. While the server works it ticks through the steps;
 * when the report arrives it shows each real result with its explanation.
 */
export function CheckList({ checks, running }: { checks: UploadCheck[] | null; running: boolean }) {
  const [step, setStep] = useState(0);
  // Start from the first step each time a new check begins.
  const [wasRunning, setWasRunning] = useState(running);
  if (running !== wasRunning) {
    setWasRunning(running);
    if (running) setStep(0);
  }
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, CHECK_STEPS.length - 1)), 650);
    return () => window.clearInterval(t);
  }, [running]);

  const rows: (Omit<UploadCheck, "status"> & { state: RowState })[] = checks
    ? checks.map((c) => ({ ...c, state: c.status }))
    : CHECK_STEPS.map((c, i) => ({
        ...c,
        detail: "",
        state: i < step ? "waiting" : i === step ? "running" : "pending",
      }));

  return (
    <ol className="space-y-2.5" aria-live="polite">
      {rows.map((c, i) => {
        const state = c.state;
        return (
          <motion.li
            key={c.id}
            className="flex items-start gap-2.5"
            initial={checks ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0, transition: { ...T.small, delay: checks ? i * 0.05 : 0 } }}
          >
            <CheckIcon status={state} />
            <div className="min-w-0">
              <div className={`text-sm ${c.state === "skip" ? "text-ink-3" : "text-ink"}`}>{c.label}</div>
              <AnimatePresence initial={false}>
                {c.detail && (
                  <motion.p
                    className={`text-xs ${c.state === "fail" ? "text-danger" : c.state === "warn" ? "text-warn" : "text-ink-2"}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto", transition: T.small }}
                  >
                    {c.detail}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Rows of label / value, for model details. */
export function Facts({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt className="text-ink-2">{k}</dt>
          <dd className="min-w-0 text-ink">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
