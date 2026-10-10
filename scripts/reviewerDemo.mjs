#!/usr/bin/env node
// scripts/reviewerDemo.mjs — ⭐ D86 §6 · create or reset the connector review's reviewer account on a database file.
//
//   DRAFT_REVIEWER_PASSWORD=… node scripts/reviewerDemo.mjs --db data/resume_master.db seed
//   node scripts/reviewerDemo.mjs --db data/resume_master.db reset
//
// The password comes from the environment, never an argument (it would land in shell history). The same code
// runs behind Admin → System → Plugin (POST /api/admin/byom/reviewer). ⛔ Against PRODUCTION this is a write:
// the owner's go first (WORKLOG O93).
import Database from "better-sqlite3";
import { seedReviewerDemo, resetReviewerDemo, DEMO_USERNAME, DEMO_POSTINGS } from "../services/reviewerDemo.js";

const args = process.argv.slice(2);
const dbPath = args[args.indexOf("--db") + 1];
const action = args.find(a => a === "seed" || a === "reset");
if (!dbPath || args.indexOf("--db") < 0 || !action) {
  console.error("usage: node scripts/reviewerDemo.mjs --db <path> seed|reset   (seed reads DRAFT_REVIEWER_PASSWORD)");
  process.exit(2);
}
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
try {
  const out = action === "reset" ? resetReviewerDemo(db) : seedReviewerDemo(db, { password: process.env.DRAFT_REVIEWER_PASSWORD || null });
  console.log(`${action}: ${DEMO_USERNAME} (user ${out.userId})${out.created ? " created" : ""}; ${out.postings} sample postings, ${DEMO_POSTINGS[0].job_id} … ${DEMO_POSTINGS.at(-1).job_id}`);
} catch (e) {
  console.error(`${action} failed: ${e.message}`);
  process.exitCode = 1;
} finally { db.close(); }
