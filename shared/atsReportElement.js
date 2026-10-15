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
//
// The structure, the classes and the copy are A52 / D31 / D32 / A86 / D50's, unchanged — see the history of
// client/src/components/AtsReport.jsx for the reasoning behind each; the comments below keep the load-bearing ones.
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

/**
 * The one THREE-segment bar: matched · missing · generic. Not enough signal is a dashed, hue-less
 * outline whose segments carry no hue at all — never a short Weak bar.
 */
function askBar(doc, { band, matched, missing, generic }) {
  const unknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const all = matched + missing + generic;
  const share = (n) => `${all > 0 ? (n / all) * 100 : 0}%`;
  return h(doc, "div", { class: "ats-bar", "data-ats-bar": true, "data-unknown": unknown ? "true" : "false", role: "img",
      "aria-label": `${matched} of ${matched + missing} asks already on your résumé; ${generic} generic, not a gap` },
    h(doc, "div", { class: "ats-bar__seg ats-bar__seg--matched", width: share(matched) }),
    h(doc, "div", { class: "ats-bar__seg ats-bar__seg--missing", width: share(missing) }),
    h(doc, "div", { class: "ats-bar__seg ats-bar__seg--generic", width: share(generic) }));
}

/**
 * The band card — THE HEADER: the band, "you cover 9 of 12", the score (D50: shown, provisional), the
 * three-segment bar. Below it, only when they exist, the reasons the band is what it is: why the scorer
 * declined, the seniority note, the profile facts the posting requires. The full report opens with it;
 * the signup hook and the deck's collapsed score show only this (mode "band").
 */
export function buildBandCard(doc, report, { band: knownBand = null, compact = false, extra = null } = {}) {
  const band = reportBand(report, knownBand);
  const meta = atsBandLabel(band);
  const isUnknown = band === ATS_BAND.NOT_ENOUGH_SIGNAL;
  const declineReasons = Array.isArray(report?.decline_reasons) ? report.decline_reasons : [];
  const seniority = report?.seniority_cap?.applied ? report.seniority_cap : null;
  const hardMisses = Array.isArray(report?.hard_constraint_misses) ? report.hard_constraint_misses : [];
  const { matched, missing, total, generic } = reportAsks(report);
  // ⭐ D50 (owner, 10-07): the number, beside the band and the count — never the only claim — and provisional
  // (ATS_NUMBER_NOTE). Static — nothing counts up. No score → no digit.
  const showNumber = ATS_NUMBER_SHOWN && !isUnknown && Number.isFinite(report?.score);
  const hasNotes = declineReasons.length > 0 || seniority || hardMisses.length > 0 || extra;
  return h(doc, "div", { "data-ats-band-card": true, class: "ats-sum ink-pair", "data-compact": compact ? "true" : "false" },
    h(doc, "div", { class: "ats-sum__head" },
      h(doc, "div", null,
        // BAND-FIRST: the band is the heading, read first (pair2.html's .bd). ⛔ "Not enough signal" is
        // the scorer declining — dashed and hue-less (data-unknown), with "no judgement" beside it.
        h(doc, "div", { "data-ats-band": true, class: "ats-sum__band", "data-unknown": isUnknown ? "true" : "false" }, meta.label),
        isUnknown && h(doc, "span", { class: "ats-sum__cap" }, "no judgement"),
        total > 0 && h(doc, "p", { "data-ats-count": true, class: "ats-sum__count" },
          `You cover ${matched} of the ${total} things this posting asks for.`)),
      showNumber && h(doc, "div", { "data-ats-score": true, class: "ats-sum__score", title: ATS_NUMBER_NOTE },
        String(Math.round(report.score)), h(doc, "small", null, "ats"))),
    showNumber && h(doc, "p", { "data-ats-number-note": true, class: "ats-sum__note" },
      `${ATS_NUMBER_NOTE} — read it with the band and the count above.`),
    hasNotes && h(doc, "div", { class: "ats-sum__notes" },
      declineReasons.length > 0 && h(doc, "ul", { class: "ats-notes" }, declineReasons.map(r => h(doc, "li", null, r))),
      seniority && h(doc, "div", { class: "ats-note" }, seniority.reason || ""),
      hardMisses.length > 0 && h(doc, "div", { "data-ats-hard": true, class: "ats-note ats-note--hard" },
        `Required by this posting, not on your profile: ${hardMisses.join(" · ")}`),
      extra),
    // The bar runs flush across the card, under the header (pair2.html's .bar).
    total > 0 && askBar(doc, { band, matched, missing, generic: generic.length }));
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

/**
 * One term, as a RECTANGULAR DEPTH BOX (D32 — the pills are gone), with the scorer's `kind` beside it.
 * With claims it is a CLAIM BOX (AG2) — a button, with the + affordance and D1's lift / hover / press;
 * without, a read-only box.
 *
 * THE COPY IS THE FEATURE. Clicking one of these asserts "I have this" — a claim the candidate will
 * have to defend in an interview. So the box never reads as "add this to improve your score".
 * CC4: a claim DOES count toward this score and toward where the job ranks, and the copy says so.
 * NOTHING IS PRE-SELECTED: a box reads as claimed only from what the person did — a lock, a claim, a click in flight.
 */
function termBox(doc, host, { term: k, kind, generic = false, claims = null, evidenced: evidencedLookup = new Set(), linkable = false }) {
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
  const kindLabel = () => h(doc, "span", { class: "ats-box__kind" }, TERM_KINDS[kind]?.label || kind);
  // The box's tone (pair2.html): green for what the résumé shows or the candidate claimed, grey for
  // generic language, the claim red for an ask it does not show.
  const tone = generic ? "gen" : (evidenced || claimed) ? "ok" : "claim";
  const key = `${generic ? "g" : kind}:${k}`;
  if (!interactive) {
    return h(doc, "span", { class: "ats-box", "data-kind": kind, "data-tone": tone, "data-claimed": claimed ? "true" : "false",
        "data-key": key, title: provenance, tabindex: linkable ? "0" : null, ...linkProps },
      // Generic language carries no kind — the sketch's grey boxes are the word alone.
      h(doc, "span", { class: "ats-box__term" }, claimed ? `✓ ${k}` : k), !generic && kindLabel());
  }
  return h(doc, "button", { type: "button", class: "ats-box ats-box--claim", "data-kind": kind, "data-tone": "claim",
      "data-claim-chip": claimKind, "data-key": key, "aria-pressed": claimed ? "true" : "false",
      title: claimed ? `You claimed "${k}". Click to withdraw it.`
                     : `Claim "${k}" — only if it is true of you. It counts toward this score and toward where this job ranks, and it is used in future resumes.`,
      onclick: () => host?.dispatchEvent?.(new CustomEvent(ATS_CLAIM_EVENT,
        { detail: { kind: claimKind, term: k, claimed: !claimed }, bubbles: true, composed: true })),
      ...linkProps },
    // The FILLED square: + to claim, ✓ once claimed (pair2.html's .p). aria-pressed carries the state.
    h(doc, "span", { class: "ats-box__plus", "aria-hidden": "true" }, claimed ? "✓" : "+"),
    h(doc, "span", { class: "ats-box__term" }, k), kindLabel());
}

function listSection(doc, title, items) {
  return h(doc, "div", null,
    h(doc, "div", { class: "ats-sec__label" }, title),
    h(doc, "div", { class: "ats-list" },
      items.map(t => h(doc, "div", { class: "ats-list__item" }, h(doc, "span", { "aria-hidden": "true" }, "·"), h(doc, "span", null, t)))));
}

/**
 * THE FULL REPORT, as a DOM tree (no styles — mountAtsReport adds the shadow root and the stylesheet).
 *
 * @param doc     the document to build in
 * @param report  the scorer's report shape (cleanReport'd by the caller; see fromDeckReport / fromStandaloneResult)
 * @param opts    { band, mode: "full"|"band", compact, claims, linkable, host } — `host` receives the events
 */
export function buildAtsReport(doc, report, { band: knownBand = null, mode = "full", compact = false, claims = null, linkable = false, host = null } = {}) {
  if (!report) return null;
  if (mode === "band") return buildBandCard(doc, report, { band: knownBand, compact });
  const state = claimState(claims);
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
  const hasBody = !!(depth || couldClaim.length || report.experience?.summary || onResume.length
    || report.action_verbs_generic?.length || more);
  const box = (t, extra = {}) => termBox(doc, host, { ...t, evidenced, linkable, ...extra });

  // A BAND, NOT THE NUMBER (G5): the best fit the profile can reach.
  const best = report.best_possible_score != null ? h(doc, "div", { class: "ats-note", "data-best": pct === report.best_possible_score ? "reached" : "short" },
    pct === report.best_possible_score
      ? "✓ The best fit your profile can reach for this posting"
      : [h(doc, "span", { class: "ats-note__best" }, `Best possible for your profile: ${atsBandLabel(atsBandFor(report.best_possible_score)).label}`),
         report.best_possible_reason ? h(doc, "span", null, ` — ${report.best_possible_reason}`) : null]) : null;

  return h(doc, "div", { "data-ats-report": true, class: "ats-card ink-pair" },
    // Band card. Renders for EVERY report, including a declined one.
    buildBandCard(doc, report, { band: knownBand, extra: best }),
    hasBody && h(doc, "div", { class: "ats-sb" },
      // The résumé-depth warning sits under the band it qualifies, never above it (band-first).
      depth && h(doc, "div", { class: "ats-note ats-sec" },
        h(doc, "div", { class: "ats-note__head" }, depth.headline || ""), h(doc, "div", null, depth.detail || "")),
      // ⭐ D32: "YOU COULD CLAIM" IS ONE BLOCK, AND THE ONLY OPEN SECTION — skills, verbs and qualities
      // together, each box labelled with the scorer's bucket.
      couldClaim.length > 0 && h(doc, "section", { "data-ats-could-claim": true, class: "ats-sec" },
        h(doc, "div", { class: "ats-gh" }, h(doc, "span", { class: "ats-gh__label" }, "You could claim"), h(doc, "span", { class: "ats-gh__ct" }, couldClaim.length)),
        h(doc, "div", { class: "ats-sec__sub" }, canClaim
          ? "This posting asks for these and your résumé does not show them. Claim the ones that are true of you."
          : "This posting asks for these and your résumé does not show them."),
        h(doc, "div", { class: "ats-boxes" }, couldClaim.map(t => box(t, { claims: state }))),
        // ⛔ THE CLAIM COPY APPEARS ONCE — beneath the boxes, where the action is.
        canClaim && h(doc, "div", { "data-claim-note": true, class: "ats-claim-note" },
          "Claiming a term says it is true of you — claim it only if it is. It counts toward this score and toward " +
          "where jobs rank on your board, and it is used in resumes generated from now on; " +
          "it never rewrites one you already have. Withdraw it at any time and all three go back. " +
          "Nothing is ever pre-selected.")),
      // ⭐ D32: Experience gets its own row — pass/fail, not a footnote.
      report.experience?.summary && experienceRow(doc, report.experience),
      // FOLDED: what the résumé already shows. Read-only — there is nothing to do here.
      onResume.length > 0 && h(doc, "details", { "data-ats-on-resume": true, "data-fold": "on-resume", class: "ats-fold ats-sec" },
        h(doc, "summary", { class: "ats-gh" }, h(doc, "span", { class: "ats-gh__label" }, "Already yours"), h(doc, "span", { class: "ats-gh__ct" }, onResume.length)),
        h(doc, "div", { class: "ats-boxes" }, onResume.map(t => box(t)))),
      // Generic language — AH3. ⛔ NOT a gap, deliberately not claimable, FOLDED AWAY and labelled so —
      // surfacing "Managed" or "collaboration" as a deficiency is a claim that is not true.
      report.action_verbs_generic?.length > 0 && h(doc, "details", { "data-ats-generic": true, "data-fold": "generic", class: "ats-fold ats-sec" },
        h(doc, "summary", { class: "ats-gh" }, h(doc, "span", { class: "ats-gh__label" }, "Generic — not a gap"), h(doc, "span", { class: "ats-gh__ct" }, generic.length)),
        h(doc, "div", { class: "ats-sec__sub" }, "This job uses these, but almost any candidate could claim them — they are not a gap."),
        h(doc, "div", { class: "ats-boxes" }, generic.map(t => box(t, { generic: true })))),
      // The verdict and (LLM reports only) strengths and improvements — folded, printed once.
      more && h(doc, "details", { "data-ats-more": true, "data-fold": "more", class: "ats-fold ats-sec" },
        h(doc, "summary", { class: "ats-gh" }, h(doc, "span", { class: "ats-gh__label" }, "More about this match")),
        h(doc, "div", { class: "ats-more" },
          verdict && h(doc, "div", { class: "ats-more__verdict" }, verdict),
          !isLocalReport && report.strengths?.length > 0 && listSection(doc, "💪 Strengths", report.strengths),
          !isLocalReport && report.improvements?.length > 0 && listSection(doc, "🔧 Improvements", report.improvements)))));
}

// ── mounting: a shadow root, the stylesheet once, and the reader's place kept across a redraw ────────────────────
const SIG = Symbol.for("draft.atsReport.sig");
const setsOut = (c) => c && { pending: [...asSet(c.pending)].sort(), s: [...asSet(c.claimedLookup?.skillKeys)].sort(),
  v: [...asSet(c.claimedLookup?.verbKeys)].sort(), ls: [...asSet(c.lockedSkills)].sort(), lv: [...asSet(c.lockedVerbs)].sort() };

/**
 * Draw `report` into `host`'s (open) shadow root — creating it, and its one <style>, the first time. A redraw with
 * the same inputs does nothing; a redraw with new ones keeps which folds are open and which box has focus, so a
 * claim click (which the host answers with new claim state) never closes a fold or drops the keyboard's place.
 * @returns {ShadowRoot}
 */
export function mountAtsReport(host, report, opts = {}) {
  const doc = host.ownerDocument;
  const root = host.shadowRoot || host.attachShadow({ mode: "open" });
  let style = root.querySelector?.("style[data-ats-style]") || null;
  if (!style) { style = doc.createElement("style"); style.setAttribute("data-ats-style", ""); style.textContent = ATS_REPORT_SHADOW_CSS; root.append(style); }
  const clean = cleanReport(report);
  const sig = JSON.stringify([clean, opts.band ?? null, opts.mode || "full", !!opts.compact, !!opts.linkable, setsOut(opts.claims)]);
  if (root[SIG] === sig) return root;
  root[SIG] = sig;
  const prior = root.querySelector?.("[data-ats-root]") || null;
  const open = new Set(prior ? [...prior.querySelectorAll("details[open]")].map(d => d.getAttribute("data-fold")) : []);
  const focused = root.activeElement?.getAttribute?.("data-key") || null;
  const tree = clean ? buildAtsReport(doc, clean, { ...opts, host }) : null;
  const wrap = doc.createElement("div");
  wrap.setAttribute("data-ats-root", "");
  if (tree) wrap.append(tree);
  if (prior) prior.replaceWith(wrap); else root.append(wrap);
  for (const d of wrap.querySelectorAll?.("details[data-fold]") || []) if (open.has(d.getAttribute("data-fold"))) d.setAttribute("open", "");
  if (focused) {
    for (const el of wrap.querySelectorAll?.("[data-key]") || []) if (el.getAttribute("data-key") === focused) { el.focus?.(); break; }
  }
  return root;
}

/**
 * `<draft-ats-report>` — the element. Properties: `report` (the scorer's JSON), `band`, `claims` (see claimState),
 * `linkable`. Attributes: `mode` ("full" | "band"), `compact`, `theme` (a registry id; none follows the OS),
 * `cues` ("shape"). Defined only where a registry exists; returns the class (or null).
 */
export function defineAtsReportElement(registry = typeof customElements !== "undefined" ? customElements : null) {
  if (!registry || typeof HTMLElement === "undefined") return null;
  const existing = registry.get(ATS_REPORT_TAG);
  if (existing) return existing;
  class DraftAtsReport extends HTMLElement {
    static get observedAttributes() { return ["mode", "compact"]; }
    constructor() { super(); this._report = null; this._band = null; this._claims = null; this._linkable = false; this._queued = false; }
    set report(v) { this._report = v ?? null; this._schedule(); }
    get report() { return this._report; }
    set band(v) { this._band = v ?? null; this._schedule(); }
    get band() { return this._band; }
    set claims(v) { this._claims = v ?? null; this._schedule(); }
    get claims() { return this._claims; }
    set linkable(v) { this._linkable = !!v; this._schedule(); }
    get linkable() { return this._linkable; }
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
        compact: this.hasAttribute("compact"), claims: this._claims, linkable: this._linkable });
    }
  }
  registry.define(ATS_REPORT_TAG, DraftAtsReport);
  return DraftAtsReport;
}
