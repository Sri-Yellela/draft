/**
 * J6 · THE RÉSUMÉ ON THE PAGE — the real extension on the Workday-shaped fixture (D98 §4–§5).
 * ==========================================================================================
 *   npm run walk:extension -- resumePanel [--theme dark]
 *
 * Proves, in a real Chrome, with J3's REAL routes mounted (routes/extensionResume.js) and the GENERATION STUBBED
 * (test-support/extensionResumeStub.mjs — no model, nothing leaves the machine):
 *   1. My Information: the dock's Résumé tab — "No résumé has been made for this job yet", the job named; ⭐ T22 REVISED:
 *      it is a VIEW, with no Generate (a résumé starts only from the Draft button and the résumé row — T24 / T18)
 *   2. a generation started FROM THE PAGE'S TAB (h.pageSend — the message those two controls will send) → the tab shows
 *      Generating (progress, Cancel); one generation, one slot
 *   3. a Workday STEP change (no navigation) — the panel stays and keeps going; a RELOAD (the panel gone, as after the
 *      popup closed) and the popup's button again — the panel comes back Generating, the same generation
 *   4. Ready: the preview in a shadow root of its own, nothing in it ran, ATS before → after, What we changed, the guard
 *   5. Attach on My Experience — the PDF set on the fixture's hidden input, the drop zone shows the name, the panel
 *      says "Attached: Ada_Example_Zoom_Software_Engineer.pdf"
 *   6. the Copy sheet lists "Résumé — attached ✓"; the NEXT FILL (Prepare on a fresh My Experience) attaches the SAME
 *      file and the review panel's Filled group says "Résumé — attached ✓" — nothing generated again
 *   7. no Regenerate in the tab; a regeneration from the page's tab, then the tab's Cancel: "Cancelled — nothing was
 *      attached", and no Try again
 *   8. a claim-guard refusal: the reasons, Attach not offered, no PDF made
 * Synthetic person (Ada Example) throughout.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitUntil, sleep, defaultSeed, BUSY_MS } from '../extensionBrowser.mjs';
import { mountExtensionResume, seedBaseResume } from '../extensionResumeStub.mjs';
import { prepareAndRead, fresh } from './panelLifecycle.mjs';
import { C_LIGHT, C_DARK } from '../../extension/tokens.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * ⭐ THE ROUTER LINES THIS LANE HANDS THE COORDINATOR (extension/background.js is theirs). Appended to the TEST build
 * only, and only while the shipped background.js does not already import resumePanel.js — once wired, the walk runs the
 * SHIPPED router (J4's walk broke by appending a duplicate import after wiring; this cannot).
 */
export const ROUTER_LINES = `// ── D98 §4–§5 (J6): the résumé on the page — generate (the panel's own click only), preview, attach, the fallback ──
// extension/resumePanel.js: RESUME_PANEL_OPEN (popup / review panel) · RESUME_GENERATE (the panel's trusted click, a tab
// only) · RESUME_STATUS · RESUME_CANCEL · RESUME_ATTACH · RESUME_DOWNLOAD · RESUME_OPEN_EDITOR. Every request goes to
// RESUME_MASTER_URL (draft's own server); the generation's id is kept in the job's progress record (no new key).
import { handlers as RESUME_PANEL_HANDLERS, configureResumePanel } from './resumePanel.js';
configureResumePanel({ serverUrl: RESUME_MASTER_URL });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = RESUME_PANEL_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});`;
const wired = () => /from '\.\/resumePanel\.js'/.test(fs.readFileSync(path.join(ROOT, 'extension', 'background.js'), 'utf8'));

let CTL = null;
export const options = {
  backgroundAppend: wired() ? '' : ROUTER_LINES,
  api: {
    seed: (db) => { defaultSeed(db); seedBaseResume(db); },
    mount: async (app, db) => { CTL = mountExtensionResume(app, db); },
  },
};

export const description = 'D98 §4–§5: generate on the page (a click only), survive a step change and a reload, attach on the drop zone or fall back, the same file reused, cancel, a refusal attaches nothing';

const HOST = 'rm-resume-panel';
const click = (h, sel) => h.page.click(`#${HOST} >>> ${sel}`);
const readPanel = (h) => h.readShadow(HOST, (root, host) => ({
  state: host.dataset.state, id: host.dataset.id || null,
  title: root.querySelector('[data-role="title"]')?.textContent || null,
  job: root.querySelector('[data-role="job"]')?.textContent || null,
  text: root.querySelector('.sc')?.textContent.replace(/\s+/g, ' ').trim() || '',
  // ⭐ T26: the actions are icons — read by their names
  actions: [...root.querySelectorAll('.acts button')].map(b => b.getAttribute('aria-label') || b.textContent),
  score: root.querySelector('[data-role="score"]')?.textContent || null,
  changes: root.querySelector('[data-role="changes"]')?.textContent || null,
  guard: root.querySelector('[data-role="guard"]')?.textContent || null,
  reasons: [...root.querySelectorAll('[data-role="reasons"] li')].map(li => li.textContent),
  previewShadow: !!root.querySelector('[data-role="preview"]')?.shadowRoot,
  previewText: root.querySelector('[data-role="preview"]')?.shadowRoot?.querySelector('[data-role="page"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
  previewTags: [...(root.querySelector('[data-role="preview"]')?.shadowRoot?.querySelectorAll('*') || [])].map(e => e.tagName.toLowerCase()),
  // ⭐ T26: the dock's frame is the ONE surface (the view paints none of its own)
  bg: getComputedStyle(document.getElementById('rm-draft-dock').shadowRoot.querySelector('.fr')).backgroundColor,
  own: getComputedStyle(root.querySelector('.rp')).backgroundColor,
}));
const waitState = (h, want, ms = BUSY_MS) => waitUntil(async () => { const p = await readPanel(h); return p && want.includes(p.state) ? p : null; }, ms, 150);
const starts = (h) => h.api.requests.filter(r => r.method === 'POST' && r.path === '/api/extension/resume').length;
const hex = (rgb) => '#' + String(rgb).match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();

export default async function run(h, { check, observe, section }) {
  const { page } = h;
  const theme = h.theme();

  section('1 · My Information — the dock\'s Résumé tab is a VIEW; nothing starts');
  await h.openStage('applyManually');
  const cap = await h.capture();
  check('captured — the tab is bound to the job', cap?.success === true, cap?.message);
  const opened = await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'resume' });
  check('the Résumé tab is drawn on the page (the dock)', opened?.ok === true && opened.state === 'none', JSON.stringify(opened));
  const p1 = await waitState(h, ['none']);
  check('Not made yet: "Résumé for this job"', p1?.title === 'Résumé for this job', p1?.title);
  check('…it names the job', p1?.job === 'Software Engineer at Zoom', p1?.job);
  check('…"No résumé has been made for this job yet."', /No résumé has been made for this job yet\./.test(p1?.text || ''), p1?.text);
  check('⛔ T22: no Generate — the tab is not a place to start one', !p1?.actions.some(a => /Generate|Try again|Regenerate/.test(a)) && !(await h.readShadow(HOST, (root) => !!root.querySelector('[data-role="generate"], [data-role="regenerate"]'))), JSON.stringify(p1?.actions));
  const menu = (theme === 'dark' ? C_DARK : C_LIGHT).SURFACE_MENU;
  const flat = (c) => String(c || '').replace(/\s+/g, '').toLowerCase();
  check(`painted from the ${theme} tokens`, /^#/.test(menu) ? hex(p1?.bg) === menu.toUpperCase().slice(0, 7) : flat(p1?.bg) === flat(menu), `${p1?.bg} vs ${menu}`);
  check('opening the tab started nothing', CTL.generations().length === 0 && starts(h) === 0);

  section('2 · a generation is started from the page\'s tab (as T24\'s Draft / T18\'s "Generate and attach" will) → the tab shows Generating');
  const release = CTL.hold();
  // ⭐ T22 REVISED: no control starts one yet — the two that will (T24 / T18) send THIS message from the page's tab
  const g = await h.pageSend({ type: 'RESUME_GENERATE', trigger: 'click' });
  check('the one start answers', g?.ok === true, JSON.stringify(g)?.slice(0, 200));
  await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'resume' });
  const p2 = await waitState(h, ['generating']);
  check('Generating — progress and Cancel', p2?.state === 'generating' && p2.actions.join() === 'Cancel', JSON.stringify(p2?.actions));
  check('one generation, one slot', CTL.generations().length === 1 && CTL.slots() === 1, `${CTL.generations().length} / ${CTL.slots()}`);
  const local = await h.storage.local();
  const rec = Object.values(local.jobProgress?.records || {}).find(r => r.resume?.id);
  check('the job\'s progress record keeps the generation\'s id — and nothing of the résumé', rec?.resume?.id === p2?.id
    && Object.keys(rec.resume).sort().join() === 'at,attached,id,status', JSON.stringify(rec?.resume));

  section('3 · a Workday step change, then a reload and the popup again');
  await h.goStep('myExperience');
  await sleep(600);
  const p3 = await readPanel(h);
  check('the step changed under it — the panel is still there, still generating', p3?.state === 'generating' && p3.id === p2?.id, JSON.stringify(p3?.state));
  await h.reload();
  check('a reload takes the panel away (as a closed popup leaves it to the page)', (await readPanel(h)) === null);
  const reopened = await h.send({ type: 'RESUME_PANEL_OPEN' });
  const p3b = await waitState(h, ['generating']);
  check('…the popup\'s button brings it back Generating — the SAME generation, nothing spent again', reopened?.ok && p3b?.id === p2?.id && CTL.slots() === 1 && starts(h) === 1, JSON.stringify(reopened));
  release();
  const p4 = await waitState(h, ['ready']);
  check('…and it lands on Ready by itself (the panel polls)', p4?.state === 'ready', p4?.state);

  section('4 · Ready — the preview, the score, what changed, the guard');
  check('the preview is in a shadow root of its own', p4?.previewShadow === true);
  check('…it shows the résumé', /Ada Example/.test(p4?.previewText || '') && /payments ledger/.test(p4?.previewText || ''), p4?.previewText?.slice(0, 80));
  check('…no script, no image survived into it', !p4?.previewTags.some(t => ['script', 'img', 'iframe', 'link'].includes(t)), p4?.previewTags.join(','));
  check('…and nothing in the résumé ran', (await page.evaluate(() => window.__ranFromResume ?? null)) === null);
  check('ATS before → after', p4?.score === 'ATS 62 → 81', p4?.score);
  check('"What we changed — …"', /^What we changed — /.test(p4?.changes || ''), p4?.changes);
  check('the guard\'s result in plain words', /Checked against your profile/.test(p4?.guard || ''), p4?.guard);
  check('Attach · Download PDF · Edit in a full page — no Regenerate (T22: a view)', p4?.actions.join(' · ') === 'Attach · Download PDF · Edit in a full page', p4?.actions.join(' · '));
  const words = `${p4?.title} ${p4?.text} ${p4?.actions.join(' ')}`;
  check('⛔ no cost, token or model word anywhere on it', !/\$|\bcost|\bprice|\btokens?\b|\bmodel\b|claude|sonnet|anthropic|openai|credit/i.test(words), words.match(/\$|cost|price|token|model|claude|sonnet|credit/i)?.[0]);

  section('5 · Attach on My Experience — Workday\'s drop zone');
  await h.goStep('myExperience');
  await click(h, '[data-role="attach"]');
  const p5 = await waitState(h, ['attached', 'fallback']);
  observe('after Attach', { state: p5?.state, title: p5?.title });
  check('"Attached: Ada_Example_Zoom_Software_Engineer.pdf"', p5?.state === 'attached' && p5.title === 'Attached: Ada_Example_Zoom_Software_Engineer.pdf', p5?.title);
  const shown = await page.$eval('#ws-resume-status', el => el.textContent).catch(() => '');
  check('…and the page itself shows the file name', /Ada_Example_Zoom_Software_Engineer\.pdf · Successfully Uploaded!/.test(shown), shown);
  check('the server keeps the PDF as this application\'s', CTL.pdfs().length === 1 && CTL.pdfs()[0].attached_at != null);

  section('6 · the Copy sheet and the NEXT fill reuse the same file');
  await h.page.click('#rm-draft-dock >>> [data-role="close"]');   // ⭐ T17: Close is the dock's
  const sheet = await h.openCopySheet();
  const cs = await h.waitForCopySheet();
  const csRow = (cs?.rows || []).find(r => /^Résumé — attached ✓/.test(r.label || ''));
  check('the Copy sheet lists "Résumé — attached ✓" with the file', sheet?.ok === true && csRow?.value === 'Ada_Example_Zoom_Software_Engineer.pdf', JSON.stringify(csRow));
  await page.evaluate(() => document.getElementById('rm-copy-sheet-panel')?.remove());
  await fresh(h);
  await h.goStep('myExperience');
  const before = { calls: CTL.calls.length, starts: starts(h) };
  const fill = await prepareAndRead(h);
  const rpanel = await h.readPanel();
  const row = (rpanel?.rows || []).find(r => r.value === 'Résumé — attached ✓');
  check('the next fill attaches the SAME file — the drop zone shows its name', /Ada_Example_Zoom_Software_Engineer\.pdf/.test(await page.$eval('#ws-resume-status', el => el.textContent).catch(() => '')), JSON.stringify(fill?.reply?.resume || null));
  check('…the review panel\'s Filled group says "Résumé — attached ✓"', row?.band === 'ok', JSON.stringify((rpanel?.rows || []).filter(r => /sum|CV/i.test(r.label || ''))));
  check('…and nothing was generated again', CTL.calls.length === before.calls && starts(h) === before.starts, `${CTL.calls.length} calls, ${starts(h)} starts`);
  await page.evaluate(() => document.getElementById('rm-gate-review-overlay')?.remove());

  section('7 · no Regenerate in the tab (T22); a regeneration from the page\'s tab, then Cancel in the tab');
  await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'resume' });
  const p7a = await waitState(h, ['attached', 'ready']);
  check('⛔ T22: the Résumé tab offers no Regenerate', !(p7a?.actions || []).some(a => /Regenerate|Generate/.test(a)), JSON.stringify(p7a?.actions));
  const release2 = CTL.hold();
  const again = await h.pageSend({ type: 'RESUME_GENERATE', trigger: 'click', regenerate: true, id: p7a?.id });
  check('a regeneration (the T24 / T18 press) answers', again?.ok === true, JSON.stringify(again)?.slice(0, 200));
  await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'resume' });
  const p7 = await waitState(h, ['generating']);
  check('…it regenerates (another slot)', p7?.state === 'generating' && CTL.slots() === 2, `${CTL.slots()} slots`);
  await click(h, '[data-role="cancel"]');
  const p7b = await waitState(h, ['cancelled']);
  check('Cancel (the tab still cancels a running one) → "Cancelled — nothing was attached."', /Cancelled — nothing was attached\./.test(p7b?.text || ''), p7b?.text);
  check('…and offers no Try again (T22)', !(p7b?.actions || []).some(a => /Try again|Generate/.test(a)), JSON.stringify(p7b?.actions));
  release2();
  await sleep(300);
  check('…and a cancelled one never turns into a résumé', (await readPanel(h))?.state === 'cancelled' && CTL.pdfs().length === 1);

  section('8 · a claim-guard refusal attaches nothing');
  // ⚠ The server REUSES a résumé already made for this job from the SAME base (J3's rule — no slot, no generation), so
  // a second start here would bring the first one back. A changed base is a new (job, base) pair, and a new generation.
  h.db.prepare("UPDATE profile_base_resumes SET content = content || ' Also: Kubernetes.' WHERE profile_id = 10").run();
  CTL.mode = 'refuse';
  await h.pageSend({ type: 'RESUME_GENERATE', trigger: 'click' });
  await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'resume' });
  const p8 = await waitState(h, ['refused']);
  check('Refused: the reasons in plain words', p8?.state === 'refused' && p8.reasons[0] === 'The résumé claims 9 years of experience; your profile states 6.', JSON.stringify(p8?.reasons));
  check('…"Nothing was attached." — and Attach is not offered', /Nothing was attached\./.test(p8?.text || '') && !p8?.actions.includes('Attach'), p8?.actions.join());
  check('…no PDF made for it', CTL.pdfs().length === 1);
  check('the fixture recorded no submission (draft never submits)', (await h.submissions()).length === 0);
  await h.screenshot(`j6-resume-panel-${theme}`);
}
