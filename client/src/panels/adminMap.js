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
  ] },
  { id: "board", label: "The board", question: "What is on it, and why?", sections: [
    ["companies", "Companies and candidates"], // #9
    ["scope", "Scope and age"],                // #5
    ["crawler", "Crawler"],                    // #14
    ["harvest", "Slug harvest"],               // #10
    ["enrichment", "Enrichment"],              // #13
  ] },
  { id: "people", label: "People", question: "Who is using it?", sections: [
    ["users", "Users"],                 // #15a + #17
    ["support", "Support"],             // D88 P3 — tickets
    ["messages", "Messages"],           // #19 — was under every tab
    ["trial", "Testers"],               // D124 → D131: the trial + both surveys as one readable page (the old tables below it)
  ] },
  { id: "data", label: "Data", question: "What is stored?", sections: [
    ["jobdata", "Job data in and out"], // #8 — the one place for postings in and out
    ["scoring", "Board-fit scoring"],   // #7
    ["calibrate", "ATS calibration"],   // D125 — the owner's hand-checked gold set: terms, verbs, scores; the gate's baseline
    ["readiness", "Readiness questions"], // D142 — the CHECK bank: drafts wait for a person's review
    ["database", "Database"],           // #20–#26 — the inspector's own page
    ["atlas", "Atlas"],                 // D105 P4 — the Atlas's drafts, published here so the public pages exist
  ] },
  { id: "system", label: "System", question: "Is it set up right?", sections: [
    ["switches", "Feature switches"],   // #6 + D86's plugin
    ["tools", "Tools service"],         // #11
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
