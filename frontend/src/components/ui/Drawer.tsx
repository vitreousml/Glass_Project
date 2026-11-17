"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DURATION, EASE_IN, T } from "@/lib/motion";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Panel that slides in from the right over a light scrim (the page stays visible behind it).
 * Moves focus in on open, keeps Tab inside, closes on Escape, returns focus on close.
 */
export function Drawer({
  open,
  onClose,
  label,
  className = "sm:w-[500px]",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panelRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            aria-hidden
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: T.small }}
            exit={{ opacity: 0, transition: T.exit }}
          />
          <motion.aside
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className={`fixed inset-y-0 right-0 z-50 w-full p-0 outline-none sm:p-3 ${className}`}
            initial={{ x: "100%" }}
            animate={{ x: 0, transition: T.panel }}
            exit={{ x: "100%", transition: { duration: DURATION.small, ease: EASE_IN } }}
          >
            <div className="flex h-full flex-col overflow-hidden border-line bg-surface shadow-float sm:rounded-lg sm:border">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
