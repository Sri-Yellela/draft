import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hashPassword, verifyPassword } from "../services/authSecurity.js";
import { verifyPasswordOffThread, stopPasswordWorker } from "../services/passwordCheck.js";

// ⛔ A190 (46i): sign-in's bcryptjs compare (~55 ms each) ran on the one main thread — staging 20f: 20 sign-ins ≈ 1.1 s;
// a burst of failed sign-ins froze every page. It now runs in a worker thread. Synthetic passwords.

test("a190: the off-thread check answers exactly as verifyPassword", async () => {
  const h = hashPassword("correct horse battery");
  for (const [pw, hash] of [["correct horse battery", h], ["wrong horse battery", h], ["", h]]) {
    assert.equal(await verifyPasswordOffThread(pw, hash), verifyPassword(pw, hash), pw);
  }
  assert.equal(await verifyPasswordOffThread("x", "not-a-bcrypt-hash"), false, "a malformed hash is a no, never a throw");
  assert.equal(await verifyPasswordOffThread(null, h), false);
  await stopPasswordWorker();
});

test("a190: the main thread stays free while checks run (no timer gap near a check's ~55 ms)", async () => {
  const h = hashPassword("correct horse battery");
  let last = Date.now(), maxGap = 0;
  const t = setInterval(() => { const now = Date.now(); maxGap = Math.max(maxGap, now - last); last = now; }, 5);
  await Promise.all(Array.from({ length: 6 }, () => verifyPasswordOffThread("wrong horse battery", h)));
  clearInterval(t);
  await stopPasswordWorker();
  // Synchronously, six checks hold the loop ~330 ms in ~55 ms pieces; off the thread the loop only waits for messages.
  // 40 ms leaves room for Windows' ~15 ms timer granularity and a loaded machine.
  assert.ok(maxGap < 40, `the longest gap between timer ticks was ${maxGap} ms`);
});

test("a190: sign-in uses it, and a throw reaches passport (never an unhandled rejection)", () => {
  const s = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(s, /const passwordOk = user \? await verifyPasswordOffThread\(password, user\.password_hash\) : false;/);
  assert.match(s, /passport\.use\(new LocalStrategy\(\(username, password, done\) => \{ localSignInVerify\(username, password, done\)\.catch\(done\); \}\)\);/);
});
