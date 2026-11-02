import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

// Owner 11-01: "the trial analytics and user last active on users panel in admin are only updating on admin sign in, i
// have tested it 40 min ago, but the admin panel says last active 50s ago". Measured on production (Railway HTTP log,
// 21:24–22:28Z): one tester tab left open polled /api/trial/state every 45–60 s, and each admin page load sent the
// tester's cookie with /api/auth/me — both moved last_seen_at. And Admin → Trial fetched once, on mount.

const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");

test("lastActiveIgnoresBackgroundReads: polls and the admin page keep a credential alive but never move last active", () => {
  const set = server.slice(at(server, "const BACKGROUND_READS = new Set(["), at(server, "function bindAuthContext("));
  for (const p of ["/api/trial/state", "/api/auth/me", "/api/sync/events"]) assert.ok(set.includes(`"${p}"`), p);
  assert.match(set, /req\.method !== "GET"\) return false/, "a write is always activity");
  assert.match(set, /p\.startsWith\("\/api\/admin\/"\)/, "the admin page's reads are not the user's activity");
  const bind = server.slice(at(server, "function bindAuthContext("), at(server, '"[auth-context] bind failed:"', at(server, "function bindAuthContext(")));
  assert.match(bind, /const background = isBackgroundRead\(req\)/);
  assert.match(bind, /if \(background\) db\.prepare\("UPDATE auth_contexts SET expires_at=\? WHERE token_hash=\?"\)/, "the expiry still slides");
  assert.match(bind, /\} else if \(!background\) \{\n\s+db\.prepare\("UPDATE auth_contexts SET last_seen_at=\?/);
  assert.match(server, /if \(uid && req\.sessionID && !isBackgroundRead\(req\) && Date\.now\(\)/, "the session registry too");
});

test("adminTrialRefreshesLive: every Admin → Trial panel re-reads on a timer while visible, not only on mount", () => {
  const src = fs.readFileSync("client/src/panels/adminTrial.jsx", "utf8");
  assert.match(src, /const LIVE_MS = 30_000;/);
  assert.match(src, /document\.visibilityState === "visible"/);
  assert.equal((src.match(/useLive\(load\);/g) || []).length, 4, "the three panels + 44b People & questions");
  assert.doesNotMatch(src, /useEffect\(\(\) => \{ load\(\); \}, \[load\]\);/);
});
