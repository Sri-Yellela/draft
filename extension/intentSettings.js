// ── ⭐ T24 · THE INTENT MODEL'S SETTINGS — the account's, read from draft's server ──────────────────────────────────────
//
// Two settings and one remembered answer, kept WITH THE ACCOUNT (users.extension_intent, migration 168 — GET / PUT
// /api/settings/extension-intent, routes/extensionDraft.js), not in the browser — ⛔ no new chrome.storage key:
//
//   onDraft       'queue' (default) — When I press Draft: queue the résumé automatically · 'ask' — ask me
//   manualResume  'on_cue' (default) — In a manual fill: offer a résumé on cue · 'never'
//   remembered    null (default) · 'drafted' · 'manual' — the answer to the ONE question ("Draft this job and queue its
//                 résumé, or just fill this form yourself?") when the user ticked "Remember my choice". ⛔ Only that tick
//                 writes it; nothing is ever inferred from what the user did before.
//
// Read at most once a minute (memory only — gone when the worker sleeps), and the defaults when draft cannot be asked.
// A module of its own so the fill (gated-handoff.js, T18's résumé row — `opts.resumeOnCue`) and the intent model
// (intent.js) read the SAME answer without importing each other.
import { authedFetch } from './auth.js';

export const INTENT_SETTINGS = Object.freeze({
  onDraft: Object.freeze(['queue', 'ask']),
  manualResume: Object.freeze(['on_cue', 'never']),
  remembered: Object.freeze([null, 'drafted', 'manual']),
});
export const INTENT_DEFAULTS = Object.freeze({ onDraft: 'queue', manualResume: 'on_cue', remembered: null });
export const SETTINGS_PATH = '/api/settings/extension-intent';
const TTL_MS = 60_000;

/** Any value → the settings, every field one of its allowed values (the default otherwise). Pure. */
export function normaliseIntentSettings(v) {
  const out = { ...INTENT_DEFAULTS };
  for (const k of Object.keys(INTENT_SETTINGS)) if (v && typeof v === 'object' && INTENT_SETTINGS[k].includes(v[k])) out[k] = v[k];
  return out;
}

let CACHE = { at: 0, value: null };
/** Tests, a disconnect or another account: the next read asks again. */
export function forgetIntentSettings() { CACHE = { at: 0, value: null }; }

/** The account's settings — asked of draft at most once a minute; the defaults when it cannot be asked. */
export async function intentSettings(serverUrl, { now = Date.now() } = {}) {
  if (CACHE.value && now - CACHE.at < TTL_MS) return CACHE.value;
  let value = { ...INTENT_DEFAULTS };
  if (serverUrl) {
    try {
      const r = await authedFetch(serverUrl, SETTINGS_PATH);
      if (r?.ok) value = normaliseIntentSettings(await r.json().catch(() => null));
    } catch { /* the defaults */ }
  }
  CACHE = { at: now, value };
  return value;
}

/** Change one or more of them (the Options page, the "Remember my choice" tick). → the stored settings, or null. */
export async function saveIntentSettings(serverUrl, patch = {}) {
  const body = {};
  for (const k of Object.keys(INTENT_SETTINGS)) if (k in (patch || {}) && INTENT_SETTINGS[k].includes(patch[k])) body[k] = patch[k];
  if (!serverUrl || !Object.keys(body).length) return null;
  try {
    const r = await authedFetch(serverUrl, SETTINGS_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r?.ok) return null;
    const value = normaliseIntentSettings(await r.json().catch(() => null));
    CACHE = { at: Date.now(), value };
    return value;
  } catch { return null; }
}

/** T18's gate input: 'on_cue' or 'never' — what the résumé row may offer in a manual fill. */
export async function resumeOnCueSetting(serverUrl) {
  return (await intentSettings(serverUrl)).manualResume;
}
