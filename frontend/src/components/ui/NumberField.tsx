"use client";

import React, { useState } from "react";
import { DURATION, useAnimatedNumber } from "@/lib/motion";

/**
 * Number box that rolls to new values when they change from elsewhere.
 * Typing is kept as a draft and applied on Enter or blur, so "12.5" can be
 * typed without other values jumping on every key.
 */
export function NumberField({
  value,
  onCommit,
  disabled,
  label,
  digits = 1,
  min = 0,
  max = 100,
  step = 0.1,
  className = "",
}: {
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
  label: string;
  digits?: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const shown = useAnimatedNumber(value, DURATION.panel);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(draft);
    if (!Number.isNaN(v)) onCommit(v);
    setDraft(null);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={label}
      value={draft ?? shown.toFixed(digits)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
      className={`num h-8 rounded-sm border border-line bg-surface px-2 text-right text-sm text-ink transition-colors hover:border-line-strong focus:border-ink focus:outline-none disabled:opacity-45 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  );
}
