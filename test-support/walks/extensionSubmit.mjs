/**
 * ⭐ A207 (a) · THE ONE PRESS, WITH THE REAL EXTENSION LOADED (46l). npm run walk:extension -- extensionSubmit
 * ======================================================================================================
 * The hand-off of an ATS that flags draft's SERVER (a run held `server_submit_paused`) on the fake ATS's plain form:
 *   1. prepare + fill on the form → the packet; the harness's own DB / session copy is made the extension-submit shape a
 *      held Ashby run produces (gateReason server_submit_paused) and the form is filled again from it
 *   2. the review panel offers **Submit application**; disabled until Ready
 *   3. the person settles the panel (the guess acknowledged, the needed answer chosen, their résumé attached on the page)
 *   4. ⛔ a page script's click on Submit application sends NOTHING (untrusted)
 *   5. the person's press (a real input event) → the extension presses the form's own submit control in THIS browser →
 *      the fake ATS records ONE submission → the confirmation page is read → Sent recorded on draft's server
 *      (POST /api/apply/handoff/submitted) — once
 * Synthetic person (Ada Example) only; the "employer" is scripts/fakeAts.js on localhost.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultSeed, freePort, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';
import { prepareAndRead, clickIn } from './panelLifecycle.mjs';

const ATS_PORT = await freePort();
const LEVER = `http://localhost:${ATS_PORT}/lever`;
const AUTH = 'Are you authorized to work without sponsorship?';

export const PAYLOAD = {
  field_map: { first_name: 'Ada', last_name: 'Example', full_name: 'Ada Example', email: 'ada@example.test', company: 'Example Corp' },
  handler_map: {}, custom_answers: {},
};
export const options = {
  viewport: { width: 1280, height: 900 },
  atsPort: ATS_PORT,
  hosts: ['http://localhost/*'],
  api: {
    seed: (db) => {
      defaultSeed(db);
      db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
        VALUES ('lv-1','Backend Engineer','Example Co','Remote',?,?,'t','h-lv',unixepoch()-3600)`).run(LEVER, LEVER);
      db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'lv-1', 1)").run();
    },
    payload: PAYLOAD,
  },
};
export const description = 'A207 (a): an extension-submit hand-off — Submit application, Ready-gated; a page script cannot press it; ONE trusted press submits the form from this browser and Sent is recorded from the confirmation';

const rowHandle = (page, label) => page.evaluateHandle((l) => [...(document.getElementById('rm-gate-review-overlay')?.shadowRoot?.querySelectorAll('.rm-row') || [])]
  .find(x => x.querySelector('[data-role="label"]')?.textContent === l) || null, label);
const panelState = (h) => h.readShadow('rm-gate-review-overlay', (root, host) => ({
  ready: host.dataset.ready, need: host.dataset.need, state: root.querySelector('[data-role="state"]')?.textContent || null,
  send: root.querySelector('[data-role="send"]') ? { disabled: root.querySelector('[data-role="send"]').disabled } : null,
  rows: [...root.querySelectorAll('.rm-row')].map(r => `${r.dataset.group}:${r.querySelector('[data-role="label"]')?.textContent}`),
}));

export default async function run(h, { check, observe, section }) {
  const { page, db } = h;

  section('1 · the packet, made the extension-submit shape a held Ashby run produces');
  await h.open(LEVER);
  const first = await prepareAndRead(h);
  observe('the first fill', { reply: first.reply?.message, state: first.panel?.state });
  const pk = db.prepare("SELECT id, answers_json AS packet_json FROM apply_gate_packets WHERE job_id = 'lv-1' ORDER BY id DESC LIMIT 1").get();
  check('the prepare made a packet for the job', !!pk, JSON.stringify(db.prepare('SELECT id, job_id, gate_reason FROM apply_gate_packets').all()));
  if (!pk) return;
  const packet = { ...JSON.parse(pk.packet_json || '{}'), gateReason: 'server_submit_paused' };
  db.prepare("UPDATE apply_gate_packets SET gate_reason = 'server_submit_paused', answers_json = ?, consumed_at = NULL WHERE id = ?").run(JSON.stringify(packet), pk.id);
  const session = await h.storage.session();
  const key = Object.keys(session).find(k => /^gate:\d+$/.test(k));
  check('the tab holds the released packet (chrome.storage.session gate:<tab>)', !!key, Object.keys(session).join(', '));
  if (key) await h.storage.set('session', { [key]: { ...session[key], packet: { ...session[key].packet, gateReason: 'server_submit_paused' } } });
  await h.reload();
  const again = await prepareAndRead(h, { dismiss: true });
  observe('the fill from the extension-submit packet', { reply: again.reply?.message, state: again.panel?.state });

  section('2 · Submit application is offered, and waits for Ready');
  let s = await waitUntil(() => panelState(h), 20000, 200);
  observe('the panel', s);
  check('the panel offers Submit application on this hand-off', !!s?.send, JSON.stringify(s));
  check('…disabled while the panel is not Ready', s?.ready !== 'true' ? s?.send?.disabled === true : true, JSON.stringify(s));

  section('3 · the person settles the panel');
  const ack = (await rowHandle(page, 'Current company')).asElement();
  if (ack) { const b = await ack.$('[data-role="ack"]'); if (b) await b.click(); }
  if (await page.$(`#rm-gate-review-overlay >>> [aria-label="${AUTH}"]`)) {
    await page.select(`#rm-gate-review-overlay >>> [aria-label="${AUTH}"]`, 'yes').catch(() => {});
    await page.click(`#rm-gate-review-overlay >>> [aria-label="${AUTH}"] ~ [data-role="use"]`).catch(() => {});
  } else {
    await page.select('select[name="cards[authorized_to_work]"]', 'yes');
  }
  if (await page.$('#rm-gate-review-overlay >>> .rm-row[data-group="need"] [aria-label="Location"]')) {
    await page.type('#rm-gate-review-overlay >>> .rm-row[data-group="need"] [aria-label="Location"]', 'Remote');
    await page.click('#rm-gate-review-overlay >>> [aria-label="Location"] ~ [data-role="use"]').catch((e) => observe('use Location', e.message));
    await sleep(1500);
    observe('the page\'s Location after Use it', await page.$eval('input[name="location"]', el => el.value).catch(() => null));
  } else observe('no Location input in the panel', true);
  const pdf = path.join(os.tmpdir(), 'a207-walk-resume.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const file = await page.$('input[name="resume"]');
  if (file) await file.uploadFile(pdf);   // the person attaches their résumé on the page
  await page.evaluate(() => document.querySelector('input[name="resume"]')?.dispatchEvent(new Event('change', { bubbles: true })));
  s = await waitUntil(async () => { const x = await panelState(h); return x?.ready === 'true' ? x : null; }, 20000, 300) || await panelState(h);
  observe('after settling', s);
  check('the panel reads Ready', s?.ready === 'true', JSON.stringify(s));
  check('Submit application is enabled once Ready', s?.send?.disabled === false, JSON.stringify(s?.send));
  if (s?.ready !== 'true') return;

  section('4 · ⛔ a page script cannot press it');
  const before = (await h.ats.submissions()).length;
  await page.evaluate(() => document.getElementById('rm-gate-review-overlay').shadowRoot.querySelector('[data-role="send"]').click());
  await sleep(1500);
  check('an untrusted click sends nothing', (await h.ats.submissions()).length === before);
  check('…and records nothing', !h.api.requests.some(r => /\/api\/apply\/handoff\/submitted/.test(r.url || r.path || '')));

  section('5 · the person\'s ONE press');
  // the dock had folded to its slim bar (data-collapsed) by the time the panel read Ready — the person opens it, as here
  observe('the dock host', await page.evaluate(() => ({ ...document.getElementById('rm-draft-dock')?.dataset })));
  if (await page.$('#rm-draft-dock >>> [data-role="expand"]')) { await page.click('#rm-draft-dock >>> [data-role="expand"]').catch(() => {}); await sleep(500); }
  const sendBtn = await page.$('#rm-gate-review-overlay >>> [data-role="send"]');
  await sendBtn.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await sleep(300);
  const box = await sendBtn.evaluate(el => { const r = el.getBoundingClientRect(); const root = el.getRootNode(); const at = root.elementFromPoint ? root.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, top: at ? `${at.tagName}.${at.className}[${at.dataset?.role || ''}]` : null,
      hidden: getComputedStyle(el).visibility, display: getComputedStyle(el).display }; });
  observe('the Submit application button', box);
  await sendBtn.click().catch(async (e) => { observe('element click', e.message); await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); });   // a real input event — the person's press
  const subs = await waitUntil(async () => { const a = await h.ats.submissions(); return a.length > before ? a : null; }, BUSY_MS, 300);
  check('the form was submitted from this browser — once', (subs || []).length === before + 1, JSON.stringify((subs || []).map(x => x.provider)));
  check('…as the plain form (provider lever)', (subs || []).slice(-1)[0]?.provider === 'lever', JSON.stringify((subs || []).slice(-1)[0] || null));
  observe('the tab now', { url: page.url(), h1: await page.$eval('h1', el => el.textContent).catch(() => null) });
  const recorded = await waitUntil(() => { const r = h.api.requests.filter(x => /\/api\/apply\/handoff\/submitted/.test(x.url || x.path || '')); return r.length ? r : null; }, BUSY_MS, 300);
  check('Sent recorded on draft\'s server from the confirmation page — once', (recorded || []).length === 1, JSON.stringify((recorded || []).map(r => r.url || r.path)));
  const app = db.prepare("SELECT job_id FROM job_applications WHERE user_id = 1 AND job_id = 'lv-1'").get();
  observe('job_applications', app || null);
  check('the application is on the person\'s record', !!app);
}
