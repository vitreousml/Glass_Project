"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, LogOut, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { ProfileDetails } from "@/lib/api";
import { SPRING, T } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProfileForm, positionText } from "@/components/shell/ProfileForm";

export default function ProfileModule() {
  const { user, profile, profileStatus, saveProfile, retryProfile, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // The "Saved" note fades out on its own.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  if (!user) return null;

  const save = async (details: ProfileDetails) => {
    await saveProfile(details); // throws on failure; the form shows the message
    setEditing(false);
    setSaved(true);
  };

  const complete = !!profile?.profileComplete;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="text-sm text-ink-2">Your account, and the details you gave when you first signed in.</p>
      </header>

      {/* Account */}
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-5">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-semibold text-paper"
        >
          {user.displayName.trim()[0]?.toUpperCase() ?? "?"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium">{user.displayName}</div>
          <div className="truncate text-sm text-ink-2">{user.email}</div>
          <div className="mt-1 text-xs text-ink-3">
            {user.demo ? "Demo session · nothing is saved to the server" : "Signed in with Google"}
          </div>
        </div>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </section>

      {/* About you */}
      <motion.section layout transition={SPRING} className="overflow-hidden rounded-lg border border-line bg-surface p-5">
        <motion.div layout="position" className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">About you</h2>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saved && (
                <motion.span
                  role="status"
                  className="flex items-center gap-1 text-sm text-ink-2"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0, transition: T.small }}
                  exit={{ opacity: 0, transition: T.exit }}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Saved
                </motion.span>
              )}
            </AnimatePresence>
            {!editing && profileStatus === "ready" && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {complete ? "Edit" : "Add details"}
              </Button>
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.div
              key="edit"
              className="mt-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: T.small }}
              exit={{ opacity: 0, transition: T.exit }}
            >
              <ProfileForm
                initial={profile}
                idPrefix="pr"
                onSubmit={save}
                actions={(saving) => (
                  <>
                    <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </>
                )}
              />
            </motion.div>
          ) : profileStatus === "loading" || profileStatus === "idle" ? (
            <motion.div key="loading" className="mt-4 space-y-3" exit={{ opacity: 0, transition: T.exit }}>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </motion.div>
          ) : profileStatus === "error" ? (
            <motion.div
              key="error"
              role="alert"
              className="mt-4 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: T.small }}
              exit={{ opacity: 0, transition: T.exit }}
            >
              <p className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Couldn&apos;t load your details from the server.
              </p>
              <Button variant="secondary" size="sm" onClick={retryProfile}>
                Try again
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="view"
              className="mt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: T.small }}
              exit={{ opacity: 0, transition: T.exit }}
            >
              <dl className="divide-y divide-line">
                <Row label="University or organisation" value={profile?.university} />
                <Row label="Position" value={complete && profile ? positionText(profile) : undefined} />
              </dl>
              {user.demo && <p className="pt-3 text-xs text-ink-3">Demo: these answers stay in this browser.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className={`text-sm ${value ? "text-ink" : "text-ink-3"}`}>{value || "Not set"}</dd>
    </div>
  );
}
