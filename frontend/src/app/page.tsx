"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import SeerModule from "@/components/SeerModule";
import BankModule from "@/components/BankModule";
import ZenModule from "@/components/ZenModule";
import ProfileModule from "@/components/ProfileModule";
import {
  Sparkles,
  Database,
  Compass,
  User as UserIcon,
  LogOut,
  Atom,
  Sun,
  Moon,
  FlaskConical,
} from "lucide-react";

export default function Home() {
  const { user, loginWithEmail, loginWithGoogle, loginDevMock, logout, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"seer" | "bank" | "zen" | "profile">("seer");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">
        Loading Glass Platform...
      </div>
    );
  }

  // Not signed in: Pastel Claymorphic Login Portal
  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        {/* Theme Toggle Top Right */}
        <div className="absolute top-6 right-6 z-20">
          <button
            onClick={toggleTheme}
            className="clay-btn px-4 py-2.5 flex items-center gap-2 text-xs font-black shadow-md"
            title="Toggle Light / Dark Mode"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-[#FFEE8C]" />
                <span>Light Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Central Sign-In Clay Card */}
        <div className="w-full max-w-md clay-card p-10 relative">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 rounded-3xl clay-butter mb-4">
              <FlaskConical className="w-9 h-9 text-slate-900" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Glass Studio Platform
            </h1>
            <p className="text-xs opacity-70 mt-1 font-semibold">
              Physics-Informed ML for Glass Transition Temperature ($T_g$)
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (loginEmail) loginWithEmail(loginEmail, loginPassword || "test1234");
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs font-black block mb-1.5 ml-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="researcher@university.edu"
                className="w-full px-4 py-3 clay-input text-sm font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-black block mb-1.5 ml-1">
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 clay-input text-sm font-semibold"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 clay-btn-accent font-black text-xs uppercase tracking-wider rounded-2xl mt-4"
            >
              Sign In with Email
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-300/40 dark:border-slate-800 space-y-3">
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full py-3 px-4 clay-btn clay-butter text-xs font-black flex items-center justify-center gap-2"
            >
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => loginDevMock("demo.scientist@glasslab.edu", "Dr. Eleanor Vance")}
              className="w-full py-2.5 px-3 clay-btn clay-sky text-[11px] font-bold flex items-center justify-center"
            >
              <span>One-Click Demo Access</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen flex flex-col md:flex-row p-4 sm:p-6 gap-6">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-68 clay-card p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Brand header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-300/40 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl clay-butter">
                <Atom className="w-5 h-5 text-slate-900" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-tight">Glass Studio</h2>
                <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                  $T_g$ in K · mol %
                </span>
              </div>
            </div>

            {/* Theme Toggle Pill */}
            <button
              onClick={toggleTheme}
              className="clay-btn p-2 rounded-xl"
              title="Toggle Light/Dark Theme"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4 text-indigo-600" />
              ) : (
                <Sun className="w-4 h-4 text-[#FFEE8C]" />
              )}
            </button>
          </div>

          {/* Navigation Items in Distinct Clay Pastels */}
          <nav className="space-y-3">
            <button
              onClick={() => setActiveTab("seer")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all ${
                activeTab === "seer"
                  ? "clay-btn-accent"
                  : "clay-btn clay-lavender hover:scale-102"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Seer (Predict)</span>
            </button>

            <button
              onClick={() => setActiveTab("bank")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all ${
                activeTab === "bank"
                  ? "clay-btn-accent"
                  : "clay-btn clay-mint hover:scale-102"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Bank (Explore)</span>
            </button>

            <button
              onClick={() => setActiveTab("zen")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all ${
                activeTab === "zen"
                  ? "clay-btn-accent"
                  : "clay-btn clay-sky hover:scale-102"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Zen (Discover)</span>
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all ${
                activeTab === "profile"
                  ? "clay-btn-accent"
                  : "clay-btn clay-peach hover:scale-102"
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>My Profile</span>
            </button>
          </nav>
        </div>

        {/* Footer User Info */}
        <div className="pt-6 border-t border-slate-300/40 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-2xl clay-butter text-slate-900 font-black text-xs flex items-center justify-center shrink-0">
                {user.displayName[0]?.toUpperCase() || "U"}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-black truncate">{user.displayName}</div>
                <div className="text-[10px] opacity-60 truncate font-semibold">{user.email}</div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="clay-btn p-2 hover:text-rose-500 rounded-xl"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "seer" && <SeerModule />}
        {activeTab === "bank" && <BankModule />}
        {activeTab === "zen" && <ZenModule />}
        {activeTab === "profile" && <ProfileModule />}
      </main>
    </div>
  );
}
