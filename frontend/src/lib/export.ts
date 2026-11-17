// Downloads and printouts. Every file and every printed page carries the watermark.

// Placeholder text until the real wording is decided.
export const WATERMARK = "SAMPLE WATERMARK · Glass Studio · COE-DSAI, TIET Patiala · Lorem ipsum dolor sit amet";

export interface Report {
  title: string;
  /** Short lines under the title: date, model, unit… */
  meta: string[];
  columns: string[];
  rows: (string | number)[][];
  /** Footnotes, e.g. extrapolation warnings. */
  notes?: string[];
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

export const reportDate = () =>
  new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with the watermark as its first and last line. */
export function reportToCsv(r: Report): string {
  const lines: (string | number)[][] = [
    [WATERMARK],
    [r.title],
    ...r.meta.map((m) => [m]),
    [],
    r.columns,
    ...r.rows,
    ...(r.notes?.length ? [[], ["Notes"], ...r.notes.map((n) => [n])] : []),
    [],
    [WATERMARK],
  ];
  return lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(r: Report, name = "glass-studio-prediction") {
  // The BOM makes Excel read °C and ± correctly.
  const blob = new Blob(["﻿" + reportToCsv(r)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const esc = (s: string | number) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function reportHtml(r: Report): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title>
<style>
  @page { margin: 16mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font: 12px/1.45 "IBM Plex Sans", system-ui, sans-serif; color: #1d1b17; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #57524a; margin: 0 0 14px; }
  table { border-collapse: collapse; width: 100%; position: relative; z-index: 1; }
  th, td { border-bottom: 1px solid #e1dbce; padding: 5px 8px; text-align: left; }
  th { font-weight: 600; border-bottom-color: #c9c0ae; }
  td.n, th.n { text-align: right; font-family: "IBM Plex Mono", ui-monospace, monospace; }
  .notes { margin-top: 14px; color: #57524a; }
  .notes p { margin: 2px 0; }
  .band { border: 1px dashed #c9c0ae; padding: 4px 8px; margin: 0 0 12px; color: #726c60; font-size: 11px; }
  /* Repeats on every printed page */
  .wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
  .wm span { transform: rotate(-30deg); font-size: 34px; font-weight: 600; color: rgba(29, 27, 23, 0.09); text-align: center; max-width: 80%; }
</style></head><body>
<div class="wm"><span>${esc(WATERMARK)}</span></div>
<div class="band">${esc(WATERMARK)}</div>
<h1>${esc(r.title)}</h1>
<p class="meta">${r.meta.map(esc).join("<br>")}</p>
<table><thead><tr>${r.columns
    .map((c, i) => `<th class="${i > 0 && typeof r.rows[0]?.[i] === "number" ? "n" : ""}">${esc(c)}</th>`)
    .join("")}</tr></thead>
<tbody>${r.rows
    .map((row) => `<tr>${row.map((v) => `<td class="${typeof v === "number" ? "n" : ""}">${esc(v)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>
${r.notes?.length ? `<div class="notes"><strong>Notes</strong>${r.notes.map((n) => `<p>${esc(n)}</p>`).join("")}</div>` : ""}
<div class="band" style="margin-top:16px">${esc(WATERMARK)}</div>
</body></html>`;
}

/** Prints the report from a hidden frame, so the app itself is never printed. */
export function printReport(r: Report) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(reportHtml(r));
  doc.close();
  const win = frame.contentWindow!;
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  win.addEventListener("afterprint", cleanup);
  // Give the frame a moment to lay out before opening the print dialog.
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  }, 150);
}
