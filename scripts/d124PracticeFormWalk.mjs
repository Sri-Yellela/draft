#!/usr/bin/env node
// D124 · THE PRACTICE FORM, FILLED BY THE REAL ENGINE IN A REAL CHROME — the sample-résumé path end to end, locally.
//
// A sample résumé's Draft is sent to draft's practice form instead of the employer (services/trial.js trialSendUrl). This
// proves the engine that fills real Greenhouse forms fills and submits that one: it serves the REAL practice form
// (routes/trial.js) on localhost from an in-memory database, then runs services/applyAutomation.js autoApply against it
//   1. mode "semi"  — fill and STOP at review (a new user's mode): nothing may be recorded;
//   2. mode "full"  — fill and submit (what an Approve does): ONE submission recorded, with the résumé attached, and the
//                     confirmation handed to the Inbox.
// Assertions are on what the FORM RECORDED, never on the run's own status. Nothing leaves this machine.
//
// Usage: node scripts/d124PracticeFormWalk.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import multer from "multer";
import Database from "better-sqlite3";
import { MIGRATIONS } from "./migrations.js";
import trialRoutes from "../routes/trial.js";
import { practiceUrlFor, samples } from "../services/trial.js";
import { autoApply } from "../services/applyAutomation.js";

process.env.DRAFT_TRIAL = "on";
const SECRET = "walk-secret";
const db = new Database(":memory:");
for (const m of MIGRATIONS) db.exec(m.sql);
db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'walk-tester', 'x')").run();
db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, apply_url)
            VALUES ('gh::walk', 'q', 'h', 'Backend Engineer', 'Acme Robotics', 'https://boards.greenhouse.io/acme/jobs/1', 'https://boards.greenhouse.io/acme/jobs/1')`).run();

const delivered = [];
const app = express();
trialRoutes(app, db, { requireAuth: (_q, r) => r.status(401).end(), requireAdmin: (_q, r) => r.status(403).end(), secret: SECRET,
  upload: multer({ storage: multer.memoryStorage() }), deliver: (m) => delivered.push(m) });
const server = http.createServer(app);
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const url = practiceUrlFor({ baseUrl: base, secret: SECRET, userId: 1, jobId: "gh::walk" });

const RESUME = path.join(os.tmpdir(), "d124-walk-resume.pdf");
fs.writeFileSync(RESUME, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const c = samples().A.candidate;
const [first, ...rest] = c.fullName.split(" ");
const PAYLOAD = {
  field_map: { first_name: first, last_name: rest.join(" "), full_name: c.fullName, email: c.email, phone: c.phone,
               location: c.location, linkedin: c.linkedinUrl, linkedin_url: c.linkedinUrl, website: c.githubUrl },
  handler_map: {}, custom_answers: {},
};

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); if (!ok) failed++; };
const count = () => db.prepare("SELECT COUNT(*) n FROM practice_submissions").get().n;
const sum = (r) => `status=${r.status} reason=${r.reasonCode ?? "-"} filled=${r.fieldsFilled} verified=${r.submitVerified ?? "-"} evidence=${r.submitEvidence ?? "-"}`;

try {
  console.log(`practice form: ${url.replace(/t=[^&]+/, "t=…")}`);
  const semi = await autoApply(url, PAYLOAD, { mode: "semi", jobId: "d124-semi", platform: "greenhouse", resumePath: RESUME });
  console.log(`semi: ${sum(semi)}`);
  check("semi fills the form", (semi.fieldsFilled ?? 0) >= 3, `fieldsFilled=${semi.fieldsFilled}`);
  check("semi stops at review — nothing recorded", count() === 0, `${count()} recorded`);

  const full = await autoApply(url, PAYLOAD, { mode: "full", jobId: "d124-full", platform: "greenhouse", resumePath: RESUME });
  console.log(`full: ${sum(full)}`);
  const row = db.prepare("SELECT user_id, job_id, fields_filled, resume_attached FROM practice_submissions").get();
  check("full submits — the practice form RECORDED one submission", count() === 1, `${count()} recorded`);
  check("for this account and posting", row?.user_id === 1 && row?.job_id === "gh::walk", JSON.stringify(row));
  check("with the résumé attached", row?.resume_attached === 1);
  check("and the name, email (and more) filled", (row?.fields_filled ?? 0) >= 3, `fields_filled=${row?.fields_filled}`);
  check("the confirmation went to the Inbox", delivered.length === 1 && /Acme Robotics/.test(delivered[0]?.subject || ""), delivered[0]?.subject);
  check("the run reports it submitted", full.status === "submitted", sum(full));
} catch (e) {
  console.error("walk failed:", e?.stack || e);
  failed++;
} finally {
  server.close();
}
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
