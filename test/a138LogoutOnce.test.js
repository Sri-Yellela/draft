// ⛔ A138 (45h) · ONE SIGN-OUT, HOWEVER MANY 401s. Production 11-06 21:26:28Z: a session expired under a freshly loaded
// page; its ≈ 20 requests in flight each answered 401, api.js fired "rm:session-expired" for each, and each listener call
// POSTed /api/auth/logout — 20 sign-outs in 25 ms. handleLogout now shares the one in flight.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const app = fs.readFileSync(new URL("../client/src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("a138LogoutOnce: handleLogout returns the sign-out already in flight instead of starting another", () => {
  const start = at(app, "const handleLogout = useCallback(");
  const body = app.slice(start, at(app, "}, [setAuthUser]);", start));
  assert.match(body, /if \(logoutInFlight\.current\) return logoutInFlight\.current;/);
  assert.equal((body.match(/\/api\/auth\/logout/g) || []).length, 1, "one POST in the shared promise");
  assert.match(body, /setTimeout\(\(\) => \{ logoutInFlight\.current = null; \}, 2000\)/, "re-armed after the burst");
});

test("a138LogoutOnce: the guard holds — N concurrent callers make ONE request (the same pattern, run)", async () => {
  let posts = 0;
  const ref = { current: null };
  const logout = () => {
    if (ref.current) return ref.current;
    ref.current = (async () => { posts++; await new Promise(r => setTimeout(r, 10)); })().finally(() => { setTimeout(() => { ref.current = null; }, 50); });
    return ref.current;
  };
  await Promise.all(Array.from({ length: 20 }, () => logout()));
  assert.equal(posts, 1);
  await new Promise(r => setTimeout(r, 80));
  await logout();
  assert.equal(posts, 2, "a later, separate sign-out still goes");
});
