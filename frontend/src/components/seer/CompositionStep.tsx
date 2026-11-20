"use client";

import React from "react";
import type { CompositionBasis } from "@/lib/api";
import { OXIDES, basisLabel, formula, sumOf, toFullMol, type Composition } from "@/lib/chem";
import { fixed } from "@/lib/units";
import { Slider } from "@/components/ui/Slider";
import { NumberField } from "@/components/ui/NumberField";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { Formula } from "@/components/ui/Tg";
import { TernaryDiagram } from "@/components/viz/TernaryDiagram";
import { Section } from "@/components/seer/SetupStep";

export function CompositionStep({
  oxides,
  composition,
  basis,
  onBasis,
  onSet,
  region,
}: {
  oxides: string[];
  composition: Composition;
  basis: CompositionBasis;
  onBasis: (b: CompositionBasis) => void;
  onSet: (oxide: string, value: number) => void;
  region: Composition[];
}) {
  const unit = basisLabel(basis);
  const locked = oxides.length === 1;
  // The triangle only shows SiO2–B2O3–Na2O glasses; others (from newer models) skip it.
  const ternary = oxides.every((ox) => (OXIDES as readonly string[]).includes(ox));

  return (
    <Section
      title="Composition"
      hint={
        basis === "wt"
          ? "The total stays at 100. Weight % is converted to mol % on the server before predicting."
          : "The total stays at 100. Switching unit keeps the same glass."
      }
      action={
        <SegmentedToggle
          id="basis"
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
      <div className={`grid items-center gap-5 ${ternary ? "grid-cols-[120px_1fr]" : "grid-cols-1"}`}>
        {ternary && (
        <figure>
          <TernaryDiagram
            point={toFullMol(composition, basis)}
            region={region}
            regionLabel="Composition ranges of the training glasses"
            className="w-full"
          />
          <figcaption className="mt-1 text-center text-xs leading-tight text-ink-3">
            {region.length > 0 ? "dashed: training ranges" : "your glass, mol %"}
          </figcaption>
        </figure>
        )}

        <div className="space-y-2">
          {oxides.map((ox) => {
            const v = composition[ox] ?? 0;
            return (
              <div key={ox}>
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium">
                    <Formula>{ox}</Formula>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <NumberField
                      value={v}
                      disabled={locked}
                      onCommit={(n) => onSet(ox, n)}
                      label={`${ox} in ${unit}`}
                      className="w-[72px]"
                    />
                    <span className="w-9 text-xs text-ink-3">{unit}</span>
                  </span>
                </div>
                <Slider
                  value={v}
                  disabled={locked}
                  onChange={(n) => onSet(ox, n)}
                  label={`${formula(ox)} amount`}
                  valueText={`${fixed(v)} ${unit}`}
                />
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-line pt-2 text-sm">
            <span className="text-ink-2">Total</span>
            <span className="num">
              {fixed(sumOf(composition))} {unit}
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}
