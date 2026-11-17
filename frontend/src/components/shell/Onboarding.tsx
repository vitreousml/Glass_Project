"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Position } from "@/lib/api";
import { SPRING, T } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { CoolingCurve } from "@/components/viz/CoolingCurve";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

const POSITIONS: { id: Position; label: string; hint: string }[] = [
  { id: "student", label: "Student", hint: "Studying at a university" },
  { id: "faculty", label: "Faculty", hint: "Teaching or research staff" },
  { id: "industry", label: "Industry", hint: "Working at a company" },
  { id: "other", label: "Other", hint: "Tell us in your own words" },
];

const settle = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { ...T.panel, delay: 0.05 + i * 0.03 } }),
};

const inputClass =
  "h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none";

type Field = "university" | "position" | "course" | "other";

/** Asked once, after a new account's first sign-in. */
export function Onboarding() {
  const { user, saveProfile, logout } = useAuth();
  const [university, setUniversity] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const [course, setCourse] = useState("");
  const [other, setOther] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Partial<Record<Field, string>> = {};
    if (university.trim().length < 2) e.university = "Enter your university or organisation.";
    if (!position) e.position = "Choose the option that fits you best.";
    if (position === "student" && !course.trim()) e.course = "Enter the course you're studying.";
    if (position === "other" && !other.trim()) e.other = "Describe your position.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate() || !position) return;
    setSaving(true);
    try {
      await saveProfile({
        university: university.trim(),
        position,
        course: position === "student" ? course.trim() : undefined,
        position_other: position === "other" ? other.trim() : undefined,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Couldn't save your details. Try again.");
      setSaving(false);
    }
  };

  const clear = (f: Field) => errors[f] && setErrors((e) => ({ ...e, [f]: undefined }));
  const firstName = user?.displayName.split(" ")[0] ?? "";

  return (
    <motion.main
      className="relative flex min-h-dvh items-center justify-center px-6 py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: T.panel }}
      exit={{ opacity: 0, transition: T.exit }}
    >
      <ThemeToggle className="absolute top-4 right-4" />

      <div className="w-full max-w-md">
        <motion.div initial="hidden" animate="show" custom={0} variants={settle}>
          <CoolingCurve variant="mark" draw={false} className="mb-6 h-7 w-10 text-ink" />
          <h1 className="text-xl font-semibold tracking-tight">A little about you{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-1 text-sm text-ink-2">A few quick questions, asked only once.</p>
          {user?.demo && (
            <p className="mt-2 text-xs text-ink-3">Demo: your answers stay in this browser and aren&apos;t saved.</p>
          )}
        </motion.div>

        <form onSubmit={submit} noValidate className="mt-8 space-y-6">
          {/* 1. University */}
          <motion.div initial="hidden" animate="show" custom={1} variants={settle}>
            <label htmlFor="ob-university" className="mb-1.5 block text-sm font-medium">
              University or organisation
            </label>
            <input
              id="ob-university"
              autoComplete="organization"
              value={university}
              onChange={(e) => {
                setUniversity(e.target.value);
                clear("university");
              }}
              placeholder="e.g. Thapar Institute of Engineering and Technology"
              aria-invalid={!!errors.university}
              aria-describedby={errors.university ? "ob-university-err" : undefined}
              className={`${inputClass} ${errors.university ? "border-danger" : "border-line"}`}
            />
            <FieldError id="ob-university-err" message={errors.university} />
          </motion.div>

          {/* 2. Position */}
          <motion.fieldset initial="hidden" animate="show" custom={2} variants={settle}>
            <legend className="mb-1.5 block text-sm font-medium">Position</legend>
            <div role="radiogroup" aria-label="Position" className="grid grid-cols-2 gap-2">
              {POSITIONS.map((p) => {
                const on = position === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setPosition(p.id);
                      clear("position");
                    }}
                    className={`relative isolate rounded-md border px-3 py-2.5 text-left transition-colors duration-200 ${
                      on ? "border-transparent" : errors.position ? "border-danger" : "border-line hover:border-line-strong"
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId="onboarding-position"
                        transition={SPRING}
                        className="absolute inset-0 -z-10 rounded-md border border-ink bg-surface-2/60"
                      />
                    )}
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{p.hint}</span>
                  </button>
                );
              })}
            </div>
            <FieldError message={errors.position} />
          </motion.fieldset>

          {/* 3. Follow-up, only when it applies */}
          <AnimatePresence initial={false} mode="popLayout">
            {position === "student" && (
              <FollowUp key="course">
                <label htmlFor="ob-course" className="mb-1.5 block text-sm font-medium">
                  Course
                </label>
                <input
                  id="ob-course"
                  autoFocus
                  value={course}
                  onChange={(e) => {
                    setCourse(e.target.value);
                    clear("course");
                  }}
                  placeholder="e.g. M.Tech, Materials Science"
                  aria-invalid={!!errors.course}
                  className={`${inputClass} ${errors.course ? "border-danger" : "border-line"}`}
                />
                <FieldError message={errors.course} />
              </FollowUp>
            )}
            {position === "other" && (
              <FollowUp key="other">
                <label htmlFor="ob-other" className="mb-1.5 block text-sm font-medium">
                  Your position
                </label>
                <input
                  id="ob-other"
                  autoFocus
                  value={other}
                  onChange={(e) => {
                    setOther(e.target.value);
                    clear("other");
                  }}
                  placeholder="e.g. Independent researcher"
                  aria-invalid={!!errors.other}
                  className={`${inputClass} ${errors.other ? "border-danger" : "border-line"}`}
                />
                <FieldError message={errors.other} />
              </FollowUp>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {serverError && (
              <motion.p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: T.small }}
                exit={{ opacity: 0, transition: T.exit }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {serverError}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div layout transition={SPRING} className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={logout}
              className="text-sm text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
            >
              Not you? Sign out
            </button>
            <Button type="submit" variant="primary" size="lg" disabled={saving}>
              {saving ? "Saving…" : "Continue"}
              {!saving && <ArrowRight className="h-4 w-4" aria-hidden />}
            </Button>
          </motion.div>
        </form>
      </div>
    </motion.main>
  );
}

function FollowUp({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout
      className="overflow-hidden"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto", transition: T.small }}
      exit={{ opacity: 0, height: 0, transition: T.exit }}
    >
      {children}
    </motion.div>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          id={id}
          className="mt-1.5 overflow-hidden text-sm text-danger"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto", transition: T.small }}
          exit={{ opacity: 0, height: 0, transition: T.exit }}
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
