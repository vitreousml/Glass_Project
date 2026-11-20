"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, FileUp, History, Star } from "lucide-react";
import { adminAudit, adminGetModels, type AdminModel, type AdminOverview, type AuditEntry } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { announceCatalogChange } from "@/context/CatalogContext";
import { SPRING, T } from "@/lib/motion";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { Skeleton } from "@/components/ui/Skeleton";
import { Formula } from "@/components/ui/Tg";
import { ModelDrawer } from "@/components/admin/ModelDrawer";
import { UploadDrawer } from "@/components/admin/UploadDrawer";
import { OxideChips, StatusBadge, errorText, when } from "@/components/admin/parts";

type Tab = "models" | "activity";

const STATUS_ORDER = { live: 0, ready: 1, archived: 2 } as const;

/** One row per model (all versions of it together), showing the version that matters most. */
function families(models: AdminModel[]) {
  const groups: Record<string, AdminModel[]> = {};
  models.forEach((m) => (groups[m.family] ??= []).push(m));
  return Object.values(groups)
    .map((versions) => {
      versions.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.version - a.version);
      return { lead: versions[0], versions };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.lead.status] - STATUS_ORDER[b.lead.status] ||
        (a.lead.order ?? 1e9) - (b.lead.order ?? 1e9),
    );
}

export default function AdminModule() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("models");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const load = useCallback(async () => {
    try {
      setOverview(await adminGetModels(token));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load the models.");
    }
  }, [token]);

  const loadAudit = useCallback(async () => {
    try {
      setAudit((await adminAudit(token, 200)).entries);
    } catch {
      setAudit([]);
    }
  }, [token]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const showTab = (t: Tab) => {
    setTab(t);
    if (t === "activity") loadAudit();
  };

  // After any change: refresh this screen, and tell every page to re-read the catalog.
  const changed = useCallback(() => {
    load();
    announceCatalogChange();
    if (tab === "activity") loadAudit();
  }, [load, loadAudit, tab]);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) setFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    pick(e.dataTransfer.files);
  };

  const properties = overview
    ? Array.from(new Set([...overview.properties.map((p) => p.id), ...overview.models.map((m) => m.property)]))
    : [];
  const drafts = overview?.models.filter((m) => m.status === "ready") ?? [];

  return (
    <div
      className="relative mx-auto max-w-5xl space-y-5"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Admin</h1>
          <p className="text-sm text-ink-2">Add prediction models and choose which ones are live across the portal.</p>
        </div>
        <SegmentedToggle
          id="admin-tab"
          label="Admin section"
          value={tab}
          onChange={showTab}
          options={[
            { value: "models", label: "Models" },
            { value: "activity", label: "Activity" },
          ]}
        />
      </header>

      <input
        ref={inputRef}
        type="file"
        accept=".pkl,.joblib"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />

      {tab === "models" && (
        <>
          {/* Drop zone */}
          <motion.button
            type="button"
            onClick={() => inputRef.current?.click()}
            animate={{ scale: dragging ? 1.01 : 1 }}
            transition={SPRING}
            className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragging ? "border-ink bg-surface-2" : "border-line-strong bg-surface hover:border-ink"
            }`}
          >
            <FileUp className="h-7 w-7 text-ink-2" aria-hidden />
            <span className="text-base font-medium">{dragging ? "Drop it to check it" : "Drop a model file here, or click to choose one"}</span>
            <span className="text-xs text-ink-3">
              .pkl or .joblib, up to {overview?.max_upload_mb ?? 30} MB. It is checked first and only goes live when you publish it.
            </span>
          </motion.button>

          {loadError && (
            <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              {loadError}
            </p>
          )}

          {!overview && !loadError && (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}

          {overview && (
            <>
              {/* Elements on the portal */}
              <section className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                <span className="text-ink-2">Elements with a live model:</span>
                {overview.live_oxides.map((o) => (
                  <span key={o.formula} className="inline-flex h-6 items-center gap-1 rounded-sm bg-surface-2 px-1.5 text-xs">
                    <span className="font-semibold">{o.element}</span>
                    <span className="text-ink-3">
                      <Formula>{o.formula}</Formula>
                    </span>
                  </span>
                ))}
                <span className="ml-auto text-xs text-ink-3">A new model with a new oxide adds its element automatically.</span>
              </section>

              {drafts.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold">Waiting to be published</h2>
                  <ul className="space-y-2">
                    {drafts.map((m) => (
                      <ModelRow key={m.id} model={m} versions={1} isDefault={false} onOpen={() => setOpenId(m.id)} />
                    ))}
                  </ul>
                </section>
              )}

              {properties.map((pid) => {
                const prop = overview.properties.find((p) => p.id === pid);
                const rows = families(overview.models.filter((m) => m.property === pid && m.status !== "ready"));
                if (rows.length === 0) return null;
                const liveCount = rows.filter((r) => r.lead.status === "live").length;
                return (
                  <section key={pid} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-sm font-semibold">
                        {prop?.name ?? pid} <span className="font-normal text-ink-3">({prop?.unit ?? "?"})</span>
                      </h2>
                      <span className="text-xs text-ink-3">
                        {liveCount} live model{liveCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {rows.map(({ lead, versions }) => (
                        <ModelRow
                          key={lead.family}
                          model={lead}
                          versions={versions.length}
                          isDefault={lead.status === "live" && prop?.default_family === lead.family}
                          onOpen={() => setOpenId(lead.id)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </>
      )}

      {tab === "activity" && (
        <section className="rounded-lg border border-line bg-surface">
          {!audit && (
            <div className="space-y-2 p-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          )}
          {audit && audit.length === 0 && <p className="p-4 text-sm text-ink-2">Nothing has been changed yet.</p>}
          {audit && audit.length > 0 && (
            <ol className="divide-y divide-line">
              {audit.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                  <History className="h-3.5 w-3.5 shrink-0 self-center text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1">{e.summary}</span>
                  <span className="text-xs text-ink-3">
                    {e.actor} · {when(e.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <AnimatePresence>
        {dragging && tab === "activity" && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-ink/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: T.small }}
            exit={{ opacity: 0, transition: T.exit }}
          >
            <span className="rounded-lg bg-surface px-5 py-3 text-base font-medium shadow-float">Drop the model file to check it</span>
          </motion.div>
        )}
      </AnimatePresence>

      <UploadDrawer file={file} overview={overview} onClose={() => setFile(null)} onChanged={changed} />
      <ModelDrawer modelId={openId} overview={overview} onSelect={setOpenId} onClose={() => setOpenId(null)} onChanged={changed} />
    </div>
  );
}

function ModelRow({
  model,
  versions,
  isDefault,
  onOpen,
}: {
  model: AdminModel;
  versions: number;
  isDefault: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`group flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-left transition-colors hover:border-line-strong ${
          model.status === "archived" ? "border-line bg-surface/60 text-ink-2" : "border-line bg-surface"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{model.name}</span>
            <span className="rounded-sm bg-surface-2 px-1.5 text-xs text-ink-2">{model.code}</span>
            <StatusBadge status={model.status} />
            {isDefault && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                <Star className="h-3 w-3" aria-hidden /> default
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            <span>
              v{model.version}
              {versions > 1 ? ` · ${versions} versions` : ""}
            </span>
            <span>{errorText(model)}</span>
            {model.builtin && <span>original</span>}
          </div>
        </div>
        <OxideChips oxides={model.features} highlight={model.status !== "archived" ? model.new_oxides ?? [] : []} />
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </li>
  );
}
