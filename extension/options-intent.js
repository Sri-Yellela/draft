// ── ⭐ T24 · Options → "Draft and your résumé" — the intent model's two settings ──────────────────────────────────────
// Read from, and written to, the ACCOUNT (the service worker's INTENT_SETTINGS → GET / PUT /api/settings/extension-intent;
// migration 168) — nothing is kept in the browser. "Forget my remembered choice" clears the answer the dock's one question
// kept when "Remember my choice" was ticked.

const status = document.getElementById('intent-status');
const remembered = document.getElementById('intent-remembered');
const forget = document.getElementById('intent-forget');
const radios = (name) => [...document.querySelectorAll(`input[name="${name}"]`)];

function show(s) {
  for (const r of radios('intent-on-draft')) r.checked = r.value === s.onDraft;
  for (const r of radios('intent-manual')) r.checked = r.value === s.manualResume;
  const words = s.remembered === 'drafted' ? 'Draft it and queue its résumé' : s.remembered === 'manual' ? 'Just fill it myself' : null;
  remembered.hidden = !words;
  forget.hidden = !words;
  remembered.textContent = words ? `Remembered for application forms: “${words}”.` : '';
}

async function ask(set = null) {
  const r = await chrome.runtime.sendMessage({ type: 'INTENT_SETTINGS', ...(set ? { set } : {}) }).catch(() => null);
  if (r?.ok && r.settings) { show(r.settings); status.textContent = set ? 'Saved.' : ''; return; }
  status.textContent = r?.message || 'Sign in to draft to change these.';
}

for (const r of radios('intent-on-draft')) r.addEventListener('change', () => { if (r.checked) void ask({ onDraft: r.value }); });
for (const r of radios('intent-manual')) r.addEventListener('change', () => { if (r.checked) void ask({ manualResume: r.value }); });
forget.addEventListener('click', () => { void ask({ remembered: null }); });
void ask();
