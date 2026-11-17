"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Crosshair,
  LogOut,
  Thermometer,
  Triangle,
  UserRound,
  FolderKanban,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { DURATION, EASE_IN, SPRING, T } from "@/lib/motion";
import { CoolingCurve } from "@/components/viz/CoolingCurve";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ProjectHub } from "@/components/ProjectHub";
import SeerModule from "@/components/SeerModule";
import BankModule from "@/components/BankModule";
import ZenModule from "@/components/ZenModule";
import ProfileModule from "@/components/ProfileModule";

type ScreenId = "projects" | "seer" | "bank" | "zen" | "profile";

const SCREENS: {
  id: ScreenId;
  name: string;
  verb: string;
  icon: LucideIcon;
  requiresProject?: boolean;
}[] = [
  { id: "projects", name: "Projects", verb: "Home", icon: FolderKanban },
  { id: "seer", name: "Seer", verb: "Predict", icon: Thermometer, requiresProject: true },
  { id: "bank", name: "Bank", verb: "Explore", icon: Triangle, requiresProject: true },
  { id: "zen", name: "Zen", verb: "Discover", icon: Crosshair, requiresProject: true },
  { id: "profile", name: "Profile", verb: "Account", icon: UserRound },
];

const order = (id: ScreenId) => SCREENS.findIndex((s) => s.id === id);

// Screens slide in the direction of the nav order (down the list = up from below).
const screenVariants = {
  enter: (dir: number) => ({ opacity: 0, y: dir * 16 }),
  center: { opacity: 1, y: 0, transition: T.panel },
  exit: (dir: number) => ({ opacity: 0, y: dir * -10, transition: { duration: DURATION.press, ease: EASE_IN } }),
};

export function AppShell() {
  const { user, logout } = useAuth();
  const { activeProject } = useProject();
  const [screen, setScreen] = useState<{ id: ScreenId; dir: number }>({
    id: activeProject ? "seer" : "projects",
    dir: 0,
  });

  const go = (id: ScreenId) => {
    // If no project is selected and the target screen requires a project, keep on projects
    const screenDef = SCREENS.find((s) => s.id === id);
    if (screenDef?.requiresProject && !activeProject) {
      if (screen.id !== "projects") {
        setScreen({ id: "projects", dir: 0 });
      }
      return;
    }
    if (id === screen.id) return;
    setScreen({ id, dir: Math.sign(order(id) - order(screen.id)) });
  };

  useEffect(() => {
    const handler = (e: any) => {
      const target = e.detail;
      if (target && ["projects", "seer", "bank", "zen", "profile"].includes(target)) {
        go(target as ScreenId);
      }
    };
    window.addEventListener("navigate-screen", handler);
    return () => window.removeEventListener("navigate-screen", handler);
  }, [screen.id, activeProject]);

  // If active project is cleared while on a protected screen, immediately redirect to projects home
  useEffect(() => {
    if (!activeProject && ["seer", "bank", "zen"].includes(screen.id)) {
      setScreen({ id: "projects", dir: -1 });
    }
  }, [activeProject, screen.id]);

  return (
    <motion.div
      className="flex min-h-dvh flex-col md:h-dvh md:flex-row"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: T.panel }}
      exit={{ opacity: 0, transition: T.exit }}
    >
      {/* Navigation: top bar on phones, icon rail on tablets, full rail on desktop */}
      <aside className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2 md:w-16 md:flex-col md:items-stretch md:gap-6 md:border-r md:border-b-0 md:px-2 md:py-4 lg:w-56 lg:px-3">
        <div className="flex items-center gap-2.5 md:justify-center md:pt-1 lg:justify-start lg:px-2">
          <CoolingCurve variant="mark" className="h-6 w-8 shrink-0 text-ink" />
          <div className="hidden lg:block">
            <div className="text-base leading-tight font-semibold">Glass Studio</div>
            <div className="text-xs text-ink-3">COE-DSAI · TIET Patiala</div>
          </div>
        </div>

        <nav aria-label="Screens" className="flex flex-1 items-center justify-center gap-1 md:flex-none md:flex-col md:items-stretch">
          {SCREENS.map((s) => {
            const on = s.id === screen.id;
            const Icon = s.icon;
            const isLocked = s.requiresProject && !activeProject;

            return (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                aria-current={on ? "page" : undefined}
                title={
                  isLocked
                    ? `${s.name}: Requires active project`
                    : `${s.name}: ${s.verb}`
                }
                className={`relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors md:justify-center lg:justify-start ${
                  on
                    ? "text-ink"
                    : isLocked
                    ? "text-ink-3/60 hover:text-ink-3"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="nav-active"
                    transition={SPRING}
                    className="absolute inset-0 rounded-md border border-line bg-surface"
                  >
                    <span className="absolute top-2 bottom-2 left-0 hidden w-0.5 rounded-full bg-ink md:block" />
                  </motion.span>
                )}
                <Icon className="relative h-4 w-4 shrink-0" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                <span className="relative hidden font-medium lg:inline">{s.name}</span>
                {isLocked ? (
                  <Lock className="relative hidden h-3 w-3 text-ink-3/70 lg:inline ml-auto" />
                ) : (
                  <span className="relative hidden text-ink-3 lg:inline">{s.verb}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Project Pill in Sidebar */}
        <div className="hidden lg:block px-1">
          {activeProject ? (
            <div className="p-2.5 rounded-xl border border-line bg-surface-2/60 text-xs space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-ink-3 uppercase tracking-wide">
                <span>Active Project</span>
                <button
                  type="button"
                  onClick={() => go("projects")}
                  className="text-ink hover:underline font-medium"
                >
                  Switch
                </button>
              </div>
              <div className="font-semibold text-ink truncate text-xs" title={activeProject.name}>
                {activeProject.name}
              </div>
              <div className="text-[10px] text-ink-3">
                {activeProject.predictionCount} prediction{activeProject.predictionCount === 1 ? "" : "s"}
              </div>
            </div>
          ) : (
            <div
              onClick={() => go("projects")}
              className="p-2 rounded-xl border border-warn/30 bg-warn-bg text-warn text-[11px] font-bold flex items-center gap-2 cursor-pointer hover:bg-warn-bg/80 transition-colors"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Select Project</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 md:mt-auto md:flex-col lg:flex-row lg:items-center lg:gap-2 lg:border-t lg:border-line lg:px-1 lg:pt-3">
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="truncate text-sm font-medium">{user?.displayName}</div>
            <div className="truncate text-xs text-ink-3">{user?.email}</div>
          </div>
          <ThemeToggle />
          <button
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </aside>

      <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" custom={screen.dir} initial={false}>
          <motion.div
            key={screen.id}
            custom={screen.dir}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="h-full p-3 sm:p-4 lg:p-5"
          >
            {screen.id === "projects" && (
              <ProjectHub onProceed={() => go("seer")} />
            )}
            {screen.id === "seer" && <SeerModule />}
            {screen.id === "bank" && <BankModule />}
            {screen.id === "zen" && <ZenModule />}
            {screen.id === "profile" && <ProfileModule />}
          </motion.div>
        </AnimatePresence>
      </main>
    </motion.div>
  );
}
