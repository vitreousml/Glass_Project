"use client";

import React, { useEffect, useState } from "react";
import {
  Folder,
  Calendar,
  Layers,
  X,
  Clock,
  AlertCircle,
  Play,
} from "lucide-react";
import { Project, PredictionRecord } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/Button";
import { formula } from "@/lib/chem";
import { fixed, kToC } from "@/lib/units";
import { Tg } from "@/components/ui/Tg";

interface ProjectDetailsModalProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}

export function ProjectDetailsModal({ project, open, onClose }: ProjectDetailsModalProps) {
  const { loadProjectDetails, setActiveProject, activeProject } = useProject();
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !project) return;
    setLoading(true);
    setError(null);
    loadProjectDetails(project.id)
      .then((data) => {
        setPredictions(data.predictions || []);
      })
      .catch((err) => {
        setError(err?.message || "Failed to load project details");
      })
      .finally(() => setLoading(false));
  }, [open, project, loadProjectDetails]);

  if (!open || !project) return null;

  const isCurrentActive = activeProject?.id === project.id;

  const handleContinuePredicting = () => {
    setActiveProject(project);
    onClose();
    window.dispatchEvent(new CustomEvent("navigate-screen", { detail: "seer" }));
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-lg bg-surface border border-line shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4 bg-surface-2/40">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink mt-0.5">
              <Folder className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-ink truncate">{project.name}</h3>
                {isCurrentActive && (
                  <span className="rounded-sm bg-ink px-1.5 py-0.2 text-[10px] font-semibold text-paper shrink-0">
                    Active
                  </span>
                )}
              </div>
              {project.description && (
                <p className="text-xs text-ink-3 mt-0.5">{project.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3 mt-1.5 num">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" aria-hidden />
                  {formatDate(project.createdAt)}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" aria-hidden />
                  {predictions.length} prediction{predictions.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors ml-2 shrink-0"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Prediction list body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-semibold text-ink">
              Recorded predictions ({predictions.length})
            </h4>
            <Button variant="primary" size="sm" onClick={handleContinuePredicting}>
              <Play className="h-3.5 w-3.5 mr-1" aria-hidden />
              Predict in project
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-ink-3" aria-busy="true">
              Loading predictions…
            </div>
          ) : error ? (
            <div className="p-3 rounded-md bg-danger-bg text-danger text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : predictions.length === 0 ? (
            <div className="text-center py-10 rounded-md border border-dashed border-line p-6 space-y-2">
              <div className="text-sm font-medium text-ink">No predictions recorded yet</div>
              <p className="text-xs text-ink-3 max-w-sm mx-auto">
                Run predictions in Seer to record glass composition and <Tg /> data under this project.
              </p>
              <Button variant="primary" size="sm" onClick={handleContinuePredicting}>
                Start predicting
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {predictions.map((p, idx) => {
                const tgRes = p.results?.find((r) => r.property === "Tg");
                const tgKelvin = tgRes?.value;
                const tgCelsius = tgKelvin ? kToC(tgKelvin) : null;

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-md border border-line bg-surface hover:border-line-strong transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">
                          Run #{predictions.length - idx}
                        </span>
                        <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                          {p.selectedModel}
                        </span>
                        <span className="text-ink-3 text-[11px]">
                          {p.compositionBasis} %
                        </span>
                      </div>
                      <span className="text-xs text-ink-3 num">
                        {formatDate(p.createdAt)}
                      </span>
                    </div>

                    {/* Composition */}
                    <div className="text-xs font-mono num text-ink-2">
                      {Object.entries(p.composition || {})
                        .map(([ox, v]) => `${formula(ox)} ${fixed(v)}%`)
                        .join(" · ")}
                    </div>

                    {/* Results */}
                    <div className="flex items-center justify-between pt-1 border-t border-line text-xs">
                      <div className="flex items-baseline gap-2">
                        <span className="text-ink-3">Predicted <Tg />:</span>
                        {tgCelsius !== null ? (
                          <span className="font-semibold text-ink num">
                            {fixed(tgCelsius)} °C{" "}
                            <span className="text-ink-3 font-normal">({fixed(tgKelvin!)} K)</span>
                          </span>
                        ) : (
                          <span className="text-ink-3">Multiple models</span>
                        )}
                      </div>

                      {p.results && p.results.length > 1 && (
                        <span className="text-xs text-ink-3">
                          {p.results.length} models
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-5 py-3 bg-surface-2/30">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" size="sm" onClick={handleContinuePredicting}>
            <Play className="h-3.5 w-3.5 mr-1" aria-hidden />
            Continue predicting
          </Button>
        </div>
      </div>
    </div>
  );
}
