// ============================================================
// draftHouseExceptions — what Draft House's workspace shows, as data (D25)
// ============================================================
// The panel's job is EXCEPTIONS: of everything the pipeline did, the few things that stopped and
// need the user. Everything that worked stays quiet — an exact match is not listed anywhere, it is
// counted into one line inside the fold ("12 of 14 needed no attention").
//
// Pure functions over the feeds AutoApplyContext already loads, so the rules here can be tested in
// node without a browser and the panel cannot grow a second opinion about them.
//
// D22 ANTICIPATED, NOT BUILT: a remote run will be a Queued row, an expired portal session a
// Stopped item with its own `kind`. Each is one more case in buildStoppedItems — never a second list.
// ============================================================

/** The copy for Stop everything (D113 UI: Pause). Said on the Pause button and in Settings. */
export const STOP_DOES =
  "Stop everything holds every draft that has not started, and a run in progress starts nothing further.";
export const STOP_DOES_NOT =
  "It does not recall applications already sent. One already being filled finishes — stop it under Running.";
export const HELD_LINE = "Stopped — nothing new starts until you resume.";

/** Shown under the locked AUTO segment until the server says otherwise. */
export const AUTO_LOCKED_FALLBACK = "Auto has never run unattended against a real employer.";

/**
 * Whether AUTO may be selected. ⛔ ONLY the server can unlock it: anything other than an explicit
 * `locked: false` from GET /api/apply/run-bar — no answer yet, an error, an older server, a typo —
 * reads as locked. There is no client-side way to say yes.
 */
export function autoToggle(runBar) {
  const auto = runBar?.mode?.auto;
  const selectable = auto?.locked === false;
  return {
    selectable,
    reason: selectable ? null : (auto?.message || AUTO_LOCKED_FALLBACK),
  };
}

/** "3 of 40". A cap with no number yet renders nothing rather than a 0 nobody measured. */
export function capUsage(cap) {
  if (!cap || !Number.isFinite(cap.used) || !Number.isFinite(cap.limit)) return null;
  return `${cap.used} of ${cap.limit}`;
}

/**
 * The fold's one line for everything that needed no attention. `total` is how many fields there
 * were, `attention` how many are listed above it. Null when there is nothing quiet to count — "0 of
 * 2 needed no attention" is a sentence about nothing.
 */
export function quietLine(total, attention) {
  const t = Number(total) || 0;
  const a = Math.min(Number(attention) || 0, t);
  const quiet = t - a;
  if (t <= 0 || quiet <= 0) return null;
  return `${quiet} of ${t} needed no attention`;
}

/**
 * A pending application's answers, split. ONLY the guesses are listed — a fuzzy label match the
 * resolver would not swear to. Exact mappings, saved answers and profile fields are counted, not
 * shown: that is the reframe (D25), the panel shows what stopped, not every filled field.
 */
export function splitAnswers(answers = []) {
  const filled = (answers || []).filter(a => a && !a.skipped && !a.policy_rejected);
  const attention = filled.filter(a => a.provenance === "label_fuzzy");
  return { attention, total: filled.length, line: quietLine(filled.length, attention.length) };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Every Stopped item, in the order the user should meet them: what blocks EVERYTHING first
 * (prerequisites), then what one action clears for many (portals, shared questions), then the
 * per-application ones (approvals, holds). Each item is { key, kind, tone, title, sub, fold }.
 *
 *   tone   "danger" | "warning" | "info" — mapped to tokens by the component, never a colour here.
 *   fold   { needs: [string], quiet: string|null } — what the item needs, then the quiet line.
 *
 * The caller attaches actions by `kind`; this module decides only what is listed and how it reads.
 */
export function buildStoppedItems({
  prereqMissing = [], prereqLabels = {}, gatePortals = [], questions = [], pending = [],
  heldApplications = [], brokeApplications = [], companyLabel = (c) => c || "Unknown company",
} = {}) {
  const items = [];

  for (const key of prereqMissing) {
    items.push({
      key: `prereq-${key}`, kind: "prerequisite", tone: "danger", ref: key,
      title: prereqLabels[key]?.obstacle || `Your profile is missing ${String(key).replace(/_/g, " ")}`,
      sub: "Blocks every application until it is set",
      fold: { needs: [prereqLabels[key]?.action || "Add it to your profile."], quiet: null },
    });
  }

  for (const p of gatePortals) {
    const captcha = (p.gateReasons || []).includes("captcha_required");
    items.push({
      key: `portal-${p.origin}`, kind: "portal", tone: captcha ? "danger" : "info", ref: p,
      title: captcha ? `${p.host} is behind an identity check` : `Sign in to ${p.host} once`,
      sub: captcha
        ? `${plural(p.count, "application")} — open them and apply yourself`
        : `${plural(p.count, "application")} continue when you are signed in`,
      fold: {
        needs: [captcha
          ? "We do not defeat identity checks."
          : "Each one is still reviewed by you before it is sent."],
        quiet: null,
      },
    });
  }

  const groups = [
    { id: "confirm", tone: "warning", pick: q => q.reason === "low_confidence" && !q.eligibility,
      title: n => `${plural(n, "answer")} we guessed`, sub: "Confirm or correct — we would not send a guess" },
    { id: "attest", tone: "danger", pick: q => !!q.eligibility,
      title: n => `${plural(n, "question")} only you can answer`, sub: "Statements to the employer — never answered from your profile" },
    { id: "other", tone: "warning", pick: q => q.reason !== "low_confidence" && !q.eligibility,
      title: n => `${plural(n, "field")} we would not fill without you`, sub: "Saved answers are reused verbatim" },
  ];
  for (const g of groups) {
    const qs = questions.filter(g.pick);
    if (!qs.length) continue;
    items.push({
      key: `questions-${g.id}`, kind: "questions", tone: g.tone, ref: g.id,
      title: g.title(qs.length), sub: g.sub,
      fold: { needs: qs.slice(0, 6).map(q => q.question).concat(qs.length > 6 ? [`+${qs.length - 6} more`] : []), quiet: null },
    });
  }

  for (const p of pending) {
    const guesses = Number(p.guessCount) || 0;
    const total = Number(p.answerCount) || 0;
    items.push({
      key: `approval-${p.runJobId}`, kind: "approval", tone: "info", ref: p, jobId: p.jobId ?? null,
      title: companyLabel(p.company), sub: [p.title, "filled — waiting for your approval"].filter(Boolean).join(" · "),
      fold: {
        needs: guesses ? [`${plural(guesses, "answer")} matched by a guess — read before you approve`] : [],
        quiet: quietLine(total, guesses),
      },
    });
  }

  for (const app of heldApplications) {
    // groupByApplication's reasons are describeApplication's sentences — the obstacle, deduplicated.
    const reasons = (app.reasons || []).map(r => r?.obstacle).filter(x => typeof x === "string" && x);
    const missing = app.primary?.row?.missingRequired || [];
    items.push({
      key: `held-${app.key}`, kind: "held", tone: app.postingGone ? "warning" : app.protective ? "warning" : "danger", ref: app,
      jobId: app.jobId ?? null,
      title: companyLabel(app.company), sub: [app.title, app.postingGone ? "the posting is gone" : "stopped"].filter(Boolean).join(" · "),
      fold: { needs: [...reasons, ...missing.map(m => `Empty: ${m}`)], quiet: null },
    });
  }

  // Ended WITHOUT being sent, and not on purpose — a failure the user can retry or take over. The
  // held-on-purpose half of splitByFault (dismissed, superseded, stopped by the user) is NOT here:
  // nothing about it needs anyone, and history is The Table's.
  for (const app of brokeApplications) {
    const lead = app.primary || {};
    items.push({
      key: `broke-${app.key}`, kind: "broke", tone: "danger", ref: app, jobId: app.jobId ?? null,
      title: companyLabel(app.company), sub: [app.title, "did not complete — nothing was sent"].filter(Boolean).join(" · "),
      fold: { needs: [lead.obstacle, lead.action].filter(x => typeof x === "string" && x), quiet: null },
    });
  }

  return items;
}

/** Narrow Stopped by what a person would type: employer, role or the item's own words. */
export function filterItems(items, term) {
  const t = String(term || "").trim().toLowerCase();
  if (!t) return items;
  return items.filter(i => `${i.title} ${i.sub}`.toLowerCase().includes(t));
}

/** Above this many Stopped items the column offers a search box (PanelControls' PanelSearch). */
export const SEARCH_FROM = 6;

/**
 * ⭐ D52 · A PREPARED PACKET SAYS HOW LONG IT IS GOOD FOR — and a lapsed one is ONE click from fresh.
 * ⚠ The row assumed "the packet lives ~10 minutes": that is the TOKEN, minted fresh on every Fill. The
 * packet's answers go stale after PACKET_STALE_MS (72 h, services/applyGatePacket.js), and a stale one
 * used to offer only "Open" with a message saying "Run it again" — and no button that did.
 * @returns {{ state: "ready"|"stale"|"gone"|"none", line: string, action: "fill"|"prepare"|"open" }}
 */
export function packetLife(packet, now = Date.now()) {
  if (!packet) return { state: "none", line: "No prepared answers — it was held before the form was reached.", action: "prepare" };
  if (packet.postingGone) return { state: "gone", line: "The posting is no longer listed — there is no form to fill.", action: "open" };
  const left = Number(packet.staleAfterMs) - Number(packet.ageMs);
  if (packet.stale || !(left > 0)) return { state: "stale", line: "Prepared answers have gone stale — prepare again for fresh ones.", action: "prepare" };
  const h = Math.ceil(left / 3600000);
  const span = h >= 48 ? `${Math.floor(h / 24)} more days` : h >= 24 ? "1 more day" : `${h} more hour${h === 1 ? "" : "s"}`;
  // O80c: whether the packet carries its résumé (written in the background after the packet is stored).
  const resume = packet.resumeAvailable === true ? ", with its résumé"
    : packet.resumeAvailable === false ? " (the résumé is still being written — or could not be; Prepare again writes one)" : "";
  return { state: "ready", line: `Ready to fill${resume} — fresh for ${span}.`, action: "fill" };
}
