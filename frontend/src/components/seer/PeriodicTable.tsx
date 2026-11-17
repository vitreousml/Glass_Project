"use client";

import React, { memo, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PERIODIC_ELEMENTS, type ElementData } from "@/data/elements";
import { formula } from "@/lib/chem";
import { DURATION, EASE_OUT, SPRING } from "@/lib/motion";

// The entrance wave plays on the first visit per page load only.
let wavePlayed = false;

// Elements the models accept, in reading order (for arrow-key navigation).
const SELECTABLE = PERIODIC_ELEMENTS.filter((e) => e.supported).sort((a, b) => a.row - b.row || a.col - b.col);

// Wave timing: cells arrive along the diagonal (row + col), selectable ones last.
const WAVE_STEP = 0.011;
const WAVE_LAST = 28 * WAVE_STEP + 0.06;

export function PeriodicTable({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (el: ElementData) => void;
}) {
  const reduce = useReducedMotion();
  const [wave] = useState(() => !wavePlayed);
  useEffect(() => {
    wavePlayed = true;
  }, []);
  const playWave = wave && !reduce;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !back) return;
    const symbol = (e.target as HTMLElement).dataset.symbol;
    const i = SELECTABLE.findIndex((s) => s.symbol === symbol);
    if (i < 0) return;
    e.preventDefault();
    const next = SELECTABLE[(i + (forward ? 1 : -1) + SELECTABLE.length) % SELECTABLE.length];
    e.currentTarget.querySelector<HTMLElement>(`[data-symbol="${next.symbol}"]`)?.focus();
  };

  return (
    <div className="pt-grid h-full" role="group" aria-label="Periodic table" onKeyDown={onKeyDown}>
      {PERIODIC_ELEMENTS.map((el) => (
        <Cell key={el.number} el={el} selected={selected.includes(el.symbol)} onToggle={onToggle} wave={playWave} />
      ))}
      <Slot row={6} col={3} label="57–71" title="Lanthanides, shown below" wave={playWave} />
      <Slot row={7} col={3} label="89–103" title="Actinides, shown below" wave={playWave} />
    </div>
  );
}

function waveProps(wave: boolean, delay: number) {
  return wave
    ? {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: DURATION.small, delay, ease: EASE_OUT },
      }
    : { initial: false as const };
}

const Cell = memo(function Cell({
  el,
  selected,
  onToggle,
  wave,
}: {
  el: ElementData;
  selected: boolean;
  onToggle: (el: ElementData) => void;
  wave: boolean;
}) {
  const delay = el.supported ? WAVE_LAST : (el.row + el.col) * WAVE_STEP;
  const inner = (
    <>
      <span className="pt-number">{el.number}</span>
      <span className="pt-symbol">{el.symbol}</span>
      <span className="pt-name">{el.name}</span>
    </>
  );

  // Outer element: grid placement and the entrance. Inner element: hover and press,
  // so their timing never inherits the entrance delay.
  return (
    <motion.div style={{ gridRow: el.row, gridColumn: el.col }} {...waveProps(wave, delay)}>
      {el.supported ? (
        <motion.button
          type="button"
          data-symbol={el.symbol}
          onClick={() => onToggle(el)}
          aria-pressed={selected}
          aria-label={`${el.name}, enters the glass as ${formula(el.oxide ?? "")}${el.noModel ? ", no model yet" : ""}`}
          title={`${el.name} → ${formula(el.oxide ?? "")}${el.noModel ? " · glass former, no model yet" : ""}`}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.9 }}
          transition={SPRING}
          className={`pt-cell ${selected ? "pt-selected" : el.noModel ? "pt-supported pt-nomodel" : "pt-supported"}`}
        >
          {inner}
        </motion.button>
      ) : (
        <div
          title={el.implicit ? `${el.name}: part of every oxide` : `${el.name}: no training data yet`}
          className={`pt-cell ${el.implicit ? "pt-implicit" : "pt-off"}`}
        >
          {inner}
        </div>
      )}
    </motion.div>
  );
});

function Slot({ row, col, label, title, wave }: { row: number; col: number; label: string; title: string; wave: boolean }) {
  return (
    <motion.div style={{ gridRow: row, gridColumn: col }} {...waveProps(wave, (row + col) * WAVE_STEP)}>
      <div className="pt-cell pt-marker" title={title}>
        <span className="pt-number">{label}</span>
      </div>
    </motion.div>
  );
}
