"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { PERIODIC_ELEMENTS } from "@/data/elements";
import { MODELS, MOLAR_MASS, PROPERTIES } from "@/lib/chem";
import { SPRING, T } from "@/lib/motion";
import { fixed } from "@/lib/units";
import { Formula, Tg } from "@/components/ui/Tg";

export function Box({ on }: { on: boolean }) {
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
  selectedElements,
  oxideChoices = {},
  onOxideChoiceChange,
}: {
  oxides: string[];
  excluded: string[];
  onToggleOxide: (ox: string) => void;
  properties: string[];
  onToggleProperty: (id: string) => void;
  model: string;
  onModel: (id: string) => void;
  selectedElements?: string[];
  oxideChoices?: Record<string, string>;
  onOxideChoiceChange?: (sym: string, ox: string) => void;
}) {
  const modelOptions = [
    ...MODELS.map((m) => ({ id: m.id, name: m.name, detail: `±${fixed(m.mae, 0)} °C · R² ${m.r2}` })),
    { id: "ALL", name: "Compare all four", detail: "RF, XGB, KNN and SVM side by side" },
  ];

  const multiOxideElements = (selectedElements || [])
    .map((sym) => PERIODIC_ELEMENTS.find((e) => e.symbol === sym))
    .filter((e): e is (typeof PERIODIC_ELEMENTS)[0] => !!e && !!e.oxides && e.oxides.length > 1);

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

        {/* Oxidation State Choice for Multi-Oxide Elements (Fe, Mn) */}
        {multiOxideElements.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            {multiOxideElements.map((el) => {
              const currentOx = oxideChoices[el.symbol] || el.oxide;
              return (
                <div key={el.symbol} className="rounded-md border border-line bg-surface-2/40 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink">
                      {el.name} ({el.symbol}) oxidation state:
                    </span>
                    <span className="text-ink-3 text-[11px]">One active at a time</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {el.oxides!.map((oxOption) => {
                      const isChosen = currentOx === oxOption;
                      return (
                        <button
                          key={oxOption}
                          type="button"
                          onClick={() => onOxideChoiceChange?.(el.symbol, oxOption)}
                          className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            isChosen
                              ? "bg-ink text-paper font-semibold"
                              : "border border-line bg-surface text-ink hover:bg-surface-2"
                          }`}
                        >
                          <Formula>{oxOption}</Formula>
                          {isChosen && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
        <div className="mt-2 space-y-2">
          {PROPERTIES.filter((p) => !p.available).map((p) => (
            <div
              key={p.id}
              role="checkbox"
              aria-checked={false}
              aria-disabled
              title="No trained model for this property yet"
              className="flex h-10 w-full cursor-not-allowed items-center gap-3 rounded-md border border-dashed border-line px-3 text-left text-ink-3"
            >
              <span className="inline-flex h-4 w-4 shrink-0 rounded-[4px] border border-line" aria-hidden />
              <span className="flex-1 text-sm">{p.label}</span>
              <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs">No model yet</span>
            </div>
          ))}
        </div>
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
