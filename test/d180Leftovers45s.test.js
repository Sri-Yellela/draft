// ⭐ D180 leftovers (45s): the opt-in unread-messages digest (counts only), *started a new role* proof moments (opt-in), and
// "1 connection works here" as ONE component on the company page, the posting panel and the deck. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setSetting } from "../services/appSettings.js";
import { setVisibility } from "../services/profilePage.js";
import { createSecretBox } from "../services/secretBox.js";
import { requestConnection, respond } from "../services/network/connections.js";
import { sendMessage } from "../services/network/messages.js";
import { setPref, eventText, NOTIFY_EVENTS } from "../services/notify.js";
import { dueDigests, runUnreadDigests, DIGEST_HOUR_UTC } from "../services/network/unreadDigest.js";
import { newRoleOf, noteNewRole, setSharePref } from "../services/network/feed.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const box = createSecretBox(crypto.randomBytes(32));
const DAY = 86400;
const AT = Math.floor(Date.UTC(2026, 10, 10, DIGEST_HOUR_UTC + 1) / 1000);

function world() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')");
  [[1, "ada"], [2, "ben"]].forEach(r => ins.run(...r));
  const h = db.prepare("INSERT INTO proof_pages (user_id, handle, enabled) VALUES (?, ?, 0)");
  [[1, "ada-example"], [2, "ben-example"]].forEach(r => h.run(...r));
  for (const id of [1, 2]) setVisibility(db, id, { page: "public" });
  setSetting(db, "network_enabled", true);
  requestConnection(db, 1, "ben-example"); respond(db, 2, "ada-example", true);
  return db;
}

test("Unread digest: OFF by default; once a day after the hour; counts only — never who or what; only while the network is on", async () => {
  const db = world();
  assert.deepEqual(NOTIFY_EVENTS.messages_unread.defaults, { push: false, email: false }, "opt-in on both channels");
  sendMessage(db, box, 2, { to: "ada-example", text: "A private note about Northwind" }, { now: AT - 3600 });
  assert.deepEqual(dueDigests(db, box, AT), [], "nobody turned it on");
  setPref(db, 1, "messages_unread", "email", true);
  assert.deepEqual(dueDigests(db, box, AT - 2 * 3600), [], "before the hour");
  assert.deepEqual(dueDigests(db, box, AT), [{ userId: 1, count: 1 }]);
  const sent = [];
  const notify = (userId, event, data) => {
    sent.push({ userId, event, data });
    db.prepare("INSERT INTO notifications (user_id, type, message, created_at) VALUES (?, ?, ?, ?)").run(userId, event, eventText(event, data).body, AT);
  };
  assert.equal(await runUnreadDigests(db, box, notify, AT), 1);
  assert.equal(await runUnreadDigests(db, box, notify, AT + 600), 0, "one a day");
  assert.deepEqual(sent[0].data, { count: 1 }, "the count only");
  const words = eventText("messages_unread", { count: 1 }).body;
  assert.equal(words, "1 message is waiting for you in Network.");
  assert.doesNotMatch(words, /Northwind|ben/i);
  assert.equal(dueDigests(db, box, AT + DAY).length, 1, "the next day again, while unread");
  setSetting(db, "network_enabled", false);
  assert.deepEqual(dueDigests(db, box, AT + DAY), [], "network off → nothing");
  assert.match(read("routes/notify.js"), /filter\(\(\[, e\]\) => !e\.network \|\| networkEnabled\(db\)\)/, "not even listed while off");
  assert.match(read("server.js"), /NETWORK_DIGEST !== "off"[\s\S]{0,120}runUnreadDigests\(db, SECRET_BOX/);
});

test("New role: a save that ADDS a current role posts one proof moment — only with *new role* on; edits never post", () => {
  assert.deepEqual(newRoleOf([{ company: "Contoso", title: "Engineer" }], [{ company: "Contoso", title: "Engineer" }]), null);
  assert.deepEqual(newRoleOf([{ company: "Contoso", title: "Engineer" }], [{ company: "Northwind", title: "Data Engineer" }]), { company: "Northwind", title: "Data Engineer" });
  const db = world();
  const addRole = () => db.prepare("INSERT INTO profile_experience (user_id, company, title, is_current) VALUES (1, 'Northwind', 'Data Engineer', 1)").run();
  addRole();
  assert.equal(noteNewRole(db, 1, []), null, "*new role* is off → no post");
  db.prepare("DELETE FROM profile_experience").run();
  setSharePref(db, 1, "new_role", true);
  addRole();
  const id = noteNewRole(db, 1, []);
  assert.ok(id);
  assert.equal(db.prepare("SELECT proof_label FROM network_posts WHERE id = ?").pluck().get(id), "started as Data Engineer at Northwind");
  assert.equal(noteNewRole(db, 1, [{ company: "Northwind", title: "Data Engineer" }]), null, "the same role again → nothing");
  assert.match(read("routes/profileSections.js"), /req\.params\.section === "experience" \? currentRoles\(db, req\.user\.id\)[\s\S]*noteNewRole\(db, req\.user\.id, before\)/);
});

test("Works here: ONE component — the company page, the posting panel and the deck (JobDetailPanel) mount components/WorksHere.jsx", () => {
  const wh = read("client/src/components/WorksHere.jsx");
  assert.match(wh, /\/api\/network\/at-company\?name=/);
  assert.match(wh, /api\("\/api\/network\/status"\)/, "asks whether the network is on (once a minute for the page)");
  assert.match(wh, /if \(!r \|\| !r\.count\) return null;/, "no one there → nothing drawn");
  const co = read("client/src/pages/companies/CompanyPage.jsx");
  assert.match(co, /import WorksHere from "\.\.\/\.\.\/components\/WorksHere\.jsx"/);
  assert.doesNotMatch(co, /function WorksHere\(/, "not built twice");
  assert.match((fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8") + fs.readFileSync("client/src/plate/OpeningSheet.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: JobDetailPanel.jsx deleted — its home now */, /<WorksHere company=\{selectedJob\.company\} job=\{\{ id: selectedJob\.id \?\? selectedJob\.jobId \}\} \/>/);
});
