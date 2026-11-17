// ⭐ 46t: an /api address no route answers is a JSON 404, not the app's index.html with 200 (found after A230's push:
// the deleted /api/atlas/subcategory-roles still read 200 on production). The 404 sits LAST before the app's catch-all,
// so every real /api route registered earlier still wins.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const SERVER = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const API_404 = 'app.all(/^\\/api(\\/|$)/, (_req, res) => {\n  res.status(404).json({ error: "not_found" });';
const CATCH_ALL = 'app.get("*", (_req, res) => {';

test("unknown /api paths answer a JSON 404, registered just before the SPA's catch-all", () => {
  const api404 = at(SERVER, API_404, 0, "the /api 404");
  const catchAll = at(SERVER, CATCH_ALL, 0, "the SPA catch-all");
  assert.ok(api404 < catchAll, "the /api 404 comes before the catch-all");
  // nothing registers an /api route between them, and no route at all after the catch-all
  assert.doesNotMatch(SERVER.slice(api404 + API_404.length, catchAll), /app\.(get|post|put|patch|delete|use|all)\(/);
  assert.doesNotMatch(SERVER.slice(catchAll + CATCH_ALL.length), /\napp\.(get|post|put|patch|delete|use|all)\(/);
});

test("the pattern matches /api and /api/... only", () => {
  const re = /^\/api(\/|$)/;
  for (const p of ["/api", "/api/", "/api/atlas/subcategory-roles", "/api/x"]) assert.ok(re.test(p), p);
  for (const p of ["/apiary", "/app/api", "/atlas/api"]) assert.ok(!re.test(p), p);
});
