"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, X } from "lucide-react";
import type { CompositionBasis } from "@/lib/api";
import { basisLabel, sumOf, type Composition } from "@/lib/chem";
import { SPRING, T } from "@/lib/motion";
import { fixed } from "@/lib/units";
import { NumberField } from "@/components/ui/NumberField";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { Formula } from "@/components/ui/Tg";
import { Box, Section } from "@/components/seer/SetupStep";

export const MAX_ROWS = 5;

export interface CompositionRow {
  id: number;
  values: Composition; // in the current basis
}

/** A row adds up to 100 (within rounding) over the oxides in use. */
export const rowTotal = (row: CompositionRow, oxides: string[]) =>
  sumOf(Object.fromEntries(oxides.map((ox) => [ox, row.values[ox] ?? 0])));
export const rowValid = (row: CompositionRow, oxides: string[]) => Math.abs(rowTotal(row, oxides) - 100) <= 0.5;

export function MultiCompositionStep({
  oxides,
  excluded,
  onToggleOxide,
  rows,
  onSet,
  onAdd,
  onRemove,
  onScale,
  basis,
  onBasis,
}: {
  /** Every oxide from the selected elements; `excluded` ones are greyed out. */
  oxides: string[];
  excluded: string[];
  onToggleOxide: (ox: string) => void;
  rows: CompositionRow[];
  onSet: (rowId: number, oxide: string, value: number) => void;
  onAdd: () => void;
  onRemove: (rowId: number) => void;
  onScale: () => void;
  basis: CompositionBasis;
  onBasis: (b: CompositionBasis) => void;
}) {
  const unit = basisLabel(basis);
  const active = oxides.filter((ox) => !excluded.includes(ox));
  const anyInvalid = rows.some((r) => !rowValid(r, active));
  const cols = `2rem repeat(${oxides.length}, minmax(4.5rem, 1fr)) 4.5rem 2rem`;

  return (
    <Section
      title="Compositions"
      hint={`Up to ${MAX_ROWS} glasses, one per row. Untick a column to leave that oxide out. Each row must add up to 100 ${unit}.`}
      action={
        <SegmentedToggle
          id="basis-multi"
          label="Composition unit"
          value={basis}
          onChange={onBasis}
          options={[
            { value: "mol", label: "mol %" },
            { value: "wt", label: "wt %" },
          ]}
        />
      }
    >
      <div className="overflow-x-auto">
        <div role="table" aria-label="Compositions" className="min-w-max space-y-1">
          {/* Column headings: one checkbox per oxide */}
          <div role="row" className="grid items-end gap-2 pb-1" style={{ gridTemplateColumns: cols }}>
            <span role="columnheader" className="text-xs text-ink-3">
              #
            </span>
            {oxides.map((ox) => {
              const on = !excluded.includes(ox);
              return (
                <button
                  key={ox}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`Use ${ox}`}
                  onClick={() => onToggleOxide(ox)}
                  className={`flex h-8 items-center justify-end gap-1.5 rounded-sm px-1 text-sm font-medium transition-colors hover:bg-surface-2 ${
                    on ? "text-ink" : "text-ink-3"
                  }`}
                >
                  <Box on={on} />
                  <span className={on ? "" : "line-through decoration-1"}>
                    <Formula>{ox}</Formula>
                  </span>
                </button>
              );
            })}
            <span role="columnheader" className="text-right text-xs text-ink-3">
              Total
            </span>
            <span />
          </div>

          <AnimatePresence initial={false}>
            {rows.map((row, i) => {
              const total = rowTotal(row, active);
              const ok = rowValid(row, active);
              return (
                <motion.div
                  key={row.id}
                  role="row"
                  layout
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: cols }}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, transition: T.exit }}
                  transition={SPRING}
                >
                  <span className="num text-sm text-ink-3">{i + 1}</span>
                  {oxides.map((ox) => (
                    <NumberField
                      key={ox}
                      value={row.values[ox] ?? 0}
                      disabled={excluded.includes(ox)}
                      onCommit={(v) => onSet(row.id, ox, v)}
                      label={`Glass ${i + 1}, ${ox} in ${unit}`}
                      className="w-full"
                    />
                  ))}
                  <span
                    className={`num text-right text-sm transition-colors ${ok ? "text-ink-2" : "font-medium text-danger"}`}
                    aria-label={`Total ${fixed(total)}${ok ? "" : ", must be 100"}`}
                  >
                    {fixed(total)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(row.id)}
                    disabled={rows.length === 1}
                    aria-label={`Remove glass ${i + 1}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={rows.length >= MAX_ROWS}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-line-strong px-3 text-sm text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add composition
          <span className="num text-xs text-ink-3">
            {rows.length}/{MAX_ROWS}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {anyInvalid && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: T.small }}
              exit={{ opacity: 0, transition: T.exit }}
            >
              <span className="text-xs text-danger">Rows in red don&apos;t add up to 100.</span>
              <button
                type="button"
                onClick={onScale}
                className="text-sm text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
              >
                Scale to 100
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Section>
  );
}
