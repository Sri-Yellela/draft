/**
 * ⭐ BINDING FIRST (owner 10-15: "binding and then the rest. and it has to work flawlessly") + T15 + T16.
 * ======================================================================================================
 *   npm run walk:extension -- bindingFirst
 *
 * The real extension in a real Chrome on the Workday-shaped fixture (the owner's Zoom URL), the REAL routes, a SYNTHETIC
 * person (Ada Example), every automatic switch OFF — each press below is the user's own. The scenario matrix:
 *   1. ON YOUR BOARD — Fill on a cold tab: the page is IDENTIFIED (POST /api/extension/page) and the tab bound BEFORE any
 *      prepare or token mint (the order read from the API's own request log), then prepared and filled in one press
 *   2. (a) a BOUND tab on a page naming no job keeps its binding (identify ran, named nothing, nothing rebound)
 *   3. T15 — the packet has gone off (older than the server's 72 h): Fill on the bound job re-prepares and fills in ONE
 *      press — never "Nothing is prepared"
 *   4. T15 — no packet at all on a bound job: the same
 *   5. T15 — the popup's count is the SERVER packet's: Read's packets and the job's record carry its field count and expiry
 *   6. A BOARD JOB NOT YET YOURS — identified, bound ("On the draft board"), prepared and filled (D99's binding rule)
 *   7. NOT ON THE BOARD — nothing bound, nothing prepared, nothing asked of /api/apply; the sentence names ONE button
 *      (Capture); the capture binds the tab and the same Fill then fills
 *   8. NOT A JOB — a page of the same site that is no posting: nothing bound, nothing prepared
 *   9. UNREACHABLE and SIGNED OUT — nothing bound, nothing prepared, each with its own sentence
 * ⛔ T16: no sentence in any of these tells the user to run an earlier step.
 */
import { OWNER_STAGE, POSTING, T, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';

export const description = 'BINDING FIRST + T15 + T16: identify and bind before anything; each outcome its own sentence; a bound job never ends "Nothing is prepared"';

// The identify route can be made to fail on demand (section 9) — a lane's own route mounted BEFORE the real one.
const FAIL = { mode: null };
export const options = {
  api: {
    mount: (app) => {
      app.post('/api/extension/page', (req, res, next) => {
        if (FAIL.mode === 'down') return res.status(503).json({ error: 'unavailable' });
        if (FAIL.mode === 'signed_out') return res.status(401).json({ error: 'not_signed_in' });
        return next();
      });
    },
  },
};

const INSTRUCTS = /in the draft popup|capture it first|capture it (to fill|again)|then open this again|press\s+["“']?(Read this page|Prepare this application)|run it again in draft/i;
const NOTHING_PREPARED = /Nothing is prepared/i;

export default async function run(h, { check, observe, section }) {
  const { db, browser } = h;
  FAIL.mode = null;
  const forget = async () => { await h.storage.set('local', { jobProgress: null }); await h.storage.clear('session'); };
  const firstName = (p) => p.evaluate(() => document.querySelector('input[name="firstName"]')?.value || '');
  let front = h.page;
  const readBadge = () => front.evaluate(() => {
    const host = document.getElementById('rm-draft-autofill-badge');
    return host ? { state: host.dataset.state || null } : null;
  }).catch(() => null);
  const dismissBadge = () => front.evaluate(() => {
    const b = document.getElementById('rm-draft-autofill-badge')?.shadowRoot?.querySelector('[data-role="dismiss"]');
    if (b) b.click();
    return !!b;
  }).catch(() => false);
  /** A fill on a Workday-shaped step waits for the candidate on the required fields it cannot answer: × ends it. */
  const settle = async (reply) => {
    if (!reply?.pending) return reply;
    const badge = await waitUntil(() => readBadge().then(b => (b?.state === 'required' ? b : null)), BUSY_MS);
    if (badge) await dismissBadge();
    return reply.reply;
  };
  const newTab = async (url) => {
    const p = await browser.newPage();
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.bringToFront();
    await sleep(250);
    front = p;
    return p;
  };
  const pathsSince = (mark) => h.api.requests.slice(mark).map(r => r.path);
  const firstIndex = (paths, re) => paths.findIndex(p => re.test(p));
  const PREPARE = /^\/api\/apply\/prepare$/;
  const MINT = /^\/api\/apply\/gate-packets\/\d+\/token$/;
  const IDENTIFY = /^\/api\/extension\/page$/;
  const APPLY = /^\/api\/apply\//;
  const tabBinding = async (page) => {
    const all = await h.bindings();
    // the newest binding is the tab in front (each section opens its own tab)
    return all.map(([k, v]) => ({ tabId: Number(k.slice(5)), ...v })).sort((a, b) => b.boundAt - a.boundAt)[0] || null;
  };
  const packets = () => db.prepare('SELECT id, job_id, created_at, answers_json FROM apply_gate_packets WHERE user_id = 1 ORDER BY id DESC').all();

  section('0 · setup — the job is on Ada\'s board (captured once); the browser forgets everything');
  await h.open(OWNER_STAGE);
  const cap = await h.capture();
  check('captured once', cap?.success === true, cap?.message);
  const jobId = String(cap?.jobId);
  await forget();
  check('no binding and no progress left', (await h.bindings()).length === 0 && !(await h.storage.local()).jobProgress);

  section('1 · ON YOUR BOARD — Fill on a cold tab: identify and bind BEFORE any prepare or mint, then prepare and fill');
  const tab1 = await newTab(OWNER_STAGE);
  let mark = h.api.requests.length;
  const one = await settle(await h.fill({ timeoutMs: 8000 }));
  check('the form carries the prepared answers', (await firstName(tab1)) === 'Ada', await firstName(tab1));
  const p1 = pathsSince(mark);
  const iId = firstIndex(p1, IDENTIFY), iPrep = firstIndex(p1, PREPARE), iMint = firstIndex(p1, MINT), iApply = firstIndex(p1, APPLY);
  check('the page was identified (POST /api/extension/page)', iId >= 0, JSON.stringify(p1));
  check('…BEFORE any /api/apply request, any prepare and any token mint', iId >= 0 && iId < iApply && iId < iPrep && iId < iMint,
    JSON.stringify({ iId, iApply, iPrep, iMint }));
  const b1 = await tabBinding(tab1);
  check('the tab is bound to the job, recognised by the identify', b1?.jobId === jobId && b1?.via === 'recognised', JSON.stringify(b1));
  check('one press said what it did', /^Read this page and prepared your answers\./.test(one?.message || ''), one?.message);
  check('T16 · no sentence sends the user back a step', !INSTRUCTS.test(one?.message || ''), one?.message);

  section('2 · (a) a BOUND tab on a page naming no job keeps its binding');
  await tab1.goto(`${T}/`, { waitUntil: 'domcontentloaded' });
  await tab1.bringToFront(); await sleep(250);
  mark = h.api.requests.length;
  const two = await settle(await h.fill({ timeoutMs: 8000 }));
  const p2 = pathsSince(mark);
  check('the press identified the page (an address the job was never seen at)', firstIndex(p2, IDENTIFY) >= 0, JSON.stringify(p2));
  const b2 = await tabBinding(tab1);
  check('…named no job, and the binding stayed', b2?.jobId === jobId && b2?.tabId === b1?.tabId, JSON.stringify(b2));
  observe('what the press said there', two?.message);
  check('…and never "Nothing is prepared" or an instruction to go back a step', !NOTHING_PREPARED.test(two?.message || '') && !INSTRUCTS.test(two?.message || ''), two?.message);

  section('3 · T15 — the packet has gone off: Fill re-prepares and fills in ONE press');
  db.prepare('UPDATE apply_gate_packets SET created_at = unixepoch() - 73 * 3600 WHERE user_id = 1').run();
  const before3 = packets().length;
  const tab3 = await newTab(OWNER_STAGE);   // a new tab: T14 binds it on its known address; no packet cached in it
  mark = h.api.requests.length;
  const three = await settle(await h.fill({ timeoutMs: 8000 }));
  check('filled', (await firstName(tab3)) === 'Ada', await firstName(tab3));
  check('…the press prepared afresh', (three?.did || []).includes('prepared') && packets().length > before3, JSON.stringify({ did: three?.did, n: packets().length }));
  check('…without identifying again (the address is one the job is known at)', firstIndex(pathsSince(mark), IDENTIFY) < 0, JSON.stringify(pathsSince(mark)));
  check('…and never said "Nothing is prepared"', !NOTHING_PREPARED.test(three?.message || ''), three?.message);

  section('4 · T15 — no packet at all on a bound job: the same one press');
  db.prepare('DELETE FROM apply_gate_packets WHERE user_id = 1').run();
  const tab4 = await newTab(OWNER_STAGE);
  const four = await settle(await h.fill({ timeoutMs: 8000 }));
  check('filled', (await firstName(tab4)) === 'Ada', await firstName(tab4));
  check('…prepared in the same press', (four?.did || []).includes('prepared') && packets().length === 1, JSON.stringify({ did: four?.did, n: packets().length }));
  check('…and never said "Nothing is prepared"', !NOTHING_PREPARED.test(four?.message || ''), four?.message);

  section('5 · T15 — the popup\'s count is the SERVER packet\'s');
  db.prepare('DELETE FROM apply_gate_packets WHERE user_id = 1').run();
  await newTab(OWNER_STAGE);
  const ctx = await h.popupContext();
  const row = packets()[0];
  const serverCount = row ? (JSON.parse(row.answers_json || '{}').answers || []).length : -1;
  const listed = (ctx?.packets || [])[0];
  check('Read prepared, and the popup is told the packet', ctx?.prepared === true && !!listed, JSON.stringify({ prepared: ctx?.prepared, n: ctx?.packets?.length }));
  check('the popup\'s field count equals the packet\'s', listed?.answerCount === serverCount, JSON.stringify({ popup: listed?.answerCount, server: serverCount }));
  check('…and when it goes off is the server\'s rule (made + 72 h)', listed && listed.expiresAt === listed.createdAt + 72 * 3600 * 1000, JSON.stringify(listed));
  const rec5 = (await h.storage.local()).jobProgress?.records?.[jobId];
  check('the job\'s record remembers the SERVER packet (made, expires, field count)',
    rec5?.prepared?.answerCount === serverCount && rec5?.prepared?.expiresAt === listed?.expiresAt && rec5?.prepared?.at === listed?.createdAt,
    JSON.stringify(rec5?.prepared || null));

  section('6 · A BOARD JOB NOT YET YOURS — identified, bound, prepared and filled');
  // Ada's own record of the job is gone; the board holds a live copy of the same posting that she never saved.
  for (const t of ['apply_gate_packets', 'job_captures', 'user_jobs', 'job_page_keys']) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* absent */ } }
  db.prepare('DELETE FROM scraped_jobs').run();   // Ada's captured copy (and the seed's other-ATS copy) gone
  // (http, as the fixture serves the tenant — the packet's addresses follow the posting's own scheme)
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at,is_active)
    VALUES ('wd-zoom-board','Software Engineer','Zoom','Remote (US)',?,?,'t','hb',unixepoch()-3600,1)`).run(POSTING, OWNER_STAGE);
  await forget();
  const tab6 = await newTab(OWNER_STAGE);
  mark = h.api.requests.length;
  const six = await settle(await h.fill({ timeoutMs: 8000 }));
  const p6 = pathsSince(mark);
  const b6 = await tabBinding(tab6);
  check('identified as the board job and bound to it', b6?.jobId === 'wd-zoom-board', JSON.stringify(b6));
  check('identify came before the prepare', firstIndex(p6, IDENTIFY) >= 0 && firstIndex(p6, IDENTIFY) < firstIndex(p6, PREPARE), JSON.stringify(p6));
  check('filled', (await firstName(tab6)) === 'Ada', `${await firstName(tab6)} · ${six?.message}`);
  check('…never "capture it first"', !INSTRUCTS.test(six?.message || ''), six?.message);

  section('7 · NOT ON THE BOARD — nothing bound, nothing prepared; ONE button (Capture), which binds, and Fill fills');
  for (const t of ['apply_gate_packets', 'job_captures', 'user_jobs', 'job_page_keys', 'resumes']) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* absent */ } }
  db.prepare('DELETE FROM scraped_jobs').run();
  await forget();
  const tab7 = await newTab(OWNER_STAGE);
  mark = h.api.requests.length;
  const seven = await settle(await h.fill({ timeoutMs: 8000 }));
  const p7 = pathsSince(mark);
  check('not filled', seven?.ok === false && (await firstName(tab7)) === '', JSON.stringify({ ok: seven?.ok, v: await firstName(tab7) }));
  check('the outcome is "not on the board" and its ONE action is Capture', seven?.outcome === 'not_on_board' && seven?.action === 'capture', JSON.stringify({ outcome: seven?.outcome, action: seven?.action }));
  check('…said in one sentence naming Capture', /Capture adds it/.test(seven?.message || '') && !INSTRUCTS.test(seven?.message || ''), seven?.message);
  check('nothing bound', (await h.bindings()).length === 0, JSON.stringify(await h.bindings()));
  check('nothing prepared and nothing asked of /api/apply', firstIndex(p7, APPLY) < 0 && packets().length === 0, JSON.stringify(p7));
  const cap7 = await h.capture();
  check('Capture adds it and binds the tab', cap7?.success === true && (await tabBinding(tab7))?.via === 'capture', JSON.stringify({ cap: cap7?.message, b: await tabBinding(tab7) }));
  const seven2 = await settle(await h.fill({ timeoutMs: 8000 }));
  check('…and the same Fill then fills', (await firstName(tab7)) === 'Ada', `${await firstName(tab7)} · ${seven2?.message}`);

  section('8 · NOT A JOB — a page of the same site that is no posting: nothing bound, nothing prepared');
  await forget();
  db.prepare('DELETE FROM apply_gate_packets WHERE user_id = 1').run();
  await newTab(`${T}/robots.txt`);
  mark = h.api.requests.length;
  const eight = await settle(await h.fill({ timeoutMs: 8000 }));
  check('not filled; outcome "not a job"', eight?.ok === false && eight?.outcome === 'not_a_job', JSON.stringify({ ok: eight?.ok, outcome: eight?.outcome, message: eight?.message }));
  check('nothing bound, nothing asked of /api/apply', (await h.bindings()).length === 0 && firstIndex(pathsSince(mark), APPLY) < 0, JSON.stringify(pathsSince(mark)));

  section('9 · UNREACHABLE and SIGNED OUT — nothing bound, nothing prepared, each its own sentence');
  for (const mode of ['down', 'signed_out']) {
    await forget();
    FAIL.mode = mode;
    await newTab(OWNER_STAGE);
    mark = h.api.requests.length;
    const r = await settle(await h.fill({ timeoutMs: 8000 }));
    const want = mode === 'down' ? 'unavailable' : 'signed_out';
    check(`${mode}: outcome ${want}`, r?.ok === false && r?.outcome === want, JSON.stringify({ outcome: r?.outcome, message: r?.message }));
    check(`${mode}: nothing bound, nothing asked of /api/apply`, (await h.bindings()).length === 0 && firstIndex(pathsSince(mark), APPLY) < 0, JSON.stringify(pathsSince(mark)));
    observe(`${mode}: the sentence`, r?.message);
  }
  FAIL.mode = null;
}
