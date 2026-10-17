/**
 * T13 + T14 (field report 10-14) · ONE PRESS DOES THE WHOLE CHAIN, AND A NEW TAB FOR THE SAME JOB KNOWS IT.
 * ===========================================================================================================
 *   npm run walk:extension -- fillChain
 *
 * The real extension in a real Chrome on the Workday-shaped fixture (the owner's Zoom URL), the REAL routes, a
 * SYNTHETIC person (Ada Example). Every automatic switch is OFF (the default) — each press below is the user's own.
 *   1. setup: the job is on Ada's board (captured once); the browser then FORGETS everything (no binding, no progress)
 *   2. T13 · Fill from a COLD tab with every auto switch off → it reads, prepares and fills in ONE press, and says so
 *   3. T13 · "Read this page" on a cold tab → the answers are PREPARED (a packet on the server, "Answers prepared" kept)
 *   4. T14 · the application URL opened in a NEW tab → the REAL popup (chrome.action.openPopup) shows the same job, its
 *      card and its progress at once — no capture, no read, no prepare asked; nothing about the page is sent on open
 *   5. T14 · …and the popup's own Fill button fills that tab with no prior press, without reading the page again
 *   6. T13 · a page with no application form (the posting) → the press says why
 */
import { OWNER_STAGE, OTHER_STAGE, POSTING, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';

export const description = 'T13 + T14: one Fill press reads, prepares and fills; Read prepares; a new tab for the same job binds at once and fills with no prior press';

const PAGE_PATHS = ['/api/import/context', '/api/extension/page', '/api/apply/handoff/match', '/api/apply/prepare'];

export default async function run(h, { check, observe, section }) {
  const { db, browser, control } = h;
  const forget = async () => { await h.storage.set('local', { jobProgress: null }); await h.storage.clear('session'); };
  const firstName = (p) => p.evaluate(() => document.querySelector('input[name="firstName"]')?.value || '');
  // The on-page badge of the tab in FRONT (the harness's own readers watch its first tab only).
  let front = h.page;
  const readBadge = () => front.evaluate(() => {
    const host = document.getElementById('rm-draft-autofill-badge');
    return host ? { state: host.dataset.state || null } : null;
  });
  const dismissBadge = () => front.evaluate(() => {
    const b = document.getElementById('rm-draft-autofill-badge')?.shadowRoot?.querySelector('[data-role="dismiss"]');
    if (b) b.click();
    return !!b;
  });
  /**
   * One Fill press, to ITS end. A fill on a Workday-shaped step waits for the candidate on the required fields it cannot
   * answer — the status line says "required" — and the × ends it. ⭐ (open item 2) Waited for by its own signals (the
   * reply, or "required" on the tab in front: h.untilAnswerOrWaiting), not by "no reply in 8 s, so it must be waiting" —
   * under load a press that was merely slow was held a minute for a "required" that never came (as in bindingFirst).
   */
  const fillPress = async () => {
    const r = await h.untilAnswerOrWaiting({ type: 'FILL_ACTIVE_TAB' }, { on: front });
    if (r.answered) return r.reply;
    if (r.waitingForYou) await dismissBadge();
    return Promise.race([r.reply, sleep(BUSY_MS).then(() => ({ ok: null, message: `the Fill never answered (${r.waitingForYou ? 'after the ×' : 'no reply and no "required"'})` }))]);
  };
  const newTab = async (url) => {
    const p = await browser.newPage();
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.bringToFront();
    await sleep(250);
    front = p;
    return p;
  };

  section('1 · setup — the job is on the board; the browser forgets everything');
  await h.open(OWNER_STAGE);
  const cap = await h.capture();
  check('captured once (the server now knows the job)', cap?.success === true, cap?.message);
  const jobId = String(cap?.jobId);
  await forget();
  check('no binding and no progress left', (await h.bindings()).length === 0 && !(await h.storage.local()).jobProgress);
  const auto = Object.keys(await h.storage.local()).filter(k => /auto/i.test(k));
  observe('auto-read storage keys (all switches off by default)', auto);

  section('2 · T13 — Fill from a cold tab, every auto switch off: read, prepare and fill in ONE press');
  const tabA = await newTab(OWNER_STAGE);
  check('the tab is cold — not bound', (await h.bindings()).length === 0);
  const before = db.prepare('SELECT COUNT(*) FROM apply_gate_packets WHERE user_id = 1').pluck().get();
  const one = await fillPress();
  check('the form carries the prepared answers', (await firstName(tabA)) === 'Ada', await firstName(tabA));
  check('ONE press read the page and prepared the answers', JSON.stringify(one?.did) === JSON.stringify(['read', 'prepared']), JSON.stringify(one?.did));
  check('…and says so', /^Read this page and prepared your answers\./.test(one?.message || ''), one?.message);
  check('a packet was prepared on the server', db.prepare('SELECT COUNT(*) FROM apply_gate_packets WHERE user_id = 1').pluck().get() > before);
  const bA = (await h.bindings())[0]?.[1];
  check('the tab is now bound to the job', bA?.jobId === jobId, JSON.stringify(bA || null));
  const recA = (await h.storage.local()).jobProgress?.records?.[jobId];
  check('its progress says read and prepared', !!recA?.read?.at && !!recA?.prepared?.at, JSON.stringify(recA ? { read: recA.read, prepared: recA.prepared } : null));
  check('…and remembers the address it was seen at', (recA?.addresses || []).length > 0, JSON.stringify(recA?.addresses || []));

  section('3 · T13 — "Read this page" on a cold tab leaves the answers prepared');
  await forget();
  db.prepare('DELETE FROM apply_gate_packets WHERE user_id = 1').run();
  await newTab(OTHER_STAGE);
  const ctx = await h.popupContext();
  check('Read prepared', ctx?.prepared === true, JSON.stringify({ prepared: ctx?.prepared, handoff: ctx?.handoff?.state }));
  check('a packet exists for the job', db.prepare('SELECT COUNT(*) FROM apply_gate_packets WHERE user_id = 1 AND job_id = ?').pluck().get(jobId) > 0);
  check('the popup is offered Fill, not Prepare (a packet fills this page)', (ctx?.packets || []).length > 0, JSON.stringify(ctx?.packets?.length));
  const recB = (await h.storage.local()).jobProgress?.records?.[jobId];
  check('"Answers prepared" is remembered', !!recB?.prepared?.at, JSON.stringify(recB?.prepared || null));

  section('4 · T14 — the application URL in a NEW tab: the real popup knows the job at once');
  const tabC = await newTab(OWNER_STAGE);
  const tabsBefore = (await h.bindings()).length;
  const mark = h.api.requests.length;
  const opened = await control.evaluate(() => chrome.action.openPopup().then(() => 'ok', e => `ERR ${e.message}`));
  const popupT = opened === 'ok' ? await browser.waitForTarget(t => t.url().endsWith('/popup.html'), { timeout: BUSY_MS }).catch(() => null) : null;
  check('the real popup opened on the new tab', !!popupT, opened);
  if (!popupT) return;
  const popup = await popupT.asPage();
  const view = await waitUntil(() => popup.evaluate(() => {
    const t = (id) => document.getElementById(id);
    if (t('progress')?.hidden !== false) return null;
    return { bound: t('bound').style.display, boundLine: t('bound-line').textContent, title: t('preview-title').textContent,
      card: t('job-preview').style.display, progress: t('progress-line').textContent, fill: t('btn-fill-primary').style.display,
      read: t('btn-read-page').textContent.trim() };
  }), BUSY_MS);
  check('the bound line names the job', view?.bound === 'block' && /Software Engineer at Zoom/.test(view?.boundLine || ''), JSON.stringify(view));
  check('the job card is drawn', view?.card === 'grid' && view?.title === 'Software Engineer', JSON.stringify(view));
  check('its progress came back — no capture, no read, no prepare asked', /Page read/.test(view?.progress || '') && /Answers prepared/.test(view?.progress || ''), view?.progress);
  check('Fill is the one action; Read is offered only again', view?.fill === 'flex' && view?.read === 'Read again', JSON.stringify(view));
  const binds = await h.bindings();
  check('the new tab is bound ("known from earlier")', binds.length > tabsBefore && binds.some(([, v]) => v.jobId === jobId && v.via === 'known'),
    JSON.stringify(binds.map(([, v]) => v.via)));
  const sentOnOpen = h.api.requests.slice(mark).map(r => r.path).filter(p => PAGE_PATHS.includes(p));
  check('nothing about the page was sent on open (D23)', sentOnOpen.length === 0, JSON.stringify(sentOnOpen));

  section('5 · T14 — the popup\'s Fill fills the new tab with no prior press, without reading it again');
  const mark2 = h.api.requests.length;
  await popup.evaluate(() => document.getElementById('btn-fill-primary').click());
  const filled = await waitUntil(() => firstName(tabC).then(v => v === 'Ada'), BUSY_MS);
  check('the new tab\'s form is filled', !!filled, await firstName(tabC));
  // ⭐ (open item 2) the press's end, by its own signals: the wizard asking the candidate ("required" — × it), or the popup's
  // status leaving "Filling…" — whichever comes first. It gave "required" 15 s and then waited a minute on a popup that
  // was still filling (the wizard waits for the candidate up to 9 minutes) when the badge came later than that.
  const popupStatus = () => popup.evaluate(() => document.getElementById('status')?.textContent || '').catch(() => 'closed');
  const ended = await waitUntil(async () => {
    if ((await readBadge().catch(() => null))?.state === 'required') return 'required';
    const s = await popupStatus();
    return /Filling/.test(s) || !s ? null : 'answered';
  }, BUSY_MS);
  if (ended === 'required') await dismissBadge();
  const status = await waitUntil(() => popupStatus().then(s => (/Filling/.test(s) || !s ? null : s)), BUSY_MS);
  observe('the popup said', status);
  const reads = h.api.requests.slice(mark2).map(r => r.path).filter(p => p === '/api/import/context' || p === '/api/extension/page');
  check('the page was NOT read again', reads.length === 0, JSON.stringify(reads));
  check('…and not prepared again (a packet already filled it)', !h.api.requests.slice(mark2).some(r => r.path === '/api/apply/prepare'));
  await popup.close().catch(() => {});

  section('6 · T13 — a page with no application form says why');
  await newTab(POSTING);
  const none = await fillPress();
  check('not filled', none?.ok === false, JSON.stringify(none));
  check('…and the sentence says why', /No application form/.test(none?.message || ''), none?.message);
}
