"use client";

import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";

/*
 * Volume vs temperature on cooling: the textbook definition of the glass transition.
 * The melt follows the steep liquid line until its structure freezes at Tg, then
 * follows the shallower glass line. The dashed line is the (hypothetical) supercooled
 * liquid below Tg.
 *
 * viewBox 0 0 200 140, temperature increases to the right, volume upwards.
 * The path is drawn hot -> cold (right -> left), the direction of cooling.
 */
const MAIN = "M184,18 L104,67.1 Q96,72 86,75.3 L24,96";
const SUPERCOOLED = "M100,69.5 L44,103.9";
const KINK = { x: 96, y: 72 };

export function CoolingCurve({
  variant = "full",
  draw = true,
  loop = false,
  className = "",
}: {
  /** "full": axes and labels. "mark": just the curve, for logos. */
  variant?: "full" | "mark";
  /** Draw itself on mount. */
  draw?: boolean;
  /** Keep redrawing (loading states only). */
  loop?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const animateDraw = draw && !reduce;
  const repeat = loop && !reduce ? { repeat: Infinity, repeatType: "loop" as const, repeatDelay: 0.4 } : {};

  const path = (d: string, delay: number, duration: number, extra: object = {}) => (
    <motion.path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={animateDraw ? { pathLength: 0, opacity: 0 } : false}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration, delay, ease: EASE_OUT, ...repeat }}
      {...extra}
    />
  );

  if (variant === "mark") {
    return (
      <svg viewBox="16 8 176 100" className={className} aria-hidden>
        {path(MAIN, 0, loop ? 1.1 : DURATION.data, { strokeWidth: 12 })}
        <motion.circle
          cx={KINK.x}
          cy={KINK.y}
          r={13}
          style={{ fill: "var(--heat-4)", stroke: "currentColor" }}
          strokeWidth={7}
          initial={animateDraw ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={{ delay: animateDraw ? DURATION.data * 0.7 : 0, duration: DURATION.small, ease: EASE_OUT }}
        />
      </svg>
    );
  }

  const fade = (delay: number) => ({
    initial: animateDraw ? { opacity: 0 } : false,
    animate: { opacity: 1 },
    transition: { delay, duration: DURATION.small },
  });

  return (
    <svg viewBox="0 0 200 140" className={className} role="img" aria-labelledby="cooling-title">
      <title id="cooling-title">
        Volume against temperature on cooling: the liquid line bends into the glass line at the glass transition
        temperature, Tg.
      </title>

      {/* Axes */}
      <motion.g {...fade(0)} stroke="var(--ink-3)" strokeWidth={0.8} fill="none">
        <path d="M18,122 L190,122" />
        <path d="M18,122 L18,8" />
        <path d="M186,119.5 L190,122 L186,124.5" />
        <path d="M15.5,12 L18,8 L20.5,12" />
      </motion.g>
      <motion.g {...fade(0.05)} style={{ fill: "var(--ink-3)" }} fontSize={6.5}>
        <text x={190} y={132} textAnchor="end">
          temperature →
        </text>
        <text x={12} y={8} textAnchor="end" transform="rotate(-90 12 8)">
          volume →
        </text>
      </motion.g>

      {/* Curves */}
      {path(MAIN, 0.1, DURATION.data * 1.4, { strokeWidth: 1.4 })}
      {path(SUPERCOOLED, 0.1 + DURATION.data * 1.1, DURATION.panel, { strokeWidth: 0.7, strokeDasharray: "2.5 2.5", opacity: 0.7 })}

      {/* Tg marker: drop line to the axis, then the dot */}
      <motion.path
        d={`M${KINK.x},${KINK.y + 6} L${KINK.x},122`}
        stroke="var(--ink-3)"
        strokeWidth={0.8}
        strokeDasharray="2 2"
        initial={animateDraw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.1 + DURATION.data * 1.2, duration: DURATION.small }}
      />
      <motion.circle
        cx={KINK.x}
        cy={KINK.y}
        r={3.2}
        style={{ fill: "var(--heat-4)", stroke: "currentColor" }}
        strokeWidth={1.2}
        initial={animateDraw ? { scale: 0 } : false}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 + DURATION.data * 1.15, duration: DURATION.small, ease: EASE_OUT }}
      />

      {/* Labels */}
      <motion.g {...fade(0.1 + DURATION.data * 1.3)} fontSize={7}>
        <text x={KINK.x} y={131} textAnchor="middle" style={{ fill: "currentColor" }} fontWeight={600}>
          T<tspan fontSize={5} dy={1.5}>g</tspan>
        </text>
        <text x={156} y={48} style={{ fill: "var(--ink-2)" }}>
          liquid
        </text>
        <text x={30} y={86} style={{ fill: "var(--ink-2)" }}>
          glass
        </text>
        <text x={50} y={113} style={{ fill: "var(--ink-3)" }} fontSize={5.5}>
          supercooled liquid
        </text>
      </motion.g>
    </svg>
  );
}
