"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT, SPRING, useAnimatedNumber } from "@/lib/motion";
import { fixed } from "@/lib/units";

export interface ScaleRow {
  id: string;
  label: string;
  valueC: number;
  maeC?: number;
  /** The model's raw value, shown as secondary text when values are listed. */
  kelvin?: number;
}

const GUTTER = 38; // room for row labels
const VALUES_W = 150; // right column with each row's value
const AXIS_H = 30;
const TOP = 14;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Colour of a temperature on the ember -> butter ramp (t in 0..1). */
function heat(t: number): string {
  const stops = ["var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = Math.round((x - i) * 100);
  return `color-mix(in oklab, ${stops[i + 1]} ${f}%, ${stops[i]})`;
}

/**
 * Predicted values as markers on a °C axis, each with its error band (± test MAE).
 * The shaded strip is the Tg range of the training glasses.
 */
export function TemperatureScale({
  rows,
  rangeC,
  stale = false,
  showValues = false,
  countFromC,
}: {
  rows: ScaleRow[];
  rangeC?: [number, number];
  stale?: boolean;
  /** List each row's value (°C, then K) at the end of the row. */
  showValues?: boolean;
  /** Where value count-ups start on first show. */
  countFromC?: number;
}) {
  const ROW_H = showValues ? 22 : 18;
  const PAD_R = showValues ? VALUES_W : 10;
  const reduce = useReducedMotion();
  const [ref, width] = useWidth<HTMLDivElement>();

  // Domain: training range with room, widened to include any value and its band.
  let lo = Math.min(150, ...(rangeC ? [rangeC[0] - 50] : []));
  let hi = Math.max(800, ...(rangeC ? [rangeC[1] + 50] : []));
  rows.forEach((r) => {
    lo = Math.min(lo, r.valueC - (r.maeC ?? 0) - 20);
    hi = Math.max(hi, r.valueC + (r.maeC ?? 0) + 20);
  });
  lo = Math.floor(lo / 50) * 50;
  hi = Math.ceil(hi / 50) * 50;

  const plotW = Math.max(0, width - GUTTER - PAD_R);
  const x = (c: number) => GUTTER + ((c - lo) / (hi - lo)) * plotW;
  const height = TOP + rows.length * ROW_H + AXIS_H;
  const axisY = TOP + rows.length * ROW_H + 6;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / 100) * 100; t <= hi; t += 100) ticks.push(t);

  return (
    <div
      ref={ref}
      className={`w-full transition-[filter,opacity] duration-200 ${stale ? "opacity-55 grayscale" : ""}`}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Predicted values on a temperature scale in degrees Celsius">
          <defs>
            <linearGradient id="heat-ramp" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" style={{ stopColor: "var(--heat-1)" }} />
              <stop offset="45%" style={{ stopColor: "var(--heat-2)" }} />
              <stop offset="75%" style={{ stopColor: "var(--heat-3)" }} />
              <stop offset="100%" style={{ stopColor: "var(--heat-4)" }} />
            </linearGradient>
          </defs>

          {/* Training range */}
          {rangeC && (
            <g>
              <rect
                x={x(rangeC[0])}
                y={TOP - 4}
                width={x(rangeC[1]) - x(rangeC[0])}
                height={rows.length * ROW_H + 8}
                rx={3}
                style={{ fill: "var(--ink)" }}
                opacity={0.05}
              />
              <text x={x(rangeC[1]) - 3} y={TOP - 6} textAnchor="end" fontSize={11} style={{ fill: "var(--ink-3)" }}>
                training range
              </text>
            </g>
          )}

          {/* Rows */}
          {rows.map((r, i) => {
            const cy = TOP + i * ROW_H + ROW_H / 2;
            const px = x(r.valueC);
            const delay = reduce ? 0 : Math.min(i * 0.08, 0.4);
            const color = heat((r.valueC - lo) / (hi - lo));
            const band = r.maeC ? x(r.valueC + r.maeC) - x(r.valueC - r.maeC) : 0;
            return (
              <g key={r.id}>
                <text x={0} y={cy + 4} fontSize={12} className="num" style={{ fill: "var(--ink-2)" }}>
                  {r.label}
                </text>
                <line x1={GUTTER} x2={GUTTER + plotW} y1={cy} y2={cy} stroke="var(--line)" strokeWidth={1} />
                <motion.g
                  initial={reduce ? false : { x: GUTTER }}
                  animate={{ x: px }}
                  transition={reduce ? { duration: 0 } : { ...SPRING, delay }}
                >
                  {band > 0 && (
                    <motion.rect
                      x={-band / 2}
                      y={cy - 4}
                      width={band}
                      height={8}
                      rx={4}
                      style={{ fill: color, originX: 0.5, transformBox: "fill-box" }}
                      opacity={0.45}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: delay + 0.3, duration: DURATION.panel, ease: EASE_OUT }}
                    />
                  )}
                  <line x1={0} x2={0} y1={cy - 7} y2={cy + 7} stroke="var(--ink)" strokeWidth={1.5} />
                  <circle cy={cy} r={3.5} style={{ fill: color, stroke: "var(--ink)" }} strokeWidth={1.2} />
                </motion.g>
                {showValues && (
                  <RowValue x={GUTTER + plotW + 14} y={cy + 4} valueC={r.valueC} maeC={r.maeC} kelvin={r.kelvin} fromC={countFromC} />
                )}
              </g>
            );
          })}

          {/* Axis: heat ramp bar, ticks, labels */}
          <rect x={GUTTER} y={axisY} width={plotW} height={3} rx={1.5} fill="url(#heat-ramp)" />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={axisY + 3} y2={axisY + 7} stroke="var(--ink-3)" strokeWidth={1} />
              <text x={x(t)} y={axisY + 20} textAnchor="middle" fontSize={11} className="num" style={{ fill: "var(--ink-3)" }}>
                {fixed(t, 0)}
              </text>
            </g>
          ))}
          <text x={0} y={axisY + 20} fontSize={11} style={{ fill: "var(--ink-3)" }}>
            °C
          </text>
        </svg>
      )}
    </div>
  );
}

function RowValue({
  x,
  y,
  valueC,
  maeC,
  kelvin,
  fromC,
}: {
  x: number;
  y: number;
  valueC: number;
  maeC?: number;
  kelvin?: number;
  fromC?: number;
}) {
  const c = useAnimatedNumber(valueC, DURATION.data, fromC);
  // Whole degrees: the models aren't more precise than that.
  return (
    <text x={x} y={y} fontSize={13} className="num" style={{ fill: "var(--ink)" }}>
      {fixed(c, 0)}
      {maeC !== undefined && <tspan style={{ fill: "var(--ink-2)" }}> ± {fixed(maeC, 0)}</tspan>} °C
      {kelvin !== undefined && (
        <tspan dx={8} fontSize={11} style={{ fill: "var(--ink-3)" }}>
          {fixed(kelvin, 0)} K
        </tspan>
      )}
    </text>
  );
}
