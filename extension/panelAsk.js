// extension/panelAsk.js — ⭐ D191 B3 (owner 11-18: "alright go" on the one-panel sketch — no separate side panel) · ASK DRAFT
// INSIDE THE ONE PANEL. The panel's other-page view has one box — "Search jobs, or ask draft"; what is typed comes here (the
// service worker, PANEL_ASK) and goes through the SAME engine and vocabulary as the site (assistantEngine.js +
// commands-v1.json, mirrored byte-identical from draft's shared/ and content/assistant/). It replaces the side panel's
// ask.js, whose handlers moved here unchanged in meaning; a sentence the engine does not know is a search of draft's board.
// ⛔ The owner's rule (11-14): nothing within draft's own data or functions calls a model. T1 acts through the worker's own
//   press acts (the dock's Capture / Draft on the posting's tab) or opens draft; T2 reads GET /api/extension/home, this tab's
//   read, the public company record and POST /api/assistant/lookup. T3 (new writing) is not offered — it says so, sends nothing.
// ⛔ Voice is not offered in the panel: it is drawn in the employer's page, where the microphone prompt would be that site's.
// Everything browser-shaped is handed in (deps), so the tests run it without Chrome.
import { createAssistant } from './assistantEngine.js';

/** Where "open X" goes on draft (D167's dock names: "draft" is the jobs page, Home is the house). */
export const PLACES = Object.freeze({
  draft: '/app', board: '/app', jobs: '/app', matches: '/app', today: '/app',
  home: '/app/auto-apply', applications: '/app/auto-apply', 'my applications': '/app/auto-apply',
  profile: '/app/profile/about', settings: '/app/profile/account', 'saved answers': '/app/profile/answers', appearance: '/app/profile/appearance',
  privacy: '/app/profile/privacy', atlas: '/app/atlas', interview: '/app/interview',
});

/**
 * deps: { commands, serverUrl, act(tabId, name) → { ok, say }, open(path), context(tabId) → the press's read or null,
 *         home() → GET /api/extension/home's answer or null, fetchJson(path, init, { auth }) → parsed body or null }
 * → { handle(tabId, text) → { tier, label, text, confirm?, intent? } }
 */
export function createPanelAsk(deps) {
  const bots = new Map();                                       // one engine per tab: a confirmation belongs to its tab
  const botFor = (tabId) => {
    if (bots.has(tabId)) return bots.get(tabId);
    const job = () => deps.context(tabId)?.job || null;
    const needJob = () => { const j = job(); if (!j) throw new Error('Open a job posting first, then ask here.'); return j; };
    const open = (path) => { void deps.open(path); };
    const lookup = async (intent, question = '') => {
      const r = await deps.fetchJson('/api/assistant/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent, question }) }, { auth: true }).catch(() => null);
      return r && r.found !== false ? r : null;
    };
    const search = (sentence) => { open(`/app/jobs?search=${encodeURIComponent(String(sentence || '').slice(0, 200))}`); return { text: `Opened draft's board searching “${sentence}”.` }; };
    const handlers = {
      help: () => ({ text: 'I act on draft without AI: “draft this job”, “save this”, “open my applications”, “show me remote senior jobs”, and I answer from your own data: “how many need me?”, “does this company sponsor?”.' }),
      undo: () => ({ text: 'Undo a draft or a save from the toast in draft, or from Home.' }),
      navigate: (a) => {
        const key = String(a.place || '').toLowerCase().replace(/^(my|the) /, '').replace(/ (page|tab|screen)$/, '').trim();
        const to = PLACES[key];
        if (!to) return { ask: 'I can open draft (the jobs), Home (your applications), Profile, Settings, Saved answers, Atlas or Interview — which one?' };
        open(to); return { text: `Opened ${key} in draft.` };
      },
      openResumeEditor: () => { const j = needJob(); if (!j.jobId) return { ask: 'Draft this job first — then its résumé editor opens.' }; open(`/draft/resume/${encodeURIComponent(j.jobId)}`); return { text: 'Opened the résumé editor for this job.' }; },
      openQuestions: () => { open('/app/auto-apply'); return { text: 'Opened your applications in draft — the held ones are at the top.' }; },
      draftJob: async () => { needJob(); const r = await deps.act(tabId, 'draft'); if (!r?.ok) throw new Error(r?.say || 'draft could not draft this job — press Draft this job in the panel.'); return { text: r.say || 'Drafted.' }; },
      saveJob: async () => { needJob(); const r = await deps.act(tabId, 'capture'); if (!r?.ok) throw new Error(r?.say || 'draft could not add this job.'); return { text: r.say || 'Saved to your board.' }; },
      passJob: () => ({ text: 'Passing is done on draft\'s board — open the job there and press Pass.' }),
      cancelDraft: () => { open('/app/auto-apply'); return { text: 'Opened your applications — stop the draft from its row.' }; },
      setFilter: (a, c) => {
        if (/^clear/i.test(c?.said || '')) { open('/app'); return { text: 'Opened draft\'s board.' }; }
        return search(a.sentence);
      },
      needsMe: async () => { const home = await deps.home(); return home ? { text: home.needsYou ? `${home.needsYou} application${home.needsYou === 1 ? ' needs' : 's need'} you.` : 'Nothing needs you right now.' } : { text: 'Sign in to draft to see your applications.' }; },
      draftedToday: async () => { const home = await deps.home(); return home ? { text: `Today you drafted ${home.drafted} and sent ${home.sent}.` } : { text: 'Sign in to draft to see today.' }; },
      matchScore: () => { const j = needJob(); return { text: Number.isFinite(j.score) ? `Your résumé is a ${Math.round(j.score)}% match for ${j.title ? `${j.title} at ` : ''}${j.company || 'this job'}.` : 'There\'s no match for this job yet — Draft it and draft scores your résumé against it.' }; },
      missingKeywords: () => ({ text: 'The panel\'s ATS tab lists the keywords your résumé has and misses for this posting.' }),
      sponsorship: async (a) => {
        const ctx = deps.context(tabId);
        const name = a.company || ctx?.company?.name || job()?.company;
        if (!name) return { ask: 'Which company? Say “does <company> sponsor?”, or open its posting first.' };
        const card = !a.company && ctx?.company?.name ? ctx.company
          : (await deps.fetchJson(`/api/extension/company?${new URLSearchParams({ name })}`, {}, { auth: false }).catch(() => null))?.company;
        const s = typeof card?.sponsorship === 'string' ? card.sponsorship : card?.sponsorship?.text;
        return { text: s ? `${card.name}: ${s}.` : `draft has no H-1B filing record it can show for ${name}. That isn't a no — it may file under another name.` };
      },
      mySkills: async () => { const r = await lookup('my_skills'); return { text: r?.text || 'Sign in to draft to see your skills.' }; },
      t3: () => ({ ask: 'Writing new words isn\'t offered in the extension. Everything draft already holds I can do here without it — say “help” for the list.' }),
      fallback: async (text) => { const r = await lookup('question', text); return r ? { tier: 'T2', intent: 'lookup', text: r.text } : null; },
    };
    const bot = createAssistant({ commands: deps.commands, site: 'draft', handlers, fallback: handlers.fallback,
      examples: ['draft this job', 'does this company sponsor?', 'how many need me?', 'show me remote senior jobs'] });
    const entry = { bot, search };
    bots.set(tabId, entry);
    return entry;
  };
  return {
    async handle(tabId, text) {
      const q = String(text || '').trim().slice(0, 600);
      if (!q) return null;
      const { bot, search } = botFor(tabId);
      const m = await bot.handle(q);
      // one box for both: a sentence draft's vocabulary does not know, and its own data cannot answer, is a search
      if (m && m.tier === 'ask' && !m.intent && !m.confirm) return { tier: 'T1', label: null, intent: 'search', ...search(q) };
      return m;
    },
    forget(tabId) { bots.delete(tabId); },
  };
}
