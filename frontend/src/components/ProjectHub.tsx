"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FolderPlus,
  Folder,
  Layers,
  Calendar,
  Clock,
  ArrowRight,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  Lock,
  Eye,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/Button";
import { Project } from "@/lib/api";
import { DeleteConfirmModal } from "@/components/profile/DeleteConfirmModal";
import { ProjectDetailsModal } from "@/components/profile/ProjectDetailsModal";
import { T, SPRING } from "@/lib/motion";

export function ProjectHub({ onProceed }: { onProceed?: () => void }) {
  const {
    projects,
    activeProject,
    setActiveProject,
    createNewProject,
    removeProject,
    isLoading,
  } = useProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion modal
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Details modal
  const [projectForDetails, setProjectForDetails] = useState<Project | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Enter a project name.");
      return;
    }

    const exists = projects.some(
      (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setFormError(`A project named "${trimmed}" already exists. Project names must be unique.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createNewProject(trimmed, description.trim());
      setName("");
      setDescription("");
      setActiveProject(created);
      if (onProceed) onProceed();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelect = (p: Project) => {
    setActiveProject(p);
    if (onProceed) onProceed();
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await removeProject(projectToDelete.id);
      setProjectToDelete(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setIsDeleting(false);
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
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-1">
        <div>
          <h1 className="text-lg font-semibold text-ink">Projects</h1>
          <p className="text-sm text-ink-2">
            Every glass prediction is organized into a project. Create or select a project to proceed to the prediction tools.
          </p>
        </div>

        {activeProject && (
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-xs">
            <span className="text-ink-3">Active:</span>
            <span className="font-semibold text-ink truncate max-w-[220px]">{activeProject.name}</span>
            <Button variant="primary" size="sm" onClick={() => onProceed && onProceed()} className="ml-2">
              Enter Seer
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        )}
      </header>

      {/* Main Grid: Create form on left, existing projects on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Create Project Card */}
        <section className="lg:col-span-5 rounded-lg border border-line bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-line">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink">
              <FolderPlus className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">Create project</h2>
              <p className="text-xs text-ink-3">New container for your glass compositions.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {formError && (
              <motion.div
                role="alert"
                className="flex items-start gap-2 rounded-md bg-danger-bg p-3 text-xs text-danger"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: T.small }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{formError}</span>
              </motion.div>
            )}

            <div>
              <label htmlFor="proj-name" className="block text-xs font-medium text-ink mb-1.5">
                Project name <span className="text-danger">*</span>
              </label>
              <input
                id="proj-name"
                type="text"
                required
                placeholder="e.g. Sodium Borosilicate High-Tg Study"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none"
              />
              <span className="mt-1 block text-xs text-ink-3">
                Must be unique across your research projects.
              </span>
            </div>

            <div>
              <label htmlFor="proj-desc" className="block text-xs font-medium text-ink mb-1.5">
                Description / notes (optional)
              </label>
              <textarea
                id="proj-desc"
                rows={3}
                placeholder="Composition boundaries, research notes, target applications..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-line bg-surface p-3 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:outline-none resize-none"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden />
              {isSubmitting ? "Creating…" : "Create and enter project"}
            </Button>
          </form>
        </section>

        {/* Right Column: Existing Projects List */}
        <section className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Folder className="h-4 w-4 text-ink-2" aria-hidden />
              Existing projects ({projects.length})
            </h2>
            <span className="text-xs text-ink-3">
              Select one to unlock the workspace
            </span>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-line bg-surface p-8 text-center text-xs text-ink-3" aria-busy="true">
              Loading projects…
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-surface/50 p-8 text-center space-y-2">
              <Folder className="h-8 w-8 mx-auto text-ink-3 opacity-40" aria-hidden />
              <div className="text-sm font-medium text-ink">No projects yet</div>
              <p className="text-xs text-ink-3 max-w-sm mx-auto">
                Create your first project on the left to begin predicting glass properties.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {projects.map((p) => {
                const isSelected = activeProject?.id === p.id;
                return (
                  <motion.div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    whileHover={{ scale: 1.005 }}
                    transition={SPRING}
                    className={`group rounded-lg border p-4 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? "border-ink bg-surface-2 ring-1 ring-ink"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-2/40"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ink truncate">
                          {p.name}
                        </span>
                        {isSelected && (
                          <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-paper shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-ink-2 line-clamp-1">
                          {p.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3 pt-0.5">
                        <span className="flex items-center gap-1 num">
                          <Layers className="h-3.5 w-3.5" aria-hidden />
                          {p.predictionCount} prediction{p.predictionCount === 1 ? "" : "s"}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" aria-hidden />
                          {formatDate(p.createdAt)}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {formatDate(p.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectForDetails(p);
                        }}
                        title="View project prediction details"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" aria-hidden />
                        Details
                      </Button>
                      <Button
                        variant={isSelected ? "secondary" : "primary"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(p);
                        }}
                      >
                        {isSelected ? "Continue" : "Select"}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(p);
                        }}
                        aria-label={`Delete project ${p.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-danger hover:bg-danger-bg transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        project={projectToDelete}
        open={!!projectToDelete}
        isDeleting={isDeleting}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Project Details Modal */}
      <ProjectDetailsModal
        project={projectForDetails}
        open={!!projectForDetails}
        onClose={() => setProjectForDetails(null)}
      />
    </div>
  );
}
