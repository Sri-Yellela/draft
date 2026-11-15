// extension/runnerModel.js — ⭐ A211 (1a) (owner 11-15: "automate applications using the users own session … by seeking
// permission" → "build option 1a"). THE RUNNER TAB's rules, pure (the tests read them; runner.js draws them).
//
// The runner is an extension page the person keeps open. It lists the applications waiting to be sent FROM THE PERSON'S OWN
// BROWSER (the A207 extension-submit packets: an ATS that flags draft's servers), fills each one in a background tab from its
// stored answers on the person's "Fill all", and then ONE press of "Send all" sends every application that reads Ready — each
// from the person's own browser, each confirmation read back (A207's sendWithPress). ⛔ D36 / A207's rule holds: nothing is
// sent without the person's press; the one press covers exactly the Ready applications the runner shows at that moment.
// A bot check (CAPTCHA) or a question only the person can answer stops that application at "Needs you" — never solved here.

export const RUNNER_STATES = Object.freeze(['waiting', 'opening', 'filling', 'ready', 'needs_you', 'sending', 'sent', 'failed']);

/** One row per application: { packetId, jobId, company, title, applyUrl, origins, state, note, tabId }. */
export function rowsFromPackets(packets, isExtensionSubmit) {
  return (Array.isArray(packets) ? packets : []).filter(p => isExtensionSubmit(p) && !p.stale && p.applyUrl).map(p => ({
    packetId: p.packetId, jobId: p.jobId ?? null, company: p.company || 'An employer', title: p.title || 'Application',
    applyUrl: p.applyUrl, origins: Array.isArray(p.origins) && p.origins.length ? p.origins : (p.expectedOrigin ? [p.expectedOrigin] : []),
    state: 'waiting', note: '', tabId: null,
  }));
}

/** A page the runner may open: https, or this computer's own loopback (the harness's stand-in ATS). Pure. */
export function runnablePage(u) {
  try { const x = u instanceof URL ? u : new URL(String(u)); return x.protocol === 'https:' || (x.protocol === 'http:' && (x.hostname === 'localhost' || x.hostname === '127.0.0.1')); }
  catch { return false; }
}

/** The host patterns the runner asks Chrome for, on the person's click — only these applications' own sites. Pure. */
export function originPatterns(rows) {
  const out = new Set();
  for (const r of rows) for (const o of r.origins) { try { const u = new URL(o); if (runnablePage(u)) out.add(`${u.protocol}//${u.hostname}/*`); } catch { /* not a site */ } }
  return [...out].sort();
}

/** What a fill result means for the row. Pure. */
export function stateAfterFill(result) {
  if (!result?.ok) return { state: 'failed', note: result?.message || 'draft could not fill this one — open it and use Fill.' };
  const need = Number(result.panel?.needYou ?? result.missingCount ?? 0);
  if (result.review?.ready === true && need === 0) return { state: 'ready', note: `Filled ${result.panel?.filled ?? result.filled?.length ?? 0} of ${result.panel?.of ?? result.fieldCount ?? '?'} — ready to send.` };
  return { state: 'needs_you', note: need ? `${need} question${need === 1 ? '' : 's'} only you can answer — open it to finish.` : 'Check it before it goes — open it.' };
}

/** What a send result means for the row. Pure. */
export function stateAfterSend(result) {
  if (result?.ok && result.outcome === 'sent') return { state: 'sent', note: result.message || 'Sent from your browser.' };
  return { state: result?.outcome === 'on_form' ? 'needs_you' : 'failed', note: result?.message || 'Not sent — open it and press Submit on the page.' };
}

/** The rows "Send all" sends: Ready ones with an open tab — nothing else, ever. Pure. */
export const sendable = (rows) => rows.filter(r => r.state === 'ready' && r.tabId != null);

/** The runner's one line. Pure. */
export function summaryLine(rows) {
  const n = (s) => rows.filter(r => r.state === s).length;
  if (!rows.length) return 'Nothing is waiting to be sent from your browser.';
  const parts = [n('ready') && `${n('ready')} ready`, n('needs_you') && `${n('needs_you')} need you`, n('sent') && `${n('sent')} sent`,
    n('failed') && `${n('failed')} not sent`, (n('waiting') + n('opening') + n('filling')) && `${n('waiting') + n('opening') + n('filling')} to fill`].filter(Boolean);
  return parts.join(' · ');
}
