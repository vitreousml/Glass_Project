"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { MODELS, MOLAR_MASS, PROPERTIES } from "@/lib/chem";
import { SPRING, T } from "@/lib/motion";
import { fixed } from "@/lib/units";
import { Formula, Tg } from "@/components/ui/Tg";

function Box({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-200 ${
        on ? "border-ink bg-ink text-paper" : "border-line-strong"
      }`}
    >
      <AnimatePresence initial={false}>
        {on && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={T.press}>
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {hint && <p className="mt-0.5 text-sm text-ink-2">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function SetupStep({
  oxides,
  excluded,
  onToggleOxide,
  properties,
  onToggleProperty,
  model,
  onModel,
}: {
  oxides: string[];
  excluded: string[];
  onToggleOxide: (ox: string) => void;
  properties: string[];
  onToggleProperty: (id: string) => void;
  model: string;
  onModel: (id: string) => void;
}) {
  const modelOptions = [
    ...MODELS.map((m) => ({ id: m.id, name: m.name, detail: `±${fixed(m.mae)} °C · R² ${m.r2}` })),
    { id: "ALL", name: "Compare all four", detail: "RF, XGB, KNN and SVM side by side" },
  ];

  return (
    <div className="space-y-6">
      <Section title="Oxides" hint="Each element goes into the glass as its oxide. Untick one to leave it out.">
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
                  title={`${MOLAR_MASS[ox]} g/mol`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                  className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-base transition-colors duration-200 ${
                    on ? "border-ink bg-surface text-ink" : "border-line text-ink-3 hover:border-line-strong"
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
      </Section>

      <Section title="Properties" hint="What to predict.">
        {PROPERTIES.filter((p) => p.available).map((p) => {
          const on = properties.includes(p.id);
          return (
            <motion.button
              key={p.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggleProperty(p.id)}
              whileTap={{ scale: 0.99 }}
              transition={T.press}
              className={`flex h-10 w-full items-center gap-3 rounded-md border px-3 text-left transition-colors duration-200 ${
                on ? "border-ink" : "border-line hover:border-line-strong"
              }`}
            >
              <Box on={on} />
              <span className="w-6 text-base font-semibold">{p.id === "Tg" ? <Tg /> : p.id}</span>
              <span className="flex-1 text-sm">{p.label}</span>
              <span className="text-xs text-ink-3">shown in °C</span>
            </motion.button>
          );
        })}
        <p className="mt-3 mb-1.5 text-xs text-ink-3">No trained model yet</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {PROPERTIES.filter((p) => !p.available).map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm text-ink-3">
              <span className="h-px w-3 bg-line-strong" aria-hidden />
              {p.label}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Model" hint="± is the average error on test glasses the model never saw.">
        <div role="radiogroup" aria-label="Model" className="grid grid-cols-2 gap-2">
          {modelOptions.map((m) => {
            const on = model === m.id;
            const wide = m.id === "ALL";
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onModel(m.id)}
                className={`relative isolate rounded-md border px-3 py-2 text-left transition-colors duration-200 ${
                  wide ? "col-span-2" : ""
                } ${on ? "border-transparent" : "border-line hover:border-line-strong"}`}
              >
                {on && (
                  <motion.span
                    layoutId="model-choice"
                    transition={SPRING}
                    className="absolute inset-0 -z-10 rounded-md border border-ink bg-surface-2/60"
                  />
                )}
                <span className="block text-sm font-medium">{m.name}</span>
                <span className="num mt-0.5 block text-xs text-ink-3">{m.detail}</span>
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
