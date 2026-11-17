"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DURATION, EASE_OUT, T } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Tg } from "@/components/ui/Tg";
import { CoolingCurve } from "@/components/viz/CoolingCurve";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

// Form rows settle in once, one after another.
const settle = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { ...T.panel, delay: 0.15 + i * 0.03 } }),
};

const inputClass =
  "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none";

export function SignIn() {
  const { loginWithEmail, loginWithGoogle, loginDevMock, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Bumped after every attempt so a repeated failure shakes the form again.
  const [attempt, setAttempt] = useState(0);
  const [formRef, animate] = useAnimate<HTMLFormElement>();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!authError || reduce || !formRef.current) return;
    animate(formRef.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.36, ease: EASE_OUT });
  }, [authError, attempt, reduce, animate, formRef]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    await loginWithEmail(email, password || "test1234");
    setBusy(false);
    setAttempt((n) => n + 1);
  };

  return (
    <motion.main
      className="relative grid min-h-dvh lg:grid-cols-[1.15fr_1fr]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: T.small }}
      exit={{ opacity: 0, scale: 0.985, transition: { duration: DURATION.small } }}
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

      {/* Sign-in form */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <CoolingCurve className="mb-8 w-full max-w-xs text-ink lg:hidden" />

          <motion.div initial="hidden" animate="show" custom={0} variants={settle}>
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-ink-2">
              Predict <Tg /> for sodium borosilicate glasses from their composition.
            </p>
          </motion.div>

          <form ref={formRef} onSubmit={submit} className="mt-8 space-y-4">
            <motion.label className="block" initial="hidden" animate="show" custom={1} variants={settle}>
              <span className="mb-1.5 block text-sm font-medium">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (authError) clearAuthError();
                }}
                placeholder="you@university.edu"
                aria-invalid={!!authError}
                className={`${inputClass} ${authError ? "border-danger" : ""}`}
              />
            </motion.label>
            <motion.label className="block" initial="hidden" animate="show" custom={2} variants={settle}>
              <span className="mb-1.5 block text-sm font-medium">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) clearAuthError();
                }}
                aria-invalid={!!authError}
                className={`${inputClass} ${authError ? "border-danger" : ""}`}
              />
            </motion.label>

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

            <motion.div initial="hidden" animate="show" custom={3} variants={settle}>
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </motion.div>
          </form>

          <motion.div className="mt-6 space-y-2" initial="hidden" animate="show" custom={4} variants={settle}>
            <div className="flex items-center gap-3 py-2 text-xs text-ink-3">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <Button type="button" variant="secondary" className="w-full" onClick={loginWithGoogle}>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => loginDevMock("demo.scientist@glasslab.edu", "Demo researcher")}
            >
              Try the demo (nothing is saved)
            </Button>
          </motion.div>
        </div>
      </section>
    </motion.main>
  );
}
