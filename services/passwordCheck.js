// services/passwordCheck.js — ⛔ A190 (46i): the sign-in's password check OFF the main thread.
//
// verifyPassword (services/authSecurity.js) is bcryptjs.compareSync — pure JS, ~55 ms of the ONE main thread per check
// (staging 20f profile: 20 sign-ins = ~1.1 s of `_encipher`). A burst of failed sign-ins (credential stuffing) therefore
// freezes every page for everyone. Here the same compare runs in ONE worker thread; the main thread only waits.
// Same answer as verifyPassword (the worker runs the same bcryptjs compareSync); any worker failure falls back to the
// synchronous check, so a broken worker can never lock anyone out; a malformed hash answers false (it threw before). A
// Pure plumbing — no policy lives here.
import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { verifyPassword } from "./authSecurity.js";

const WORKER_SRC = `
const { parentPort } = require("node:worker_threads");
const bcrypt = require(${JSON.stringify(createRequire(import.meta.url).resolve("bcryptjs"))});
parentPort.on("message", ({ id, password, hash }) => {
  let ok = false, error = null;
  try { ok = typeof password === "string" && typeof hash === "string" && bcrypt.compareSync(password, hash); }
  catch (e) { error = String(e && e.message || e); }
  parentPort.postMessage({ id, ok, error });
});
`;

let worker = null;
let seq = 0;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(WORKER_SRC, { eval: true });
  worker.unref();
  worker.on("message", ({ id, ok, error }) => {
    const p = pending.get(id); if (!p) return;
    pending.delete(id);
    if (error) p.fallback(); else p.resolve(ok);
  });
  const fail = () => { const all = [...pending.values()]; pending.clear(); worker = null; for (const p of all) p.fallback(); };
  worker.on("error", fail);
  worker.on("exit", fail);
  return worker;
}

/** @returns {Promise<boolean>} the same answer as verifyPassword(password, hash), computed off the main thread. */
export function verifyPasswordOffThread(password, hash) {
  if (typeof password !== "string" || typeof hash !== "string") return Promise.resolve(false);
  return new Promise((resolve) => {
    const fallback = () => { try { resolve(verifyPassword(password, hash)); } catch { resolve(false); } };
    let w;
    try { w = ensureWorker(); } catch { return fallback(); }
    const id = ++seq;
    pending.set(id, { resolve, fallback });
    try { w.postMessage({ id, password, hash }); } catch { pending.delete(id); fallback(); }
  });
}

/** Test support: stop the worker (so a test process can exit cleanly). */
export async function stopPasswordWorker() { const w = worker; worker = null; if (w) await w.terminate(); }
