// services/hirebase/admin.js — ⭐ HB-10 (D187 HB-INFRA): what Admin → System → Hirebase shows and does.
//   hirebaseState(db)        the switches (master / dry-run / key present), the caps and what is used (from the headers),
//                            the last runs with their counts, the last error, and the boards switch
//   sizingQueries()          HB-9 (a)'s free estimates, exactly as the owner set them (11-09)
//   setCaps(db, { month, day })
import { hirebaseConfig } from "./client.js";
import { caps, usedSoFar, MONTH_CAP_KEY, DAY_CAP_KEY } from "./spendGuard.js";
import { buildSearchBody, boardsConfig, categoryMap } from "./filter.js";
import { setSetting } from "../appSettings.js";

export function hirebaseState(db, { env = process.env } = {}) {
  const config = hirebaseConfig(env);
  let runs = [];
  try {
    runs = db.prepare(`SELECT id, kind, status, dry_run, pages_done, units_used, counts_json, error, started_at, finished_at
      FROM hirebase_runs ORDER BY id DESC LIMIT 20`).all().map(r => ({ ...r, counts: (() => { try { return JSON.parse(r.counts_json || "null"); } catch { return null; } })(), counts_json: undefined }));
  } catch { runs = []; }
  const lastError = runs.find(r => r.error)?.error ?? null;
  let boards = null; try { boards = boardsConfig(); } catch { boards = null; }
  return {
    enabled: config.enabled, dryRun: config.dryRun, hasKey: !!config.key,
    caps: caps(db), used: usedSoFar(db),
    runs, lastError,
    skipOurBoards: !!boards?.skipOurBoards, ourBoards: boards?.ourBoards || [],
  };
}

/** HB-9 (a) — zero units each (the estimate endpoint, limit 0). */
export function sizingQueries({ nowMs = Date.now() } = {}) {
  const day60 = new Date(nowMs - 60 * 86400_000).toISOString().slice(0, 10);
  const swe = [categoryMap().sampleCategory];
  return [
    { label: "60-day backfill, whole filter — all boards", body: buildSearchBody({ datePosted: day60, skipOurBoards: false }) },
    { label: "60-day backfill, whole filter — our boards skipped", body: buildSearchBody({ datePosted: day60, skipOurBoards: true }) },
    { label: "Construction / project management, US, 60 days", body: buildSearchBody({ categories: ["Project & Program Management Jobs", "Engineering Jobs"], datePosted: day60, skipOurBoards: false }) },
    { label: "Construction / project management, Boston, 60 days", body: { ...buildSearchBody({ categories: ["Project & Program Management Jobs", "Engineering Jobs"], datePosted: day60, skipOurBoards: false }),
      geo_locations: [{ city: "Boston", region: "Massachusetts", country: "United States" }] } },
    { label: "Visa-sponsored, 60 days", body: buildSearchBody({ datePosted: day60, visa: true, skipOurBoards: false }) },
    { label: "Software engineering, last 1 day — all boards", body: buildSearchBody({ categories: swe, daysAgo: 1, skipOurBoards: false }) },
    { label: "Software engineering, last 1 day — our boards skipped", body: buildSearchBody({ categories: swe, daysAgo: 1, skipOurBoards: true }) },
  ];
}

export function setCaps(db, { month = null, day = null } = {}) {
  const ok = (v) => Number.isInteger(v) && v >= 0 && v <= 10_000_000;
  if (month != null) { if (!ok(month)) throw Object.assign(new Error("month cap must be a whole number of jobs"), { status: 400 }); setSetting(db, MONTH_CAP_KEY, String(month)); }
  if (day != null) { if (!ok(day)) throw Object.assign(new Error("day cap must be a whole number of jobs"), { status: 400 }); setSetting(db, DAY_CAP_KEY, String(day)); }
  return caps(db);
}
