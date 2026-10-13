// D86/D88 follow-up, item 3 (owner 10-12): "People → Users: show ALL accounts by default; if internal/test accounts
// are hidden by a filter, say how many ("3 hidden") beside the filter." Each guard red when its rule is removed.
// Synthetic accounts only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { listPeople, personDetail, setTag, USER_TAGS } from "../services/userAdmin.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
function db() {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare(`INSERT INTO users (id, username, password_hash, is_admin) VALUES
    (1, 'admin', 'h', 1), (2, 'ada', 'h', 0), (3, 'grace', 'h', 0), (4, 'reviewer', 'h', 0), (5, 'qa-bot', 'h', 0)`).run();
  return d;
}

test("⛔ item 3: every account shows by default; the filter hides internal and test ones and says how many", () => {
  const d = db();
  setTag(d, { userId: 4, tag: "test", on: true, reason: "the reviewer account", actorId: null });
  setTag(d, { userId: 5, tag: "internal", on: true, reason: "our own QA account", actorId: null });
  setTag(d, { userId: 3, tag: "beta", on: true, reason: "early access", actorId: null });
  const all = listPeople(d, {});
  assert.deepEqual(all.rows.map(r => r.id).sort(), [2, 3, 4, 5], "ALL user accounts by default (never the admin)");
  assert.equal(all.hidden, 0, "nothing is hidden unless asked");
  const hid = listPeople(d, { hideTagged: true });
  assert.deepEqual(hid.rows.map(r => r.id).sort(), [2, 3], "beta is not hidden — only internal and test");
  assert.equal(hid.hidden, 2, "and it says how many");
  assert.equal(hid.counts.total, 4, "the numbers on top still count everyone");
  assert.equal(listPeople(d, { hideTagged: true, q: "qa" }).hidden, 1, "hidden is counted within the search");
  assert.deepEqual(all.rows.find(r => r.id === 4).tags, ["test"]);
  assert.deepEqual(personDetail(d, 3).tags, ["beta"]);
});

test("⛔ item 3: a tag needs a reason, is audited with its actor, never reaches an admin, and goes with the account", () => {
  const d = db();
  assert.throws(() => setTag(d, { userId: 2, tag: "test", on: true, reason: "", actorId: null }), /Say why/);
  assert.throws(() => setTag(d, { userId: 2, tag: "vip", on: true, reason: "testing it", actorId: null }), /one of/);
  assert.throws(() => setTag(d, { userId: 1, tag: "test", on: true, reason: "testing it", actorId: null }), /No such user/);
  setTag(d, { userId: 2, tag: "internal", on: true, reason: "testing it", actorId: 1 });
  assert.throws(() => setTag(d, { userId: 2, tag: "internal", on: true, reason: "testing it", actorId: 1 }), /already/);
  const a = d.prepare("SELECT action, actor_kind, actor, reason FROM admin_audit_log ORDER BY id DESC LIMIT 1").get();
  assert.deepEqual(a, { action: "user.tag.add", actor_kind: "user", actor: "user:1", reason: "testing it" });
  assert.equal(d.prepare("SELECT set_by_actor FROM user_tags WHERE user_id = 2").pluck().get(), "user:1");
  d.prepare("DELETE FROM users WHERE id = 2").run();
  assert.equal(d.prepare("SELECT COUNT(*) FROM user_tags").pluck().get(), 0, "cascade with the account");
  assert.deepEqual(Object.keys(USER_TAGS), ["internal", "test", "beta"]);
});

test("⛔ item 3 UI: the filter is OFF by default and the count sits beside it; migration 160 is byte-identical", () => {
  const ui = read("client/src/panels/adminPeople.jsx");
  assert.match(ui, /const \[hideTagged, setHideTagged\] = useState\(false\);/);
  assert.match(ui, /Hide internal and test accounts\s*<\/label>\s*\{hideTagged && d && <span data-people-hidden=\{d\.hidden \|\| 0\}[^>]*>\{num\(d\.hidden \|\| 0\)\} hidden<\/span>\}/);
  assert.match(read("routes/adminPeople.js"), /hideTagged: req\.query\.hideTagged === "1"/);
  const blk = (f) => { const s = read(f); const i = at(s, 'id: "160_user_tags"'); return s.slice(i, at(s, "`,", i)); };
  assert.equal(blk("server.js"), blk("scripts/migrations.js"));
});
