"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion, type Transition } from "motion/react";

// The whole app uses only these timings. If an animation can't say what it
// explains (where something came from, or what changed), it shouldn't exist.

export const DURATION = {
  press: 0.12, // press, hover
  small: 0.2, // small state change
  panel: 0.32, // panels, screen changes
  data: 0.6, // data drawing, count-ups
} as const;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const; // entrances
export const EASE_IN = [0.55, 0, 1, 0.45] as const; // exits

// For things the user moves directly (sliders, toggles, selections).
export const SPRING: Transition = { type: "spring", stiffness: 520, damping: 38, mass: 0.7 };

export const T = {
  press: { duration: DURATION.press, ease: EASE_OUT },
  small: { duration: DURATION.small, ease: EASE_OUT },
  panel: { duration: DURATION.panel, ease: EASE_OUT },
  data: { duration: DURATION.data, ease: EASE_OUT },
  exit: { duration: DURATION.small, ease: EASE_IN },
} satisfies Record<string, Transition>;

/** Per-item stagger: at most 30 ms, and the whole list within 400 ms. */
export function staggerStep(count: number): number {
  return Math.min(0.03, 0.4 / Math.max(count, 1));
}

/**
 * A number that glides to each new value. With reduced motion it jumps.
 * `from` is where the very first animation starts (defaults to the first value).
 */
export function useAnimatedNumber(value: number, duration: number = DURATION.data, from?: number): number {
  const reduce = useReducedMotion();
  const current = useRef(from ?? value);
  const [shown, setShown] = useState(from ?? value);

  useEffect(() => {
    if (reduce) {
      current.current = value;
      return;
    }
    const controls = animate(current.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        current.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return reduce ? value : shown;
}
