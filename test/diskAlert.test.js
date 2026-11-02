// Owner 11-02: the volume filled (5.01 of 5 GB) and sign-ups failed with SQLITE_FULL while the only warning was the Admin
// banner. services/diskAlert.js emails the owner past 80%, again at each higher band, and once a day while above.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { checkDiskAlert, bandOf, ALERT_AT, REPEAT_SECONDS } from "../services/diskAlert.js";

const GB = 1e9;
const db0 = () => { const db = new Database(":memory:"); db.exec("CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)"); return db; };
const gauge = (pct) => () => ({ usedPct: pct, usedBytes: pct / 100 * 50 * GB, totalBytes: 50 * GB, freeBytes: (100 - pct) / 100 * 50 * GB });
const quiet = { error: () => {} };

test("diskAlertBands: 80 / 90 / 95, nothing below 80", () => {
  assert.equal(ALERT_AT, 80);
  assert.deepEqual([79.9, 80, 89, 90, 95, 99, NaN].map(bandOf), [null, 80, 80, 90, 95, 95, null]);
});

test("diskAlertSendsOncePerBandAndDaily: crossing sends, the same band waits a day, a higher band sends at once, below clears", async () => {
  const db = db0(), sent = [];
  const send = async (m) => { sent.push(m); return { ok: true }; };
  const run = (pct, now) => checkDiskAlert(db, "/data", { send, to: "owner@example.com", now, readGaugeImpl: gauge(pct), log: quiet });
  const T = 1_800_000_000;
  assert.equal((await run(70, T)).sent, false, "below 80: nothing");
  assert.equal((await run(81, T)).sent, true, "crossing 80 sends");
  assert.match(sent[0].subject, /81% full/);
  assert.match(sent[0].text, /sign-ups and sign-ins fail/);
  assert.equal(sent[0].to, "owner@example.com");
  assert.equal((await run(84, T + 600)).sent, false, "same band, ten minutes later: not again");
  assert.equal((await run(91, T + 1200)).sent, true, "a higher band sends at once");
  assert.equal((await run(92, T + 1200 + REPEAT_SECONDS)).sent, true, "still above a day later: once more");
  await run(60, T + 2 * REPEAT_SECONDS);
  assert.equal((await run(80, T + 2 * REPEAT_SECONDS + 600)).sent, true, "after dropping below, the next crossing alerts at once");
  assert.equal(sent.length, 4);
});

test("diskAlertWithoutEmail: no owner address or no provider still logs the line, and does not retry every check", async () => {
  const db = db0(), lines = [];
  const r = await checkDiskAlert(db, "/data", { to: undefined, now: 1, readGaugeImpl: gauge(97), log: { error: (l) => lines.push(l) } });
  assert.equal(r.band, 95);
  assert.match(lines[0], /^\[disk-alert\] The draft data volume is 97% full/);
  const again = await checkDiskAlert(db, "/data", { to: undefined, now: 601, readGaugeImpl: gauge(97), log: { error: (l) => lines.push(l) } });
  assert.equal(again.reason, "already_alerted");
  assert.equal(lines.length, 1);
});

test("diskAlertWired: server.js checks every 10 minutes and mails ADMIN_OWNER_EMAIL", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /checkDiskAlert\(db, DATA_DIR, \{ send: sendEmail, to: process\.env\.ADMIN_OWNER_EMAIL \}\)/);
  assert.match(src, /\}, DISK_ALERT_EVERY_MS\)\.unref\(\);/);
});
