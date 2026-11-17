import type { CompositionBasis } from "@/lib/api";

export type Composition = Record<string, number>;

// The three oxides the models know, in ternary-diagram order (top, bottom-left, bottom-right).
export const OXIDES = ["SiO2", "B2O3", "Na2O"] as const;
export type Oxide = (typeof OXIDES)[number];

// g/mol. Used on screen to keep the same glass when switching mol % <-> wt %.
// The backend does the conversion the prediction actually uses.
export const MOLAR_MASS: Record<string, number> = { SiO2: 60.084, B2O3: 69.62, Na2O: 61.979 };

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
/** "B2O3" -> "B₂O₃" */
export const formula = (s: string) => s.replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]);
export const basisLabel = (b: CompositionBasis) => (b === "mol" ? "mol %" : "wt %");
export const sumOf = (c: Composition) => Object.values(c).reduce((a, b) => a + b, 0);

/** Rescale to 100; split equally if everything is zero. */
export function normalize(c: Composition): Composition {
  const keys = Object.keys(c);
  const total = sumOf(c);
  const out: Composition = {};
  keys.forEach((k) => (out[k] = total > 0 ? (c[k] / total) * 100 : 100 / keys.length));
  return out;
}

/** Keep amounts of oxides that stay, give new ones an equal share, rescale to 100. */
export function rebalance(prev: Composition, oxides: string[]): Composition {
  if (oxides.length === 0) return {};
  const next: Composition = {};
  oxides.forEach((ox) => (next[ox] = prev[ox] ?? 100 / oxides.length));
  return normalize(next);
}

/** Same glass, other unit: weight ∝ moles × molar mass. */
export function convertBasis(c: Composition, to: CompositionBasis): Composition {
  const parts: Composition = {};
  Object.entries(c).forEach(([ox, v]) => {
    parts[ox] = to === "wt" ? v * MOLAR_MASS[ox] : v / MOLAR_MASS[ox];
  });
  return normalize(parts);
}

/** Set one oxide; the others share what is left in their current proportions. */
export function setOne(c: Composition, oxide: string, value: number): Composition {
  const v = Math.min(100, Math.max(0, value));
  const others = Object.keys(c).filter((k) => k !== oxide);
  const othersTotal = others.reduce((a, k) => a + c[k], 0);
  const next: Composition = { [oxide]: v };
  others.forEach((k) => {
    next[k] = othersTotal > 0 ? ((100 - v) * c[k]) / othersTotal : (100 - v) / others.length;
  });
  return next;
}

/** The composition in mol %, with every model oxide present (missing ones are 0). */
export function toFullMol(c: Composition, basis: CompositionBasis): Composition {
  const mol = basis === "mol" ? c : convertBasis(c, "mol");
  const out: Composition = {};
  OXIDES.forEach((ox) => (out[ox] = mol[ox] ?? 0));
  return out;
}

/**
 * Corners of the region allowed by per-oxide min/max ranges (mol %), as compositions.
 * Each corner sits where two range limits meet and the third oxide is within its range.
 */
export function rangeRegion(ranges: Partial<Record<string, { min: number; max: number }>>): Composition[] {
  const r = (ox: Oxide) => ranges[ox];
  if (!OXIDES.every((ox) => r(ox))) return [];
  const pts: Composition[] = [];
  const pairs: [Oxide, Oxide, Oxide][] = [
    ["SiO2", "B2O3", "Na2O"],
    ["SiO2", "Na2O", "B2O3"],
    ["B2O3", "Na2O", "SiO2"],
  ];
  for (const [p, q, rest] of pairs) {
    for (const pv of [r(p)!.min, r(p)!.max]) {
      for (const qv of [r(q)!.min, r(q)!.max]) {
        const rv = 100 - pv - qv;
        if (rv >= r(rest)!.min - 1e-9 && rv <= r(rest)!.max + 1e-9) {
          pts.push({ [p]: pv, [q]: qv, [rest]: rv });
        }
      }
    }
  }
  const seen = new Set<string>();
  return pts.filter((c) => {
    const key = OXIDES.map((ox) => c[ox].toFixed(3)).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Test-set errors are in K; a difference of 1 K equals 1 °C.
export const MODELS = [
  { id: "RF", name: "Random Forest", mae: 14.85, r2: 0.878 },
  { id: "XGB", name: "XGBoost", mae: 15.75, r2: 0.873 },
  { id: "KNN", name: "K-nearest neighbours", mae: 17.82, r2: 0.84 },
  { id: "SVM", name: "Support vector machine", mae: 22.37, r2: 0.785 },
] as const;
export const MODEL_BY_ID: Record<string, (typeof MODELS)[number]> = Object.fromEntries(MODELS.map((m) => [m.id, m]));

export const PROPERTIES = [
  { id: "Tg", label: "Glass transition temperature", available: true },
  { id: "density", label: "Density", available: false },
  { id: "refractive_index", label: "Refractive index", available: false },
  { id: "youngs_modulus", label: "Young's modulus", available: false },
  { id: "cte", label: "Thermal expansion", available: false },
] as const;
