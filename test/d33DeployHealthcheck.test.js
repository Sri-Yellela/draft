// D33 part 1 — "/extension returns 502" (owner, 10-05).
//
// The app cannot send a 502 for a document: /extension is a client route (App.jsx), the server's
// only handler for it is the SPA catch-all's sendFile, and every 502 server.js writes is under
// /api/. A document 502 carrying `Server: railway-hikari` is Railway's EDGE answering for an
// upstream that is not listening. Two ways that happens, and this pins both shut:
//
//   1. A DEPLOY WITH NO HEALTHCHECK. railway.toml declared none, so Railway made each new
//      deployment active without waiting for it to answer — and the listener is bound at the very
//      end of a ten-thousand-line module, after the migrations and the boot tag pass. 10-05 had
//      three production deploys inside ~70 minutes, the session the owner was testing in.
//   2. A CRASH. No unhandledRejection handler, and Express 4 does not catch a rejected async
//      handler, so one throw anywhere exited the process and every page was a 502 until restart.
//
// ⚠ The SPA catch-all answers 200 for ANY path, so a healthcheck pointed at a path the API does not
// register would pass the instant the listener is up and prove nothing about the API — the
// healthcheck path must be a real /api/ route, registered BEFORE the catch-all, answering JSON.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SERVER = read("server.js");

function deploySection() {
  const toml = read("railway.toml");
  const m = /^\[deploy\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m.exec(toml);
  assert.ok(m, "railway.toml has no [deploy] section");
  return m[1].split("\n").filter(l => !/^\s*#/.test(l)).join("\n");
}

test("D33: railway.toml declares a healthcheck, so a deploy is not routed to before it listens", () => {
  const deploy = deploySection();
  const path = /^healthcheckPath\s*=\s*"([^"]+)"/m.exec(deploy)?.[1];
  assert.ok(path, "railway.toml [deploy] declares no healthcheckPath — every deploy has a 502 window");
  const timeout = Number(/^healthcheckTimeout\s*=\s*(\d+)/m.exec(deploy)?.[1]);
  assert.ok(timeout >= 60, `healthcheckTimeout ${timeout} is too short for a boot that runs migrations`);
});

test("D33: the healthcheck path is a REAL API route, before the SPA catch-all, answering JSON", () => {
  const path = /^healthcheckPath\s*=\s*"([^"]+)"/m.exec(deploySection())[1];
  assert.match(path, /^\/api\//, "a non-/api/ path is answered 200 by the SPA catch-all, whatever the API's state");
  const route = SERVER.indexOf(`app.get("${path}"`);
  const catchAll = SERVER.indexOf(`app.get("*"`);
  assert.ok(route > 0, `server.js registers no app.get("${path}") — the healthcheck would hit the SPA`);
  assert.ok(catchAll > route, "the healthcheck route must be registered before the SPA catch-all");
  const handler = SERVER.slice(route, at(SERVER, "\n", route));
  assert.match(handler, /res\.json\(\{\s*ok\s*:\s*true/, "the healthcheck route must answer JSON { ok: true }");
  // It must not sit behind auth: Railway's probe carries no session.
  assert.doesNotMatch(handler, /requireAuth|requireAdmin/);
});

test("D33: an unhandled rejection is logged, not a process exit (every page 502s until restart)", () => {
  const i = SERVER.indexOf('process.on("unhandledRejection"');
  assert.ok(i > 0, "no unhandledRejection handler — one rejected async route takes the whole site down");
  const body = SERVER.slice(i, at(SERVER, "});", i));
  assert.match(body, /console\.error/);
  assert.doesNotMatch(body, /process\.exit/);
});
