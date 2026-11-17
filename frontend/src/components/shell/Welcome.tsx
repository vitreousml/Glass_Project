"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, T, useAnimatedNumber } from "@/lib/motion";
import { fixed } from "@/lib/units";
import { Tg } from "@/components/ui/Tg";

/*
 * Welcome after signing in: the greeting appears glowing like a melt and cools,
 * letter by letter, into solid ink while a readout counts down to room temperature.
 * It passes Tg on the way, the moment the letters "freeze". Click or any key skips it.
 */
const START_C = 1150;
const ROOM_C = 25;
const TG_MARK_C = 560; // roughly where a soda-borosilicate glass freezes
const COOL_S = 1.4; // the countdown
const TOTAL_MS = 2600;
const REDUCED_MS = 1000;

export function Welcome({ firstName, returning, onDone }: { firstName: string; returning: boolean; onDone: () => void }) {
  const reduce = useReducedMotion();
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  // Freeze the wording at mount, so it can't change mid-animation when the profile loads.
  const [greeting] = useState(() => (returning ? "Welcome back," : "Welcome,"));
  const [target, setTarget] = useState(START_C);
  const temp = useAnimatedNumber(target, COOL_S, START_C);

  useEffect(() => {
    const cool = setTimeout(() => setTarget(ROOM_C), 250);
    const end = setTimeout(() => finishRef.current(), reduce ? REDUCED_MS : TOTAL_MS);
    const skip = () => finishRef.current();
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(cool);
      clearTimeout(end);
      window.removeEventListener("keydown", skip);
    };
  }, [reduce]);

  const line = `${greeting} ${firstName}`;
  const letters = Array.from(line);
  const frozen = temp <= TG_MARK_C;
  // Fraction of the cooling run done, for the bar.
  const progress = (START_C - temp) / (START_C - ROOM_C);

  return (
    <motion.main
      className="flex min-h-dvh cursor-pointer flex-col items-center justify-center px-6"
      onClick={finish}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: T.small }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.24, ease: EASE_OUT } }}
      aria-live="polite"
    >
      <h1 className="text-center text-xl font-semibold tracking-tight sm:text-2xl" aria-label={line}>
        {letters.map((ch, i) => (
          <Letter key={i} ch={ch} delay={0.35 + (i / Math.max(letters.length - 1, 1)) * 0.75} reduce={!!reduce} />
        ))}
      </h1>

      {/* Cooling readout */}
      <div className="mt-8 w-full max-w-xs" aria-hidden>
        <div className="relative h-1 overflow-hidden rounded-full bg-line">
          <motion.div
            className="absolute inset-y-0 right-0 rounded-full"
            style={{
              width: `${(1 - (reduce ? 1 : progress)) * 100}%`,
              background: "linear-gradient(90deg, var(--heat-1), var(--heat-2), var(--heat-3), var(--heat-4))",
            }}
          />
          {/* Tg tick on the bar */}
          <span
            className="absolute inset-y-0 w-px bg-ink"
            style={{ left: `${((START_C - TG_MARK_C) / (START_C - ROOM_C)) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-xs">
          <span className="num text-ink-2">{fixed(reduce ? ROOM_C : temp, 0)} °C</span>
          <span className={`transition-colors duration-200 ${frozen || reduce ? "text-ink" : "text-ink-3"}`}>
            {frozen || reduce ? (
              <>
                below <Tg />: solid
              </>
            ) : (
              "melt, cooling"
            )}
          </span>
        </div>
      </div>

      <motion.p
        className="mt-10 text-sm text-ink-2"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 1.6, duration: 0.32 }}
      >
        Glass Studio · predict <Tg /> from composition
      </motion.p>
      <p className="mt-2 text-xs text-ink-3">Click or press any key to skip</p>
    </motion.main>
  );
}

/** One letter: a hot, glowing copy fades out as the solid ink copy settles in. */
function Letter({ ch, delay, reduce }: { ch: string; delay: number; reduce: boolean }) {
  if (ch === " ") return <span> </span>;
  if (reduce) return <span>{ch}</span>;
  return (
    <span className="relative inline-block" aria-hidden>
      <motion.span
        className="absolute inset-0"
        style={{ color: "var(--heat-3)", textShadow: "0 0 12px var(--heat-2), 0 0 2px var(--heat-4)" }}
        initial={{ opacity: 0, y: 3, filter: "blur(2px)" }}
        animate={{ opacity: [0, 1, 0], y: [3, 0, 0], filter: ["blur(2px)", "blur(0.5px)", "blur(0px)"] }}
        transition={{ duration: 0.9, delay: delay - 0.3, times: [0, 0.3, 1], ease: EASE_OUT }}
      >
        {ch}
      </motion.span>
      <motion.span
        className="inline-block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.1, ease: EASE_OUT }}
      >
        {ch}
      </motion.span>
    </span>
  );
}
