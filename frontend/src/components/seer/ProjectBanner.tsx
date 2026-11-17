"use client";

import React, { useState } from "react";
import { FolderCheck, AlertTriangle } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { ProjectModal } from "./ProjectModal";
import { Button } from "@/components/ui/Button";

export function ProjectBanner({ className = "" }: { className?: string }) {
  const { activeProject } = useProject();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-md border transition-colors ${
          activeProject
            ? "border-line bg-surface text-ink"
            : "border-warn/40 bg-warn-bg text-ink"
        } ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md border shrink-0 ${
              activeProject
                ? "border-line bg-surface-2 text-ink"
                : "border-warn/30 bg-warn/10 text-warn"
            }`}
          >
            {activeProject ? (
              <FolderCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
          </span>
          <div className="min-w-0 text-xs">
            {activeProject ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-ink-3">Project:</span>
                <span className="font-semibold text-ink truncate max-w-xs sm:max-w-md">
                  {activeProject.name}
                </span>
                <span className="rounded-sm bg-surface-2 px-1.5 py-0.2 text-[11px] font-mono num text-ink-3 shrink-0">
                  {activeProject.predictionCount} saved
                </span>
              </div>
            ) : (
              <div>
                <span className="font-semibold text-warn">Project required:</span>{" "}
                <span className="text-ink-2">Select or create a project before predicting.</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={activeProject ? "secondary" : "primary"}
            size="sm"
            onClick={() => setModalOpen(true)}
          >
            {activeProject ? "Switch" : "Select project"}
          </Button>
        </div>
      </div>

      <ProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
