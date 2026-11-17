"use client";

import React, { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formula, type Composition } from "@/lib/chem";
import { DURATION, EASE_OUT, SPRING, T } from "@/lib/motion";
import { fixed } from "@/lib/units";
import { useWidth } from "@/lib/useWidth";

/*
 * Composition profile: one vertical 0–100 axis per oxide (works for any number of
 * oxides, unlike a triangle). Each glass is a line through its amount on every axis.
 * The shaded strip on an axis is that oxide's training range; a hollow ring marks
 * an amount outside it.
 *
 * Identity is never colour alone: one glass at a time is drawn in ink (the
 * highlighted one), the rest recede, and every line carries its label. The heat
 * colours stay reserved for temperature.
 */

export interface ProfileLine {
  id: string;
  /** Short label at the end of the line, e.g. "1". */
  label?: string;
  /** Long name for tooltips, e.g. "Glass 1". */
  name?: string;
  values: Composition; // mol %
}

type Ranges = Partial<Record<string, { min: number; max: number }>>;

const PAD_L = 34; // y ticks
const PAD_R = 30; // line-end labels
const PAD_T = 22;
const PAD_B = 34; // oxide names
const TICKS = [0, 25, 50, 75, 100];

export function OxideProfile({
  oxides,
  ranges,
  lines = [],
  highlightId,
  onHover,
  scanning = false,
  showRangeValues = false,
  height = 170,
  unit = "mol %",
  title = "Composition profile",
}: {
  oxides: string[];
  ranges?: Ranges | null;
  lines?: ProfileLine[];
  highlightId?: string | null;
  onHover?: (id: string | null) => void;
  /** Sweep the SiO₂ axis from 40 to 85 mol % (what Zen's search screens). */
  scanning?: boolean;
  /** Write each training range's min and max beside its strip. */
  showRangeValues?: boolean;
  height?: number;
  unit?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number; line: ProfileLine; ox: string } | null>(null);
  const clip = "op" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const plotW = Math.max(0, width - PAD_L - PAD_R);
  const plotH = Math.max(0, height - PAD_T - PAD_B);
  const n = oxides.length;
  // Axes sit in the middle of equal columns, so one or two oxides still look intentional.
  const ax = (i: number) => PAD_L + (plotW * (i + 0.5)) / Math.max(n, 1);
  const y = (v: number) => PAD_T + plotH * (1 - Math.min(100, Math.max(0, v)) / 100);
  const outside = (ox: string, v: number) => {
    const r = ranges?.[ox];
    return !!r && (v < r.min - 1e-6 || v > r.max + 1e-6);
  };

  const active = highlightId ?? (lines.length === 1 ? lines[0].id : null);
  // Draw the highlighted line last, so it sits on top.
  const ordered = [...lines].sort((a, b) => Number(a.id === active) - Number(b.id === active));
  const labelAll = lines.length <= 5;
  const pathOf = (l: ProfileLine) =>
    oxides.map((ox, i) => `${i === 0 ? "M" : "L"}${ax(i).toFixed(1)},${y(l.values[ox] ?? 0).toFixed(1)}`).join(" ");
  const shape = oxides.join("|"); // remount lines when the axes change

  // End labels: spread apart so lines that end at the same amount stay readable.
  const labelY: Record<string, number> = {};
  const labelled = lines
    .filter((l) => l.label && (labelAll || l.id === active))
    .map((l) => ({ id: l.id, y: y(l.values[oxides[n - 1]] ?? 0) }))
    .sort((a, b) => a.y - b.y);
  labelled.forEach((l, i) => {
    labelY[l.id] = i === 0 ? l.y : Math.max(l.y, labelY[labelled[i - 1].id] + 13);
  });
  // If that pushed labels below the plot, shift the whole stack up.
  const overflow = labelled.length ? labelY[labelled[labelled.length - 1].id] - (PAD_T + plotH + 4) : 0;
  if (overflow > 0) labelled.forEach((l) => (labelY[l.id] -= overflow));

  const summary =
    lines.length === 0
      ? `Training ranges for ${oxides.join(", ")}`
      : `${lines.length} composition${lines.length > 1 ? "s" : ""} across ${oxides.join(", ")}, ${unit}`;

  return (
    <div className="w-full">
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && n > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${title}: ${summary}`} className="overflow-visible">
            {/* Recessive grid */}
            {TICKS.map((t) => (
              <g key={t}>
                <line x1={PAD_L} x2={PAD_L + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} className="num" style={{ fill: "var(--ink-3)" }}>
                  {t}
                </text>
              </g>
            ))}
            <text x={0} y={11} fontSize={11} style={{ fill: "var(--ink-3)" }}>
              {unit}
            </text>

            {/* Axes with their training-range strips */}
            {oxides.map((ox, i) => {
              const r = ranges?.[ox];
              const x = ax(i);
              return (
                <g key={ox}>
                  <line
                    x1={x}
                    x2={x}
                    y1={y(100)}
                    y2={y(0)}
                    stroke="var(--line-strong)"
                    strokeWidth={1}
                    strokeDasharray={r ? undefined : "3 3"}
                  />
                  {r && (
                    <motion.rect
                      x={x - 7}
                      width={14}
                      rx={4}
                      style={{ fill: "var(--ink)" }}
                      opacity={0.09}
                      initial={reduce ? false : { attrY: y(0), height: 0 }}
                      animate={{ attrY: y(r.max), height: y(r.min) - y(r.max) }}
                      transition={{ duration: DURATION.data, ease: EASE_OUT, delay: reduce ? 0 : i * 0.05 }}
                    />
                  )}
                  {r && showRangeValues && (
                    <motion.g
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: reduce ? 0 : DURATION.data, duration: DURATION.small }}
                      fontSize={11}
                      className="num"
                      style={{ fill: "var(--ink-2)" }}
                    >
                      <text x={x + 11} y={y(r.max) + 4}>
                        {fixed(r.max, 0)}
                      </text>
                      <text x={x + 11} y={y(r.min) + 4}>
                        {fixed(r.min, 0)}
                      </text>
                    </motion.g>
                  )}
                  <text x={x} y={height - PAD_B + 18} textAnchor="middle" fontSize={13} fontWeight={500} style={{ fill: "var(--ink)" }}>
                    {formula(ox)}
                  </text>
                  {!r && (
                    <text x={x} y={height - PAD_B + 31} textAnchor="middle" fontSize={11} style={{ fill: "var(--ink-3)" }}>
                      no data
                    </text>
                  )}
                </g>
              );
            })}

            {/* Search sweep on the SiO₂ axis */}
            {scanning && !reduce && oxides.includes("SiO2") && (
              <motion.rect
                x={ax(oxides.indexOf("SiO2")) - 10}
                width={20}
                height={6}
                rx={3}
                style={{ fill: "var(--ink)" }}
                opacity={0.35}
                initial={{ y: y(40) }}
                animate={{ y: y(85) }}
                transition={{ duration: 1.1, ease: "linear", repeat: Infinity, repeatDelay: 0.15 }}
              />
            )}

            {/* Glasses */}
            <clipPath id={clip}>
              <rect x={0} y={0} width={width} height={height} />
            </clipPath>
            <g clipPath={`url(#${clip})`}>
              {ordered.map((l, li) => {
                const on = l.id === active;
                const dim = active !== null && !on;
                const d = pathOf(l);
                return (
                  <g key={`${l.id}-${shape}`} opacity={dim ? 0.4 : 1} style={{ transition: "opacity 0.2s" }}>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={on ? "var(--ink)" : "var(--ink-3)"}
                      strokeWidth={on ? 2.25 : 1.5}
                      strokeLinejoin="round"
                      initial={reduce ? false : { pathLength: 0, d }}
                      animate={{ pathLength: 1, d }}
                      transition={{
                        pathLength: { duration: DURATION.data, ease: EASE_OUT, delay: Math.min(li * 0.03, 0.4) },
                        d: SPRING,
                      }}
                    />
                    {/* Wide invisible stroke: easy to point at */}
                    {onHover && (
                      <path
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={12}
                        onMouseEnter={() => onHover(l.id)}
                        onMouseLeave={() => onHover(null)}
                      />
                    )}
                    {oxides.map((ox, i) => {
                      const v = l.values[ox] ?? 0;
                      const out = outside(ox, v);
                      return (
                        <g key={ox}>
                          <motion.circle
                            cx={ax(i)}
                            r={4}
                            initial={false}
                            animate={{ cy: y(v) }}
                            transition={reduce ? { duration: 0 } : SPRING}
                            style={{
                              fill: out ? "var(--surface)" : on ? "var(--ink)" : "var(--ink-3)",
                              stroke: out ? "var(--warn)" : "var(--surface)",
                            }}
                            strokeWidth={2}
                          />
                          {/* Hit target bigger than the mark */}
                          <circle
                            cx={ax(i)}
                            cy={y(v)}
                            r={10}
                            fill="transparent"
                            onMouseEnter={() => {
                              setTip({ x: ax(i), y: y(v), line: l, ox });
                              onHover?.(l.id);
                            }}
                            onMouseLeave={() => {
                              setTip(null);
                              onHover?.(null);
                            }}
                          />
                        </g>
                      );
                    })}
                    {labelY[l.id] !== undefined && (
                      <text
                        x={ax(n - 1) + 10}
                        y={labelY[l.id] + 4}
                        fontSize={12}
                        fontWeight={on ? 600 : 400}
                        className="num"
                        style={{ fill: on ? "var(--ink)" : "var(--ink-2)" }}
                      >
                        {l.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Tooltip */}
        <AnimatePresence>
          {tip && (
            <motion.div
              key={`${tip.line.id}-${tip.ox}`}
              role="tooltip"
              className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-float"
              style={{ left: tip.x, top: tip.y - 10, translate: "-50% -100%" }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: T.press }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {tip.line.name && <div className="text-ink-2">{tip.line.name}</div>}
              <div className="font-medium">
                {formula(tip.ox)} <span className="num">{fixed(tip.line.values[tip.ox] ?? 0)}</span> {unit}
              </div>
              {outside(tip.ox, tip.line.values[tip.ox] ?? 0) && ranges?.[tip.ox] && (
                <div className="text-warn">
                  Outside training range ({fixed(ranges[tip.ox]!.min, 0)}–{fixed(ranges[tip.ox]!.max, 0)})
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Key */}
      <ul className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3" aria-hidden>
        {ranges && (
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-2 rounded-[2px] bg-ink/10" />
            training range
          </li>
        )}
        {lines.length > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full border-2 border-warn" />
            outside it
          </li>
        )}
        {oxides.some((ox) => !ranges?.[ox]) && ranges && (
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0 border-l border-dashed border-line-strong" />
            no training data
          </li>
        )}
      </ul>
    </div>
  );
}
