"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle } from "lucide-react";
import type { Position, ProfileDetails, UserProfile } from "@/lib/api";
import { SPRING, T } from "@/lib/motion";

export const POSITIONS: { id: Position; label: string; hint: string }[] = [
  { id: "student", label: "Student", hint: "Studying at a university" },
  { id: "faculty", label: "Faculty", hint: "Teaching or research staff" },
  { id: "industry", label: "Industry", hint: "Working at a company" },
  { id: "other", label: "Other", hint: "Tell us in your own words" },
];

/** "Student · M.Tech" / "Other · Independent researcher" */
export function positionText(p: Pick<UserProfile, "position" | "course" | "positionOther">): string {
  const label = POSITIONS.find((x) => x.id === p.position)?.label ?? "";
  if (p.position === "student" && p.course) return `${label} · ${p.course}`;
  if (p.position === "other" && p.positionOther) return p.positionOther;
  return label;
}

const settle = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { ...T.panel, delay: 0.05 + i * 0.03 } }),
};

export const inputClass =
  "h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none";

type Field = "university" | "position" | "course" | "other";

/**
 * University, position and the follow-up question that applies.
 * Used by the first-sign-in questions and by Profile's edit form.
 */
export function ProfileForm({
  initial,
  onSubmit,
  actions,
  stagger = false,
  idPrefix = "pf",
}: {
  initial?: UserProfile | null;
  /** Throw to show an error under the form. */
  onSubmit: (details: ProfileDetails) => Promise<void>;
  /** Footer: receives whether a save is running. */
  actions: (saving: boolean) => React.ReactNode;
  /** Fields settle in one after another on mount. */
  stagger?: boolean;
  idPrefix?: string;
}) {
  const [university, setUniversity] = useState(initial?.university ?? "");
  const [position, setPosition] = useState<Position | null>(initial?.position ?? null);
  const [course, setCourse] = useState(initial?.course ?? "");
  const [other, setOther] = useState(initial?.positionOther ?? "");
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
      await onSubmit({
        university: university.trim(),
        position,
        course: position === "student" ? course.trim() : undefined,
        position_other: position === "other" ? other.trim() : undefined,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Couldn't save your details. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const clear = (f: Field) => errors[f] && setErrors((e) => ({ ...e, [f]: undefined }));
  const enter = (i: number) => (stagger ? { initial: "hidden", animate: "show", custom: i, variants: settle } : {});
  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {/* University */}
      <motion.div {...enter(1)}>
        <label htmlFor={id("university")} className="mb-1.5 block text-sm font-medium">
          University or organisation
        </label>
        <input
          id={id("university")}
          autoComplete="organization"
          value={university}
          onChange={(e) => {
            setUniversity(e.target.value);
            clear("university");
          }}
          placeholder="e.g. Thapar Institute of Engineering and Technology"
          aria-invalid={!!errors.university}
          aria-describedby={errors.university ? id("university-err") : undefined}
          className={`${inputClass} ${errors.university ? "border-danger" : "border-line"}`}
        />
        <FieldError id={id("university-err")} message={errors.university} />
      </motion.div>

      {/* Position */}
      <motion.fieldset {...enter(2)}>
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
                    layoutId={id("position")}
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

      {/* Follow-up, only when it applies */}
      <AnimatePresence initial={false} mode="popLayout">
        {position === "student" && (
          <FollowUp key="course">
            <label htmlFor={id("course")} className="mb-1.5 block text-sm font-medium">
              Course
            </label>
            <input
              id={id("course")}
              autoFocus={!initial?.course}
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
            <label htmlFor={id("other")} className="mb-1.5 block text-sm font-medium">
              Your position
            </label>
            <input
              id={id("other")}
              autoFocus={!initial?.positionOther}
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
        {actions(saving)}
      </motion.div>
    </form>
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
