// e2e 11-05 (agenda step 4, apply with auto-fill) — the server's PDF render waits for "load", not "networkidle0".
// Measured in real Chrome (the extension loaded, the fake ATS at each family's host, the real server.js on the 18k
// copy): with networkidle0, setContent timed out at 30 s on 8 of 17 renders (every tailored one) and every "Attach tailored" answered "The
// PDF could not be made right now" on Greenhouse, Lever, Workday and Ashby; with "load" every render answered in
// 0.5–4.8 s and the tailored PDF reached the page's file input.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { at } from "../test-support/sourceAnchors.js";
import { sanitiseResumeHtml } from "../services/resumePreviewSanitiser.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8").replace(/\r\n/g, "\n");

test("e2e step 4 · htmlToPdf waits for load — there is no network for networkidle0 to wait on", () => {
  const fn = server.slice(at(server, "async function htmlToPdf(html) {"), at(server, "// ── Field normalisers"));
  assert.match(fn, /await page\.setContent\(html, \{ waitUntil:"load", timeout:30000 \}\);/);
  assert.doesNotMatch(fn, /waitUntil:"networkidle0"/);
});

test("e2e step 4 · why load is enough: the printed résumé can name nothing to fetch", () => {
  const out = sanitiseResumeHtml(`<html><head><link rel="stylesheet" href="https://cdn.example.test/x.css">
    <style>@import "https://cdn.example.test/y.css"; body{background:url(https://cdn.example.test/bg.png)}</style></head>
    <body><img src="https://cdn.example.test/p.png"><h1>Sam Synthetic</h1></body></html>`).html;
  assert.doesNotMatch(out, /cdn\.example\.test\/(x|y)\.css|bg\.png|p\.png/);
  assert.match(out, /<h1>Sam Synthetic<\/h1>/);
});
