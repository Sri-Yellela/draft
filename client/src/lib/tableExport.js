// ⭐ D146 · THE TABLE'S EXPORTS, built once — Excel (GET /api/export/excel) and the CSV of the rows shown
// (shared/applicationCsv.js historyToCsv). Called from the one tracker's header (Export) and from the full sheet
// (DatabasePanel's Export Excel, ApplicationHistory's Export CSV). Unchanged in function from D55 (i) / The Table.
import { api } from "./api.js";

/** Hand the browser a text file to save (a BOM first, so Excel reads the UTF-8). */
export function saveText(name, text, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The whole Table as an .xlsx, named after the user and the day. Throws on failure (the caller says so). */
export async function downloadExcel(username) {
  const r = await api("/api/export/excel");
  const b = await r.blob();
  const u = URL.createObjectURL(b);
  Object.assign(document.createElement("a"), {
    href: u,
    download: `ResuMaster_${username}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  }).click();
  URL.revokeObjectURL(u);
}

/** The CSV file's name for a day's export. */
export const csvName = (d = new Date()) => `draft-the-table-${d.toISOString().slice(0, 10)}.csv`;
