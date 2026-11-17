"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { EASE_IN, SPRING, T } from "@/lib/motion";

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Small centred alert that asks for a decision. Sits above the drawer.
 * Its keys are handled first (capture phase), so Escape closes only the dialog.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    // Focus the last action (the safe choice comes last).
    const frame = requestAnimationFrame(() => {
      const items = boxRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      items?.[items.length - 1]?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !boxRef.current) return;
      e.stopPropagation();
      const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next].focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      returnTo?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: T.small }}
            exit={{ opacity: 0, transition: T.exit }}
          />
          <motion.div
            ref={boxRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-body"
            className="relative w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-float"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: SPRING }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.16, ease: EASE_IN } }}
          >
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warn-bg text-warn">
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="dialog-title" className="text-base font-semibold">
                  {title}
                </h2>
                <div id="dialog-body" className="mt-1 text-sm text-ink-2">
                  {children}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
