"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/motion";
import { AppShell } from "@/components/shell/AppShell";
import { SignIn } from "@/components/shell/SignIn";
import { CoolingCurve } from "@/components/viz/CoolingCurve";

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    // "user": people who ask their OS for reduced motion get fades instead of movement.
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            className="flex min-h-dvh items-center justify-center"
            exit={{ opacity: 0, transition: T.exit }}
            role="status"
            aria-label="Loading"
          >
            <CoolingCurve variant="mark" loop className="h-10 w-14 text-ink" />
          </motion.div>
        ) : user ? (
          <AppShell key="app" />
        ) : (
          <SignIn key="signin" />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
