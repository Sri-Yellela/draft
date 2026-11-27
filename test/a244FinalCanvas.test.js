// A244 (47h) · the oracle is the approved canvas's own board sources (docs/sketches/final/project), not the HTML export that
// carried only the storyboard: every approved board is there, retired ones are kept out of the list, and the server that
// d196Regress's `source: "final"` pairs use serves a board and refuses a path outside the folder.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { finalBoards, pendingBoards, PENDING_LOOK, finalIndex, serveFinal, FINAL_DIR } from "../scripts/d196FinalCanvas.mjs";

const APPROVED = ["Shell", "Market", "Opening", "Ledger", "Survey", "ATSCard", "Home", "Map", "Gazetteer", "YourSurvey", "Library", "Emblem", "Maps", "Explainer", "Storyboard",
  // 47m: row 4, approved by the owner 11-27
  "GazetteerIndex", "Route", "AskRoute", "Passport", "ProvingGround", "DarkPlate", "DrawingsAtlas", "DrawingsJobs", "DrawingsPublic"];

test("A244: every approved board's source is in the snapshot, in the canvas's order; retired boards are not listed", () => {
  const stems = finalBoards().map((b) => b.stem);
  assert.deepEqual([...stems].sort(), [...APPROVED].sort());
  for (const s of stems) assert.ok(fs.existsSync(path.join(FINAL_DIR, `${s}.dc.html`)), `${s}.dc.html`);
  assert.ok(!stems.includes("Lesson") && !stems.includes("Shelves"), "the retired boards stay out");
  assert.ok(fs.existsSync(path.join(FINAL_DIR, "support.js")), "the runtime each board loads as ./support.js");
  assert.equal(finalIndex().pages[0].id, "final");
});

test("47l: boards awaiting the owner's look are on the canvas and in the snapshot, but never in the oracle", () => {
  const pending = pendingBoards().map((b) => b.stem);
  assert.deepEqual([...pending].sort(), [...PENDING_LOOK].sort(), "every pending stem is a board on the canvas");
  for (const s of pending) {
    assert.ok(fs.existsSync(path.join(FINAL_DIR, `${s}.dc.html`)), `${s}.dc.html`);
    assert.ok(!finalBoards().some((b) => b.stem === s), `${s} is not an oracle until approved`);
  }
});

test("A244: the board server serves a board and refuses a path outside the snapshot", async () => {
  const { base } = await serveFinal();
  const get = (u) => new Promise((res, rej) => http.get(base + u, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res({ s: r.statusCode, b })); }).on("error", rej));
  const ok = await get("/Market.dc.html");
  assert.equal(ok.s, 200);
  assert.match(ok.b, /<script src="\.\/support\.js"><\/script>/);
  assert.equal((await get("/canvas.json")).s, 200, "the index sits beside the boards");
  assert.equal((await get("/..%2FSOURCE.md")).s, 404, "an encoded ../ never leaves the snapshot");
  assert.equal((await get("/..%2F..%2F..%2F..%2Fpackage.json")).s, 404);
});
