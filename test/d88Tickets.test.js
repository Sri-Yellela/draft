// ⭐ D88 P3 · support tickets — the row's ⛔ TESTS for tickets (39d). Each was mutated red and restored.
import { allowLegacyAdminRows } from "../test-support/legacyAdminRows.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  openTicket, userTickets, userTicket, userReply, adminReply, adminTicket, ticketQueue, setTicketFields, purgeSolvedTickets,
  DUE_SECONDS, PRIVACY_DUE_SECONDS, NEW_TICKETS_PER_DAY,
} from "../services/tickets.js";
import { deleteAccount, MERGE_PLAN } from "../services/accountService.js";
import { setOverride, addNote } from "../services/userAdmin.js";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function db0() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  allowLegacyAdminRows(db);   // a pre-162 admin row (test-support/legacyAdminRows.js)
  db.prepare("INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'admin', 'x', 1), (2, 'ada', 'x', 0), (3, 'grace', 'x', 0)").run();
  return db;
}
const ask = (db, userId, extra = {}) => openTicket(db, { userId, category: "account", subject: "Cannot sign in", message: "It says my password is wrong.", ...extra });

test("D88 P3 · ⛔ an internal note never reaches the user — not in their thread, not in their list's last word", () => {
  const db = db0();
  const id = ask(db, 2);
  adminReply(db, { ticketId: id, actorId: 1, body: "Their sessions look odd — check the merge.", internal: true });
  adminReply(db, { ticketId: id, actorId: 1, body: "I've reset it — try again?" });
  const t = userTicket(db, 2, id);
  assert.deepEqual(t.messages.map(m => m.body), ["It says my password is wrong.", "I've reset it — try again?"]);
  assert.ok(!JSON.stringify(t).includes("sessions look odd"));
  assert.equal(userTickets(db, 2)[0].messages, 2);
  assert.equal(adminTicket(db, id).messages.length, 3, "the admin sees all three");
  // an internal note changes nothing the user sees, and sends nothing
  const before = userTicket(db, 2, id).status;
  adminReply(db, { ticketId: id, actorId: 1, body: "note only", internal: true });
  assert.equal(userTicket(db, 2, id).status, before);
  const routes = lf("routes/tickets.js");
  assert.match(routes, /if \(!internal && t\.email\) \{/, "only a non-internal reply is mailed");
});

test("D88 P3 · a user reads and replies only to their own requests", () => {
  const db = db0();
  const id = ask(db, 2);
  assert.throws(() => userTicket(db, 3, id), /No such request/);
  assert.throws(() => userReply(db, 3, id, "hello"), /No such request/);
  assert.deepEqual(userTickets(db, 3), []);
});

test("D88 P3 · ⛔ deleting an account removes its tickets and threads (and 155's overrides and notes)", () => {
  const db = db0();
  const id = ask(db, 2);
  adminReply(db, { ticketId: id, actorId: 1, body: "reply" });
  setOverride(db, { userId: 2, featureKey: "draft_slots", value: 3, reason: "ticket", actorId: 1 });
  addNote(db, { userId: 2, body: "note", actorId: 1 });
  deleteAccount(db, 2);
  for (const t of ["tickets", "user_entitlement_overrides", "user_notes"]) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, t);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ticket_messages").get().n, 0);
  assert.equal(MERGE_PLAN.tickets, "move", "a merged person keeps their requests");
});

test("D88 P3 · due dates: 2 days, a privacy request 30 days that a reply does not move; a user reply reopens", () => {
  const db = db0();
  const now = Math.floor(Date.now() / 1000);
  const a = ask(db, 2), p = ask(db, 2, { category: "privacy_request", subject: "Delete my data" });
  const due = (id) => db.prepare("SELECT due_at FROM tickets WHERE id = ?").get(id).due_at;
  assert.ok(Math.abs(due(a) - (now + DUE_SECONDS)) < 5);
  assert.ok(Math.abs(due(p) - (now + PRIVACY_DUE_SECONDS)) < 5);
  assert.equal(adminTicket(db, p).priority, "high");
  adminReply(db, { ticketId: a, actorId: 1, body: "done", solve: true });
  assert.equal(userTicket(db, 2, a).status, "solved");
  userReply(db, 2, a, "still broken");
  assert.equal(userTicket(db, 2, a).status, "open");
  const pDue = due(p);
  userReply(db, 2, p, "any news?");
  assert.equal(due(p), pDue, "the legal date stands");
  const q = ticketQueue(db, { status: "unsolved" });
  assert.equal(q.counts.privacy, 1);
});

test("D88 P3 · the context is three named things; the input is checked; five a day", () => {
  const db = db0();
  const id = openTicket(db, { userId: 2, category: "bug", subject: "Board blank", message: "The board shows nothing today.",
    context: { page: "/app/jobs", appVersion: "web", sponsorship: "yes", resumeText: "secret" } });
  assert.deepEqual(adminTicket(db, id).context, { accountId: 2, appVersion: "web", page: "/app/jobs" });
  assert.throws(() => ask(db, 2, { category: "nope" }), /Pick what it is about/);
  assert.throws(() => ask(db, 2, { message: "hi" }), /Say a little more/);
  for (let i = 1; i < NEW_TICKETS_PER_DAY; i++) ask(db, 2);
  assert.throws(() => ask(db, 2), /opened 5 requests today/);
});

test("D88 P3 · retention: a solved ticket goes after 24 months; an open one never by age", () => {
  const db = db0();
  const old = ask(db, 2), open = ask(db, 2);
  setTicketFields(db, { ticketId: old, status: "solved" });
  db.prepare("UPDATE tickets SET solved_at = unixepoch() - 800 * 86400 WHERE id = ?").run(old);
  db.prepare("UPDATE tickets SET created_at = unixepoch() - 900 * 86400 WHERE id = ?").run(open);
  assert.equal(purgeSolvedTickets(db), 1);
  assert.deepEqual(db.prepare("SELECT id FROM tickets").all().map(r => r.id), [open]);
});

test("D88 P3 · the routes: the user's behind requireAuth, the queue behind requireAdmin on every route; replies audited", () => {
  const server = lf("server.js");
  assert.match(server, /app\.use\("\/api\/support", requireAuth, support\.user\);/);
  assert.match(server, /app\.use\("\/api\/admin\/tickets", requireAdmin, support\.admin\);/);
  const routes = lf("routes/tickets.js");
  const userRoutes = [...routes.matchAll(/user\.(get|post)\("([^"]+)", (\w+),/g)];
  const adminRoutes = [...routes.matchAll(/admin\.(get|post)\("([^"]+)", (\w+),/g)];
  assert.ok(userRoutes.length >= 4 && userRoutes.every(r => r[3] === "requireAuth"));
  assert.ok(adminRoutes.length >= 4 && adminRoutes.every(r => r[3] === "requireAdmin"));
  assert.match(routes, /action: internal \? "ticket\.note" : "ticket\.reply", target: `user:\$\{t\.userId\}`/);
  assert.match(routes, /action: "ticket\.update"/);
  assert.doesNotMatch(routes, /anthropic|callModel/i, "no model writes a reply (D17)");
});
