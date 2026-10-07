// services/diskGauge.js — ⛔ D77 · THE DISK GAUGE, in place of Railway's Pro-only volume alert.
//
// Read from the volume itself (statfs on the data directory — the mount), not from a plan's documented
// size: production's volume is 1,000 MB (railway volume list, 10-07), not the 500 MB the 09-29 ENOSPC
// suggested. Green below AMBER_AT, amber to RED_AT, red above — the Admin banner, the Pipeline Health line
// and the Ops card all read toneFor(), one rule.
//
// ⛔ D74 P3's TRANCHE GATE reads it: a company is not ADDED or ENABLED when the projected usage after it
// exceeds TRANCHE_LIMIT. The projection is measured from this database — rows per active company and bytes
// per row — and counts the backups that copy the database (each retained backup is one more copy, up to
// the backup budget), because on this volume the backups ARE most of the growth.
import fs from "node:fs";
import path from "node:path";
import { backupLimits, listBackups } from "../scripts/backup.js";   // the configured package, as server.js reads it

export const AMBER_AT = 70;
export const RED_AT = 85;
export const TRANCHE_LIMIT = 70;

export function toneFor(usedPct) {
  if (!Number.isFinite(usedPct)) return "unknown";
  return usedPct >= RED_AT ? "red" : usedPct >= AMBER_AT ? "amber" : "green";
}

function largestFiles(dir, { depth = 2, top = 10 } = {}) {
  const out = [];
  const walk = (d, left) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (left > 0) walk(p, left - 1); continue; }
      try { out.push({ path: path.relative(dir, p).split(path.sep).join("/"), bytes: fs.statSync(p).size }); } catch { /* vanished */ }
    }
  };
  walk(dir, depth);
  return out.sort((a, b) => b.bytes - a.bytes).slice(0, top);
}

/**
 * @param {string} dataDir  the volume's mount (draft's data directory)
 * @returns {{ totalBytes, usedBytes, freeBytes, usedPct, tone, largest, backups: { count, bytes, budget } }}
 */
export function readGauge(dataDir, { statfs = fs.statfsSync, backups = safeBackups } = {}) {
  const s = statfs(dataDir);
  const totalBytes = s.blocks * s.bsize, freeBytes = s.bavail * s.bsize;
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPct = totalBytes ? +(100 * usedBytes / totalBytes).toFixed(1) : NaN;
  const list = backups();
  const backupBytes = list.reduce((n, b) => n + (Number(b.size) || 0), 0);
  const { budget } = backupLimits({ total: totalBytes, free: freeBytes }, backupBytes);
  return { totalBytes, usedBytes, freeBytes, usedPct, tone: toneFor(usedPct), largest: largestFiles(dataDir),
           backups: { count: list.length, bytes: backupBytes, budget } };
}
function safeBackups() { try { return listBackups(); } catch { return []; } }

/**
 * What adding `companies` more would do to the disk, from THIS database's own numbers.
 * @returns {{ rowsPerCompany, bytesPerRow, addedDbBytes, addedBackupBytes, projectedPct, limit }}
 */
export function projectTranche(db, gauge, { companies = 1, dbBytes } = {}) {
  const active = db.prepare("SELECT COUNT(*) n FROM company_ats_list WHERE active = 1").get().n || 1;
  const rows = db.prepare("SELECT COUNT(*) n FROM scraped_jobs").get().n || 1;
  const activeRows = db.prepare("SELECT COUNT(*) n FROM scraped_jobs WHERE is_active = 1").get().n;
  // The whole database over its postings — conservative: it charges every other table to the postings.
  const size = dbBytes ?? (db.prepare("PRAGMA page_count").get().page_count * db.prepare("PRAGMA page_size").get().page_size);
  const bytesPerRow = size / rows;
  const rowsPerCompany = activeRows / active;
  const addedDbBytes = Math.round(companies * rowsPerCompany * bytesPerRow);
  const room = Math.max(0, gauge.backups.budget - gauge.backups.bytes);
  const addedBackupBytes = Math.min(addedDbBytes * Math.max(1, gauge.backups.count), room + addedDbBytes);
  const projectedPct = gauge.totalBytes ? +(100 * (gauge.usedBytes + addedDbBytes + addedBackupBytes) / gauge.totalBytes).toFixed(1) : NaN;
  return { rowsPerCompany: Math.round(rowsPerCompany), bytesPerRow: Math.round(bytesPerRow), addedDbBytes, addedBackupBytes,
           projectedPct, limit: TRANCHE_LIMIT };
}

/** ⛔ D74 P3: may `companies` more be added / enabled? Refused above TRANCHE_LIMIT, or when the disk cannot be read. */
export function trancheGate(db, dataDir, { companies = 1, readGaugeImpl = readGauge } = {}) {
  let gauge;
  try { gauge = readGaugeImpl(dataDir); } catch (e) { return { ok: false, reason: "disk_unreadable", detail: e.message }; }
  const p = projectTranche(db, gauge, { companies });
  if (!(p.projectedPct <= TRANCHE_LIMIT)) {
    return { ok: false, reason: "disk_gate", usedPct: gauge.usedPct, ...p,
             message: `Adding ${companies} compan${companies === 1 ? "y" : "ies"} projects the volume at ${p.projectedPct}% — above the ${TRANCHE_LIMIT}% gate. Free space or resize the volume first (D77).` };
  }
  return { ok: true, usedPct: gauge.usedPct, ...p };
}
