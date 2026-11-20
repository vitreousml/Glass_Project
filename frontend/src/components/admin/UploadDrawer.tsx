"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, CircleX, FileBox, Sparkles, X } from "lucide-react";
import {
  adminDiscard,
  adminEditModel,
  adminPublish,
  adminTryModel,
  adminUpload,
  type AdminModel,
  type AdminOverview,
  type TryResult,
  type UploadResult,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { T } from "@/lib/motion";
import { fixed } from "@/lib/units";
import { formula, normalize } from "@/lib/chem";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { NumberField } from "@/components/ui/NumberField";
import { CheckList, Facts, OxideChips, errorText, inputClass, textareaClass, valueText } from "@/components/admin/parts";

type Phase = "checking" | "failed" | "review" | "publishing" | "published" | "error";

/** A typical glass for this model: the middle of each training range, scaled to 100. */
function typicalGlass(m: AdminModel): Record<string, number> {
  const mid: Record<string, number> = {};
  m.features.forEach((f) => {
    const lo = m.feature_min?.[f] ?? 0;
    const hi = m.feature_max?.[f] ?? 100;
    mid[f] = (lo + hi) / 2;
  });
  const n = normalize(mid);
  return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, Number(v.toFixed(1))]));
}

export function UploadDrawer({
  file,
  overview,
  onClose,
  onChanged,
}: {
  file: File | null;
  overview: AdminOverview | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [phase, setPhase] = useState<Phase>("checking");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [model, setModel] = useState<AdminModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "", property_name: "", unit: "" });
  const [glass, setGlass] = useState<Record<string, number>>({});
  const [tried, setTried] = useState<TryResult | null>(null);
  const [trying, setTrying] = useState(false);
  const started = useRef<File | null>(null);

  // Upload once per dropped file (React may run effects twice in development).
  useEffect(() => {
    if (!file || started.current === file) return;
    started.current = file;
    setPhase("checking");
    setResult(null);
    setModel(null);
    setTried(null);
    setError(null);
    adminUpload(file, token)
      .then((res) => {
        setResult(res);
        if (res.status === "ready" && res.model) {
          const m = res.model;
          setModel(m);
          setForm({
            name: m.name,
            code: m.code,
            description: m.description ?? "",
            property_name: m.property_name ?? m.property,
            unit: m.unit,
          });
          setGlass(typicalGlass(m));
          setPhase("review");
          onChanged();
        } else {
          setPhase("failed");
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Upload failed.");
        setPhase("error");
      });
  }, [file, token, onChanged]);

  const newProperty = !!model && model.property_name !== null && model.property_name !== undefined;
  const replaces = useMemo(() => {
    if (!model || !overview) return null;
    const family = `${model.property}:${form.code || model.code}`;
    return overview.models.find((m) => m.family === family && m.status === "live") ?? null;
  }, [model, overview, form.code]);
  const warnings = result?.checks.filter((c) => c.status === "warn") ?? [];
  const newOxides = result?.info?.new_oxides ?? [];

  const close = () => {
    started.current = null;
    onClose();
  };

  const saveEdits = async (): Promise<AdminModel | null> => {
    if (!model) return null;
    const changes: Record<string, string> = {};
    if (form.name.trim() !== model.name) changes.name = form.name.trim();
    if (form.code.trim() !== model.code) changes.code = form.code.trim();
    if (form.description.trim() !== (model.description ?? "")) changes.description = form.description.trim();
    if (newProperty) {
      if (form.property_name.trim() !== model.property_name) changes.property_name = form.property_name.trim();
      if (form.unit.trim() !== model.unit) changes.unit = form.unit.trim();
    }
    if (Object.keys(changes).length === 0) return model;
    const updated = await adminEditModel(model.id, changes, token);
    setModel(updated);
    return updated;
  };

  const publish = async () => {
    if (!model) return;
    setError(null);
    setPhase("publishing");
    try {
      await saveEdits();
      const live = await adminPublish(model.id, token);
      setModel(live);
      setPhase("published");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't publish.");
      setPhase("review");
    }
  };

  const discard = async () => {
    if (!model) return close();
    try {
      await adminDiscard(model.id, token);
      onChanged();
    } catch {
      /* already gone */
    }
    close();
  };

  const tryIt = async () => {
    if (!model) return;
    setTrying(true);
    setError(null);
    try {
      setTried(await adminTryModel(model.id, glass, "mol", token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't run the model.");
    } finally {
      setTrying(false);
    }
  };

  const total = Object.values(glass).reduce((a, b) => a + b, 0);

  return (
    <Drawer open={!!file} onClose={phase === "checking" || phase === "publishing" ? () => {} : close} label="Add a model" className="sm:w-[580px]">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {phase === "published" ? "Model published" : phase === "review" || phase === "publishing" ? "Review the model" : "Checking the model"}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-3">
            <FileBox className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {file?.name} · {file ? (file.size < 1e6 ? `${Math.max(1, Math.round(file.size / 1e3))} KB` : `${(file.size / 1e6).toFixed(2)} MB`) : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          disabled={phase === "checking" || phase === "publishing"}
          aria-label="Close"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {(phase === "checking" || phase === "failed") && (
          <section className="space-y-3">
            {phase === "failed" && (
              <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
                <CircleX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  This model can&apos;t be added. Nothing was saved and the portal is unchanged. The failed check below
                  says what to fix; send that to whoever trained the model.
                </p>
              </div>
            )}
            <CheckList checks={result?.checks ?? null} running={phase === "checking"} />
          </section>
        )}

        {phase === "error" && (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {model && (phase === "review" || phase === "publishing") && (
          <>
            <div className="flex items-start gap-2 rounded-md border border-line bg-surface-2/60 px-3 py-2 text-sm">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden />
              <p>
                {warnings.length === 0
                  ? "Every check passed. It isn't live yet: review it, try it, then publish."
                  : `Checks passed with ${warnings.length} warning${warnings.length > 1 ? "s" : ""} (below). It isn't live yet.`}
              </p>
            </div>

            {newOxides.length > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-heat-4/30 px-3 py-2 text-sm text-ink ring-1 ring-heat-3/60">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Adds {newOxides.length === 1 ? "a new element" : `${newOxides.length} new elements`} to the portal:{" "}
                  <strong>
                    {newOxides.map((o) => `${o.element_name} (${formula(o.formula)})`).join(", ")}
                  </strong>
                  . After publishing, {newOxides.length === 1 ? "it" : "they"} can be picked on the periodic table in
                  Seer and Bank.
                </p>
              </div>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">What it is</h3>
              <Facts
                rows={[
                  [
                    "Predicts",
                    newProperty ? (
                      <span>
                        {form.property_name || model.property} <span className="text-ink-3">(new property)</span>
                      </span>
                    ) : (
                      `${overview?.properties.find((p) => p.id === model.property)?.name ?? model.property} (${model.unit})`
                    ),
                  ],
                  ["Inputs", <OxideChips key="ox" oxides={model.features} highlight={newOxides.map((o) => o.formula)} />],
                  ["Typical error", `${errorText(model)}${model.metrics?.r2 !== undefined ? ` · R² ${fixed(model.metrics.r2, 3)}` : ""}`],
                  ["Trained on", `${model.n_samples ?? "?"} glasses${model.trained_on ? ` · ${model.trained_on}` : ""}`],
                  ["Model type", model.estimator ?? "unknown"],
                  [
                    "On publishing",
                    replaces
                      ? `Replaces version ${replaces.version} of ${replaces.name}, which is switched off (you can restore it later).`
                      : "Added next to the current models.",
                  ],
                ]}
              />
            </section>

            {warnings.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Warnings</h3>
                {warnings.map((w) => (
                  <p key={w.id} className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn">
                    <span className="font-medium">{w.label}:</span> {w.detail}
                  </p>
                ))}
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">How it appears on the portal</h3>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-ink-2">Display name</span>
                  <input className={inputClass} value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-ink-2">Short code</span>
                  <input
                    className={inputClass}
                    value={form.code}
                    maxLength={12}
                    onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })}
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-ink-2">Description (optional)</span>
                <textarea
                  className={textareaClass}
                  rows={2}
                  maxLength={1000}
                  value={form.description}
                  placeholder="e.g. Trained on the 2026 aluminoborosilicate dataset"
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              {newProperty && (
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-ink-2">Property name</span>
                    <input className={inputClass} value={form.property_name} onChange={(e) => setForm({ ...form, property_name: e.target.value })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-ink-2">Unit</span>
                    <input className={inputClass} value={form.unit} maxLength={20} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                  </label>
                </div>
              )}
              <p className="text-xs text-ink-3">The short code is how people pick it in Seer and Zen. Use the same code as an older model to replace it.</p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Try it</h3>
                <span className={`num text-xs ${Math.abs(total - 100) > 0.5 ? "text-warn" : "text-ink-3"}`}>
                  Total {fixed(total)} mol %
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {model.features.map((ox) => (
                  <label key={ox} className="flex items-center justify-between gap-2 text-sm">
                    <span>{formula(ox)}</span>
                    <NumberField
                      label={`${ox} in mol %`}
                      value={glass[ox] ?? 0}
                      onCommit={(v) => setGlass({ ...glass, [ox]: v })}
                      className="w-20"
                    />
                  </label>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={tryIt} disabled={trying || total <= 0}>
                {trying ? "Predicting…" : "Predict this glass"}
              </Button>
              <AnimatePresence initial={false}>
                {tried && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0, transition: T.small }}
                    className="overflow-hidden rounded-md border border-line"
                  >
                    <table className="w-full text-sm">
                      <tbody>
                        {[{ ...tried.result, mine: true }, ...tried.compare.map((c) => ({ ...c, mine: false }))].map((r) => (
                          <tr key={`${r.model}-${r.mine}`} className={`border-b border-line last:border-0 ${r.mine ? "bg-surface-2/60 font-medium" : ""}`}>
                            <td className="px-3 py-2">
                              {r.mine ? `${form.name || r.model_name} (this upload)` : r.model_name}
                            </td>
                            <td className="num px-3 py-2 text-right">{valueText(r.value, r.unit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {tried.compare.length === 0 && (
                      <p className="border-t border-line px-3 py-2 text-xs text-ink-3">
                        No live model accepts this glass, so there&apos;s nothing to compare with.
                      </p>
                    )}
                    {tried.result.warnings.length > 0 && (
                      <p className="border-t border-line px-3 py-2 text-xs text-warn">{tried.result.warnings.join(" ")}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </>
        )}

        {phase === "published" && model && (
          <motion.div
            className="flex flex-col items-center gap-3 py-10 text-center"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1, transition: T.panel }}
          >
            <CircleCheck className="h-10 w-10 text-ink" aria-hidden />
            <p className="text-base font-semibold">{model.name} is live</p>
            <p className="max-w-sm text-sm text-ink-2">
              It now appears in Seer{model.property === "Tg" ? " and Zen" : ""}
              {newOxides.length > 0 ? `, and ${newOxides.map((o) => o.element_name).join(", ")} can be picked on the periodic table` : ""}.
              Pages people already have open update within about 15 seconds.
            </p>
          </motion.div>
        )}

        {error && phase !== "error" && (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
        {(phase === "failed" || phase === "error") && (
          <Button variant="primary" size="lg" className="flex-1" onClick={close}>
            Close
          </Button>
        )}
        {(phase === "review" || phase === "publishing") && (
          <>
            <Button variant="secondary" size="lg" onClick={discard} disabled={phase === "publishing"}>
              Discard upload
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={publish}
              disabled={phase === "publishing" || !form.name.trim() || !form.code.trim()}
            >
              {phase === "publishing" ? "Publishing…" : replaces ? `Publish and replace v${replaces.version}` : "Publish"}
            </Button>
          </>
        )}
        {phase === "published" && (
          <Button variant="primary" size="lg" className="flex-1" onClick={close}>
            Done
          </Button>
        )}
        {phase === "checking" && <p className="flex-1 text-center text-sm text-ink-2">Checking… this takes a few seconds.</p>}
      </div>
    </Drawer>
  );
}
