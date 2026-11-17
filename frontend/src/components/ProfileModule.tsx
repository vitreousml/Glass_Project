"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Check,
  LogOut,
  Pencil,
  BookmarkCheck,
  Plus,
  Trash2,
  Eye,
  Calendar,
  Clock,
  Layers,
  Play,
  Folder,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import type { ProfileDetails, Project } from "@/lib/api";
import { SPRING, T } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProfileForm, positionText } from "@/components/shell/ProfileForm";
import { ProjectModal } from "@/components/seer/ProjectModal";
import { ProjectDetailsModal } from "@/components/profile/ProjectDetailsModal";
import { DeleteConfirmModal } from "@/components/profile/DeleteConfirmModal";

export default function ProfileModule() {
  const { user, profile, profileStatus, saveProfile, retryProfile, logout } = useAuth();
  const {
    projects,
    activeProject,
    setActiveProject,
    removeProject,
    isLoading: projectsLoading,
  } = useProject();

  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // The "Saved" note fades out on its own.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  if (!user) return null;

  const save = async (details: ProfileDetails) => {
    await saveProfile(details);
    setEditing(false);
    setSaved(true);
  };

  const handleOpenDetails = (p: Project) => {
    setSelectedProject(p);
    setDetailsModalOpen(true);
  };

  const handleSelectAndPredict = (p: Project) => {
    setActiveProject(p);
    window.dispatchEvent(new CustomEvent("navigate-screen", { detail: "seer" }));
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

  const complete = !!profile?.profileComplete;
  const activeProjectsList = projects.filter((p) => p.id === activeProject?.id);
  const otherProjectsList = projects.filter((p) => p.id !== activeProject?.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">User Profile & Projects</h1>
        <p className="text-sm text-ink-2">Your account details, affiliation, and glass formulation projects.</p>
      </header>

      {/* Account Card */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-semibold text-paper"
        >
          {user.displayName.trim()[0]?.toUpperCase() ?? "?"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-ink">{user.displayName}</div>
          <div className="truncate text-sm text-ink-2">{user.email}</div>
          <div className="mt-1 text-xs text-ink-3">
            {user.demo ? "Demo session · nothing is saved to the server" : "Signed in with Google"}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </section>

      {/* Profile Details (Affiliation / Course) */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">Researcher Details</h2>
            <p className="mt-0.5 text-xs text-ink-2">University affiliation and role.</p>
          </div>
          {profileStatus === "ready" && complete && !editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Button>
          )}
        </div>

        <div className="mt-4">
          {profileStatus === "loading" ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading profile">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : profileStatus === "error" ? (
            <div className="flex items-start justify-between gap-3 rounded-md bg-danger-bg p-3 text-sm text-danger">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>Couldn&apos;t load your details.</span>
              </div>
              <button
                type="button"
                onClick={retryProfile}
                className="font-medium underline underline-offset-2 hover:opacity-80"
              >
                Retry
              </button>
            </div>
          ) : editing || !complete ? (
            <ProfileForm
              initial={profile}
              onSubmit={save}
              actions={(saving) => (
                <div className="flex items-center justify-end gap-2 pt-2">
                  {complete && (
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button variant="primary" size="sm" type="submit" disabled={saving}>
                    {saving ? "Saving…" : complete ? "Save changes" : "Save details"}
                  </Button>
                </div>
              )}
            />
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs text-ink-3 font-semibold">University / Organisation</dt>
                <dd className="mt-0.5 font-bold text-ink">{profile.university}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3 font-semibold">Position</dt>
                <dd className="mt-0.5 font-bold text-ink">
                  {positionText(profile)}
                </dd>
              </div>
            </dl>
          )}

          <AnimatePresence>
            {saved && (
              <motion.p
                role="status"
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: T.small }}
                exit={{ opacity: 0, transition: T.exit }}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Profile details saved.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* DEDICATED "MY PROJECTS" SECTION */}
      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-line flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-ink" />
              My Projects
            </h2>
            <p className="text-xs text-ink-2 mt-0.5 font-medium">
              Container-based prediction history. Multiple predictions are saved under each project.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-surface-2 border border-line text-ink">
              {projects.length} Project{projects.length === 1 ? "" : "s"}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </div>
        </div>

        {projectsLoading ? (
          <div className="py-8 text-center text-xs font-bold text-ink-3">
            Loading research projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed border-line p-6 space-y-3">
            <Folder className="w-10 h-10 mx-auto text-ink-3 opacity-40" />
            <div className="text-sm font-bold text-ink">No Projects Created Yet</div>
            <p className="text-xs text-ink-3 max-w-sm mx-auto font-medium">
              Create a project to unlock the prediction workbench. Each project contains multiple predictions.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Project
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Project Highlight */}
            {activeProjectsList.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-ink-3 ml-1">
                  Active Project
                </div>
                {activeProjectsList.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-4 rounded-xl border-2 border-ink bg-surface-2 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-ink truncate">
                          {proj.name}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-ink text-paper shrink-0">
                          CURRENTLY SELECTED
                        </span>
                      </div>
                      {proj.description && (
                        <p className="text-xs text-ink-2 font-medium truncate">
                          {proj.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-3 font-medium pt-1">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          {proj.predictionCount} prediction{proj.predictionCount === 1 ? "" : "s"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Created: {formatDate(proj.createdAt)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Updated: {formatDate(proj.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSelectAndPredict(proj)}
                        className="flex items-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Predict
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDetails(proj)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </Button>
                      <button
                        onClick={() => setProjectToDelete(proj)}
                        className="p-1.5 rounded-lg text-danger hover:bg-danger-bg transition-colors"
                        title="Delete project and all predictions"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Other Projects */}
            {otherProjectsList.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-ink-3 ml-1">
                  Other Projects ({otherProjectsList.length})
                </div>
                {otherProjectsList.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3.5 rounded-xl border border-line bg-surface hover:border-ink/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="text-xs font-bold text-ink block truncate">
                        {proj.name}
                      </span>
                      {proj.description && (
                        <p className="text-[11px] text-ink-3 truncate">{proj.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-ink-3 font-medium pt-0.5">
                        <span>
                          {proj.predictionCount} prediction{proj.predictionCount === 1 ? "" : "s"}
                        </span>
                        <span>•</span>
                        <span>Created: {formatDate(proj.createdAt)}</span>
                        <span>•</span>
                        <span>Updated: {formatDate(proj.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSelectAndPredict(proj)}
                        className="flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        Select & Predict
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDetails(proj)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </Button>
                      <button
                        onClick={() => setProjectToDelete(proj)}
                        className="p-1.5 rounded-lg text-danger hover:bg-danger-bg transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Creation Modal */}
      <ProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* Project Details Modal */}
      <ProjectDetailsModal
        project={selectedProject}
        open={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedProject(null);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        project={projectToDelete}
        open={!!projectToDelete}
        isDeleting={isDeleting}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
