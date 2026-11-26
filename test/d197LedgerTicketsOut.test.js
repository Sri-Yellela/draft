// ⭐ D197 Wave 1 #3 / D199 C1 (47h) · TICKETS OUT ON HOME — the market's third section moves to the ledger: the market
// (its new-today count + the best match), the best match's survey sheet, Interview, and the interchange to Atlas — each
// only when the page can back it. Plus the ledger's own model: the route lights only what the worker reported.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ledgerTickets, runStops, squaresOf, tagOf, ledgerFront, countCells } from "../client/src/plate/ledgerModel.js";
import { renderFixture } from "../test-support/renderPlateFixture.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const paths = { market: "/app/jobs", interview: "/app/interview", company: (c) => `/app/companies/${c.toLowerCase().replace(/\s+/g, "-")}` };

test("d197LedgerTicketsOut: each ticket only when the page can back it", () => {
  const bare = ledgerTickets({ paths });
  assert.deepEqual(bare.map((t) => t.key), ["market"], "nothing known → only the market, and it claims no count");
  assert.equal(bare[0].kicker, "THE MARKET");
  const full = ledgerTickets({ newToday: 179, best: { match: "91%", company: "Kestrel Payments" }, front: { company: "Sailor Health" }, sent: 2,
    sentCompanies: ["Brightline", "Orbital"], gap: { tech: "Webhooks", company: "Sailor Health", href: "/atlas/webhooks" }, paths });
  assert.deepEqual(full.map((t) => t.key), ["market", "survey", "interview", "atlas"]);
  assert.equal(full[0].kicker, "THE MARKET · 179 NEW TODAY");
  assert.equal(full[0].line, "Your best match today is 91% at Kestrel Payments.");
  assert.equal(full[1].kicker, "SURVEY SHEET · YOUR BEST MATCH");
  assert.equal(full[1].href, "/app/companies/kestrel-payments");
  assert.equal(full[2].line, "Practice the questions Brightline and Orbital ask most.");
  assert.equal(full[3].kicker, "⇄ INTERCHANGE · ATLAS");
  const booked = ledgerTickets({ sent: 2, nextInterview: { company: "Orbital", when: "ON FRIDAY" }, paths });
  assert.equal(booked.find((t) => t.key === "interview").kicker, "INTERVIEW · ON FRIDAY", "a booked interview names its day");
  assert.equal(ledgerTickets({ front: { company: "Sailor" }, paths })[1].kicker, "SURVEY SHEET · YOUR NEXT ONE", "no best match → the front application's company");
});

test("d197LedgerTicketsOut: Home mounts them (plate on), the market's needs-you ticket is Home's own section 01", async () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /\{plate && <LedgerTicketsSlot rows=\{rows\} counts=\{lgCounts\} front=\{lgFront\}\/>\}/);
  assert.match(panel, /api\(`\/api\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/contextual`\)/, "the gap comes from the front application's contextual card");
  const html = await renderFixture("LedgerBoard");
  const sec = html.slice(at(html, 'data-ledger-tickets=""'));
  assert.equal((sec.match(/class="pl-ticket pl-lift"/g) || []).length, 4);
  assert.match(sec, /Where this page leads next — the market’s tickets now live here too\./);
});

test("d197LedgerRunRoute: a stop lights only when the worker reported it; FILLED with fields open waits on YOU", () => {
  const steps = [{ id: "posting", state: "done" }, { id: "resume", state: "done", meta: "ATS 71 → 80" }, { id: "attached", state: "done" },
    { id: "filled", state: "done", meta: "22 of 24" }, { id: "you", state: "now" }, { id: "ready", state: "" }, { id: "sent", state: "" }];
  const s = runStops(steps, { answers: 2 });
  assert.deepEqual(s.map((x) => x.state), ["done", "done", "done", "underway", "now", "ahead"]);
  assert.deepEqual(s.map((x) => x.sub), ["The posting", "71 → 80 ATS", "Résumé", "22 of 24 fields", "2 answers", "Not yet"]);
  assert.deepEqual(s.map((x) => x.x), [60, 164, 268, 372, 476, 580]);
  assert.deepEqual(squaresOf({}, s), ["d", "d", "d", "u", "y", "-"]);
  const noReport = runStops([{ id: "posting", state: "done" }, { id: "resume", state: "", meta: "waiting" }, { id: "attached", state: "" }, { id: "filled", state: "" },
    { id: "you", state: "" }, { id: "ready", state: "" }, { id: "sent", state: "" }]);
  assert.deepEqual(noReport.map((x) => x.state), ["done", "ahead", "ahead", "ahead", "ahead", "ahead"], "nothing claimed that wasn't reported");
  assert.deepEqual(squaresOf({ filter: "sent" }, []), ["d", "d", "d", "d", "d", "d"]);
  assert.equal(tagOf({ stage: "question" }), "NEEDS YOU");
  assert.equal(tagOf({ stage: "working" }), "IN PROGRESS");
  const rows = [{ key: "a", stage: "sent", node: {}, at: 3 }, { key: "b", stage: "working", node: {}, at: 2 }, { key: "c", stage: "question", node: {}, at: 1 }];
  assert.equal(ledgerFront(rows).key, "c", "the one that needs you leads");
  const cells = countCells({ needs: 1, progress: 2, sent: 2, replied: 0, interview: 0 }, { filter: "sent", onFilter: () => {} });
  assert.equal(cells.find((c) => c.key === "sent").pressed, true);
  assert.equal(cells[0].tone, "clay");
});
