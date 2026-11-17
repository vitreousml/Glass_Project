"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { PERIODIC_ELEMENTS } from "@/data/elements";
import { formula } from "@/lib/chem";
import { EASE_OUT, SPRING, T } from "@/lib/motion";
import { Button } from "@/components/ui/Button";

const OXIDE_OF = Object.fromEntries(PERIODIC_ELEMENTS.map((e) => [e.symbol, e.oxide ?? ""]));

// Continue "wakes up" once, the moment it becomes available.
const wake = {
  asleep: { scale: 1 },
  awake: { scale: [1, 1.06, 1], transition: { duration: 0.42, ease: EASE_OUT } },
};

export function SelectionBar({
  selected,
  onRemove,
  onClear,
  onContinue,
}: {
  selected: string[];
  onRemove: (symbol: string) => void;
  onClear: () => void;
  onContinue: () => void;
}) {
  const ready = selected.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
      <div className="flex min-h-9 flex-1 flex-wrap items-center gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {!ready ? (
            <motion.span
              key="hint"
              className="text-sm text-ink-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: T.small }}
              exit={{ opacity: 0, transition: T.exit }}
            >
              Select the elements in your glass. The models know <strong className="font-semibold text-ink">Si</strong>,{" "}
              <strong className="font-semibold text-ink">B</strong> and <strong className="font-semibold text-ink">Na</strong>.
            </motion.span>
          ) : (
            selected.map((sym) => (
              <motion.span
                key={sym}
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6, transition: T.exit }}
                transition={SPRING}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface pr-1 pl-2.5 text-sm"
              >
                <span className="font-semibold">{sym}</span>
                <span className="text-ink-3" aria-hidden>
                  →
                </span>
                <span>{formula(OXIDE_OF[sym])}</span>
                <button
                  type="button"
                  onClick={() => onRemove(sym)}
                  aria-label={`Remove ${sym}`}
                  className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </motion.span>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <AnimatePresence initial={false}>
          {ready && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.small}>
              <Button variant="ghost" size="sm" onClick={onClear}>
                Clear
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="primary"
          onClick={onContinue}
          disabled={!ready}
          variants={wake}
          initial={false}
          animate={ready ? "awake" : "asleep"}
        >
          Continue
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
