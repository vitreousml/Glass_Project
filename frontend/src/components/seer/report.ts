import type { CompositionBasis } from "@/lib/api";
import { basisLabel, modelInfo, relevantWarnings, type Composition } from "@/lib/chem";
import { reportDate, type Report } from "@/lib/export";
import { fixed, kToC } from "@/lib/units";
import type { PredictResponse } from "@/components/seer/Results";

export interface PredictedGlass {
  /** As entered, in `basis`. */
  composition: Composition;
  response: PredictResponse;
}

/** Results rounded to whole degrees: the models aren't more precise than that. */
export const deg = (x: number) => fixed(x, 0);
export const errorOf = (model: string, property = "Tg") => modelInfo(model, property)?.mae;

/** One row per glass and model, ready for CSV or print. */
export function buildReport(glasses: PredictedGlass[], oxides: string[], basis: CompositionBasis): Report {
  const unit = basisLabel(basis);
  const rows: (string | number)[][] = [];
  const notes: string[] = [];

  glasses.forEach((g, i) => {
    const label = glasses.length > 1 ? `Glass ${i + 1}` : "Glass";
    g.response.results
      .filter((r) => r.property === "Tg" && r.unit === "K")
      .forEach((r) => {
        const mae = errorOf(r.model);
        rows.push([
          i + 1,
          ...oxides.map((ox) => Number(fixed(g.composition[ox] ?? 0))),
          modelInfo(r.model)?.name ?? r.model,
          Number(deg(kToC(r.value))),
          mae !== undefined ? `±${deg(mae)}` : "",
          Number(deg(r.value)),
        ]);
      });
    relevantWarnings(
      g.response.results.flatMap((r) => r.warnings),
      oxides,
    ).forEach((w) => notes.push(`${label}: ${w}`));
  });

  return {
    title: "Glass Studio · predicted glass transition temperature (Tg)",
    meta: [
      `Created ${reportDate()}`,
      `Composition in ${unit}${basis === "wt" ? " (converted to mol % for the models)" : ""}`,
      "± is the model's typical error on test glasses it never saw. Values are rounded to whole degrees.",
    ],
    columns: ["Glass", ...oxides.map((ox) => `${ox} (${unit})`), "Model", "Tg (°C)", "Error (°C)", "Tg (K)"],
    rows,
    notes,
  };
}
