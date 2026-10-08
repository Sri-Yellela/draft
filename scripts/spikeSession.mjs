// scripts/spikeSession.mjs — ⛔ D79 S0.2 · the spike's shared pieces: seal / open a captured session, and the
// guard that keeps the file OUT of any repository. Used by spikeCaptureSession.mjs and spikeReplaySession.mjs.
//
// The spike answers APPLY_WORKER.md §8.1–8.2 cheaply: does a session the owner signed into by hand survive
// being replayed — same machine, then a datacenter box? ⛔ Nothing here uploads anything, to draft or anywhere.
//   · The file is sealed with the repo's one AES-256-GCM box (services/secretBox.js — built once), under a key
//     derived from a passphrase the owner types (scrypt). The passphrase is read from the terminal with echo
//     off, never from argv (argv is visible to every process on the machine).
//   · ⛔ The destination must be OUTSIDE every git work tree — not just this one. A gitignore entry is a guard
//     someone can edit away (CLAUDE.md); a path outside the tree cannot be committed by accident.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createSecretBox } from "../services/secretBox.js";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MIN_PASSPHRASE = 12;
const KDF = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const FORMAT = "draft-spike-session/1";

function keyFrom(passphrase, salt, kdf = KDF) {
  if (typeof passphrase !== "string" || passphrase.length < MIN_PASSPHRASE) {
    throw new Error(`the passphrase must be at least ${MIN_PASSPHRASE} characters`);
  }
  return crypto.scryptSync(passphrase, salt, 32, kdf);
}

/** Seal a session object. Only the format, the KDF parameters and the origins are readable without the passphrase. */
export function sealSession(session, passphrase) {
  const salt = crypto.randomBytes(16);
  const box = createSecretBox(keyFrom(passphrase, salt));
  const { enc, iv, tag } = box.encrypt(JSON.stringify(session));
  return JSON.stringify({ format: FORMAT, kdf: { name: "scrypt", N: KDF.N, r: KDF.r, p: KDF.p, salt: salt.toString("base64") },
    origins: session.origins || [], capturedAt: session.capturedAt || null, enc, iv, tag });
}

/** Open a sealed session. A wrong passphrase or a tampered file throws (GCM's tag), never returns garbage. */
export function openSession(text, passphrase) {
  const f = JSON.parse(text);
  if (f.format !== FORMAT) throw new Error(`not a spike session file (format ${f.format})`);
  const key = keyFrom(passphrase, Buffer.from(f.kdf.salt, "base64"), { N: f.kdf.N, r: f.kdf.r, p: f.kdf.p, maxmem: KDF.maxmem });
  try { return JSON.parse(createSecretBox(key).decrypt(f.enc, f.iv, f.tag)); }
  catch { throw new Error("wrong passphrase, or the file was changed"); }
}

function insideGitTree(dir) {
  try {
    execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch { return false; }
}

const under = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/**
 * ⛔ Refuse a destination inside this repository or inside ANY git work tree. Resolves the nearest existing
 * ancestor through realpath, so a symlink or junction into the repo is caught too.
 */
export function assertOutsideRepo(dest, { repoRoot = REPO_ROOT, gitCheck = insideGitTree } = {}) {
  const abs = path.resolve(dest);
  let probe = path.dirname(abs);
  while (!fs.existsSync(probe) && path.dirname(probe) !== probe) probe = path.dirname(probe);
  const real = fs.realpathSync.native(probe);
  const root = fs.realpathSync.native(repoRoot);
  if (under(abs, repoRoot) || under(real, root)) throw new Error(`refused: ${abs} is inside the repository — a session file never goes in a repo`);
  if (gitCheck(real)) throw new Error(`refused: ${abs} is inside a git work tree — choose a folder no repository contains`);
  return abs;
}

/** Write the sealed file, owner-only where the platform honours modes. Refuses to overwrite unless asked. */
export function writeSealed(dest, sealed, { force = false } = {}) {
  const abs = assertOutsideRepo(dest);
  if (fs.existsSync(abs) && !force) throw new Error(`refused: ${abs} exists — pass --force to replace it`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, sealed, { mode: 0o600 });
  return abs;
}

/** Read a line from the terminal with echo OFF. Throws when there is no terminal (a pipe would leak it to logs). */
export function promptHidden(question, { input = process.stdin, output = process.stderr } = {}) {
  if (!input.isTTY) return Promise.reject(new Error("a passphrase needs a terminal — run this in an interactive shell"));
  return new Promise((resolve, reject) => {
    output.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let buf = "";
    const done = (err) => { input.setRawMode(false); input.pause(); input.removeListener("data", onData); output.write("\n"); err ? reject(err) : resolve(buf); };
    const onData = (s) => {
      for (const ch of s) {
        if (ch === "\r" || ch === "\n") return done();
        if (ch === "\u0003") return done(new Error("cancelled"));
        if (ch === "\u007f" || ch === "\b") buf = buf.slice(0, -1);
        else buf += ch;
      }
    };
    input.on("data", onData);
  });
}

/** Wait for Enter (echo on — nothing secret is typed here). */
export function waitForEnter(question, { input = process.stdin, output = process.stderr } = {}) {
  return new Promise((resolve) => { output.write(question); input.resume(); input.once("data", () => { input.pause(); resolve(); }); });
}

/** A cookie belongs to an origin when its domain is the origin's host or a parent of it. */
export function cookieMatches(cookie, origins) {
  const d = String(cookie.domain || "").replace(/^\./, "").toLowerCase();
  return origins.some((o) => { const h = new URL(o).hostname.toLowerCase(); return h === d || h.endsWith(`.${d}`); });
}

/** What may be printed about a session: counts and names' count only — never a value. */
export function describeSession(s) {
  return { origins: s.origins, capturedAt: s.capturedAt, cookies: s.cookies.length,
           localStorage: Object.fromEntries(Object.entries(s.localStorage || {}).map(([o, kv]) => [o, Object.keys(kv).length])) };
}
