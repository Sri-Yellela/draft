// ⭐ D180 P3 + P4 (45r) · THE FEED and CONNECTIONS AT A COMPANY — the spec's named tests P3 carries:
// d180FeedChronologicalDefault, d180ProofMomentsOptIn; and P3's share of d180BlockStopsEverything, d180ReportReachesQueue,
// d180DeleteRemovesContent, d180NoAiReadsMessagesUnasked. P4: only connections who SHOW where they work, at the SAME company.
// Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setVisibility } from "../services/profilePage.js";
import { setSetting } from "../services/appSettings.js";
import { requestConnection, respond, block } from "../services/network/connections.js";
import { myFeed, createPost, setHelpful, listComments, addComment, removeOwn, sharePrefs, setSharePref, recordProofMoment, POSTS_PER_DAY }
  from "../services/network/feed.js";
import { report, reportQueue, resolveReport } from "../services/network/messages.js";
import { connectionsAt, referralTemplate } from "../services/network/referrals.js";

function world() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')");
  [[1, "ada"], [2, "ben"], [3, "cy"], [4, "di"]].forEach(r => ins.run(...r));
  const h = db.prepare("INSERT INTO proof_pages (user_id, handle, enabled) VALUES (?, ?, 0)");
  [[1, "ada-example"], [2, "ben-example"], [3, "cy-example"], [4, "di-example"]].forEach(r => h.run(...r));
  for (const id of [1, 2, 3, 4]) setVisibility(db, id, { page: "public" });
  const px = db.prepare("INSERT INTO people_index (user_id, name, name_key, handle, updated_at) VALUES (?, ?, ?, ?, 0)");
  [[1, "Ada Example"], [2, "Ben Example"], [3, "Cy Example"], [4, "Di Example"]].forEach(([id, n]) => px.run(id, n, n.toLowerCase(), n.split(" ")[0].toLowerCase() + "-example"));
  setSetting(db, "network_enabled", true);
  // Ada ↔ Ben and Ada ↔ Cy are connected; Di is a stranger to everyone.
  requestConnection(db, 1, "ben-example"); respond(db, 2, "ada-example", true);
  requestConnection(db, 1, "cy-example"); respond(db, 3, "ada-example", true);
  return db;
}
const ids = (feed) => feed.posts.map(p => p.id);

test("d180FeedChronologicalDefault: my posts and my connections', newest first by time written — never a stranger's, never ranked", () => {
  const db = world();
  const a = createPost(db, 2, { text: "Ben's first" }, { now: 1000 });
  const b = createPost(db, 4, { text: "Di is a stranger" }, { now: 1001 });
  const c = createPost(db, 3, { text: "Cy's post" }, { now: 1002 });
  const d = createPost(db, 1, { text: "Ada's own" }, { now: 1003 });
  setHelpful(db, 1, a.id, true);   // a reaction on the OLDEST must not lift it
  assert.throws(() => setHelpful(db, 3, a.id, true), /no such post/, "Cy isn't Ben's connection — he can't see it to react");
  const feed = myFeed(db, 1);
  assert.equal(feed.order, "newest");
  assert.deepEqual(ids(feed), [d.id, c.id, a.id], "chronological; the stranger's post is not there");
  assert.ok(!ids(myFeed(db, 2)).includes(c.id), "Ben is not connected to Cy");
  assert.ok(!ids(myFeed(db, 1)).includes(b.id));
  const src = fs.readFileSync("services/network/feed.js", "utf8");
  assert.match(src, /ORDER BY id DESC LIMIT \?/);
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /ORDER BY[^;]*helpful/i, "no ranking by reactions");
});

test("d180ProofMomentsOptIn: a check passed becomes a post ONLY when 'checks' is on; every kind starts off", () => {
  const db = world();
  assert.ok(sharePrefs(db, 2).kinds.every(k => k.on === false), "every kind OFF until turned on");
  const proof = (uid, skill) => db.prepare(`INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (?, ?, ?, 'checked', 'check', 1)`).run(uid, skill.toLowerCase(), skill);
  proof(2, "Kafka");
  assert.equal(myFeed(db, 1).posts.length, 0, "nothing shared while off");
  assert.equal(recordProofMoment(db, 2, "new_role", "Engineer at Northwind"), null, "new role off too");
  setSharePref(db, 2, "checks", true);
  proof(2, "Kubernetes");
  const posts = myFeed(db, 1).posts;
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].proof, { kind: "check", label: "Kubernetes" });
  db.prepare(`INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (2, 'go', 'Go', 'claimed', 'self', 1)`).run();
  assert.equal(myFeed(db, 1).posts.length, 1, "a claim is not a proof");
  setSharePref(db, 2, "checks", false);
  proof(2, "Rust");
  assert.equal(myFeed(db, 1).posts.length, 1, "turned off again → nothing new");
});

test("d180BlockStopsEverything (feed): a block hides each other's posts and comments and refuses a reaction or comment", () => {
  const db = world();
  const p = createPost(db, 2, { text: "hello" });
  addComment(db, 3, (createPost(db, 1, { text: "Ada asks" })).id, "Cy answers");
  block(db, 1, "ben-example");
  assert.ok(!ids(myFeed(db, 1)).includes(p.id));
  assert.throws(() => setHelpful(db, 1, p.id, true), /no such post/);
  assert.throws(() => addComment(db, 1, p.id, "x"), /no such post/);
  assert.throws(() => listComments(db, 2, myFeed(db, 1).posts[0].id), /no such post/, "Ben can't read Ada's post any more");
});

test("d180ReportReachesQueue + d180DeleteRemovesContent (feed): a post and a comment reach the queue; removal clears the words; an author deletes their own; account deletion takes the rest", () => {
  const db = world();
  const p = createPost(db, 2, { text: "spammy post", link: "https://example.com/x" });
  addComment(db, 1, p.id, "Ada's comment");
  const cid = listComments(db, 2, p.id)[0].id;
  assert.equal(report(db, 1, { kind: "post", id: p.id, reason: "spam" }).reported, true);
  assert.equal(report(db, 2, { kind: "comment", id: cid, reason: "harassment" }).reported, true);
  assert.throws(() => report(db, 4, { kind: "post", id: p.id, reason: "spam" }), /no such post/, "a stranger can't see it to report it");
  const q = reportQueue(db, null);
  assert.deepEqual(q.map(r => r.kind).sort(), ["comment", "post"]);
  assert.equal(q.find(r => r.kind === "post").target.text, "spammy post");
  resolveReport(db, q.find(r => r.kind === "post").id, { status: "actioned", removeMessage: true });
  assert.ok(!ids(myFeed(db, 1)).includes(p.id));
  assert.equal(db.prepare("SELECT body FROM network_posts WHERE id = ?").pluck().get(p.id), null, "the words are cleared");
  const own = createPost(db, 1, { text: "mine" });
  assert.throws(() => removeOwn(db, 2, "post", own.id), /no such post/, "only the author");
  assert.equal(removeOwn(db, 1, "post", own.id).removed, true);
  createPost(db, 3, { text: "Cy writes" });
  db.prepare("DELETE FROM users WHERE id = 3").run();
  assert.equal(db.prepare("SELECT COUNT(*) FROM network_posts WHERE author_id = 3").pluck().get(), 0, "account deletion removes their posts");
});

test("d180 feed limits: links are http(s) only, a job must be open, posts are capped per day", () => {
  const db = world();
  assert.throws(() => createPost(db, 1, { link: "javascript:alert(1)" }), /http/);
  assert.throws(() => createPost(db, 1, {}), /Write something/);
  assert.throws(() => createPost(db, 1, { jobId: 999999 }), /isn't open/);
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, board_category) VALUES ('jx', 'q', 'Northwind', 'Backend Engineer', 'hx', 1, 'computing')`).run();
  const jid = db.prepare("SELECT id FROM scraped_jobs WHERE job_id = 'jx'").pluck().get();
  const jp = createPost(db, 1, { jobId: jid, text: "worth a look" });
  assert.equal(jp.kind, "job");
  assert.equal(jp.job.title, "Backend Engineer");
  for (let i = 1; i < POSTS_PER_DAY; i++) createPost(db, 1, { text: `post ${i}` });
  assert.throws(() => createPost(db, 1, { text: "one too many" }), /a day/);
});

test("d180NoAiReadsMessagesUnasked (feed + referrals): nothing in the feed or referrals calls a model", () => {
  for (const f of ["services/network/feed.js", "services/network/referrals.js"]) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /callModel|anthropic|messages\.create|modelFor\(/, f);
  }
});

test("d180 P4 connectionsAt: only connections who SHOW where they work, at the SAME company (its slug rule), never across a block", () => {
  const db = world();
  const exp = db.prepare(`INSERT INTO profile_experience (user_id, company, title, position) VALUES (?, ?, ?, 0)`);
  exp.run(2, "Northwind, Inc.", "Staff Engineer");     // connected, shows experience (public page)
  exp.run(3, "Northwind", "Recruiter");                 // connected — hides Experience below
  exp.run(4, "Northwind", "Engineer");                  // a stranger
  setVisibility(db, 3, { section: "experience", level: "only_me" });
  setVisibility(db, 2, { referrals: true });
  const r = connectionsAt(db, 1, "Northwind");
  assert.deepEqual(r.people.map(p => p.handle), ["ben-example"]);
  assert.equal(r.people[0].openToReferrals, true);
  assert.equal(connectionsAt(db, 1, "Northwind Bank").count, 0, "a different company is not the same one");
  block(db, 1, "ben-example");
  assert.equal(connectionsAt(db, 1, "Northwind").count, 0);
  const t = referralTemplate({ name: "Ben Example", company: "Northwind", jobTitle: "Backend Engineer", myName: "Ada Example" });
  assert.match(t, /^Hi Ben — I saw the Backend Engineer role at Northwind/);
});
