import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import portalRoutes, { createApplyWorkerRouter } from "../routes/applyWorker.js";
import { enqueueRemoteRun } from "../services/applyWorker.js";
import { createKeyStore, seal, verifyMinted, aadFor } from "../apply-worker/lib/keys.js";
import { auditEnvironment } from "../apply-worker/lib/env.js";
import { reportFor, fieldList } from "../apply-worker/lib/run.js";
import { createWorker } from "../apply-worker/worker.js";

// ⭐ D100 P1 / P2 (owner 10-30) · the apply worker SERVICE: its key store, its environment, its one fill engine,
// and a run end to end against draft's real routes with a stand-in browser. Synthetic people, portals and cookies.

const master = crypto.randomBytes(32);
const tmpKeys = () => fs.mkdtempSync(path.join(os.tmpdir(), "awkeys-"));
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("D100 P1 · a minted key is signed by the identity the app pins; sealed in the app, opened only here", () => {
  const dir = tmpKeys();
  const keys = createKeyStore({ dir, master });
  const m = keys.mint("exampleportal");
  assert.equal(verifyMinted(m), true);
  assert.equal(verifyMinted({ ...m, portalFamily: "other" }), false, "the signature binds the portal");
  const aad = aadFor({ userId: 1, portalFamily: "exampleportal" });
  const state = JSON.stringify({ cookies: [{ name: "sid", value: "synthetic", domain: ".portal.example.test" }] });
  const sealed = seal({ publicKey: m.publicKey, keyId: m.keyId, plaintext: state, aad });
  assert.doesNotMatch(sealed, /synthetic/);
  assert.equal(keys.unseal({ keyId: m.keyId, sealed, aad }), state);
  assert.throws(() => keys.unseal({ keyId: m.keyId, sealed, aad: aadFor({ userId: 2, portalFamily: "exampleportal" }) }),
    "sealed for user 1 — cannot be opened as user 2's");
  // the identity survives a restart; nothing on disk is a readable private key
  assert.equal(createKeyStore({ dir, master }).identity(), keys.identity());
  for (const f of fs.readdirSync(dir)) assert.doesNotMatch(fs.readFileSync(path.join(dir, f), "utf8"), /PRIVATE KEY|synthetic/, f);
  assert.throws(() => createKeyStore({ dir, master: crypto.randomBytes(32) }), "another master key cannot open the store");
});

test("D100 · d100RevokeMakesUnreadable (worker side) — a destroyed key opens nothing, ever", () => {
  const keys = createKeyStore({ dir: tmpKeys(), master });
  const m = keys.mint("exampleportal");
  const aad = aadFor({ userId: 1, portalFamily: "exampleportal" });
  const sealed = seal({ publicKey: m.publicKey, keyId: m.keyId, plaintext: "{}", aad });
  assert.equal(keys.destroy(m.keyId), true);
  assert.throws(() => keys.unseal({ keyId: m.keyId, sealed, aad }), /destroyed/);
  assert.equal(keys.destroy(m.keyId), false);
  assert.throws(() => keys.destroy("../identity"), /bad key id/);
});

test("D100 · d100WorkerHasNoDbCredentials — the worker refuses draft's secrets and carries no database code", () => {
  assert.equal(auditEnvironment({ APPLY_WORKER_TOKEN: "x", APPLY_WORKER_MASTER_KEY: "x", PATH: "/bin" }).ok, true);
  for (const k of ["DATABASE_PATH", "DATA_DIR", "ANTHROPIC_KEY", "SESSION_SECRET", "CRAWLER_TOKEN", "RESEND_API_KEY", "SQLITE_FILE"]) {
    assert.deepEqual(auditEnvironment({ [k]: "x" }).unexpected, [k], k);
  }
  const src = fs.readdirSync("apply-worker", { recursive: true }).filter(f => /\.(js|mjs)$/.test(f))
    .map(f => read(path.join("apply-worker", f))).join("\n");
  assert.doesNotMatch(src, /better-sqlite3|from ["']\.\.\/server\.js|scripts\/migrations|\.prepare\(/);
  const docker = read("apply-worker/Dockerfile");
  const copies = docker.split("\n").filter(l => /^COPY /.test(l)).join("\n");
  assert.doesNotMatch(copies, /server\.js|routes\/|scripts\/|data\/|COPY \. /, "only the fill engine's closure is copied");
});

// Every relative import, recursively, from the worker's entry — what the image must carry.
function importClosure(entry) {
  const seen = new Set();
  const walk = (file) => {
    const f = path.normalize(file);
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of read(f).matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["'](\.{1,2}\/[^"']+)["']|import\(["'](\.{1,2}\/[^"']+)["']\)/g)) {
      walk(path.join(path.dirname(f), m[1] || m[2]));
    }
  };
  walk(entry);
  return [...seen].map(f => f.replace(/\\/g, "/"));
}

test("D100 · d100OneFillEngine — the worker imports draft's autoApply, copies none of it, and its image carries the whole closure", () => {
  const worker = read("apply-worker/worker.js");
  assert.match(worker, /await import\("\.\.\/services\/applyAutomation\.js"\)/);
  const own = fs.readdirSync("apply-worker/lib").map(f => read(path.join("apply-worker/lib", f))).join("\n") + worker;
  assert.doesNotMatch(own, /function (buildAnswers|discoverFields|detectGate|refuseReason|driftFromApproved)\b/, "no second fill engine");
  const docker = read("apply-worker/Dockerfile");
  const copied = [...docker.matchAll(/^COPY (?!--)(.+) \.\/[^\n]*$/gm)].flatMap(m => m[1].split(/\s+/));
  const closure = importClosure("apply-worker/worker.js");
  for (const f of closure) {
    const inImage = f.startsWith("apply-worker/") || copied.includes(f);
    assert.ok(inImage, `${f} is imported by the worker but not copied into its image`);
  }
  assert.ok(closure.includes("services/applyAutomation.js"));
});

test("D100 · the engine's result → the report: field list, no pixels, the stop named", () => {
  const lease = { id: 7, mode: "fill" };
  const answers = [{ field_id: "fn", label: "First name", value: "Dana", provenance: "handler_exact" },
    { field_id: "q1", label: "Years with Rust?", value: "3", provenance: "label_fuzzy" }, { field_id: "x", value: null, skipped: true }];
  const filled = reportFor(lease, { status: "preview_ready", answers, screenshotBase64: "iVBOR...", screenshotPath: "/tmp/a.png" });
  assert.equal(filled.outcome, "filled");
  assert.deepEqual(filled.fields, [{ key: "fn", label: "First name", value: "Dana", source: "profile" },
    { key: "q1", label: "Years with Rust?", value: "3", source: null }], "a guess has no source (D104)");
  assert.doesNotMatch(JSON.stringify(filled), /iVBOR|screenshot|\.png/);
  assert.equal(reportFor(lease, { status: "held_gate", reasonCode: "captcha_required" }).reason, "human_check");
  assert.equal(reportFor(lease, { status: "held_gate", reasonCode: "login_required" }).reason, "signed_out");
  assert.equal(reportFor(lease, { status: "held_review", openQuestions: [{ question: "I agree to the privacy policy" }] }).reason, "consent_required");
  assert.equal(reportFor(lease, { status: "held_review", openQuestions: [{ question: "Will you require visa sponsorship?" }] }).reason, "eligibility_unanswered");
  assert.equal(reportFor({ id: 7, mode: "submit" }, { status: "held_review", reasonCode: "answers_changed_since_approval" }).reason, "value_mismatch");
  assert.equal(reportFor({ id: 7, mode: "submit" }, { status: "submitted", answers }).outcome, "submitted");
  assert.deepEqual(fieldList(null), []);
});

test("D100 · end to end: seal → upload → a gated job → the worker fills (SEMI) → approve → the worker submits the SAME values", async () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO')").run();
  const TOKEN = "k".repeat(40);
  const keys = createKeyStore({ dir: tmpKeys(), master });
  const app = express();
  app.use("/api/worker", createApplyWorkerRouter(db, { env: { APPLY_WORKER_TOKEN: TOKEN },
    payloadFor: () => ({ first_name: "Dana" }), resumePdf: async () => Buffer.from("%PDF-synthetic") }));
  app.use(express.json({ limit: "3mb" }));
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  portalRoutes(app, db, (_q, _r, n) => n(), { client: { mintKey: async (f) => keys.mint(f), destroyKey: async (k) => keys.destroy(k) } });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // the app: mint, VERIFY against the pinned identity, seal, upload
    const minted = await (await fetch(base + "/api/portals/connect/start", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ portalFamily: "exampleportal" }) })).json();
    assert.equal(minted.identity, keys.identity());
    assert.equal(verifyMinted(minted), true);
    const state = { cookies: [{ name: "sid", value: "synthetic-cookie", domain: ".portal.example.test", path: "/" }] };
    const ciphertext = seal({ publicKey: minted.publicKey, keyId: minted.keyId, plaintext: JSON.stringify(state),
      aad: aadFor({ userId: 1, portalFamily: "exampleportal" }) });
    const up = await fetch(base + "/api/portals/upload", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ portalFamily: "exampleportal", originHost: "portal.example.test", keyId: minted.keyId, ciphertext, consent: true }) });
    assert.equal(up.status, 201);
    assert.doesNotMatch(JSON.stringify(db.prepare("SELECT * FROM portal_sessions").all()), /synthetic-cookie/, "draft holds ciphertext only");

    // a run held at the portal's sign-in wall, with its packet
    const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'required')").run().lastInsertRowid;
    const rj = Number(db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code) VALUES (?,1,'wd::e2e','held_gate','login_required')").run(run).lastInsertRowid);
    db.prepare("INSERT INTO application_records (user_id, job_id, state, origin) VALUES (1,'wd::e2e','pending','drafted')").run();
    const packetId = Number(db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at, resume_artifact_id)
      VALUES (1,?,?,'wd::e2e','https://acme.portal.example.test/apply/9','https://acme.portal.example.test','login_required','{"answers":[]}','he2e',0,5)`).run(run, rj).lastInsertRowid);
    assert.ok(enqueueRemoteRun(db, { userId: 1, runJobId: rj, packetId, applyUrl: "https://acme.portal.example.test/apply/9", approvalMode: "required" }));

    const calls = [];
    const autoApply = async (url, data, opts) => {
      calls.push({ url, data, opts, resumeExists: !!opts.resumePath && fs.existsSync(opts.resumePath) });
      const answers = [{ field_id: "fn", label: "First name", value: data.first_name, provenance: "handler_exact" }];
      return opts.mode === "preview" ? { status: "preview_ready", answers } : { status: "submitted", answers, submitEvidence: "confirmation_page" };
    };
    const worker = createWorker({ base, token: TOKEN, keys, autoApply, workerId: "w-e2e", log: () => {} });
    const t1 = await worker.tick();
    assert.equal(t1.report.outcome, "filled");
    assert.equal(t1.answer.body.state, "ready_to_approve");
    assert.equal(calls[0].opts.mode, "preview");
    assert.deepEqual(calls[0].opts.storageState, state, "the session reached the engine in memory");
    assert.equal(calls[0].opts.storageStatePath, undefined, "never as a file");
    assert.equal(calls[0].resumeExists, true);
    assert.equal(fs.existsSync(calls[0].opts.resumePath), false, "the résumé temp file is gone after the run");

    assert.equal((await fetch(`${base}/api/portals/approve/${rj}`, { method: "POST" })).status, 200);
    const t2 = await worker.tick();
    assert.equal(calls[1].opts.mode, "full");
    assert.deepEqual(calls[1].opts.approvedAnswers, [{ field_id: "fn", value: "Dana" }], "the engine's drift check gets the approved values");
    assert.equal(t2.answer.body.state, "submitted");
    assert.deepEqual(db.prepare("SELECT status, submitted_by FROM apply_run_jobs WHERE id=?").get(rj), { status: "submitted", submitted_by: "user" });
    assert.deepEqual(await worker.tick(), { idle: true });

    // revoke: the key is destroyed in the worker's store — the stored ciphertext can never be opened again
    const sid = db.prepare("SELECT id FROM portal_sessions").pluck().get();
    assert.equal((await (await fetch(`${base}/api/portals/${sid}`, { method: "DELETE" })).json()).keyDestroyed, true);
    assert.throws(() => keys.unseal({ keyId: minted.keyId, sealed: ciphertext, aad: aadFor({ userId: 1, portalFamily: "exampleportal" }) }), /destroyed/);
  } finally { server.close(); }
});
