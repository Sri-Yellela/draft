// lib/assistantDraft.js — ⭐ D190 · TINY's handlers (Ask draft until owner 11-15): each row of content/assistant/commands-v1.json (site "draft")
// calls the SAME function its button calls (lib/assistantBridge.js reaches the board and the deck while they are mounted).
// ⛔ The owner's rule (11-14): nothing here calls a model. T1 acts; T2 reads the person's own data (the dock's counts,
// the open job, POST /api/assistant/lookup — a read + a template on the server). Only the T3 row's handler may reach
// /api/assistant/ask, and only because the person asked for new writing.
import { SENTENCE_WORDS } from "../../../shared/filterSentence.js";
import { resolvePlaceText } from "../../../shared/jobTagVocabulary.js";

/** Where "open X" goes. Keys are what people say; values are in-app addresses. */
export const PLACES = Object.freeze({
  // D167's dock names: "draft" is the jobs page (/app), "Home" is the house — your applications (/app/auto-apply)
  draft: "/app", today: "/app", deck: "/app", board: "/app", jobs: "/app", "job board": "/app", "the board": "/app",
  home: "/app/auto-apply", house: "/app/auto-apply", applications: "/app/auto-apply", "my applications": "/app/auto-apply", "draft house": "/app/auto-apply", drafts: "/app/auto-apply",
  profile: "/app/profile/about", "my profile": "/app/profile/about", résumé: "/app/profile/about", resume: "/app/profile/about", "my résumé": "/app/profile/about", "my resume": "/app/profile/about",
  settings: "/app/profile/account", account: "/app/profile/account", appearance: "/app/profile/appearance", theme: "/app/profile/appearance",
  notifications: "/app/profile/notifications", privacy: "/app/profile/privacy", "saved answers": "/app/profile/answers", answers: "/app/profile/answers",
  "applying settings": "/app/profile/autoapply", "apply settings": "/app/profile/autoapply", connections: "/app/profile/connections",
  atlas: "/app/atlas", "your skills": "/app/atlas", skills: "/app/atlas", learning: "/app/atlas",
  interview: "/app/interview", "interview practice": "/app/interview",
});
const LEVELS = Object.freeze({ intern: "intern", internship: "intern", entry: "entry", junior: "entry", "entry-level": "entry", "entry level": "entry",
  mid: "mid", "mid-level": "mid", "mid level": "mid", senior: "senior", sr: "senior", lead: "lead", staff: "lead", principal: "lead", executive: "executive", director: "executive" });
const WHERE = Object.freeze({ remote: "remote", hybrid: "hybrid", onsite: "onsite", "on-site": "onsite", "in-office": "onsite", "in office": "onsite" });

/** "backend senior remote in Boston" → the board's clause params + the words left for its search. Pure. */
export function sentenceToFilters(sentence) {
  let s = ` ${String(sentence || "").toLowerCase().replace(/[,.;]/g, " ").replace(/\s+/g, " ").trim()} `;
  const out = { experience_levels: [], work_models: [], places: [], search: "" };
  let place = null;
  const m = / (?:in|near|around|at) ([a-z .'-]+?)(?= (?:remote|hybrid|on-?site|senior|junior|mid|entry|lead|staff|intern) |\s*$)/.exec(s);
  if (m) { place = resolvePlaceText(m[1].trim()) || null; if (place) s = s.replace(m[0], " "); }
  for (const [w, v] of Object.entries(LEVELS).sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(` ${w.replace(/[-]/g, "[- ]?")}(?: level)? `, "g");
    if (re.test(s)) { if (!out.experience_levels.includes(v)) out.experience_levels.push(v); s = s.replace(re, " "); }
  }
  for (const [w, v] of Object.entries(WHERE).sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(` ${w} `, "g");
    if (re.test(s)) { if (!out.work_models.includes(v)) out.work_models.push(v); s = s.replace(re, " "); }
  }
  if (place) out.places = [place];
  out.search = s.replace(/\b(jobs?|roles?|positions?|openings?|for|the|a|an|me|only)\b/g, " ").replace(/\s+/g, " ").trim();
  // only words the sentence knows (the board's own vocabulary)
  out.experience_levels = out.experience_levels.filter(v => SENTENCE_WORDS.level[v]);
  out.work_models = out.work_models.filter(v => SENTENCE_WORDS.where[v]);
  return out;
}

/** ⭐ A213 (46r, the 46q audit): a sentence to Tiny REPLACES ONLY THE CLAUSES IT NAMES — "remote data engineer jobs in Boston"
 *  said over "senior … in Boston" keeps senior. Before this, every clause the sentence did not name was cleared (the career
 *  level went to "all career levels"). Pure. */
export function mergeFilters(before, f) {
  const b = before || {};
  const pick = (k) => (f[k] && f[k].length ? f[k] : (Array.isArray(b[k]) ? b[k] : []));
  return { experience_levels: pick("experience_levels"), work_models: pick("work_models"), places: pick("places"), search: f.search || b.search || "" };
}

const verbFor = { drafted: "Drafted", saved: "Saved", passed: "Passed" };

/** "senior remote jobs in Boston", "data analyst roles" — a place no PLACES key names but that asks for jobs. Pure. */
export function looksLikeJobSearch(text) {
  return /\b(jobs?|roles?|positions?|openings?|internships?|vacanc(?:y|ies))\b/i.test(String(text || ""));
}
const QUESTION_START = /^(what|whats|what's|how|why|which|who|where|when|is|are|do|does|did|can|could|should|would|will|tell|explain)\b/i;
/** ⭐ D190 · Tiny (owner 11-15: "put filters into the search and show results on the page"): what no vocabulary row matched
 *  but is plainly a search of the board — "search for data analyst", "look for product manager jobs", "data analyst jobs in
 *  Boston" — and the words to search. A question ("what should I learn for a data analyst role?") is never a search. Pure. */
export function jobSearchSentence(text) {
  const s = String(text || "").trim().replace(/[?!.]+$/, "");
  if (!s || QUESTION_START.test(s)) return null;
  const m = /^(?:please\s+)?(?:search(?:\s+for)?|look(?:ing)?\s+for|hunt\s+for|find\s+me|get\s+me|browse)\s+(.+)$/i.exec(s);
  if (m) return m[1].trim();
  if (looksLikeJobSearch(s) && s.split(/\s+/).length <= 10) return s;
  return null;
}
/** How long Tiny waits for the board to mount after it opened it (ms), and how often it looks. */
export const BOARD_WAIT_MS = 3000;
const BOARD_POLL_MS = 100;

/**
 * The handlers. Dependencies are passed in so the tests drive them with fakes:
 *   navigate(path) · api(path, opts) · action(name) → the bridge's function or null · counts() → { needsYou, questions, ready }
 *   pending() → held applications [{ jobId, runKey, company, questions }] · t3Available() → bool
 */
export function createDraftHandlers({ navigate, api, action, counts = () => null, pending = () => [], openThread = () => {}, t3Available = () => false, undoStack = [],
  boardPath = "/app", waitMs = BOARD_WAIT_MS, sleep = (ms) => new Promise(r => setTimeout(r, ms)) }) {
  // ⭐ D190 · Tiny: the filters belong to the board — when it isn't mounted here (Profile, Atlas…), open it and wait for it
  // to register (≤ waitMs, polling the bridge) so the filters land on the page the person sees.
  const boardAction = async (name) => {
    let fn = action(name);
    if (fn) return { fn, opened: false };
    navigate(boardPath);
    for (let waited = 0; waited < waitMs; waited += BOARD_POLL_MS) {
      await sleep(BOARD_POLL_MS);
      fn = action(name);
      if (fn) return { fn, opened: true };
    }
    return { fn: null, opened: true };
  };
  const job = () => action("currentJob")?.() || action("deckJob")?.() || null;
  const needJob = () => { const j = job(); if (!j) throw new Error("Open a job first — on Home, a card or a posting — and ask again."); return j; };
  async function decide(decision) {
    const j = needJob();
    const fromDeck = !action("currentJob")?.() && !!action("deckJob")?.();
    const call = fromDeck ? action("deckDecide") : action("boardDecide");
    if (!call) throw new Error("The board isn't open here — go Home and ask again.");
    await call(j, decision);
    const undo = fromDeck ? action("deckUndo") : action("boardUndo");
    const name = `${j.title ? `${j.title} at ` : ""}${j.company || "this job"}`;
    return { text: `${verbFor[decision]} ${name}.${decision === "drafted" ? " It waits for your review — nothing is sent until you approve it." : ""}`,
      undo: undo ? async () => { await undo(j, decision); return { text: `Undone — ${name} is back as it was.` }; } : null };
  }
  const lookup = async (intent, args = {}, question = "") => {
    const r = await api("/api/assistant/lookup", { method: "POST", body: JSON.stringify({ intent, args, question }) });
    return r?.found === false ? null : r;
  };
  async function setFilter(a, ctx) {
    const { fn: set, opened } = await boardAction("setFilters");
    if (!set) throw new Error("The board didn't open in time — press draft in the dock and ask again.");
    const get = action("getFilters");
    const before = get ? get() : null;
    const where = opened ? " I opened the board for you." : "";
    if (/^clear/i.test(ctx?.said || "")) { set({ experience_levels: [], work_models: [], places: [], search: "" }); return { text: `Cleared the filters.${where}`, undo: before ? () => { set(before); return { text: "The filters are back." }; } : null }; }
    let f = sentenceToFilters(a.sentence);
    if (!f.experience_levels.length && !f.work_models.length && !f.places.length && !f.search) return { ask: "Which jobs? Say it like “senior backend, remote, in Boston”." };
    const said = f;
    f = mergeFilters(before, said);   // A213: only the clauses the sentence names change
    set(f);
    // "senior remote “data analyst” jobs in Boston" — the board as it now reads, kept clauses included
    const bits = [f.experience_levels.length && f.experience_levels.join(" / "), f.work_models.length && f.work_models.join(" / "), f.search && `“${f.search}”`].filter(Boolean);
    const placeName = said.places.length ? (String(a.sentence).match(/(?:in|near|around|at) ([^,]+?)$/i)?.[1] || "that place") : "";
    return { text: `The board now shows ${bits.length ? `${bits.join(" ")} ` : ""}jobs${placeName ? ` in ${placeName}` : ""}.${where}`, undo: before ? () => { set(before); return { text: "The filters are back as they were." }; } : null };
  }
  return {
    help: () => ({ text: "I'm Tiny. I act on draft without AI: “draft this job”, “save this”, “pass”, “cancel that draft”, “open my profile”, “go to Atlas”, “show me senior remote jobs in Boston”, “find data analyst jobs”, “open my held questions” — and I answer from your own data: “how many need me?”, “what's my match?”, “which keywords am I missing?”, “does Kestrel sponsor?”, “what skills have I proven?”, or anything Atlas and draft's help cover." }),
    undo: async () => {
      const last = undoStack.pop();
      if (!last) return { text: "There's nothing to undo from here." };
      const r = await last();
      return { text: r?.text || "Undone." };
    },
    navigate: (a) => {
      const key = String(a.place || "").toLowerCase().replace(/^(my|the) /, "").replace(/ (page|tab|screen)$/, "").trim();
      const to = PLACES[key] || PLACES[`my ${key}`];
      // "show me senior remote jobs in Boston" reads as "show me {place}" — a place that asks for jobs is the board's search
      if (!to && looksLikeJobSearch(key)) return setFilter({ sentence: a.place }, { said: "" });
      if (!to) return { ask: `I can open draft (the jobs), Home (your applications), Profile, Settings, Appearance, Saved answers, Privacy, Atlas or Interview — which one?` };
      const from = typeof window !== "undefined" ? window.location.pathname + window.location.search : null;
      navigate(to);
      return { text: `Opened ${a.place.replace(/^(my|the) /i, "")}.`, undo: from ? () => { navigate(from); return { text: "Back where you were." }; } : null };
    },
    openResumeEditor: () => { const j = needJob(); const id = j.jobId ?? j.id; navigate(`/draft/resume/${encodeURIComponent(id)}`); return { text: `Opened the résumé editor for ${j.company || "this job"}.` }; },
    openQuestions: (a) => {
      const held = pending().filter(p => Array.isArray(p.questions) && p.questions.length);
      if (!held.length) return { text: "No application is waiting on your answers right now." };
      const want = a.company ? held.filter(p => String(p.company || "").toLowerCase().includes(String(a.company).toLowerCase())) : held;
      if (!want.length) return { text: `No held application at ${a.company}. ${held.length} ${held.length === 1 ? "is" : "are"} waiting: ${held.slice(0, 4).map(p => p.company).join(", ")}.` };
      if (want.length > 1 && !a.company) return { ask: `${want.length} applications are waiting on you (${want.slice(0, 4).map(p => p.company).join(", ")}${want.length > 4 ? ", …" : ""}). Which one — say “open the questions for ${want[0].company}”.` };
      openThread(want[0]);
      return { text: `Opened ${want[0].company}'s ${want[0].questions.length} question${want[0].questions.length === 1 ? "" : "s"} below.` };
    },
    draftJob: () => decide("drafted"),
    saveJob: () => decide("saved"),
    passJob: () => decide("passed"),
    cancelDraft: async () => {
      const j = needJob();
      const call = action("cancelDraft");
      if (!call) throw new Error("Open the job's draft in Home to cancel it there.");
      await call(j);
      return { text: `Cancelled the draft of ${j.company || "this job"}.` };
    },
    setFilter: (a, ctx) => setFilter(a, ctx),
    // T2 — the person's own data
    needsMe: () => {
      const c = counts();
      if (!c) return { text: "I can't read your applications from here yet — open Home." };
      const n = c.needsYou;
      const parts = [c.ready && `${c.ready} waiting for your review`, c.questions && `${c.questions} question${c.questions === 1 ? "" : "s"} only you can answer`, c.other && `${c.other} other`].filter(Boolean);
      return { text: n ? `${n} application${n === 1 ? " needs" : "s need"} you${parts.length ? ` — ${parts.join(", ")}` : ""}.` : "Nothing needs you right now.",
        extra: n ? { links: [{ title: "Your applications", href: "/app/auto-apply" }] } : {} };
    },
    matchScore: () => {
      const j = needJob();
      const s = j.atsScore ?? j.baseAtsScore ?? j.ats_score ?? null;
      return { text: s == null ? `There's no ATS score for ${j.company || "this job"} yet — open it and press its score to read your résumé against it.` : `Your résumé scores ${Math.round(s)} for ${j.title ? `${j.title} at ` : ""}${j.company || "this job"}.` };
    },
    // the deck's card carries the scorer's matched / missing keywords (`why`); a board posting has them in its ATS report
    missingKeywords: () => {
      const j = needJob();
      const w = j.why || action("deckWhy")?.(j) || null;
      if (!w || (!w.missing?.length && !w.matched?.length)) return { text: `Open ${j.company || "the job"}'s ATS score to see which of its keywords your résumé has — I don't have them for this posting yet.` };
      const list = (xs, n) => xs.slice(0, 8).join(", ") + (n > Math.min(8, xs.length) ? `, and ${n - Math.min(8, xs.length)} more` : "");
      const missN = w.missingTotal ?? w.missing?.length ?? 0, matchN = w.matchedTotal ?? w.matched?.length ?? 0;
      return { text: missN ? `For ${j.company || "this job"} your résumé is missing ${missN} keyword${missN === 1 ? "" : "s"}: ${list(w.missing || [], missN)}. It matches ${matchN}${w.matched?.length ? ` (${list(w.matched, matchN)})` : ""}.`
        : `Your résumé has every keyword the scorer found for ${j.company || "this job"} (${matchN}).` };
    },
    sponsorship: async (a) => {
      const company = a.company || job()?.company || "";
      const r = await lookup("sponsorship", { company });
      if (r?.tier === "ask") return { ask: r.text };
      return { text: r?.text || `draft has no H-1B record it can show for ${company}.`, extra: { links: r?.links || [] } };
    },
    draftedToday: async () => { const r = await lookup("drafted_today"); return { text: r?.text || "I couldn't read today's drafts.", extra: { links: r?.links || [] } }; },
    mySkills: async () => { const r = await lookup("my_skills"); return { text: r?.text || "I couldn't read your skills.", extra: { links: r?.links || [] } }; },
    // T3 — only on an explicit request for new writing, and only when the assistant is switched on
    t3: async (_a, ctx) => {
      if (!t3Available()) return { ask: "Writing new words needs the assistant, which isn't open on your account yet. Everything draft already holds I can do without it — say “help” for the list." };
      const r = await api("/api/assistant/ask", { method: "POST", body: JSON.stringify({ question: ctx.said }) });
      if (!r?.ok) throw new Error(r?.message || "The assistant couldn't write that just now.");
      return { text: r.answer, extra: { lessons: r.lessons || [], next: r.next || "", action: r.action || null, links: r.help || [] } };
    },
    /** what no row matched → draft's own help and Atlas (T2), or nothing */
    fallback: async (text) => {
      // ⭐ D190 · Tiny: a plain search ("search for data analyst", "data analyst jobs in Boston") is the board's search, T1
      const sentence = jobSearchSentence(text);
      if (sentence) {
        try {
          const r = await setFilter({ sentence }, { said: text });
          if (r.ask) return { tier: "ask", intent: "set_filter", text: r.ask };
          return { tier: "T1", intent: "set_filter", text: r.text, undo: r.undo || null };
        } catch (err) { return { tier: "T1", intent: "set_filter", text: err.message, failed: true }; }
      }
      const r = await lookup("question", {}, text);
      if (!r) return null;
      return { tier: "T2", intent: "lookup", text: r.text, lessons: r.lessons || [], links: r.links || [] };
    },
  };
}
