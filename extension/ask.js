// extension/ask.js — ⭐ D191 (2e) / (3) / P5 · THE EXTENSION'S OWN PANEL (ask.html, a small window opened from the press's
// home line, the right-click menu or a shortcut): the person's day, a search of draft's board, and ASK DRAFT — the SAME
// engine and vocabulary as the site (assistantEngine.js / commands-v1.json / assistantVoice.js, mirrored byte-identical from
// draft's shared/ and content/assistant/; test/d191AskWindow.test.js fails when they differ).
// ⛔ The owner's rule (11-14): nothing within draft's own data or functions calls a model. T1 acts through the worker's own
// press acts (ASK_ACT → the dock's Capture / Draft on the posting's tab) or opens draft; T2 reads GET /api/extension/home,
// the posting's card (the worker's memory of this tab's read), the public company record and POST /api/assistant/lookup.
// T3 (new writing) is not offered here — it says so and sends nothing.
import { createAssistant, TIER_LABEL } from './assistantEngine.js';
import COMMANDS from './commands-v1.json' with { type: 'json' };
import { voiceSupported, listenOnce, voiceNote, VOICE_ERRORS } from './assistantVoice.js';
import { authedFetch } from './auth.js';

const $ = (id) => document.getElementById(id);
// draft's address comes from the worker (background.js's RESUME_MASTER_URL — ONE source), with this tab's read
let RESUME_MASTER_URL = 'https://jobsviadraft.com';
const tabId = Number(new URLSearchParams(location.search).get('tab')) || null;
const send = (msg) => new Promise((resolve) => { try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r ?? null); }); } catch { resolve(null); } });
const open = (path) => chrome.tabs.create({ url: `${RESUME_MASTER_URL}${path}` });
const json = (r) => (r && r.ok ? r.json().catch(() => null) : null);

/** Where "open X" goes on draft (D167's dock names: "draft" is the jobs page, Home is the house). */
export const PLACES = Object.freeze({
  draft: '/app', board: '/app', jobs: '/app', matches: '/app', today: '/app',
  home: '/app/auto-apply', applications: '/app/auto-apply', 'my applications': '/app/auto-apply',
  profile: '/app/profile/about', settings: '/app/profile/account', 'saved answers': '/app/profile/answers', appearance: '/app/profile/appearance',
  privacy: '/app/profile/privacy', atlas: '/app/atlas', interview: '/app/interview',
});

let home = null, ctx = null;
async function load() {
  const got = await send({ type: 'ASK_CONTEXT', tabId });
  if (typeof got?.server === 'string' && /^https?:\/\//.test(got.server)) RESUME_MASTER_URL = got.server;
  ctx = got?.context || null;
  home = await authedFetch(RESUME_MASTER_URL, `/api/extension/home?date=${new Date().toLocaleDateString('en-CA')}`).then(json).catch(() => null);
  const day = $('ask-day');
  day.replaceChildren(...(home ? [['newMatches', 'new matches', '/app'], ['needsYou', 'need you', '/app/auto-apply'], ['drafted', 'drafted today', '/app/auto-apply'], ['sent', 'sent today', '/app/auto-apply']]
    .map(([k, label, path]) => { const a = document.createElement('a'); a.href = `${RESUME_MASTER_URL}${path}`; a.target = '_blank'; a.dataset.day = k;
      a.append(Object.assign(document.createElement('b'), { textContent: String(home[k] ?? '–') }), Object.assign(document.createElement('span'), { textContent: label })); return a; })
    : [Object.assign(document.createElement('a'), { href: `${RESUME_MASTER_URL}/login`, target: '_blank', textContent: 'Sign in to draft to see your day' })]));
}

const job = () => ctx?.job || null;
const needJob = () => { const j = job(); if (!j) throw new Error('Press the toolbar icon on a job posting first, then ask here.'); return j; };
const handlers = {
  help: () => ({ text: 'I act on draft without AI: “draft this job”, “save this”, “open my applications”, “show me remote senior jobs”, and I answer from your own data: “how many need me?”, “what\'s my match?”, “does this company sponsor?”, “what skills have I proven?” — or anything draft\'s help and Atlas cover.' }),
  undo: () => ({ text: 'Undo a draft or a save from the toast in draft, or from Home.' }),
  navigate: (a) => {
    const key = String(a.place || '').toLowerCase().replace(/^(my|the) /, '').replace(/ (page|tab|screen)$/, '').trim();
    const to = PLACES[key];
    if (!to) return { ask: 'I can open draft (the jobs), Home (your applications), Profile, Settings, Saved answers, Atlas or Interview — which one?' };
    open(to); return { text: `Opened ${key} in draft.` };
  },
  openResumeEditor: () => { const j = needJob(); if (!j.jobId) return { ask: 'Draft this job first — then its résumé editor opens.' }; open(`/draft/resume/${encodeURIComponent(j.jobId)}`); return { text: 'Opened the résumé editor for this job in draft.' }; },
  openQuestions: () => { open('/app/auto-apply'); return { text: 'Opened your applications in draft — the held ones are at the top.' }; },
  draftJob: async () => { needJob(); const r = await send({ type: 'ASK_ACT', tabId, act: 'draft' }); if (!r?.ok) throw new Error(r?.say || 'draft could not draft this job — press Draft on the page.'); return { text: r.say || 'Drafted — it waits for your review in draft; nothing is sent until you approve it.' }; },
  saveJob: async () => { needJob(); const r = await send({ type: 'ASK_ACT', tabId, act: 'capture' }); if (!r?.ok) throw new Error(r?.say || 'draft could not add this job — press Capture on the page.'); return { text: 'Added to your board — it\'s under Saved in draft.' }; },
  passJob: () => ({ text: 'Passing is done on draft\'s board — open the job there and press Pass.' }),
  cancelDraft: () => { open('/app/auto-apply'); return { text: 'Opened your applications — stop the draft from its row.' }; },
  setFilter: (a, c) => {
    if (/^clear/i.test(c?.said || '')) { open('/app'); return { text: 'Opened draft\'s board.' }; }
    open(`/app/jobs?search=${encodeURIComponent(String(a.sentence || '').slice(0, 200))}`);
    return { text: `Opened draft's board searching “${a.sentence}”.` };
  },
  needsMe: () => (home ? { text: home.needsYou ? `${home.needsYou} application${home.needsYou === 1 ? ' needs' : 's need'} you.` : 'Nothing needs you right now.' } : { text: 'Sign in to draft to see your applications.' }),
  draftedToday: () => (home ? { text: `Today you drafted ${home.drafted} and sent ${home.sent}.` } : { text: 'Sign in to draft to see today.' }),
  matchScore: () => { const j = needJob(); return { text: Number.isFinite(j.score) ? `Your résumé scores ${Math.round(j.score)} for ${j.title ? `${j.title} at ` : ''}${j.company || 'this job'}.` : 'There\'s no score for this posting yet — open the dock\'s ATS tab.' }; },
  missingKeywords: () => ({ text: 'The dock\'s ATS tab lists the keywords your résumé has and misses for this posting.' }),
  sponsorship: async (a) => {
    const name = a.company || ctx?.company?.name || job()?.company;
    if (!name) return { ask: 'Which company? Say “does <company> sponsor?”, or press the toolbar icon on its posting first.' };
    const card = !a.company && ctx?.company?.name ? ctx.company
      : (await fetch(`${RESUME_MASTER_URL}/api/extension/company?${new URLSearchParams({ name })}`, { credentials: 'omit' }).then(json).catch(() => null))?.company;
    const s = typeof card?.sponsorship === 'string' ? card.sponsorship : card?.sponsorship?.text;
    return { text: s ? `${card.name}: ${s}.` : `draft has no H-1B filing record it can show for ${name}. That isn't a no — it may file under another name.` };
  },
  mySkills: async () => { const r = await lookup('my_skills'); return { text: r?.text || 'Sign in to draft to see your skills.' }; },
  t3: () => ({ ask: 'Writing new words isn\'t offered in the extension. Everything draft already holds I can do here without it — say “help” for the list.' }),
  fallback: async (text) => { const r = await lookup('question', text); return r ? { tier: 'T2', intent: 'lookup', text: r.text } : null; },
};
async function lookup(intent, question = '') {
  const r = await authedFetch(RESUME_MASTER_URL, '/api/assistant/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent, question }) }).then(json).catch(() => null);
  return r && r.found !== false ? r : null;
}

const ledger = (globalThis.__askLedger ||= []);
const bot = createAssistant({ commands: COMMANDS, site: 'draft', handlers, fallback: handlers.fallback, ledger,
  examples: ['draft this job', 'does this company sponsor?', 'how many need me?', 'show me remote senior jobs'] });

const list = $('ask-turns');
function turn(who, m) {
  const li = document.createElement('li');
  li.className = 'turn'; li.dataset.who = who;
  if (m.tier) li.dataset.tier = m.tier;
  if (m.label) li.append(Object.assign(document.createElement('span'), { className: 'label', textContent: m.label }));
  li.append(document.createTextNode(who === 'you' ? `You: ${m.text}` : m.text));
  if (m.confirm) {
    const row = document.createElement('div'); row.className = 'confirm';
    for (const [word, yes] of [['Yes', true], ['No', false]]) {
      const b = Object.assign(document.createElement('button'), { className: `btn${yes ? ' btn-primary' : ''}`, type: 'button', textContent: word });
      b.dataset.confirm = yes ? 'yes' : 'no';
      b.addEventListener('click', (e) => { if (!e.isTrusted) return; row.remove(); say(word); });
      row.append(b);
    }
    li.append(row);
  }
  list.append(li); list.scrollTop = list.scrollHeight;
}
let busy = false;
async function say(text) {
  const q = String(text || '').trim();
  if (!q || busy) return;
  busy = true;
  turn('you', { text: q });
  try { const m = await bot.handle(q); turn('draft', { ...m, label: m.label || TIER_LABEL[m.tier] || null }); }
  finally { busy = false; }
}
// D36·5: the extension never submits a form programmatically — the Enter key calls the same function the button does
const sendTyped = () => { const q = $('ask-input').value; $('ask-input').value = ''; say(q); };
$('ask-form').addEventListener('submit', (e) => { e.preventDefault(); sendTyped(); });
$('ask-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTyped(); } });
$('ask-search').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('ask-search-input').value.trim();
  if (q) open(`/app/jobs?search=${encodeURIComponent(q.slice(0, 200))}`);
});
// P5 · voice: the browser's speech-to-text → the same engine
if (voiceSupported(globalThis)) {
  const mic = $('ask-mic'); mic.hidden = false;
  let listening = null;
  mic.addEventListener('click', async () => {
    if (listening) { listening.stop(); return; }
    try {
      mic.setAttribute('aria-pressed', 'true');
      listening = await listenOnce({ onText: (t) => say(t), onEnd: (code) => { listening = null; mic.setAttribute('aria-pressed', 'false'); $('ask-voice-note').textContent = code ? (VOICE_ERRORS[code] || 'Voice stopped — type instead.') : ''; } });
      $('ask-voice-note').textContent = voiceNote(listening.local);
    } catch (e) { listening = null; mic.setAttribute('aria-pressed', 'false'); $('ask-voice-note').textContent = e.message; }
  });
}
await load();
globalThis.__askReady = true;
