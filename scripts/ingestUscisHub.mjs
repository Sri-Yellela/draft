// scripts/ingestUscisHub.mjs — ⭐ D108 P1 · import the USCIS H-1B Employer Data Hub, then re-run the ONE LCA resolution
// so each company's approvals are rolled up through the entities it already matched (services/kb/uscisHub.js).
//
// ⛔ The downloaded files are DATA and never go in the repository: keep them in a folder outside it (--cache).
//
// Usage:
//   node scripts/ingestUscisHub.mjs --download=2021,2022,2023 --cache=<dir outside the repo>
//        fetch the archive CSVs (https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-<FY>.csv),
//        streaming to disk; the file date is the server's Last-Modified
//   node scripts/ingestUscisHub.mjs <file.csv> [more.csv] [--file-date=YYYY-MM-DD] [--source-url=https://…]
//        a file already on disk — e.g. a Crosstab View export from the hub's page (FY2024+ are only there); the file
//        date defaults to the file's modified time, the source URL to the hub's page
//   --db=<path>      the database (default data/resume_master.db)
//   --no-reconcile   import only; the roll-up happens at the next reconcile
import "dotenv/config";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHubFile, writeHubFile, downloadHubYear, HUB_PAGE_URL } from "../services/kb/uscisHub.js";
import { reconcileCompanyLca } from "../services/kb/lcaLayer.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, dflt = null) => { const hit = argv.find(a => a.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : dflt; };
const flag = (name) => argv.includes(`--${name}`);
const log = (...a) => console.log("[uscis-hub]", ...a);

async function main() {
  const db = new Database(opt("db", path.join(ROOT, "data", "resume_master.db")));
  const jobs = [];
  const years = opt("download");
  if (years) {
    const cache = opt("cache");
    if (!cache) throw new Error("--download needs --cache=<a folder outside the repository>");
    if (path.resolve(cache).startsWith(path.resolve(ROOT))) throw new Error("--cache must be OUTSIDE the repository — the files are data");
    for (const fy of years.split(",").map(s => Number(s.trim())).filter(Number.isInteger)) {
      const d = await downloadHubYear(fy, cache);
      log(`fetched FY${fy}: ${(d.bytes / 1048576).toFixed(1)} MB, dated ${d.fileDate ?? "?"}`);
      jobs.push(d);
    }
  }
  for (const f of argv.filter(a => !a.startsWith("--"))) {
    const st = fs.statSync(f);
    jobs.push({ file: f, sourceUrl: opt("source-url", HUB_PAGE_URL), fileDate: opt("file-date", st.mtime.toISOString().slice(0, 10)), bytes: st.size });
  }
  if (!jobs.length) throw new Error("nothing to import — pass a file or --download=<fiscal years>");

  for (const j of jobs) {
    const t = Date.now();
    const parsed = await parseHubFile(j.file);
    const { employerRows } = writeHubFile(db, { fileName: path.basename(j.file), sourceUrl: j.sourceUrl, fileDate: j.fileDate, byteSize: j.bytes, parsed });
    const approvals = parsed.employers.reduce((n, e) => n + e.approvals, 0);
    const denials = parsed.employers.reduce((n, e) => n + e.denials, 0);
    log(`${path.basename(j.file)}: ${parsed.layout} layout, FY ${parsed.fiscalYears.join(",")}, ${parsed.rows} rows ` +
        `(${parsed.unnamed} unnamed), ${employerRows} employer-years, ${approvals} approvals / ${denials} denials, ${Date.now() - t} ms`);
  }
  if (!flag("no-reconcile")) {
    const summary = reconcileCompanyLca(db);
    log("reconciled:", JSON.stringify(summary));
  }
  db.close();
}

main().catch(e => { console.error("[uscis-hub] FAILED:", e.message); process.exit(1); });
