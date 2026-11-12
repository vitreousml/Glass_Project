"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  User as UserIcon,
  Shield,
  Sparkles,
  Check,
  Edit2,
  BookmarkCheck,
  Award
} from "lucide-react";

export default function ProfileModule() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "Researcher");
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [projects] = useState([
    { id: 1, name: "Sodium Borosilicate High-Tg Study", updated: "Nov 12, 2026", samples: 14 },
    { id: 2, name: "Energy-Harvesting Substrate Design", updated: "Nov 10, 2026", samples: 8 },
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Banner */}
      <div className="clay-card clay-butter p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-black/30 shadow-sm shrink-0">
            <UserIcon className="w-7 h-7 text-amber-900 dark:text-amber-200" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-amber-100">
              User Profile & Workspace
            </h2>
            <p className="text-xs sm:text-sm opacity-80 mt-1 font-semibold">
              Manage researcher identity, plan tier, and active glass formulation projects.
            </p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="clay-card clay-mint p-4 text-xs font-black flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700" />
          Profile settings updated successfully.
        </div>
      )}

      {/* Main Profile Info in Lavender */}
      <div className="clay-card clay-lavender p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-black/10 dark:border-white/10 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl clay-card clay-butter text-slate-900 flex items-center justify-center text-2xl font-black shrink-0">
              {displayName[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black">{displayName}</h3>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full clay-btn clay-butter text-slate-900">
                  Free Tier
                </span>
              </div>
              <p className="text-xs opacity-75 font-semibold mt-0.5">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl clay-btn text-xs font-black"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {isEditing ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {/* Profile Inputs */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black block mb-1.5 ml-1">
                Display Name
              </label>
              <input
                type="text"
                disabled={!isEditing}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 clay-input text-xs font-black disabled:opacity-70"
              />
            </div>

            <div>
              <label className="text-xs font-black block mb-1.5 ml-1">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ""}
                className="w-full px-4 py-2.5 clay-input text-xs font-black opacity-60 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-black block mb-1.5 ml-1">
                Scientific Role
              </label>
              <input
                type="text"
                disabled
                value="Glass Research Scientist"
                className="w-full px-4 py-2.5 clay-input text-xs font-black opacity-60 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-black block mb-1.5 ml-1">
                Cloud Tier
              </label>
              <input
                type="text"
                disabled
                value="Scale-to-Zero Free Tier"
                className="w-full px-4 py-2.5 clay-input text-xs font-black opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 clay-btn-accent text-xs font-black uppercase tracking-wider rounded-2xl"
              >
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Badges in 3 distinct pastels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="clay-card clay-mint p-5 flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black">Dataset Privacy</div>
            <div className="text-[11px] font-semibold opacity-75 mt-0.5">
              <code>glass_data.csv</code> is restricted server-side.
            </div>
          </div>
        </div>

        <div className="clay-card clay-sky p-5 flex items-start gap-3">
          <Award className="w-5 h-5 text-sky-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black">Verified Units</div>
            <div className="text-[11px] font-semibold opacity-75 mt-0.5">
              $T_g$ in <strong>Kelvin (K)</strong> · <strong>mol %</strong>
            </div>
          </div>
        </div>

        <div className="clay-card clay-peach p-5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black">Models Loaded</div>
            <div className="text-[11px] font-semibold opacity-75 mt-0.5">
              RF, XGBoost, KNN, and SVM active.
            </div>
          </div>
        </div>
      </div>

      {/* Saved Projects in Clay Butter */}
      <div className="clay-card clay-butter p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black flex items-center gap-2">
            <BookmarkCheck className="w-5 h-5 text-amber-900 dark:text-amber-200" />
            Active Glass Projects
          </h3>
          <span className="text-xs font-black opacity-75">{projects.length} Saved</span>
        </div>

        <div className="space-y-3">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="p-4 rounded-2xl clay-card clay-lavender flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-black block">
                  {proj.name}
                </span>
                <span className="text-[10px] font-semibold opacity-75 mt-0.5 block">
                  Updated: {proj.updated} · {proj.samples} tests recorded
                </span>
              </div>
              <span className="text-[10px] font-black px-3 py-1 rounded-xl clay-btn clay-butter text-slate-900">
                Active
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
