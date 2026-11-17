"use client";

import React, { useState } from "react";
import { FolderPlus, Folder, X, AlertCircle, Plus, Calendar, Layers } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/Button";

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSelectProject?: (projectId: string) => void;
}

export function ProjectModal({ open, onClose, onSelectProject }: ProjectModalProps) {
  const { projects, activeProject, setActiveProject, createNewProject } = useProject();
  const [tab, setTab] = useState<"select" | "create">("select");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!open) return null;

  const handleSelect = (p: (typeof projects)[0]) => {
    setActiveProject(p);
    if (onSelectProject) onSelectProject(p.id);
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Project name is required.");
      return;
    }

    const exists = projects.some(
      (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setFormError(`A project named "${trimmed}" already exists. Please choose a unique name.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createNewProject(trimmed, description.trim());
      setName("");
      setDescription("");
      if (onSelectProject) onSelectProject(created.id);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-lg bg-surface border border-line shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-surface-2/40">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink">
              <Folder className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Select research project</h3>
              <p className="text-xs text-ink-3">Choose a container or create a new one.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-line px-5 pt-2 gap-4 bg-surface-2/20">
          <button
            type="button"
            onClick={() => setTab("select")}
            className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
              tab === "select"
                ? "border-ink text-ink font-semibold"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            Choose existing ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "create"
                ? "border-ink text-ink font-semibold"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Create new
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {tab === "select" ? (
            projects.length === 0 ? (
              <div className="text-center py-8 space-y-2.5">
                <FolderPlus className="h-8 w-8 mx-auto text-ink-3 opacity-50" aria-hidden />
                <div className="text-sm font-medium text-ink">No projects yet</div>
                <p className="text-xs text-ink-3 max-w-xs mx-auto">
                  Create a project to store and track your composition predictions.
                </p>
                <Button variant="primary" size="sm" onClick={() => setTab("create")}>
                  Create first project
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => {
                  const isCurrent = activeProject?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className={`group p-3.5 rounded-md border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? "border-ink bg-surface-2 ring-1 ring-ink"
                          : "border-line bg-surface hover:border-line-strong hover:bg-surface-2/50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-ink truncate">{p.name}</span>
                          {isCurrent && (
                            <span className="rounded-sm bg-ink px-1.5 py-0.2 text-[10px] font-semibold text-paper shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-ink-3 truncate mt-0.5">{p.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-ink-3 mt-1 font-mono num">
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" aria-hidden />
                            {p.predictionCount}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" aria-hidden />
                            {formatDate(p.updatedAt || p.createdAt)}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant={isCurrent ? "secondary" : "primary"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(p);
                        }}
                      >
                        {isCurrent ? "Selected" : "Select"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-md bg-danger-bg text-danger text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Project name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sodium Borosilicate High-Tg Study"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Description / notes (optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Composition notes, applications, literature references..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface p-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    if (projects.length > 0) setTab("select");
                    else onClose();
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create & select"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
