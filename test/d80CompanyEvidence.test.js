// ⛔ D80 · WHICH COMPANIES — hiring evidence, never list membership. Each red when removed:
// no company is added without a stored evidence record · a portfolio / VC board and a staffing agency are refused
// (and a real company whose slug merely contains a word is not) · a company with no in-scope postings, or none
// recent, is not admitted · a company not on the owner's approved list is refused · the apply generator puts ONLY
// approved, admitted, un-held companies in the module it writes · the probe never writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { addCompany, excludedCompany, admitFromProbe, evidenceLine } from "../services/companyList.js";

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const live = (o = {}) => ({ atsType: "ashby", slug: "acme", company: "Acme", state: "live", csOpen: 8, cs: 6, pct30: 50, pct120: 75, ...o });

test("⛔ D80: no company is added without a stored evidence record — and the record is stored", () => {
  const db = db0();
  assert.equal(addCompany(db, { company: "Acme", atsType: "ashby", slug: "acme" }).code, "evidence_required");
  assert.equal(addCompany(db, { company: "Acme", atsType: "ashby", slug: "acme", evidence: "   " }).code, "evidence_required");
  assert.equal(db.prepare("SELECT COUNT(*) FROM company_ats_list WHERE ats_slug = 'acme'").pluck().get(), 0, "nothing was written");
  const ev = evidenceLine(live(), { source: "hn 2026-10, 4 months hiring", date: "2026-10-08" });
  const r = addCompany(db, { company: "Acme", atsType: "ashby", slug: "acme", evidence: ev });
  assert.equal(r.ok, true);
  assert.equal(r.company.evidence, "hn 2026-10, 4 months hiring; probe 2026-10-08: 6 in-scope <= 120d of 8 in-scope open, 75% <= 120d, 50% <= 30d");
});

test("⛔ D80: a portfolio / VC board and a staffing agency are refused — one slug, many employers corrupts attribution", () => {
  for (const slug of ["Pear-VC", "pearvc", "acme-ventures", "foo_portfolio", "ycombinator", "bar-accelerator"]) {
    assert.equal(excludedCompany({ company: "X", slug }), "portfolio_board", slug);
  }
  for (const company of ["Acme Staffing", "Prime Recruiting Group", "Apex Talent Solutions", "North Search Partners"]) {
    assert.equal(excludedCompany({ company, slug: "acme" }), "staffing_agency", company);
  }
  for (const [company, slug] of [["Capital One", "capitalone"], ["Venturo", "venturo"], ["Recruitee", "recruitee"], ["Ramp", "ramp"]]) {
    assert.equal(excludedCompany({ company, slug }), null, `${company} is a real employer`);
  }
  const db = db0();
  assert.equal(addCompany(db, { company: "Phaselaw", atsType: "ashby", slug: "Pear-VC", evidence: "hn" }).code, "portfolio_board");
});

test("⛔ D80: a company with no in-scope postings, or none recent, is not admitted; the owner's bar is honoured", () => {
  assert.deepEqual(admitFromProbe(live({ csOpen: 0, cs: 0 })), { admit: false, reason: "no_in_scope_postings" });
  assert.deepEqual(admitFromProbe(live({ csOpen: 5, cs: 0 })), { admit: false, reason: "none_recent" });
  assert.deepEqual(admitFromProbe(live({ state: "dead" })), { admit: false, reason: "board_dead" });
  assert.deepEqual(admitFromProbe(live({ state: "empty", csOpen: 0, cs: 0 })), { admit: false, reason: "board_empty" });
  assert.deepEqual(admitFromProbe(live()), { admit: true, reason: "ok" });
  assert.deepEqual(admitFromProbe(live({ cs: 3 }), { minRecent: 5 }), { admit: false, reason: "too_few_recent" });
});

test("⛔ D80: a company not on the owner's approved list is refused", () => {
  const approved = new Set(["ashby:acme"]);
  assert.equal(admitFromProbe(live(), { approved }).admit, true);
  assert.deepEqual(admitFromProbe(live({ slug: "other" }), { approved }), { admit: false, reason: "not_approved" });
});

test("⛔ D80: the apply generator writes ONLY approved, admitted, un-held companies into the module", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d80-"));
  try {
    const w = (n, v) => { const p = path.join(dir, n); fs.writeFileSync(p, JSON.stringify(v)); return p; };
    const approvedFile = w("approved.json", [
      { company: "Acme", ats_type: "ashby", ats_slug: "acme" },
      { company: "Held Co", ats_type: "ashby", ats_slug: "held" },
      { company: "Stale Co", ats_type: "ashby", ats_slug: "stale" },
      { company: "Remote (US) Close (https://close.com)", ats_type: "ashby", ats_slug: "close" },
    ]);
    const probeFile = w("probe.json", [live(), live({ slug: "held", company: "Held Co" }), live({ slug: "stale", cs: 0 }),
      live({ slug: "close" }), live({ slug: "intruder", company: "Not Approved" })]);
    const namesFile = w("names.json", { "ashby:close": "Close" });
    const out = path.join(dir, "module.mjs");
    execFileSync(process.execPath, ["scripts/d80ApplyTranche.mjs", "--approved", approvedFile, "--probe", probeFile,
      "--names", namesFile, "--hold", "ashby:held", "--out", out], { stdio: "pipe" });
    const T = JSON.parse(fs.readFileSync(out, "utf8").match(/^const T = (.*);$/m)[1]);
    assert.deepEqual(T.map((t) => `${t.slug}=${t.company}`).sort(), ["acme=Acme", "close=Close"]);
    assert.ok(T.every((t) => t.evidence && t.evidence.includes("probe")), "every add carries its evidence line");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("⛔ D80: the probe never writes — no database handle, no insert, no file write", () => {
  const src = fs.readFileSync("scripts/d78TrancheProbe.mjs", "utf8");
  assert.doesNotMatch(src, /better-sqlite3|new Database|addCompany|INSERT|UPDATE|DELETE|writeFile|appendFile/);
});

test("D80: migration 147 adds company_ats_list.evidence", () => {
  const db = db0();
  assert.ok(db.prepare("PRAGMA table_info(company_ats_list)").all().some((c) => c.name === "evidence"));
});
