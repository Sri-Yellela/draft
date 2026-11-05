// shared/atsReportElement.js — ⭐ T9 · THE ATS REPORT. ONE IMPLEMENTATION, EVERY SURFACE, BOTH PRODUCTS.
//
// Owner, 10-14: "the same ATS panel we use on the website — same design and everything". The report was one React
// component (client/src/components/AtsReport.jsx, A52) that the extension could not import, so the extension drew
// its own thinner copy (a score mark and two comma lists) — the StampLogo lesson again. It is now THIS file: a
// framework-agnostic web component, `<draft-ats-report>`, with its own shadow root, built once and drawn by
//   · the web app — every ATS surface, through the thin React wrapper (client/src/components/AtsReport.jsx);
//   · the extension's popup — the element itself (extension/atsReport.js is this file, bundled);
//   · the extension's on-page panel — mountAtsReport() into the panel's shadow root, because a content script's
//     isolated world has no custom-element registry (customElements is null there); the same renderer, the same CSS.
//
// ⛔ PURE PRESENTATION, NO NETWORK. It is handed a report — the scorer's own JSON, the same the web app's ATS panel
// gets — and draws it. It fetches nothing, stores nothing, and loads nothing: no image, no font file, no script.
// ⛔ THE POSTING'S WORDS ARE TEXT. Every term, reason and sentence goes in through textContent / a text node — never
// innerHTML, never an attribute that is parsed — so a posting that "asks for" <img onerror=…> prints those characters.
// ⛔ ITS COLOURS ARE THE THEME REGISTRY'S. The token values for all four themes are set on :host
// (shared/atsReportStyles.js atsHostCss, from the generated shared/atsReportTokens.js); `theme` names one, no theme
// follows the OS (Paper Light / Charcoal Dark). `cues="shape"` turns on the shape cues (D91 P4).
// ⛔ CLAIMS ARE THE HOST'S. With `claims` set, a claim box is a button that dispatches `draft-ats-claim`
// { kind: "skill"|"action_verb", term, claimed } — the web app's ATS panel does the reversible call (AG2). Without
// it (the extension, the public tool) every box is read-only and the claim copy is not shown. NOTHING IS PRE-SELECTED.
// ⛔ D32's hover link: with `linkable`, pointing at (or focusing) a box dispatches `draft-ats-term` { term } and
// { term: null } on leaving — on request only, never standing.
// ⭐ D105 P5 · LINKS IN: with `atlas` = { base, slugs: { term: slug } }, a term that has a PUBLISHED Atlas page gets a
// small "Atlas" link beside its term (inside the row, never inside the claim button). The
// host resolves the slugs (GET /api/atlas/resolve); a term absent from `slugs` draws no link, so there is never a
// dead one. `base` is "/atlas/" in the web app and the server's https origin + "/atlas/" in the extension; anything
// else falls back to "/atlas/". Verbs and generic language never link.
//
// ⭐ D152 (8) (owner 11-04, docs/sketches/ats-options.html OPTION A — approved): the INSIDE is option A's content —
// "28 of 40 things this posting asks for" as the heading (the band heading in the logo face is gone), one plain
// sentence, the bar (on your résumé · claimed by you · missing) and its key, "You could claim · n" / "History" as quiet
// switches, and the claims as PLAIN ROWS with a "That's true of me" button (the depth boxes are gone). The rest —
// Experience, Already yours, Generic, More — keeps its meaning, restyled as plain rows and folds.
// The reasoning behind each section is A52 / D31 / D32 / A86 / D50's — see the history of
// client/src/components/AtsReport.jsx; the comments below keep the load-bearing ones.
import { atsBandLabel, atsBandFor, ATS_BAND, ATS_NUMBER_SHOWN, ATS_NUMBER_NOTE } from "./atsBands.js";
import { profileSignalKey } from "./profileSignals.js";
import { reportBand, reportAsks, evidencedKeys, experienceState, EXPERIENCE_MARK, TERM_KINDS, cleanReport } from "./atsReportModel.js";
import { ATS_REPORT_SHADOW_CSS } from "./atsReportStyles.js";

export const ATS_REPORT_TAG = "draft-ats-report";
export const ATS_CLAIM_EVENT = "draft-ats-claim";
export const ATS_TERM_EVENT = "draft-ats-term";

// ── the one DOM helper: h(doc, tag, attrs, ...children). Strings become TEXT NODES, always. ─────────────────────
function h(doc, tag, attrs, ...kids) {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "width") el.style.width = v;                     // CSSOM, not a style attribute (a page's CSP allows it)
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(typeof kid === "string" || typeof kid === "number" ? doc.createTextNode(String(kid)) : kid);
  }
  return el;
}

const asSet = (v) => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : []));

/** The claim state a host hands in, normalised: { pending, skillKeys, verbKeys, lockedSkills, lockedVerbs }. */
function claimState(claims) {
  if (!claims) return null;
  return {
    pending: asSet(claims.pending),
    skillKeys: asSet(claims.claimedLookup?.skillKeys), verbKeys: asSet(claims.claimedLookup?.verbKeys),
    lockedSkills: asSet(claims.lockedSkills), lockedVerbs: asSet(claims.lockedVerbs),
  };
}

/** How many of the asks the person could claim they have claimed — a lock, a claim, a click in flight. */
function claimedCount(couldClaim, state) {
  if (!state) return 0;
  let n = 0;
  for (const t of couldClaim) {
    const claimKind = TERM_KINDS[t.kind]?.claim || "skill";
    const key = profileSignalKey(t.term);
    const keys = claimKind === "action_verb" ? state.verbKeys : state.skillKeys;
    const locked = claimKind === "action_verb" ? state.lockedVerbs : state.lockedSkills;
    if (keys.has(key) || locked.has(key) || state.pending.has(`${claimKind}:${t.term}`)) n += 1;
  }
  return n;
}

/**
 * ⭐ D152 (8) · THE BAR (ats-options.html option A): what the résumé shows · what the person claimed · the rest is the
 * track (missing). Generic language is not an ask, so it is not on the bar at all. Not enough signal is a dashed,
 * hue-less outline whose segments carry no hue — never a short Weak bar.
 */
function askBar(doc, { band, matched, claimed, total }) {
  const unknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const share = (n) => `${total > 0 ? (n / total) * 100 : 0}%`;
  return h(doc, "div", { class: "ats-bar", "data-ats-bar": true, "data-unknown": unknown ? "true" : "false", role: "img",
      "aria-label": `${matched} of ${total} asks already on your résumé; ${claimed} claimed by you` },
    h(doc, "div", { class: "ats-bar__seg ats-bar__seg--matched", width: share(matched) }),
    h(doc, "div", { class: "ats-bar__seg ats-bar__seg--claimed", width: share(claimed) }));
}

/** The bar's key — three words, each after a dot (a perfect circle, D60). */
function barKey(doc) {
  return h(doc, "div", { class: "ats-key", "aria-hidden": "true" },
    h(doc, "span", { class: "ats-key__i", "data-k": "matched" }, "on your résumé"),
    h(doc, "span", { class: "ats-key__i", "data-k": "claimed" }, "claimed by you"),
    h(doc, "span", { class: "ats-key__i", "data-k": "missing" }, "missing"));
}

/**
 * The header — ⭐ D152 (8), ats-options.html option A: "28 of 40 things this posting asks for", one plain sentence
 * under it (the number, provisional — D50 — or, with no number, the band in words), the reasons the reading is what
 * it is, then the bar and its key. ⛔ The band heading (the "Strong match" in the logo face) is GONE: the count is the
 * heading. Not enough signal is still the scorer declining — said in words, the bar dashed and hue-less.
 * The full report opens with it; the signup hook and the deck's collapsed score show only this (mode "band").
 */
export function buildBandCard(doc, report, { band: knownBand = null, compact = false, extra = null, claims = null } = {}) {
  const band = reportBand(report, knownBand);
  const meta = atsBandLabel(band);
  const isUnknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const declineReasons = Array.isArray(report?.decline_reasons) ? report.decline_reasons : [];
  const seniority = report?.seniority_cap?.applied ? report.seniority_cap : null;
  const hardMisses = Array.isArray(report?.hard_constraint_misses) ? report.hard_constraint_misses : [];
  const { matched, total, couldClaim } = reportAsks(report);
  const claimed = claimedCount(couldClaim, claims);
  // ⭐ D50 (owner, 10-07): the number, beside the count — never the only claim — and provisional (ATS_NUMBER_NOTE).
  // Static — nothing counts up. No score → no digit.
  const showNumber = ATS_NUMBER_SHOWN && !isUnknown && Number.isFinite(report?.score);
  const hasNotes = declineReasons.length > 0 || seniority || hardMisses.length > 0 || extra;
  const sub = isUnknown
    ? h(doc, "p", { class: "ats-sum__sub", "data-ats-unknown": true }, "Not enough signal to judge this posting — no judgement.")
    : showNumber
      ? h(doc, "p", { class: "ats-sum__sub", "data-ats-number-note": true, title: ATS_NUMBER_NOTE },
          "A ", h(doc, "span", { "data-ats-score": true }, `${Math.round(report.score)}%`), " match. The score is still being tuned, so read it with the count.")
      : h(doc, "p", { class: "ats-sum__sub", "data-ats-band-words": true }, `${meta.label} — read it with the count.`);
  return h(doc, "div", { "data-ats-band-card": true, "data-ats-band": band, class: "ats-sum ink-pair", "data-compact": compact ? "true" : "false" },
    total > 0 && h(doc, "h3", { "data-ats-count": true, class: "ats-sum__count" },
      `${matched + claimed} of ${total} things this posting asks for`),
    sub,
    hasNotes && h(doc, "div", { class: "ats-sum__notes" },
      declineReasons.length > 0 && h(doc, "ul", { class: "ats-notes" }, declineReasons.map(r => h(doc, "li", null, r))),
      seniority && h(doc, "div", { class: "ats-note" }, seniority.reason || ""),
      hardMisses.length > 0 && h(doc, "div", { "data-ats-hard": true, class: "ats-note ats-note--hard" },
        `Required by this posting, not on your profile: ${hardMisses.join(" · ")}`),
      extra),
    total > 0 && askBar(doc, { band, matched, claimed, total }),
    total > 0 && barKey(doc));
}

/** Experience — its own row: the one requirement that is genuinely pass/fail. */
function experienceRow(doc, experience) {
  const state = experienceState(experience);
  const m = EXPERIENCE_MARK[state] || null;
  return h(doc, "section", { class: "ats-sec" },
    h(doc, "div", { class: "ats-gh" }, h(doc, "span", { class: "ats-gh__label" }, "Experience")),
    h(doc, "div", { "data-ats-experience": true, class: "ats-exp", "data-state": state || "stated" },
      m && h(doc, "b", { class: "ats-exp__mark" }, h(doc, "span", { "aria-hidden": "true" }, m.mark), ` ${m.word}`),
      h(doc, "span", { class: "ats-exp__text" }, experience.summary || "")));
}

/** The Atlas link's base: a same-origin path or an https origin's /atlas/ — never javascript:, never http. */
export function atlasBase(base) {
  const b = String(base ?? "");
  if (b.startsWith("/") && !b.startsWith("//") && !b.includes("\\")) return b.endsWith("/") ? b : `${b}/`;
  try { const u = new URL(b); if (u.protocol === "https:") return u.href.endsWith("/") ? u.href : `${u.href}/`; } catch { /* fall through */ }
  return "/atlas/";
}

/** The small "Atlas" link for a term with a published Atlas page — or null (D105 P5: never a dead link). */
function atlasLink(doc, term, atlas) {
  const slug = atlas?.slugs && typeof atlas.slugs[term] === "string" ? atlas.slugs[term] : null;
  if (!slug) return null;
  return h(doc, "a", { class: "ats-atlas", href: `${atlasBase(atlas.base)}${encodeURIComponent(slug)}`, target: "_blank",
    rel: "noopener noreferrer", title: `About ${term} in the Atlas`, "aria-label": `About ${term} in the Atlas`, "data-atlas-link": slug }, "Atlas");
}

/**
 * One term, as a PLAIN ROW (⭐ D152 (8), option A — the depth boxes are gone): the term, its kind in small type, and —
 * where the person can claim it — a quiet "That's true of me" button at the row's end ("Claimed · undo" once claimed).
 *
 * THE COPY IS THE FEATURE. Pressing it asserts "I have this" — a claim the candidate will have to defend in an
 * interview. So it never reads as "add this to improve your score". CC4: a claim DOES count toward this score and
 * toward where the job ranks, and the copy says so. NOTHING IS PRE-SELECTED: a row reads as claimed only from what
 * the person did — a lock, a claim, a click in flight.
 */
function termRow(doc, host, { term: k, kind, generic = false, claims = null, evidenced: evidencedLookup = new Set(), linkable = false, atlas = null }) {
  const claimKind = TERM_KINDS[kind]?.claim || "skill";
  const claimedKeys = claims ? (claimKind === "action_verb" ? claims.verbKeys : claims.skillKeys) : new Set();
  const lockedLookup = claims ? (claimKind === "action_verb" ? claims.lockedVerbs : claims.lockedSkills) : new Set();
  const itemKey = profileSignalKey(k);
  const locked = lockedLookup.has(itemKey);
  const claimed = locked || claimedKeys.has(itemKey) || (claims ? claims.pending.has(`${claimKind}:${k}`) : false);
  const evidenced = evidencedLookup.has(itemKey);
  const interactive = !!claims && !generic && !locked;
  // D32's hover link — only where the host asked for it, only while pointed at or focused.
  const term = (t) => () => host?.dispatchEvent?.(new CustomEvent(ATS_TERM_EVENT, { detail: { term: t }, bubbles: true, composed: true }));
  const linkProps = linkable
    ? { onmouseenter: term(k), onmouseleave: term(null), onfocus: term(k), onblur: term(null), "data-pair-term": k }
    : {};
  const provenance = generic
    ? "Generic language — almost any candidate could claim this. Not a gap."
    : evidenced
      ? "Your resume already shows this"
      : claimed ? "You claimed this — the job description asked for it" : "This job asked for it. Your resume does not show it.";
  const tone = generic ? "gen" : (evidenced || claimed) ? "ok" : "claim";
  const key = `${generic ? "g" : kind}:${k}`;
  // Skills and qualities link; a verb ("design", "lead") and generic language are not Atlas pages.
  const link = generic || kind === "verb" ? null : atlasLink(doc, k, atlas);
  const label = h(doc, "span", { class: "ats-cl__term" }, h(doc, "b", null, k),
    // Generic language carries no kind — the word alone.
    !generic && h(doc, "small", { class: "ats-cl__kind" }, TERM_KINDS[kind]?.label || kind), link);
  if (!interactive) {
    return h(doc, "div", { class: "ats-cl", "data-kind": kind, "data-tone": tone, "data-claimed": claimed ? "true" : "false",
        "data-key": key, title: provenance, tabindex: linkable ? "0" : null, ...linkProps },
      label, claimed && !evidenced && h(doc, "span", { class: "ats-cl__state" }, locked ? "On your profile" : "Claimed"));
  }
  return h(doc, "div", { class: "ats-cl", "data-kind": kind, "data-tone": claimed ? "ok" : "claim", "data-claimed": claimed ? "true" : "false" },
    label,
    h(doc, "button", { type: "button", class: "ats-cl__claim", "data-claim-chip": claimKind, "data-key": key, "aria-pressed": claimed ? "true" : "false",
        title: claimed ? `You claimed "${k}". Press to withdraw it.`
                       : `Claim "${k}" — only if it is true of you. It counts toward this score and toward where this job ranks, and it is used in future resumes.`,
        onclick: () => host?.dispatchEvent?.(new CustomEvent(ATS_CLAIM_EVENT,
          { detail: { kind: claimKind, term: k, claimed: !claimed }, bubbles: true, composed: true })),
        ...linkProps },
      claimed ? "Claimed · undo" : "That's true of me"));
}

function listSection(doc, title, items) {
  return h(doc, "div", null,
    h(doc, "div", { class: "ats-sec__label" }, title),
    h(doc, "div", { class: "ats-list" },
      items.map(t => h(doc, "div", { class: "ats-list__item" }, h(doc, "span", { "aria-hidden": "true" }, "·"), h(doc, "span", null, t)))));
}

/**
 * ⭐ D152 (8) · THE QUIET SWITCHES — "You could claim · n" and "History". Only where the host has a history to show
 * (the web app's posting: this job's résumé versions, handed in as light-DOM content for the `history` slot); with
 * nothing to switch to, "You could claim · n" is a plain heading and no control is drawn (the extension, the deck).
 */
function viewSwitches(doc, n, withHistory) {
  if (!withHistory) return h(doc, "div", { class: "ats-tabs ats-tabs--one" }, h(doc, "span", { class: "ats-tab", "data-ats-view": "claim" }, `You could claim · ${n}`));
  return h(doc, "div", { class: "ats-tabs", role: "group", "aria-label": "Show" },
    [["claim", `You could claim · ${n}`], ["history", "History"]].map(([view, words]) =>
    h(doc, "button", { type: "button", class: "ats-tab", "data-ats-view": view, "aria-pressed": view === "claim" ? "true" : "false",
      onclick: (e) => showAtsView(e.currentTarget?.closest?.("[data-ats-report]"), view) }, words)));
}

/** Show one view: the switch pressed, its panel shown, the other hidden. No redraw — the claim rows keep their state. */
export function showAtsView(tree, view) {
  for (const b of tree.querySelectorAll?.("button[data-ats-view]") || []) b.setAttribute("aria-pressed", String(b.getAttribute("data-ats-view") === view));
  for (const p of tree.querySelectorAll?.("[data-ats-view-panel]") || []) {
    if (p.getAttribute("data-ats-view-panel") === view) p.removeAttribute("hidden"); else p.setAttribute("hidden", "");
  }
}

/**
 * THE FULL REPORT, as a DOM tree (no styles — mountAtsReport adds the shadow root and the stylesheet).
 *
 * @param doc     the document to build in
 * @param report  the scorer's report shape (cleanReport'd by the caller; see fromDeckReport / fromStandaloneResult)
 * @param opts    { band, mode: "full"|"band", compact, claims, linkable, atlas, history, host } — `host` receives the
 *                events; `atlas` { base, slugs } links a term to its published Atlas page (D105 P5); `history` true
 *                draws the History switch and a `history` slot for the host's own content (D152 (8))
 */
export function buildAtsReport(doc, report, { band: knownBand = null, mode = "full", compact = false, claims = null, linkable = false, atlas = null, history = false, host = null } = {}) {
  if (!report) return null;
  const state = claimState(claims);
  if (mode === "band") return buildBandCard(doc, report, { band: knownBand, compact, claims: state });
  // Strengths and improvements only ever came from the LLM scorer. Matched on the family, so a new
  // local report version cannot quietly switch them back on.
  const isLocalReport = String(report.source || "").startsWith("local_ats");
  // `pct` survives only for the best-possible line (LLM reports), which is itself shown as a band.
  const pct = Math.max(0, Math.min(100, report.score ?? 0));
  const depth = report.resume_depth || null;
  const { onResume, couldClaim, generic } = reportAsks(report);
  const evidenced = evidencedKeys(report);
  const canClaim = !!state;
  // The verdict is printed once: when it is only the experience summary again (the A52 "renders twice"
  // defect), the Experience row already said it.
  const verdict = report.verdict && report.verdict !== report.experience?.summary ? report.verdict : null;
  const more = verdict || (!isLocalReport && (report.strengths?.length || report.improvements?.length));
  const row = (t, extra = {}) => termRow(doc, host, { ...t, evidenced, linkable, atlas, ...extra });

  // A BAND, NOT THE NUMBER (G5): the best fit the profile can reach.
  const best = report.best_possible_score != null ? h(doc, "div", { class: "ats-note", "data-best": pct === report.best_possible_score ? "reached" : "short" },
    pct === report.best_possible_score
      ? "✓ The best fit your profile can reach for this posting"
      : [h(doc, "span", { class: "ats-note__best" }, `Best possible for your profile: ${atsBandLabel(atsBandFor(report.best_possible_score)).label}`),
         report.best_possible_reason ? h(doc, "span", null, ` — ${report.best_possible_reason}`) : null]) : null;

  const claimView = [
    // The résumé-depth warning sits under the header it qualifies, never above it.
    depth && h(doc, "div", { class: "ats-note ats-sec" },
      h(doc, "div", { class: "ats-note__head" }, depth.headline || ""), h(doc, "div", null, depth.detail || "")),
    // ⭐ D32 → D152 (8): "YOU COULD CLAIM" IS ONE BLOCK, AND THE ONLY OPEN SECTION — skills, verbs and qualities
    // together, each row labelled with the scorer's bucket, a plain row each.
    couldClaim.length > 0 && h(doc, "section", { "data-ats-could-claim": true, class: "ats-sec ats-sec--claim" },
      h(doc, "p", { class: "ats-sec__sub" }, canClaim
        ? "The posting asks for these and your résumé doesn't show them. Claim only the ones that are true of you."
        : "The posting asks for these and your résumé doesn't show them."),
      h(doc, "div", { class: "ats-claims" }, couldClaim.map(t => row(t, { claims: state }))),
      // ⛔ THE CLAIM COPY APPEARS ONCE — beneath the rows, where the action is.
      canClaim && h(doc, "p", { "data-claim-note": true, class: "ats-claim-note" },
        "Claiming says it's true of you: it counts toward this score and where jobs rank, and it's used in résumés " +
        "made from now on. It never rewrites one you already have, and you can withdraw it any time. " +
        "Nothing is ever pre-selected.")),
    // ⭐ D32: Experience gets its own row — pass/fail, not a footnote.
    report.experience?.summary && experienceRow(doc, report.experience),
    // FOLDED: what the résumé already shows. Read-only — there is nothing to do here.
    onResume.length > 0 && h(doc, "details", { "data-ats-on-resume": true, "data-fold": "on-resume", class: "ats-fold ats-sec" },
      h(doc, "summary", { class: "ats-gh" }, h(doc, "span", { class: "ats-gh__label" }, "Already yours"), h(doc, "span", { class: "ats-gh__ct" }, onResume.length)),
      h(doc, "div", { class: "ats-claims" }, onResume.map(t => row(t)))),
    // Generic language — AH3. ⛔ NOT a gap, deliberately not claimable, FOLDED AWAY and labelled so —
    // surfacing "Managed" or "collaboration" as a deficiency is a claim that is not true.
    report.action_verbs_generic?.length > 0 && h(doc, "details", { "data-ats-generic": true, "data-fold": "generic", class: "ats-fold ats-sec" },
      h(doc, "summary", { class: "ats-gh" }, h(doc, "span", { class: "ats-gh__label" }, "Generic — not a gap"), h(doc, "span", { class: "ats-gh__ct" }, generic.length)),
      h(doc, "p", { class: "ats-sec__sub" }, "This job uses these, but almost any candidate could claim them — they are not a gap."),
      h(doc, "div", { class: "ats-claims" }, generic.map(t => row(t, { generic: true })))),
    // The verdict and (LLM reports only) strengths and improvements — folded, printed once.
    more && h(doc, "details", { "data-ats-more": true, "data-fold": "more", class: "ats-fold ats-sec" },
      h(doc, "summary", { class: "ats-gh" }, h(doc, "span", { class: "ats-gh__label" }, "More about this match")),
      h(doc, "div", { class: "ats-more" },
        verdict && h(doc, "div", { class: "ats-more__verdict" }, verdict),
        !isLocalReport && report.strengths?.length > 0 && listSection(doc, "💪 Strengths", report.strengths),
        !isLocalReport && report.improvements?.length > 0 && listSection(doc, "🔧 Improvements", report.improvements))),
  ].filter(Boolean);
  const withHistory = !!history;
  const hasBody = claimView.length > 0 || withHistory;

  return h(doc, "div", { "data-ats-report": true, class: "ats-card ink-pair" },
    // Band card. Renders for EVERY report, including a declined one. (⭐ D152 (8): the header — the count, not the band.)
    buildBandCard(doc, report, { band: knownBand, extra: best, claims: state }),
    hasBody && h(doc, "div", { class: "ats-sb" },
      (couldClaim.length > 0 || withHistory) && viewSwitches(doc, couldClaim.length, withHistory),
      h(doc, "div", { "data-ats-view-panel": "claim", class: "ats-view" }, claimView),
      withHistory && h(doc, "div", { "data-ats-view-panel": "history", class: "ats-view ats-hist", hidden: true },
        h(doc, "slot", { name: "history" }))));
}

// ── mounting: a shadow root, the stylesheet once, and the reader's place kept across a redraw ────────────────────
const SIG = Symbol.for("draft.atsReport.sig");
const setsOut = (c) => c && { pending: [...asSet(c.pending)].sort(), s: [...asSet(c.claimedLookup?.skillKeys)].sort(),
  v: [...asSet(c.claimedLookup?.verbKeys)].sort(), ls: [...asSet(c.lockedSkills)].sort(), lv: [...asSet(c.lockedVerbs)].sort() };

/**
 * Draw `report` into `host`'s (open) shadow root — creating it, and its one <style>, the first time. A redraw with
 * the same inputs does nothing; a redraw with new ones keeps which folds are open, which switch is chosen and which row has focus, so a
 * claim click (which the host answers with new claim state) never closes a fold or drops the keyboard's place.
 * @returns {ShadowRoot}
 */
export function mountAtsReport(host, report, opts = {}) {
  const doc = host.ownerDocument;
  const root = host.shadowRoot || host.attachShadow({ mode: "open" });
  let style = root.querySelector?.("style[data-ats-style]") || null;
  if (!style) { style = doc.createElement("style"); style.setAttribute("data-ats-style", ""); style.textContent = ATS_REPORT_SHADOW_CSS; root.append(style); }
  const clean = cleanReport(report);
  const sig = JSON.stringify([clean, opts.band ?? null, opts.mode || "full", !!opts.compact, !!opts.linkable, !!opts.history, setsOut(opts.claims),
    opts.atlas ? [atlasBase(opts.atlas.base), opts.atlas.slugs || {}] : null]);
  if (root[SIG] === sig) return root;
  root[SIG] = sig;
  const prior = root.querySelector?.("[data-ats-root]") || null;
  const open = new Set(prior ? [...prior.querySelectorAll("details[open]")].map(d => d.getAttribute("data-fold")) : []);
  const focused = root.activeElement?.getAttribute?.("data-key") || null;
  // ⭐ D152 (8): the switch the reader chose (You could claim / History) survives a redraw, as a fold does.
  const view = prior?.querySelector?.('button[data-ats-view][aria-pressed="true"]')?.getAttribute("data-ats-view") || null;
  const tree = clean ? buildAtsReport(doc, clean, { ...opts, host }) : null;
  const wrap = doc.createElement("div");
  wrap.setAttribute("data-ats-root", "");
  if (tree) wrap.append(tree);
  if (prior) prior.replaceWith(wrap); else root.append(wrap);
  for (const d of wrap.querySelectorAll?.("details[data-fold]") || []) if (open.has(d.getAttribute("data-fold"))) d.setAttribute("open", "");
  if (view && tree) showAtsView(tree, view);
  if (focused) {
    for (const el of wrap.querySelectorAll?.("[data-key]") || []) if (el.getAttribute("data-key") === focused) { el.focus?.(); break; }
  }
  return root;
}

/**
 * `<draft-ats-report>` — the element. Properties: `report` (the scorer's JSON), `band`, `claims` (see claimState),
 * `linkable`, `atlas` ({ base, slugs } — D105 P5). Attributes: `mode` ("full" | "band"), `compact`, `theme` (a registry id; none follows the OS),
 * `cues` ("shape"), `history` (D152 (8): draw the History switch; the host's light-DOM child with slot="history" is its content), `bare`
 * (no card of its own — the host's surface is the card, as the posting's match block is). Defined only where a registry exists; returns the class (or null).
 */
export function defineAtsReportElement(registry = typeof customElements !== "undefined" ? customElements : null) {
  if (!registry || typeof HTMLElement === "undefined") return null;
  const existing = registry.get(ATS_REPORT_TAG);
  if (existing) return existing;
  class DraftAtsReport extends HTMLElement {
    static get observedAttributes() { return ["mode", "compact", "history"]; }
    constructor() { super(); this._report = null; this._band = null; this._claims = null; this._linkable = false; this._atlas = null; this._queued = false; }
    set report(v) { this._report = v ?? null; this._schedule(); }
    get report() { return this._report; }
    set band(v) { this._band = v ?? null; this._schedule(); }
    get band() { return this._band; }
    set claims(v) { this._claims = v ?? null; this._schedule(); }
    get claims() { return this._claims; }
    set linkable(v) { this._linkable = !!v; this._schedule(); }
    get linkable() { return this._linkable; }
    set atlas(v) { this._atlas = v ?? null; this._schedule(); }
    get atlas() { return this._atlas; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this._schedule(); }
    _schedule() {
      if (this._queued) return;
      this._queued = true;
      queueMicrotask(() => { this._queued = false; this.render(); });
    }
    /** Draw now (the microtask batch calls this; a host that needs the tree at once may too). */
    render() {
      return mountAtsReport(this, this._report, { band: this._band, mode: this.getAttribute("mode") || "full",
        compact: this.hasAttribute("compact"), history: this.hasAttribute("history"), claims: this._claims, linkable: this._linkable, atlas: this._atlas });
    }
  }
  registry.define(ATS_REPORT_TAG, DraftAtsReport);
  return DraftAtsReport;
}
