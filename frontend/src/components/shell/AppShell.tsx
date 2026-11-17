"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Crosshair, LogOut, Thermometer, Triangle, UserRound, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DURATION, EASE_IN, SPRING, T } from "@/lib/motion";
import { CoolingCurve } from "@/components/viz/CoolingCurve";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import SeerModule from "@/components/SeerModule";
import BankModule from "@/components/BankModule";
import ZenModule from "@/components/ZenModule";
import ProfileModule from "@/components/ProfileModule";

type ScreenId = "seer" | "bank" | "zen" | "profile";

const SCREENS: { id: ScreenId; name: string; verb: string; icon: LucideIcon }[] = [
  { id: "seer", name: "Seer", verb: "Predict", icon: Thermometer },
  { id: "bank", name: "Bank", verb: "Explore", icon: Triangle },
  { id: "zen", name: "Zen", verb: "Discover", icon: Crosshair },
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
  const [screen, setScreen] = useState<{ id: ScreenId; dir: number }>({ id: "seer", dir: 0 });

  const go = (id: ScreenId) => {
    if (id === screen.id) return;
    setScreen({ id, dir: Math.sign(order(id) - order(screen.id)) });
  };

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
            return (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                aria-current={on ? "page" : undefined}
                title={`${s.name}: ${s.verb}`}
                className={`relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors md:justify-center lg:justify-start ${
                  on ? "text-ink" : "text-ink-2 hover:text-ink"
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
                <span className="relative hidden text-ink-3 lg:inline">{s.verb}</span>
              </button>
            );
          })}
        </nav>

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
