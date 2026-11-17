"use client";

import React from "react";
import { motion } from "motion/react";
import { SPRING } from "@/lib/motion";

interface Option<V extends string> {
  value: V;
  label: React.ReactNode;
}

/** Two or more mutually exclusive options; the dark thumb slides to the chosen one. */
export function SegmentedToggle<V extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string; // unique per toggle, so thumbs of different toggles never animate between each other
  label: string;
  options: Option<V>[];
  value: V;
  onChange: (v: V) => void;
}) {
  const index = options.findIndex((o) => o.value === value);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = options[(index + step + options.length) % options.length];
    onChange(next.value);
    // Keep focus on the newly chosen option.
    const group = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex rounded-md border border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative isolate rounded-[5px] px-3 py-1 text-sm font-medium transition-colors duration-200 ${
              on ? "text-paper" : "text-ink-2 hover:text-ink"
            }`}
          >
            {on && (
              <motion.span
                layoutId={`${id}-thumb`}
                transition={SPRING}
                className="absolute inset-0 -z-10 rounded-[5px] bg-ink"
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
