"use client";

import React, { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { OXIDES, formula, type Composition } from "@/lib/chem";
import { DURATION, EASE_OUT, SPRING } from "@/lib/motion";

/*
 * A three-oxide glass is a point in a triangle.
 * SiO2 at the top, B2O3 bottom-left, Na2O bottom-right. Gridlines every 20 mol %.
 */
const V = {
  SiO2: { x: 60, y: 12 },
  B2O3: { x: 10, y: 98.6 },
  Na2O: { x: 110, y: 98.6 },
};

export function toXY(c: Composition) {
  const total = OXIDES.reduce((a, ox) => a + (c[ox] ?? 0), 0) || 1;
  let x = 0;
  let y = 0;
  OXIDES.forEach((ox) => {
    const w = (c[ox] ?? 0) / total;
    x += w * V[ox].x;
    y += w * V[ox].y;
  });
  return { x, y };
}

function gridLines() {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const k of [20, 40, 60, 80]) {
    for (const [a, b, c] of [
      ["SiO2", "B2O3", "Na2O"],
      ["B2O3", "Na2O", "SiO2"],
      ["Na2O", "SiO2", "B2O3"],
    ] as const) {
      const p1 = toXY({ [a]: k, [b]: 100 - k, [c]: 0 });
      const p2 = toXY({ [a]: k, [b]: 0, [c]: 100 - k });
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
  }
  return lines;
}
const GRID = gridLines();

export interface TernaryPoint {
  id: string;
  comp: Composition;
}

export function TernaryDiagram({
  point,
  region,
  regionLabel,
  points,
  highlightId,
  onHover,
  scanning = false,
  className = "",
  title = "Composition on the SiO₂–B₂O₃–Na₂O triangle",
}: {
  /** One composition, drawn as a dot that glides when it changes. */
  point?: Composition | null;
  /** Corners of a shaded region (e.g. training ranges). */
  region?: Composition[];
  regionLabel?: string;
  /** Many compositions (e.g. candidates). */
  points?: TernaryPoint[];
  highlightId?: string | null;
  onHover?: (id: string | null) => void;
  /** Sweep a line across the SiO₂ levels being screened (a search is running). */
  scanning?: boolean;
  className?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const clipId = "tri" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const regionPath = useMemo(() => {
    if (!region || region.length < 3) return null;
    const xy = region.map(toXY);
    const cx = xy.reduce((a, p) => a + p.x, 0) / xy.length;
    const cy = xy.reduce((a, p) => a + p.y, 0) / xy.length;
    xy.sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
    return "M" + xy.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L") + " Z";
  }, [region]);

  const dot = point ? toXY(point) : null;

  return (
    <svg viewBox="0 0 120 112" className={className} role="img" aria-label={title}>
      {/* Frame and grid */}
      <path
        d={`M${V.SiO2.x},${V.SiO2.y} L${V.B2O3.x},${V.B2O3.y} L${V.Na2O.x},${V.Na2O.y} Z`}
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth={0.8}
      />
      <g stroke="var(--line)" strokeWidth={0.5}>
        {GRID.map((l, i) => (
          <line key={i} {...l} />
        ))}
      </g>

      {/* Search sweep: the server screens SiO₂ from 40 to 85 mol %, low to high */}
      {scanning && !reduce && (
        <>
          <clipPath id={clipId}>
            <path d={`M${V.SiO2.x},${V.SiO2.y} L${V.B2O3.x},${V.B2O3.y} L${V.Na2O.x},${V.Na2O.y} Z`} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <motion.g
              initial={{ y: toXY({ SiO2: 40, B2O3: 60 }).y }}
              animate={{ y: toXY({ SiO2: 85, B2O3: 15 }).y }}
              transition={{ duration: 1.1, ease: "linear", repeat: Infinity, repeatDelay: 0.15 }}
            >
              <rect x={0} y={0} width={120} height={6} style={{ fill: "var(--heat-3)" }} opacity={0.18} />
              <line x1={0} x2={120} y1={0} y2={0} stroke="var(--heat-2)" strokeWidth={0.8} />
            </motion.g>
          </g>
        </>
      )}

      {/* Shaded region: outline draws, then fills */}
      {regionPath && (
        <g>
          <motion.path
            d={regionPath}
            stroke="var(--ink-2)"
            strokeWidth={0.7}
            strokeDasharray="2 1.5"
            initial={reduce ? false : { pathLength: 0, fillOpacity: 0 }}
            animate={{ pathLength: 1, fillOpacity: 0.09 }}
            style={{ fill: "var(--ink)" }}
            transition={{
              pathLength: { duration: DURATION.data, ease: EASE_OUT },
              fillOpacity: { delay: DURATION.data, duration: DURATION.panel },
            }}
          />
          {regionLabel && (
            <title>{regionLabel}</title>
          )}
        </g>
      )}

      {/* Many points */}
      {points?.map((p, i) => {
        const { x, y } = toXY(p.comp);
        const on = highlightId === p.id;
        return (
          <motion.circle
            key={p.id}
            cx={x}
            cy={y}
            r={on ? 3 : 1.8}
            onMouseEnter={() => onHover?.(p.id)}
            onMouseLeave={() => onHover?.(null)}
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, r: on ? 3 : 1.8 }}
            transition={{ delay: reduce ? 0 : Math.min(i * 0.02, 0.4), duration: DURATION.small }}
            style={{ fill: on ? "var(--heat-2)" : "var(--ink)", stroke: "var(--surface)" }}
            strokeWidth={0.6}
          />
        );
      })}

      {/* The current composition */}
      {dot && (
        <motion.g initial={false} animate={{ x: dot.x, y: dot.y }} transition={reduce ? { duration: 0 } : SPRING}>
          <circle r={5} style={{ fill: "var(--ink)" }} opacity={0.12} />
          <circle r={2.6} style={{ fill: "var(--ink)", stroke: "var(--surface)" }} strokeWidth={0.8} />
        </motion.g>
      )}

      {/* Vertex labels */}
      <g fontSize={7} style={{ fill: "var(--ink-2)" }} fontWeight={500}>
        <text x={V.SiO2.x} y={V.SiO2.y - 4} textAnchor="middle">
          {formula("SiO2")}
        </text>
        <text x={V.B2O3.x} y={V.B2O3.y + 9} textAnchor="start">
          {formula("B2O3")}
        </text>
        <text x={V.Na2O.x} y={V.Na2O.y + 9} textAnchor="end">
          {formula("Na2O")}
        </text>
      </g>
    </svg>
  );
}
