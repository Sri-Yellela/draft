// ⭐ D83 · THE ADMIN MAP — five groups, each answering one question, holding the panels that answer it.
// Decided 10-09 (39d) from docs/ADMIN_AUDIT.md's proposed marks (the owner: "go with your recommended decisions").
// A panel lives in exactly one group; the audit row it came from is in the comment.

export const ADMIN_GROUPS = Object.freeze([
  { id: "today", label: "Today", question: "What needs me?", sections: [
    ["glance", "At a glance"],          // #1 (+ #20's detail stays on the database inspector)
    ["deploys", "Deployments"],         // #2 + #3
    ["disk", "Disk and backups"],       // #4 + #15b
    ["costs", "Costs & quotas"],        // cost visibility + #12 (+ #16's figures)
    ["activity", "Activity"],           // #16's live parts: users, résumés, postings
    ["outcomes", "Outcomes"],           // D185-5 (45q): interviews per application and per active person, by week
    ["phase1", "Phase 1 measures"],     // D150 T16 — the audit funnel, the bank's answers, debriefs, each against its target
  ] },
  { id: "board", label: "The board", question: "What is on it, and why?", sections: [
    ["companies", "Companies and candidates"], // #9
    ["records", "Company records"],            // A142 (45o): counts, postings with no record, likely duplicates, the review queue
    ["scope", "Scope and age"],                // #5
    ["crawler", "Crawler"],                    // #14
    ["harvest", "Slug harvest"],               // #10
    ["enrichment", "Enrichment"],              // #13
  ] },
  { id: "people", label: "People", question: "Who is using it?", sections: [
    ["users", "Users"],                 // #15a + #17
    ["support", "Support"],             // D88 P3 — tickets
    ["messages", "Messages"],           // #19 — was under every tab
    ["alerts", "New-match alerts"],     // D185-2 (45q): time from posting to alert, per source
    ["network", "Network"],             // D180 P1 (45o): the switch (OFF) and the counts
    ["reports", "Profile reports"],     // D183 — reports sent from a public profile (/in/<handle>): dismiss, action, re-open
    ["testers", "Testers"],             // D131: the trial testers' answers + both surveys as one readable page (the D124 trial removed 11-07)
  ] },
  { id: "data", label: "Data", question: "What is stored?", sections: [
    ["jobdata", "Job data in and out"], // #8 — the one place for postings in and out
    ["scoring", "Board-fit scoring"],   // #7
    ["calibrate", "ATS calibration"],   // D125 — the owner's hand-checked gold set: terms, verbs, scores; the gate's baseline
    ["readiness", "Readiness questions"], // D142 — the CHECK bank: drafts wait for a person's review
    ["questions", "Question bank"],     // D150 T02 — the ONE bank (audit, Check, Play, Learn, guides): nothing live unreviewed
    ["database", "Database"],           // #20–#26 — the inspector's own page
    ["atlas", "Atlas"],                 // D105 P4 — the Atlas's drafts, published here so the public pages exist
  ] },
  { id: "system", label: "System", question: "Is it set up right?", sections: [
    ["runs", "Runs"],                   // (A)-2 (45o): the run trace — every pick, résumé, answer and its source, what was sent
    ["switches", "Feature switches"],   // #6 + D86's plugin
    ["tools", "Tools service"],         // #11
    ["diagnostics", "Diagnostics"],     // D151 Rule 6 — loop delay, slowest endpoints, counts, DB / WAL size, growth; a 24 h read token
    ["usage", "Model usage"],           // D171 FIX 2 — every model call by hour, key and who started it; the daily cost alarm
    ["notices", "Notices"],             // D73 §B
    ["email", "Email health"],          // D94 — the Resend webhook's failed sends, suppressions, domain status
    ["admins", "Admins"],               // D95 — the admin accounts (never users): add, disable, last sign-in; owner only
    ["appearance", "Appearance"],       // D133 — the Studio theme per surface: the Admin pages' look, offered to users or not
  ] },
]);

/** The place a URL names, or the first panel of the group, or Today's glance. Unknown ids never strand the page. */
export function readAdminPlace(search = "") {
  const q = new URLSearchParams(search);
  return writeAdminPlace(q.get("g"), q.get("s"));
}

export function writeAdminPlace(g, s) {
  const group = ADMIN_GROUPS.find(x => x.id === g) || ADMIN_GROUPS[0];
  const section = group.sections.find(([id]) => id === s) || group.sections[0];
  return { g: group.id, s: section[0] };
}
