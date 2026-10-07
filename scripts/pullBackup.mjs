#!/usr/bin/env node
// scripts/pullBackup.mjs — ⛔ D77 PHASE 1 · A COPY OF THE NEWEST BACKUP, OFF THE VOLUME IT PROTECTS.
//
// The app's own backups live on the one volume they are meant to protect (draft-data, mounted at /app/data):
// a lost or corrupted volume takes the database AND its backups. This copies the NEWEST backup down to a
// folder OUTSIDE the repository, then proves the copy can be opened before keeping it.
//
//   node scripts/pullBackup.mjs [--dest <folder>] [--volume draft-data] [--keep 8] [--warn-days 3] [--list]
//
// HOW IT READS THE VOLUME — verified 10-07 against the installed CLI (railway 5.63.3):
//   railway volume files --volume draft-data list /backups --json      (paths are relative to the mount)
//   railway volume files --volume draft-data download <remote> <local>
// A read-only file download: no shell on the container. ⛔ NEVER `railway run` — it runs HERE, against the
// LOCAL database, with production's variables. (From Git Bash, a bare `/backups` is rewritten to a Windows
// path; this script calls the CLI from Node, which does not.)
//
// THEN, ON THE LOCAL COPY: opened READ-ONLY · PRAGMA integrity_check · the tables a draft database must have
// and a non-empty board · its last migration. A copy that fails is renamed `*.FAILED` and is never counted
// as "the good one". The last `--keep` good copies are kept; older good ones are deleted. The newest copy's
// age is printed, with a WARNING above `--warn-days`.
// ⛔ It refuses a destination inside the repository. ⚠ Once real users exist the folder holds personal data:
// put it on an encrypted disk (BitLocker / FileVault), or encrypt the copies — the script says so every run.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REQUIRED_TABLES = Object.freeze(["scraped_jobs", "users", "schema_migrations", "company_ats_list"]);

/** ⛔ A copy of production inside the repository is one `git add .` from being committed. */
export function refuseInsideRepo(dest, repoRoot = REPO_ROOT) {
  const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
  const rel = path.relative(real(repoRoot), real(dest));
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
    return { ok: false, reason: `${dest} is inside the repository (${repoRoot}) — choose a folder outside it` };
  }
  return { ok: true };
}

/** The newest backup database in a `volume files list` answer (never the manifest). */
export function newestBackup(files = []) {
  return files.filter(f => f?.type === "file" && /\.db$/.test(f.name || ""))
    .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))[0] || null;
}

/** Can this file be opened, and is it a whole draft database? Read-only; never writes to it. */
export function verifyCopy(file) {
  const problems = [];
  let db;
  try { db = new Database(file, { readonly: true, fileMustExist: true }); }
  catch (e) { return { ok: false, problems: [`cannot open: ${e.message}`] }; }
  try {
    const integrity = db.prepare("PRAGMA integrity_check").pluck().all();
    if (!(integrity.length === 1 && integrity[0] === "ok")) problems.push(`integrity_check: ${integrity.slice(0, 3).join("; ")}`);
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all());
    for (const t of REQUIRED_TABLES) if (!tables.has(t)) problems.push(`missing table ${t}`);
    const rows = tables.has("scraped_jobs") ? db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get() : 0;
    const active = tables.has("scraped_jobs") ? db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get() : 0;
    if (!rows) problems.push("scraped_jobs is empty");
    // The HIGHEST-NUMBERED id, not the newest applied_at: a deploy applies several in one second.
    const latestMigration = tables.has("schema_migrations")
      ? db.prepare("SELECT id FROM schema_migrations ORDER BY CAST(id AS INTEGER) DESC, id DESC LIMIT 1").pluck().get() : null;
    return { ok: problems.length === 0, problems, rows, active, latestMigration };
  } catch (e) {
    return { ok: false, problems: [...problems, `read failed: ${e.message}`] };
  } finally { db.close(); }
}

/** Keep the newest `keep` good copies; delete older good ones. FAILED copies are left for inspection. */
export function pruneGood(dir, keep = 8) {
  const good = fs.readdirSync(dir).filter(f => /\.db$/.test(f)).sort().reverse();
  const drop = good.slice(keep);
  for (const f of drop) fs.rmSync(path.join(dir, f));
  return { kept: good.slice(0, keep), deleted: drop };
}

// On Windows the CLI is an npm .cmd shim, which Node only starts through a shell — so the command line is
// built here, each argument quoted, and an argument a shell could reinterpret is refused rather than escaped.
export function shellLine(args) {
  for (const x of args) if (/["%!^&|<>`$\r\n]/.test(x)) throw new Error(`refusing a shell-sensitive argument: ${x}`);
  return ["railway", ...args.map(x => (/\s/.test(x) ? `"${x}"` : x))].join(" ");
}
function railway(args) {
  const isWin = process.platform === "win32";
  const r = isWin ? spawnSync(shellLine(args), { encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 })
                  : spawnSync("railway", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`railway ${args.slice(0, 4).join(" ")} failed: ${(r.stderr || r.stdout || "").trim().slice(0, 300)}`);
  return r.stdout;
}
const jsonFrom = (text) => JSON.parse(text.slice(text.indexOf("{")));

async function main() {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  const dest = path.resolve(flag("dest", path.join(os.homedir(), "draft-backups")));
  const volume = flag("volume", "draft-data");
  const keep = Number(flag("keep", 8)), warnDays = Number(flag("warn-days", 3));
  const inside = refuseInsideRepo(dest);
  if (!inside.ok) { console.error(`REFUSED: ${inside.reason}`); process.exit(2); }

  const listing = jsonFrom(railway(["volume", "files", "--volume", volume, "list", "/backups", "--json"]));
  const newest = newestBackup(listing.files);
  if (!newest) { console.error("No backup database found in /backups on the volume."); process.exit(1); }
  const ageDays = (Date.now() - Date.parse(newest.modifiedAt)) / 86400000;
  console.log(`newest on the volume: ${newest.name} · ${(newest.size / 1048576).toFixed(1)} MB · ${ageDays.toFixed(1)} days old`);
  if (argv.includes("--list")) return;

  fs.mkdirSync(dest, { recursive: true });
  const final = path.join(dest, newest.name);
  if (fs.existsSync(final)) {
    console.log(`already pulled: ${final}`);
  } else {
    const partial = `${final}.partial`;
    fs.rmSync(partial, { force: true });
    railway(["volume", "files", "--volume", volume, "download", newest.path, partial, "--overwrite"]);
    const v = verifyCopy(partial);
    if (!v.ok) {
      fs.renameSync(partial, `${final}.FAILED`);
      for (const side of ["-shm", "-wal"]) fs.rmSync(`${partial}${side}`, { force: true });
      console.error(`⛔ FAILED VERIFICATION — kept as ${final}.FAILED, NOT as a good copy: ${v.problems.join(" · ")}`);
      process.exit(1);
    }
    fs.renameSync(partial, final);
    for (const side of ["-shm", "-wal"]) fs.rmSync(`${partial}${side}`, { force: true });   // opening it left sidecars
    console.log(`verified: integrity ok · ${v.rows} postings (${v.active} active) · last migration ${v.latestMigration} → ${final}`);
  }
  const { kept, deleted } = pruneGood(dest, keep);
  console.log(`kept ${kept.length} good cop${kept.length === 1 ? "y" : "ies"}${deleted.length ? `, deleted ${deleted.length} older` : ""}`);
  if (ageDays > warnDays) console.warn(`⚠ WARNING: the newest backup on the volume is ${ageDays.toFixed(1)} days old (over ${warnDays}) — is the 02:00 backup running?`);
  console.log("⚠ These copies are the production database. Once there are real users, keep this folder on an encrypted disk.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
