// services/network/referrals.js — ⭐ D180 P4 (45r, owner 11-08: "build ... and merge later") · CONNECTIONS AT A COMPANY,
// and ASK FOR A REFERRAL. Behind the network switch (OFF by default; the routes 404 while off).
//
// "When a connection works at a posting's company (and shows it to connections), the posting and company page show
// '1 connection works here' → Ask for a referral (a templated message they can edit; ties to D138 warm paths)."
//   · ONLY CONNECTIONS — never a stranger, never across a block.
//   · ONLY WHAT THEY SHOW — their latest experience row counts only when their Experience section is visible to
//     connections or the public (D183's effective level). A private page or a hidden Experience never counts.
//   · THE SAME COMPANY — matched by the company page's own slug rule (shared/companyPaths.js companySlug), so "Stripe,
//     Inc." and "Stripe" are one, and nothing is guessed from a partial name.
//   · The ask is an ordinary message (messages.js sendMessage — sealed, blockable, reportable), with the job as a card;
//     the template is only offered — the person edits it before it is sent.
import { isBlocked } from "./connections.js";
import { readVisibility } from "../profilePage.js";
import { companySlug } from "../../shared/companyPaths.js";

const handleOf = (db, id) => db.prepare(`SELECT handle FROM proof_pages WHERE user_id = ?`).pluck().get(id) || null;
const nameOf = (db, id) => db.prepare(`SELECT name FROM people_index WHERE user_id = ?`).pluck().get(id) || handleOf(db, id) || "A draft member";

/** My connections who show that they work at `companyName` now (their latest experience row). */
export function connectionsAt(db, me, companyName) {
  const want = companySlug(companyName);
  if (!want) return { count: 0, people: [] };
  const ids = db.prepare(`SELECT CASE WHEN low_id = ? THEN high_id ELSE low_id END FROM network_connections
      WHERE (low_id = ? OR high_id = ?) AND status = 'accepted'`).pluck().all(me, me, me);
  const people = [];
  for (const id of ids) {
    if (isBlocked(db, me, id)) continue;
    let vis; try { vis = readVisibility(db, id); } catch { continue; }
    if (!["connections", "public"].includes(vis.effective.experience)) continue;
    let latest = null;
    try { latest = db.prepare(`SELECT company, title FROM profile_experience WHERE user_id = ? ORDER BY position, id LIMIT 1`).get(id); } catch { latest = null; }
    if (!latest || companySlug(latest.company) !== want) continue;
    const handle = handleOf(db, id);
    if (!handle) continue;
    people.push({ handle, name: nameOf(db, id), title: latest.title || null, openToReferrals: !!vis.referrals });
  }
  return { count: people.length, people };
}

/** The message offered for an ask — the person edits it before sending. */
export function referralTemplate({ name, company, jobTitle = null, myName = null }) {
  const first = String(name || "").split(/\s+/)[0] || "there";
  const role = jobTitle ? `the ${jobTitle} role` : "a role";
  return `Hi ${first} — I saw ${role} at ${company} and I'm applying. Would you be open to referring me, or telling me a bit about the team? `
    + `I've shared the posting below. Thank you!${myName ? ` — ${myName}` : ""}`;
}
