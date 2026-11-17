"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { AppShell } from "@/components/shell/AppShell";
import { SignIn } from "@/components/shell/SignIn";
import { Welcome } from "@/components/shell/Welcome";
import { Onboarding } from "@/components/shell/Onboarding";
import { CoolingCurve } from "@/components/viz/CoolingCurve";

type View = "loading" | "signin" | "welcome" | "onboarding" | "profile-error" | "app";

export default function Home() {
  const { user, isLoading, profile, profileStatus, justSignedIn, ackWelcome, retryProfile } = useAuth();
  const [skipProfile, setSkipProfile] = useState(false);

  // Sign in → welcome (right after signing in) → questions (new accounts) → the app.
  let view: View;
  if (isLoading) view = "loading";
  else if (!user) view = "signin";
  else if (justSignedIn) view = "welcome";
  else if (profileStatus === "idle" || profileStatus === "loading") view = "loading";
  else if (profileStatus === "error" && !skipProfile) view = "profile-error";
  else if (profile && !profile.profileComplete) view = "onboarding";
  else view = "app";

  return (
    // "user": people who ask their OS for reduced motion get fades instead of movement.
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {view === "loading" && (
          <motion.div
            key="loading"
            className="flex min-h-dvh items-center justify-center"
            exit={{ opacity: 0, transition: T.exit }}
            role="status"
            aria-label="Loading"
          >
            <CoolingCurve variant="mark" loop className="h-10 w-14 text-ink" />
          </motion.div>
        )}
        {view === "signin" && <SignIn key="signin" />}
        {view === "welcome" && user && (
          <Welcome
            key="welcome"
            firstName={user.displayName.split(" ")[0]}
            returning={!!profile?.profileComplete}
            onDone={ackWelcome}
          />
        )}
        {view === "onboarding" && <Onboarding key="onboarding" />}
        {view === "profile-error" && (
          <motion.div
            key="profile-error"
            className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: T.small }}
            exit={{ opacity: 0, transition: T.exit }}
          >
            <p className="max-w-sm text-sm text-ink-2">
              Couldn&apos;t reach the Glass Studio server to load your account. Check that it&apos;s running, then try
              again.
            </p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={retryProfile}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => setSkipProfile(true)}>
                Continue anyway
              </Button>
            </div>
          </motion.div>
        )}
        {view === "app" && <AppShell key="app" />}
      </AnimatePresence>
    </MotionConfig>
  );
}
