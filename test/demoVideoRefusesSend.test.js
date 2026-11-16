// ⛔ 46q · the demo recorder (scripts/demoVideo.mjs) runs on PRODUCTION on a real, signed-in account — it must never be
// able to send, approve or submit anything (D36: the person sends), and never overwrite the old video. Source pins (the
// script runs at import, so it is read, not imported).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const src = fs.readFileSync("scripts/demoVideo.mjs", "utf8").replace(/\r\n/g, "\n");

test("46q demoVideo — every write that is not on the four-entry allow-list is aborted; send / approve / submit never pass", () => {
  assert.match(src, /if \(m === "GET" \|\| m === "HEAD" \|\| m === "OPTIONS" \|\| u\.origin !== host\.origin\) return req\.continue\(\);/);
  assert.match(src, /aborted\.push\(`\$\{m\} \$\{u\.pathname\}`\); return req\.abort\("blockedbyclient"\);/);
  const start = at(src, "export const ALLOWED_WRITES = ["), list = src.slice(start, at(src, "];", start));
  const routes = [...list.matchAll(/re: (\/[^,]+\/),/g)].map(m => m[1]).join(" ");
  assert.equal((list.match(/\{ method: /g) || []).length, 4, "four allowed writes");
  assert.doesNotMatch(routes, /approve|submit|send|answers|handoff|run-now/i, "no allowed route can send");
  const NEVER = new RegExp(src.match(/export const NEVER = \/(.+)\/i;/)[1], "i");
  for (const p of ["/api/apply/approve", "/api/portals/approve/12", "/api/apply/handoff/submitted", "/api/apply/run-now", "/api/apply/answers", "/api/apply/send-all"]) assert.ok(NEVER.test(p), p);
  assert.match(src, /!\(isDraft && \(NO_DRAFT \|\| allowed\.some\(a => a === "POST \/api\/apply\/runs"\)\)\)/, "one Draft at most");
  assert.match(src, /if \(bad\.length\) \{[\s\S]{0,240}?process\.exit\(1\); \}/, "exits 1 when the page tried to send");
});

test("46q demoVideo — production or loopback only, a signed-in profile, and the old video is kept", () => {
  assert.match(src, /host\.origin === "https:\/\/jobsviadraft\.com" \|\| \/\^\(127\\\.0\\\.0\\\.1\|localhost\)\$\/\.test\(host\.hostname\)/);
  assert.match(src, /if \(fs\.existsSync\(OUT\)\) \{ console\.error\(`REFUSING: \$\{OUT\} exists/);
  assert.match(src, /if \(!me\.authenticated\) \{ console\.error\("REFUSING: the profile is signed out/);
  assert.doesNotMatch(src, /password/i.test(src.replace(/never sees a password/, "")) ? /type\([^)]*password/i : /$^/, "never types a password");
});
