"use client";

import React, { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { OXIDES, formula, type Composition } from "@/lib/chem";
import { DURATION, EASE_OUT, SPRING } from "@/lib/motion";

/*
 * A three-oxide glass is a point in a triangle.
 * Vertex 0 at the top, Vertex 1 bottom-left, Vertex 2 bottom-right.
 * Gridlines every 20 mol %.
 * Accepts an optional `oxides` prop ([top, bottom-left, bottom-right]);
 * falls back to the OXIDES constant so existing callers keep working.
 */

// Fixed SVG vertex positions (never change — purely geometric)
const V0 = { x: 60, y: 12 };     // top
const V1 = { x: 10, y: 98.6 };   // bottom-left
const V2 = { x: 110, y: 98.6 };  // bottom-right

/** Convert a composition to SVG (x,y) using whichever 3 oxides are active. */
export function toXY(c: Composition, oxides: readonly string[] = OXIDES) {
  const total = oxides.reduce((a, ox) => a + (c[ox] ?? 0), 0) || 1;
  const [ox0, ox1, ox2] = oxides;
  const w0 = (c[ox0] ?? 0) / total;
  const w1 = (c[ox1] ?? 0) / total;
  const w2 = (c[ox2] ?? 0) / total;
  return {
    x: w0 * V0.x + w1 * V1.x + w2 * V2.x,
    y: w0 * V0.y + w1 * V1.y + w2 * V2.y,
  };
}

function gridLines(oxides: readonly string[]) {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const [a, b, c] = oxides;
  for (const k of [20, 40, 60, 80]) {
    for (const [p, q, r] of [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ]) {
      const p1 = toXY({ [p]: k, [q]: 100 - k, [r]: 0 }, oxides);
      const p2 = toXY({ [p]: k, [q]: 0, [r]: 100 - k }, oxides);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
  }
  return lines;
}

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
  title,
  oxides: oxidesProp,
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
  /** Sweep a line across the composition space while a search is running. */
  scanning?: boolean;
  className?: string;
  /** SVG accessible title. Defaults to a label built from `oxides`. */
  title?: string;
  /**
   * Which 3 oxides map to [top, bottom-left, bottom-right] vertices.
   * Falls back to the OXIDES constant from chem.ts so existing callers
   * don't need to change.
   */
  oxides?: [string, string, string];
}) {
  const reduce = useReducedMotion();
  const clipId = "tri" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // Resolve active oxides: prop → OXIDES constant fallback
  const activeOxides: readonly string[] =
    oxidesProp && oxidesProp.length === 3 ? oxidesProp : OXIDES;

  const svgTitle =
    title ?? `Composition on the ${activeOxides.map(formula).join("–")} triangle`;

  // Recompute grid whenever the oxide set changes
  const GRID = useMemo(() => gridLines(activeOxides), [activeOxides]);

  const regionPath = useMemo(() => {
    if (!region || region.length < 3) return null;
    const xy = region.map((c) => toXY(c, activeOxides));
    const cx = xy.reduce((a, p) => a + p.x, 0) / xy.length;
    const cy = xy.reduce((a, p) => a + p.y, 0) / xy.length;
    xy.sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
    return "M" + xy.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L") + " Z";
  }, [region, activeOxides]);

  const dot = point ? toXY(point, activeOxides) : null;

  // Scanning sweep: animates from first vertex toward the base
  const sweepStart = toXY({ [activeOxides[0]]: 85, [activeOxides[1]]: 15, [activeOxides[2]]: 0 }, activeOxides);
  const sweepEnd  = toXY({ [activeOxides[0]]: 40, [activeOxides[1]]: 60, [activeOxides[2]]: 0 }, activeOxides);

  return (
    <svg viewBox="0 0 120 112" className={className} role="img" aria-label={svgTitle}>
      {/* Frame and grid */}
      <path
        d={`M${V0.x},${V0.y} L${V1.x},${V1.y} L${V2.x},${V2.y} Z`}
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth={0.8}
      />
      <g stroke="var(--line)" strokeWidth={0.5}>
        {GRID.map((l, i) => (
          <line key={i} {...l} />
        ))}
      </g>

      {/* Search sweep animation */}
      {scanning && !reduce && (
        <>
          <clipPath id={clipId}>
            <path d={`M${V0.x},${V0.y} L${V1.x},${V1.y} L${V2.x},${V2.y} Z`} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <motion.g
              initial={{ y: sweepStart.y }}
              animate={{ y: sweepEnd.y }}
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
        const { x, y } = toXY(p.comp, activeOxides);
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

      {/* Vertex labels — derived from active oxides, never hardcoded */}
      <g fontSize={7} style={{ fill: "var(--ink-2)" }} fontWeight={500}>
        <text x={V0.x} y={V0.y - 4} textAnchor="middle">
          {formula(activeOxides[0])}
        </text>
        <text x={V1.x} y={V1.y + 9} textAnchor="start">
          {formula(activeOxides[1])}
        </text>
        <text x={V2.x} y={V2.y + 9} textAnchor="end">
          {formula(activeOxides[2])}
        </text>
      </g>
    </svg>
  );
}
