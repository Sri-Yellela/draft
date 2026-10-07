#!/usr/bin/env node
// D74 P1 · A CLASSIFIER CHANGE, DIFFED AGAINST ONE FIXED FETCH — so "rescued N drops" is never said
// without "and moved M kept postings" beside it.
//
//   node scripts/d74ClassifierDiff.mjs --fetch data/d74-fetch.json --baseline <file>            write the baseline
//   node scripts/d74ClassifierDiff.mjs --fetch data/d74-fetch.json --against <baseline file>   diff the current code
//
// The fetch is scripts/d74DropSample.mjs --save-fetch: every US-admitted posting (title, company, the first
// 600 characters of description — all classifyJob reads). Verdicts are the crawl's: blue → ejected,
// roleKey null → dropped, otherwise kept in a family. Reads and writes files only.
import fs from "node:fs";
import { classifyJob } from "../services/jobs/classifyJob.js";

const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const fetched = JSON.parse(fs.readFileSync(flag("fetch"), "utf8"));
const verdict = (j) => { const v = classifyJob(j.title || "", j.description || "", j.company || ""); return v.collar === "blue" ? "EJECT" : v.roleKey ?? "DROP"; };
const now = Object.fromEntries(fetched.map(j => [j.id, verdict(j)]));

if (flag("baseline")) {
  fs.writeFileSync(flag("baseline"), JSON.stringify(now));
  const tally = {}; for (const v of Object.values(now)) tally[v] = (tally[v] || 0) + 1;
  console.log(JSON.stringify({ postings: fetched.length, tally }));
  process.exit(0);
}
const before = JSON.parse(fs.readFileSync(flag("against"), "utf8"));
const rescued = {}, moved = [], newlyDropped = [], byId = Object.fromEntries(fetched.map(j => [j.id, j]));
for (const [id, v] of Object.entries(now)) {
  const b = before[id];
  if (b === v) continue;
  const t = `${byId[id].company} | ${byId[id].title}`;
  if (b === "DROP") (rescued[v] ??= []).push(t);
  else if (v === "DROP" || v === "EJECT") newlyDropped.push(`${b} → ${v}: ${t}`);
  else moved.push(`${b} → ${v}: ${t}`);
}
const dropsBefore = Object.values(before).filter(v => v === "DROP").length;
const dropsNow = Object.values(now).filter(v => v === "DROP").length;
console.log(JSON.stringify({ postings: fetched.length, dropsBefore, dropsNow,
  rescued: Object.fromEntries(Object.entries(rescued).map(([k, v]) => [k, v.length])),
  movedKept: moved.length, newlyDropped: newlyDropped.length }, null, 1));
if (argv.includes("--list")) {
  for (const [k, v] of Object.entries(rescued)) { console.log(`\n── rescued → ${k} (${v.length})`); v.forEach(t => console.log("  " + t)); }
  if (moved.length) { console.log(`\n── kept, family CHANGED (${moved.length})`); moved.forEach(t => console.log("  " + t)); }
  if (newlyDropped.length) { console.log(`\n── kept → now DROPPED (${newlyDropped.length})`); newlyDropped.forEach(t => console.log("  " + t)); }
}
