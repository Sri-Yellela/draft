// ⭐ D197 Wave 1 #3 (47h) · THE LEDGER's model — pure: Home's tracker rows (lib/trackerRows.js) and a run's reported steps
// (lib/heldApplication.js runSteps) → what the final `Ledger` board draws: the front application's route, the register's
// squares and tags, the counts. "Only what the worker reports gets ticked": a stop is lit only when its step is done.

/** The application the run figure follows: the first that needs you, else one being filled, else ready, else the newest. */
export function ledgerFront(rows = []) {
  const by = (pred) => rows.filter((r) => r.node && pred(r)).sort((a, b) => (b.at || 0) - (a.at || 0))[0] || null;
  return by((r) => r.stage === "question" || r.stage === "needs") || by((r) => r.stage === "working" || r.stage === "waiting")
    || by((r) => r.stage === "ready") || by(() => true);
}

const STOP_WORDS = [
  { id: "posting", word: "READ" }, { id: "resume", word: "TAILORED" }, { id: "attached", word: "ATTACHED" },
  { id: "filled", word: "FILLED" }, { id: "you", word: "YOU" }, { id: "sent", word: "SENT" },
];

/**
 * runSteps' seven steps → the route's six stops, each { id, word, sub, state: done | underway | now | fail | ahead }.
 * FILLED with fields still open before YOU is underway (the board's white stop with a dot): the form waits on your answers.
 * `answers` = how many questions wait for you (the YOU stop's "2 answers").
 */
export function runStops(steps = [], { answers = 0 } = {}) {
  if (!steps.length) return [];
  const st = Object.fromEntries(steps.map((s) => [s.id, s]));
  const you = st.you?.state === "now" ? st.you : st.ready?.state === "now" ? { ...st.ready, state: "now", ready: true } : st.you;
  const out = STOP_WORDS.map(({ id, word }) => {
    const s = id === "you" ? you : st[id];
    const raw = s?.state || "";
    let state = raw === "done" ? "done" : raw === "now" ? "now" : raw === "fail" ? "fail" : "ahead";
    let sub = "";
    if (id === "posting") sub = "The posting";
    if (id === "resume") { const m = /^ATS (\d+) → (\d+)$/.exec(s?.meta || ""); sub = m ? `${m[1]} → ${m[2]} ATS` : state === "done" ? "Your résumé" : "Waiting"; }
    if (id === "attached") sub = state === "done" ? "Résumé" : "Waiting";
    if (id === "filled") {
      const m = /^(\d+) of (\d+)$/.exec(s?.meta || "");
      sub = m ? `${m[1]} of ${m[2]} fields` : s?.meta && s.meta !== "waiting" ? `${s.meta} fields` : state === "fail" ? "Nothing filled" : "Not yet";
      if (state === "done" && m && Number(m[1]) < Number(m[2]) && you?.state === "now") state = "underway";
    }
    if (id === "you") sub = you?.ready ? "Ready to send" : state === "now" ? (answers ? `${answers} answer${answers === 1 ? "" : "s"}` : "Your turn") : state === "done" ? "Answered" : "Not yet";
    if (id === "sent") sub = state === "done" ? "Confirmed" : "Not yet";
    return { id, word, sub, state };
  });
  return out.map((o, i) => ({ ...o, x: 60 + i * 104 }));
}

/** A register row's six squares from its stops: d done · u underway · y needs you · - not yet. Sent with no steps = all done. */
export function squaresOf(row, stops) {
  if (stops?.length) return stops.map((s) => (s.state === "done" ? "d" : s.state === "underway" ? "u" : s.state === "now" ? "y" : "-"));
  const sentish = ["sent", "replies"].includes(row?.filter);
  return Array.from({ length: 6 }, () => (sentish ? "d" : "-"));
}

/** The register's status tag (the word carries the state). */
export function tagOf(row) {
  if (row.stage === "question" || row.stage === "needs") return "NEEDS YOU";
  if (row.stage === "working" || row.stage === "waiting" || row.stage === "picked" || row.stage === "pending_self") return "IN PROGRESS";
  if (row.node?.kind === "held" && row.node?.ref?.fixedSince) return "HELD · FIXED";
  // the stage's own word, short (the line beside the squares says the rest — a date, a count)
  const WORD = { ready: "READY TO SEND", sent: "SENT", no_reply: "NO REPLY", interview: "INTERVIEW", assessment: "ASSESSMENT", offer: "OFFER",
    rejected: "NOT SELECTED", withdrawn: "WITHDRAWN", not_applied: "NOT APPLIED", stopped: "STOPPED" };
  return WORD[row.stage] || String(row.status || "").toUpperCase() || "—";
}

/** The row's one button in the register (it opens the row in place, where every stage action lives). */
export function actOf(row) {
  if (row.stage === "question" || row.stage === "needs") return "Answer";
  if (row.stage === "ready") return "Review";
  return "View";
}

/** The header's counts as the stats strip's cells, each a filter of the register (D200 Rule 2). */
export function countCells(counts, { filter, onFilter } = {}) {
  const cell = (key, label, to, extra = {}) => ({ key, value: counts?.[key] ?? 0, label, pressed: filter === to, onClick: onFilter ? () => onFilter(filter === to ? "all" : to) : undefined,
    aria: `${counts?.[key] ?? 0} ${label.toLowerCase()} — show them in the register`, attrs: { "data-ledger-count": key }, ...extra });
  return [
    cell("needs", "NEEDS YOU", "needs", { tone: counts?.needs ? "clay" : undefined }),
    cell("progress", "IN PROGRESS", "progress"), cell("sent", "SENT", "sent"), cell("replied", "REPLIED", "replies"), cell("interview", "INTERVIEW", "replies"),
  ];
}

/** The ISO week of a date (the kicker's WEEK 47). */
export function isoWeekOf(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400e3 + 1) / 7);
}

/**
 * Tickets out (D199 C1 — the market's third section, on Home now), each only when the page can back it:
 * the market (its new-today count and the deck's best match, when the market has been read this session), the best
 * match's survey sheet (else the front application's company), Interview (the next booked one, else what's been sent),
 * and the interchange to Atlas for the front application's first gap with an Atlas page.
 */
export function ledgerTickets({ newToday = null, best = null, front = null, nextInterview = null, sent = 0, sentCompanies = [], gap = null, paths }) {
  const out = [{ key: "market", kicker: newToday != null ? `THE MARKET · ${newToday} NEW TODAY` : "THE MARKET", title: "Find the next one",
    line: best?.company ? `Your best match today is ${best.match} at ${best.company}.` : "Openings that fit your bearing, best first.", go: "Open the market →", href: paths.market }];
  const co = best?.company || front?.company || null;
  if (co) out.push({ key: "survey", kicker: best?.company ? "SURVEY SHEET · YOUR BEST MATCH" : "SURVEY SHEET · YOUR NEXT ONE", title: co,
    line: "Their stack, their hiring, their H-1B history — moved here from the market.", go: "Open the survey sheet →", href: paths.company(co) });
  if (nextInterview) out.push({ key: "interview", kicker: `INTERVIEW · ${nextInterview.when}`, title: `Prepare for ${nextInterview.company}`,
    line: "Practice the questions they ask most, before the day.", go: "Start practising →", href: paths.interview });
  else if (sent > 0) out.push({ key: "interview", kicker: `INTERVIEW · ${sent} SENT`, title: "Prepare before they reply",
    line: sentCompanies.length ? `Practice the questions ${sentCompanies.slice(0, 2).join(" and ")} ask most.` : "Practice the questions they ask most.", go: "Start practising →", href: paths.interview });
  if (gap) out.push({ key: "atlas", kicker: "⇄ INTERCHANGE · ATLAS", title: gap.tech, line: `${gap.company} asks for it, and your résumé doesn’t show it yet.`, go: "Walk the place →", href: gap.href });
  return out;
}
