// ⭐ D180 P1 (45o) · CONNECTIONS — the spec's named tests that P1 can carry: d180PrivateByDefault (a private page can't be
// found or asked), d180StrangersLandInRequests (an ask is a request, never a connection), d180BlockStopsEverything, and the
// switch: OFF by default, every person-facing route 404s while off. A connection sees the Connections sections (D183).
// Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setVisibility } from "../services/profilePage.js";
import { setSetting } from "../services/appSettings.js";
import {
  networkEnabled, requestConnection, respond, removeConnection, block, unblock, relation, myNetwork, suggestions,
  profileViewerFor, DAILY_REQUEST_CAP,
} from "../services/network/connections.js";
import { publicViewFor } from "../routes/publicProfile.js";
import { saveSection } from "../services/structuredProfile.js";

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')");
  [[1, "ada"], [2, "ben"], [3, "cy"], [4, "di"]].forEach(r => ins.run(...r));
  const h = db.prepare("INSERT INTO proof_pages (user_id, handle, enabled) VALUES (?, ?, 0)");
  [[1, "ada-example"], [2, "ben-example"], [3, "cy-example"], [4, "di-example"]].forEach(r => h.run(...r));
  for (const id of [1, 2, 3]) setVisibility(db, id, { page: "public" });   // 4 stays private (the default)
  const px = db.prepare("INSERT INTO people_index (user_id, name, name_key, headline, workplace, school, handle, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?, 0)");
  px.run(1, "Ada Example", "ada example", "Northwind", "Tufts", "ada-example");
  px.run(2, "Ben Example", "ben example", "Northwind", null, "ben-example");
  px.run(3, "Cy Example", "cy example", "Contoso", "Tufts", "cy-example");
  setSetting(db, "network_enabled", true);
  return db;
}

test("the network is OFF by default and every person-facing route is gated by it", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  assert.equal(networkEnabled(db), false, "no setting = off");
  const r = fs.readFileSync("routes/network.js", "utf8");
  const personRoutes = [...r.matchAll(/app\.(get|post|put)\("(\/api\/network[^"]*)", ([^)]*?)\(req/g)];
  assert.ok(personRoutes.length >= 5);
  for (const m of personRoutes) assert.match(m[3], /requireAuth, gate,/, `${m[2]} is behind the switch`);
  assert.match(fs.readFileSync("server.js", "utf8"), /networkRoutes\(app, db, \{ requireAuth, requireAdmin, box: SECRET_BOX \}\);/);
});

test("d180PrivateByDefault · a private page can't be asked (it reads as no one there)", () => {
  const db = freshDb();
  assert.throws(() => requestConnection(db, 1, "di-example"), (e) => e.code === "no_such_person");
  assert.throws(() => requestConnection(db, 1, "ada-example"), (e) => e.code === "self");
});

test("d180StrangersLandInRequests · an ask is a request until accepted; decline leaves nothing", () => {
  const db = freshDb();
  assert.deepEqual(requestConnection(db, 1, "ben-example", { note: "Hi from Northwind" }), { relation: "requested" });
  assert.equal(relation(db, 2, 1), "incoming");
  assert.equal(myNetwork(db, 2).incoming[0].note, "Hi from Northwind");
  assert.equal(myNetwork(db, 1).connections.length, 0, "not a connection yet");
  assert.throws(() => respond(db, 1, "ben-example", true), (e) => e.code === "no_request", "only the one asked can accept");
  respond(db, 2, "ada-example", true);
  assert.equal(relation(db, 1, 2), "connected");
  assert.deepEqual(myNetwork(db, 1).connections.map(c => c.handle), ["ben-example"]);
  requestConnection(db, 3, "ada-example");
  respond(db, 1, "cy-example", false);
  assert.equal(relation(db, 1, 3), "none", "declined: nothing kept");
  removeConnection(db, 1, "ben-example");
  assert.equal(relation(db, 1, 2), "none");
});

test("the daily cap holds", () => {
  const db = freshDb();
  const now = 1_800_000_000;
  for (let i = 0; i < DAILY_REQUEST_CAP; i++) {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')").run(100 + i, `u${i}`);
    db.prepare("INSERT INTO network_connections (low_id, high_id, requester_id, status, created_at) VALUES (?, ?, 1, 'pending', ?)")
      .run(1, 100 + i, now - 60);
  }
  assert.throws(() => requestConnection(db, 1, "ben-example", { now }), (e) => e.code === "daily_cap");
  assert.deepEqual(requestConnection(db, 1, "ben-example", { now: now + 86400 }), { relation: "requested" }, "a new day, a new allowance");
});

test("d180BlockStopsEverything · a block removes the pair and stops asks both ways, until unblocked", () => {
  const db = freshDb();
  requestConnection(db, 1, "ben-example"); respond(db, 2, "ada-example", true);
  block(db, 2, "ada-example");
  assert.equal(relation(db, 1, 2), "blocked");
  assert.equal(myNetwork(db, 1).connections.length, 0);
  assert.throws(() => requestConnection(db, 1, "ben-example"), (e) => e.code === "blocked");
  assert.throws(() => requestConnection(db, 2, "ada-example"), (e) => e.code === "blocked");
  assert.deepEqual(myNetwork(db, 2).blocked.map(b => b.handle), ["ada-example"]);
  unblock(db, 2, "ada-example");
  assert.equal(relation(db, 1, 2), "none", "unblocked: back to nothing, not to connected");
});

test("suggestions: public pages sharing a workplace or school — never self, connected, asked or blocked", () => {
  const db = freshDb();
  assert.deepEqual(suggestions(db, 1).people.map(p => [p.handle, p.why]).sort(), [["ben-example", "Also at Northwind"], ["cy-example", "Also studied at Tufts"]]);
  requestConnection(db, 1, "ben-example");
  block(db, 1, "cy-example");
  assert.deepEqual(suggestions(db, 1).people, []);
});

test("a connection sees the Connections sections on /in/<handle>; a stranger sees the public view", () => {
  const db = freshDb();
  saveSection(db, 2, "summary", { summary: "Builds data pipelines." });
  setVisibility(db, 2, { page: "public", section: "about", level: "connections" });
  const stranger = publicViewFor(db, "ben-example", { viewerId: 3 });
  assert.equal(stranger.view.viewer, "public");
  assert.ok(!("about" in stranger.view.sections), "a Connections section is not public");
  requestConnection(db, 1, "ben-example"); respond(db, 2, "ada-example", true);
  assert.equal(profileViewerFor(db, 1, 2), "connection");
  const friend = publicViewFor(db, "ben-example", { viewerId: 1 });
  assert.equal(friend.view.viewer, "connection");
  setSetting(db, "network_enabled", false);
  assert.equal(profileViewerFor(db, 1, 2), "public", "with the network off, nobody is a connection");
});

test("the client: the dock draws Network only when on; the page says not available while off; Admin holds the switch", () => {
  const nav = fs.readFileSync("client/src/components/AppNav.jsx", "utf8");
  assert.match(nav, /if \(network && !list\.some\(\(t\) => t\.id === "network"\)\)/, "Network joins the dock only when on");
  assert.match(nav, /api\("\/api\/network\/status"\)/);
  const page = fs.readFileSync("client/src/pages/network/NetworkPage.jsx", "utf8");
  assert.match(page, /data-network-off=""/);
  assert.match(page, /This isn't available yet\./);
  assert.match(page, /Send request/, "a ?connect= link asks first, never a silent request");
  assert.match(fs.readFileSync("client/src/App.jsx", "utf8"), /\{activeTab === "network" && <NetworkPage\/>\}/);
  assert.match(fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8"), /\{at\("people", "network"\) && <NetworkTab\/>\}/);
  const pub = fs.readFileSync("routes/publicProfile.js", "utf8");
  assert.match(pub, /connect: networkEnabled\(db\) && out\.userId !== \(req\.user\?\.id \?\? null\)/, "Connect on a public page only while on, never on your own");
});
