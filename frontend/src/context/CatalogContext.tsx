"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  getCatalog,
  getCatalogVersion,
  type Catalog,
  type CatalogModel,
  type CatalogProperty,
} from "@/lib/api";
import { registerCatalogChem } from "@/lib/chem";
import { PERIODIC_ELEMENTS, type ElementData } from "@/data/elements";

/**
 * What is live on the portal: models, the properties they predict and the oxides
 * they accept. Comes from the server (the admin portal changes it) and is
 * re-checked every few seconds, so a newly published model shows up without a reload.
 */

// Used only until the server answers (or if it can't be reached): the original four models.
const ORIGINAL_RANGES = { SiO2: [0.7, 86.5], B2O3: [0.1, 95.2], Na2O: [0.011, 70] } as const;
const originalModel = (code: string, name: string, mae: number, r2: number): CatalogModel => ({
  id: `builtin-Tg-${code}`,
  family: `Tg:${code}`,
  code,
  name,
  property: "Tg",
  unit: "K",
  features: ["SiO2", "B2O3", "Na2O"],
  feature_min: Object.fromEntries(Object.entries(ORIGINAL_RANGES).map(([k, v]) => [k, v[0]])),
  feature_max: Object.fromEntries(Object.entries(ORIGINAL_RANGES).map(([k, v]) => [k, v[1]])),
  metrics: { mae, r2 },
  version: 1,
  builtin: true,
  is_default: code === "RF",
});

export const FALLBACK_CATALOG: Catalog = {
  version: -1,
  properties: [
    { id: "Tg", name: "Glass transition temperature", unit: "K", unit_kind: "temperature", default_model: "RF" },
  ],
  models: [
    originalModel("RF", "Random Forest", 14.85, 0.878),
    originalModel("XGB", "XGBoost", 15.75, 0.873),
    originalModel("KNN", "K-nearest neighbours", 17.82, 0.84),
    originalModel("SVM", "Support vector machine", 22.37, 0.785),
  ],
  oxides: [
    { formula: "SiO2", element: "Si", element_name: "Silicon", molar_mass: 60.084 },
    { formula: "B2O3", element: "B", element_name: "Boron", molar_mass: 69.62 },
    { formula: "Na2O", element: "Na", element_name: "Sodium", molar_mass: 61.979 },
  ],
};

const POLL_MS = 15000;

interface CatalogContextType {
  catalog: Catalog;
  status: "loading" | "ready" | "offline";
  refresh: () => Promise<void>;
  property: (id: string) => CatalogProperty | undefined;
  /** Live models for a property, in display order. */
  modelsFor: (prop: string) => CatalogModel[];
  /** A live model by short code (and property). */
  modelByCode: (code: string, prop?: string) => CatalogModel | undefined;
  /** Is this oxide accepted by any live model (for these properties, if given)? */
  isModelled: (oxide: string, properties?: string[]) => boolean;
  /**
   * Models that can predict a glass made of these oxides, for every chosen property.
   * One entry per short code (the first property's model).
   */
  modelChoices: (oxides: string[], properties: string[]) => CatalogModel[];
  /** The periodic table with each element's oxide and whether a live model accepts it. */
  elements: ElementData[];
  elementBySymbol: Record<string, ElementData>;
  elementOfOxide: Record<string, ElementData>;
}

const CatalogContext = createContext<CatalogContextType | null>(null);

/** Mark which elements a live model accepts, and add elements that new models introduce. */
function mergeElements(catalog: Catalog): ElementData[] {
  const modelled: Record<string, string[]> = {};
  catalog.oxides.forEach((o) => {
    if (o.element) (modelled[o.element] ??= []).push(o.formula);
  });
  return PERIODIC_ELEMENTS.map((el) => {
    const live = modelled[el.symbol] ?? [];
    if (live.length === 0) return el.supported ? { ...el, noModel: true } : el;
    const known = el.oxides ?? (el.oxide ? [el.oxide] : []);
    const all = Array.from(new Set([...known, ...live]));
    return {
      ...el,
      supported: true,
      noModel: false,
      oxide: el.oxide && all.includes(el.oxide) ? el.oxide : live[0],
      oxides: all.length > 1 ? all : undefined,
    };
  });
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(() => {
    registerCatalogChem(FALLBACK_CATALOG);
    return FALLBACK_CATALOG;
  });
  const [status, setStatus] = useState<"loading" | "ready" | "offline">("loading");
  const versionRef = useRef<number>(-1);

  const refresh = useCallback(async () => {
    try {
      const next = await getCatalog();
      registerCatalogChem(next);
      versionRef.current = next.version;
      setCatalog(next);
      setStatus("ready");
    } catch {
      setStatus((s) => (s === "ready" ? s : "offline"));
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { version } = await getCatalogVersion();
        if (version !== versionRef.current) await refresh();
      } catch {
        /* server unreachable: keep what we have */
      }
    };
    const timer = window.setInterval(check, POLL_MS);
    window.addEventListener("focus", check);
    // The admin portal announces its own changes so this tab updates at once.
    window.addEventListener("catalog-changed", refresh);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("catalog-changed", refresh);
    };
  }, [refresh]);

  const value = useMemo<CatalogContextType>(() => {
    const modelsFor = (prop: string) => catalog.models.filter((m) => m.property === prop);
    const covers = (m: CatalogModel, oxides: string[]) => oxides.every((ox) => m.features.includes(ox));
    const elements = mergeElements(catalog);
    return {
      catalog,
      status,
      refresh,
      property: (id) => catalog.properties.find((p) => p.id === id),
      modelsFor,
      modelByCode: (code, prop = "Tg") => catalog.models.find((m) => m.code === code && m.property === prop),
      isModelled: (oxide, properties) =>
        catalog.models.some(
          (m) => m.features.includes(oxide) && (!properties || properties.length === 0 || properties.includes(m.property)),
        ),
      modelChoices: (oxides, properties) => {
        if (properties.length === 0) return [];
        const [first, ...rest] = properties;
        return modelsFor(first).filter(
          (m) =>
            covers(m, oxides) &&
            rest.every((p) => modelsFor(p).some((x) => x.code === m.code && covers(x, oxides))),
        );
      },
      elements,
      elementBySymbol: Object.fromEntries(elements.map((e) => [e.symbol, e])),
      elementOfOxide: Object.fromEntries(
        elements.flatMap((e) => (e.oxides ?? (e.oxide ? [e.oxide] : [])).map((ox) => [ox, e] as const)),
      ),
    };
  }, [catalog, status, refresh]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextType {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside CatalogProvider");
  return ctx;
}

/** Tell every open page that the catalog changed (used by the admin portal after publishing). */
export const announceCatalogChange = () => window.dispatchEvent(new Event("catalog-changed"));
