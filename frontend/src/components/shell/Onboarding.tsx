"use client";

import React from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { CoolingCurve } from "@/components/viz/CoolingCurve";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ProfileForm } from "@/components/shell/ProfileForm";

/** Asked once, after a new account's first sign-in. */
export function Onboarding() {
  const { user, saveProfile, logout } = useAuth();
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { ...T.panel, delay: 0.05 } }}
          className="mb-8"
        >
          <CoolingCurve variant="mark" draw={false} className="mb-6 h-7 w-10 text-ink" />
          <h1 className="text-xl font-semibold tracking-tight">A little about you{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-1 text-sm text-ink-2">A few quick questions, asked only once.</p>
          {user?.demo && (
            <p className="mt-2 text-xs text-ink-3">Demo: your answers stay in this browser and aren&apos;t saved.</p>
          )}
        </motion.div>

        <ProfileForm
          stagger
          idPrefix="ob"
          onSubmit={saveProfile}
          actions={(saving) => (
            <>
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
            </>
          )}
        />
      </div>
    </motion.main>
  );
}
