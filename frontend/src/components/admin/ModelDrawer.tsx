"use client";

import React, { useState } from "react";
import { ArchiveRestore, Power, Star, X } from "lucide-react";
import {
  adminArchive,
  adminDiscard,
  adminEditModel,
  adminPublish,
  adminSetDefault,
  type AdminOverview,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fixed } from "@/lib/units";
import { formula } from "@/lib/chem";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { CheckList, Facts, OxideChips, StatusBadge, errorText, inputClass, textareaClass, when } from "@/components/admin/parts";

export function ModelDrawer({
  modelId,
  overview,
  onSelect,
  onClose,
  onChanged,
}: {
  modelId: string | null;
  overview: AdminOverview | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const model = overview?.models.find((m) => m.id === modelId) ?? null;
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState<string | null>(null);

  // Reset the edit box when another model (or a saved name) is shown.
  const formKey = model ? `${model.id}|${model.name}|${model.description ?? ""}` : "";
  const [formFor, setFormFor] = useState("");
  if (model && formFor !== formKey) {
    setFormFor(formKey);
    setForm({ name: model.name, description: model.description ?? "" });
    setError(null);
  }

  const versions = model
    ? (overview?.models ?? []).filter((m) => m.family === model.family).sort((a, b) => b.version - a.version)
    : [];
  const property = overview?.properties.find((p) => p.id === model?.property);
  const isDefault = !!model && model.status === "live" && property?.default_family === model.family;
  const dirty = !!model && (form.name.trim() !== model.name || form.description.trim() !== (model.description ?? ""));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const switchOff = async (confirm: boolean) => {
    if (!model) return;
    setBusy(true);
    setError(null);
    try {
      await adminArchive(model.id, confirm, token);
      setConfirmOff(null);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't switch it off.";
      // The last live model for a property needs an explicit yes.
      if (!confirm && msg.includes("last live model")) setConfirmOff(msg);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Drawer open={!!model} onClose={onClose} label="Model details" className="sm:w-[560px]">
        {model && (
          <>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{model.name}</h2>
                  <StatusBadge status={model.status} />
                  {isDefault && (
                    <span className="inline-flex h-5 items-center gap-1 rounded-sm bg-heat-4/40 px-1.5 text-[11px] font-semibold text-ink">
                      <Star className="h-3 w-3" aria-hidden /> Default
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink-3">
                  {model.code} · version {model.version} · predicts {property?.name ?? model.property}
                  {model.builtin ? " · one of the original four" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {model.status === "live" && (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => switchOff(false)}>
                    <Power className="h-3.5 w-3.5" aria-hidden /> Switch off
                  </Button>
                )}
                {model.status === "live" && !isDefault && (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => adminSetDefault(model.id, token))}>
                    <Star className="h-3.5 w-3.5" aria-hidden /> Make default
                  </Button>
                )}
                {model.status === "archived" && (
                  <Button variant="primary" size="sm" disabled={busy} onClick={() => run(() => adminPublish(model.id, token))}>
                    <ArchiveRestore className="h-3.5 w-3.5" aria-hidden /> Restore this version
                  </Button>
                )}
                {model.status === "ready" && (
                  <>
                    <Button variant="primary" size="sm" disabled={busy} onClick={() => run(() => adminPublish(model.id, token))}>
                      Publish
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => run(async () => { await adminDiscard(model.id, token); onClose(); })}
                    >
                      Discard upload
                    </Button>
                  </>
                )}
              </div>
              <p className="-mt-3 text-xs text-ink-3">
                {model.status === "live"
                  ? "Switching off hides it everywhere; it stays here and can be restored."
                  : model.status === "archived"
                    ? "Restoring makes this version live again and switches off the current version of the same model."
                    : "Not live yet. Publishing puts it on every page within seconds."}
              </p>

              {error && (
                <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              {/* Name and description */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Name on the portal</h3>
                <input className={inputClass} value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <textarea
                  className={textareaClass}
                  rows={2}
                  maxLength={1000}
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                {dirty && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy || !form.name.trim()}
                    onClick={() => run(() => adminEditModel(model.id, { name: form.name.trim(), description: form.description.trim() }, token))}
                  >
                    Save
                  </Button>
                )}
              </section>

              {/* Details */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Details</h3>
                <Facts
                  rows={[
                    ["Inputs", <OxideChips key="ox" oxides={model.features} highlight={model.new_oxides ?? []} />],
                    [
                      "Typical error",
                      `${errorText(model)}${model.metrics?.rmse !== undefined ? ` · RMSE ${fixed(model.metrics.rmse, 1)}` : ""}${
                        model.metrics?.r2 !== undefined ? ` · R² ${fixed(model.metrics.r2, 3)}` : ""
                      }`,
                    ],
                    ["Trained on", `${model.n_samples ?? "?"} glasses${model.trained_on ? ` · ${model.trained_on}` : ""}`],
                    ["Model type", model.estimator ?? "unknown"],
                    [
                      "Libraries",
                      Object.entries(model.library_versions ?? {})
                        .map(([k, v]) => `${k} ${v}`)
                        .join(", ") || "not recorded",
                    ],
                    [
                      "File",
                      `${model.file?.original_name ?? ""} · ${
                        !model.file
                          ? "?"
                          : model.file.size < 1e6
                            ? `${Math.max(1, Math.round(model.file.size / 1e3))} KB`
                            : `${(model.file.size / 1e6).toFixed(2)} MB`
                      }`,
                    ],
                    ["Uploaded", model.created_by === "system" ? "Shipped with the portal" : `${when(model.created_at)} by ${model.created_by ?? "?"}`],
                    ...(model.published_at && model.published_by !== "system"
                      ? ([["Published", `${when(model.published_at)} by ${model.published_by}`]] as [string, string][])
                      : []),
                    ...(model.status === "archived" && model.archived_at
                      ? ([["Switched off", `${when(model.archived_at)} by ${model.archived_by ?? "?"}`]] as [string, string][])
                      : []),
                  ]}
                />
              </section>

              {/* Training ranges */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Training ranges</h3>
                <p className="text-xs text-ink-2">Glasses outside these ranges still get a prediction, with a warning.</p>
                <table className="w-full text-sm">
                  <tbody>
                    {model.features.map((ox) => (
                      <tr key={ox} className="border-b border-line last:border-0">
                        <td className="py-1.5">{formula(ox)}</td>
                        <td className="num py-1.5 text-right text-ink-2">
                          {model.feature_min?.[ox] !== undefined
                            ? `${fixed(model.feature_min[ox])} – ${fixed(model.feature_max[ox])} mol %`
                            : "not recorded"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Versions */}
              {versions.length > 1 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Versions</h3>
                  <ul className="divide-y divide-line rounded-md border border-line">
                    {versions.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(v.id)}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                            v.id === model.id ? "bg-surface-2/60" : ""
                          }`}
                        >
                          <span className="num w-8 font-medium">v{v.version}</span>
                          <StatusBadge status={v.status} />
                          <span className="ml-auto text-xs text-ink-3">{when(v.created_at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Upload checks */}
              {model.checks?.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Checks at upload</h3>
                  <CheckList checks={model.checks} running={false} />
                </section>
              )}
            </div>
          </>
        )}
      </Drawer>

      <Dialog
        open={confirmOff !== null}
        onClose={() => setConfirmOff(null)}
        title="Switch off the last model?"
        actions={
          <>
            <Button variant="secondary" onClick={() => switchOff(true)} disabled={busy}>
              Switch it off
            </Button>
            <Button variant="primary" onClick={() => setConfirmOff(null)}>
              Keep it live
            </Button>
          </>
        }
      >
        <p>{confirmOff}</p>
      </Dialog>
    </>
  );
}
