"use client";

import React, { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { SPRING } from "@/lib/motion";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 0-100 slider. The one being dragged follows the pointer exactly; when its value
 * changes because of something else (another slider, a unit switch) it glides there.
 */
export function Slider({
  value,
  onChange,
  disabled,
  label,
  valueText,
  step = 0.5,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
  valueText?: string;
  step?: number;
}) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const mv = useMotionValue(value);
  const left = useTransform(mv, (v) => `${v}%`);

  useEffect(() => {
    if (dragging.current || reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, SPRING);
    return () => controls.stop();
  }, [value, reduce, mv]);

  const fromPointer = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const pct = clamp(((clientX - r.left) / r.width) * 100, 0, 100);
    return Math.round(pct / step) * step;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const big = e.shiftKey ? 5 : step;
    const map: Record<string, number> = {
      ArrowRight: value + big,
      ArrowUp: value + big,
      ArrowLeft: value - big,
      ArrowDown: value - big,
      PageUp: value + 10,
      PageDown: value - 10,
      Home: 0,
      End: 100,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    onChange(clamp(map[e.key], 0, 100));
  };

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(value.toFixed(1))}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        onChange(fromPointer(e.clientX));
      }}
      onPointerMove={(e) => {
        if (dragging.current) onChange(fromPointer(e.clientX));
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      className={`group relative flex h-6 touch-none items-center rounded-full ${
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
      }`}
    >
      <div ref={trackRef} className="relative h-1 w-full rounded-full bg-line">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: left }} />
      </div>
      <motion.div
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface shadow-sm transition-[scale] duration-150 group-active:scale-115"
        style={{ left }}
      />
    </div>
  );
}
