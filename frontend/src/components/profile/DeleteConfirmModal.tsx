"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Project } from "@/lib/api";

interface DeleteConfirmModalProps {
  project: Project | null;
  open: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  project,
  open,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!open || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-lg bg-surface border border-line shadow-xl overflow-hidden p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-danger-bg text-danger">
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Delete project</h3>
              <p className="text-xs text-ink-3">Permanent action · cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="rounded-md border border-danger/20 bg-danger-bg/40 p-3.5 text-xs text-ink space-y-1.5">
          <p className="font-semibold text-danger">
            Delete &quot;{project.name}&quot;?
          </p>
          <p className="text-ink-2">
            This will permanently remove the project and all <span className="font-semibold num">{project.predictionCount}</span> recorded prediction{project.predictionCount === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="!bg-danger !text-paper hover:!bg-danger/90"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden />
            {isDeleting ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      </div>
    </div>
  );
}
