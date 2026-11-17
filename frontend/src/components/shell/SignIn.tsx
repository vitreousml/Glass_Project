"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DURATION, EASE_OUT, T } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { GoogleLogo } from "@/components/ui/GoogleLogo";
import { Tg } from "@/components/ui/Tg";
import { CoolingCurve } from "@/components/viz/CoolingCurve";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

// Rows settle in once, one after another.
const settle = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { ...T.panel, delay: 0.15 + i * 0.03 } }),
};

export function SignIn() {
  const { loginWithGoogle, loginDemo, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [boxRef, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();

  // A failed attempt nudges the buttons sideways, once per attempt.
  useEffect(() => {
    if (!authError || reduce || !boxRef.current) return;
    animate(boxRef.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.36, ease: EASE_OUT });
  }, [authError, attempt, reduce, animate, boxRef]);

  const google = async () => {
    setBusy(true);
    await loginWithGoogle();
    setBusy(false);
    setAttempt((n) => n + 1);
  };

  return (
    <motion.main
      className="relative grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: T.small }}
      exit={{ opacity: 0, transition: { duration: DURATION.small } }}
    >
      <ThemeToggle className="absolute top-4 right-4 z-10" />

      {/* The glass transition, drawn */}
      <section className="hidden flex-col justify-between border-r border-line bg-surface-2/50 p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <CoolingCurve variant="mark" className="h-6 w-8 text-ink" />
          <span className="text-base font-semibold">Glass Studio</span>
        </div>
        <figure className="mx-auto w-full max-w-xl">
          <CoolingCurve className="w-full text-ink" />
          <motion.figcaption
            className="mt-6 max-w-md text-sm text-ink-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: DURATION.panel }}
          >
            Cool a melt and its volume follows the liquid line until the structure freezes. The bend is the glass
            transition temperature, <Tg />.
          </motion.figcaption>
        </figure>
        <p className="text-xs text-ink-3">
          Physics-informed machine learning for novel glass compositions · DSAI2025-EE-1018 · COE-DSAI, TIET Patiala
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <CoolingCurve className="mb-8 w-full max-w-xs text-ink lg:hidden" />

          <motion.div initial="hidden" animate="show" custom={0} variants={settle}>
            <h1 className="text-xl font-semibold tracking-tight">Sign in to Glass Studio</h1>
            <p className="mt-1 text-sm text-ink-2">
              Predict <Tg /> for sodium borosilicate glasses from their composition.
            </p>
          </motion.div>

          <div ref={boxRef} className="mt-8 space-y-3">
            <motion.div initial="hidden" animate="show" custom={1} variants={settle}>
              {/* Follows Google's sign-in button style: neutral surface, the G mark, plain label */}
              <motion.button
                type="button"
                onClick={google}
                disabled={busy}
                whileTap={busy ? undefined : { scale: 0.98 }}
                transition={T.press}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#747775] bg-white px-4 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f7f8f8] disabled:cursor-wait disabled:opacity-60 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]"
              >
                <GoogleLogo />
                {busy ? "Waiting for Google…" : "Continue with Google"}
              </motion.button>
            </motion.div>

            <AnimatePresence initial={false}>
              {authError && (
                <motion.p
                  role="alert"
                  className="flex items-start gap-2 overflow-hidden text-sm text-danger"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto", transition: T.small }}
                  exit={{ opacity: 0, height: 0, transition: T.exit }}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {authError}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div initial="hidden" animate="show" custom={2} variants={settle}>
              <div className="flex items-center gap-3 py-2 text-xs text-ink-3">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button type="button" variant="secondary" className="w-full" onClick={loginDemo}>
                Try the demo
              </Button>
              <p className="mt-2 text-center text-xs text-ink-3">The demo doesn&apos;t save anything.</p>
            </motion.div>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
