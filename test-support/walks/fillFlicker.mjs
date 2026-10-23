/**
 * T21 (owner report (e), 10-15) · NO FLICKER — what the dock, its Fill view and the status line do DURING a fill.
 * ==============================================================================================================
 *   npm run walk:extension -- fillFlicker [--headful]
 *
 * The real extension in a real Chrome on the Workday-shaped fixture, a SYNTHETIC person (Ada Example). A recorder in
 * the page's MAIN world (the dock's shadow roots are open, so it reads them without touching the extension) counts,
 * through one fill:
 *   · frame repaints  — the dock frame's whole contents (header, tabs, panes) thrown away and re-made
 *   · fill-view mounts — the Fill tab's view host appended (each one a new shadow root, a new panel)
 *   · status repaints — the status line's bar thrown away and re-made (its pulsing icon's animation restarts)
 *   · fill buttons    — distinct "Fill this page" button NODES seen (a re-made node is a remount)
 *   · visible states  — what the Fill tab SHOWS, sampled every animation frame, with consecutive repeats folded
 * Two passes: (1) the popup's / Ctrl+Shift+Y's fill (FILL_ACTIVE_TAB); (2) the dock's own "Fill this page" button,
 * pressed as the person would (a trusted click). Each wizard step waits for the candidate; the × ends the wait.
 *
 * `export const budget` is the bound the T21 test holds these counts to.
 */
import { OWNER_STAGE, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';

export const description = 'T21: count the dock frame repaints, Fill view mounts, status repaints and Fill button remounts through a fill';

/** ⭐ T21's bound — through ONE fill of one wizard step, from either press. */
// Measured BEFORE T21 (10-15, one Workday step of 13 rows): popup fill 2 · 2 · 2 · 2 nodes; dock press 4 frame repaints,
// 2 view mounts, 2 status repaints, 4 button nodes. After: 1 · 1 · 1 · 1 and 0 · 1 · 1 · ≤1. The one frame repaint left is
// the slim bar opening into the full dock (a different shape — what the person is meant to see). The button's own
// mutations are its three changes of state (idle → "Filling…" → "Filling… 3 of 13" → idle: its words and its
// aria-busy / aria-disabled / data-busy) — 9 measured, on ONE node.
// ⭐ T26 (10-22): the button shows an ICON, and its words moved into its aria-label — the label is written where the text
// was (idle → "Filling…" → idle), and the icon is NOT swapped while it runs (it pulses in CSS). 11 measured, still ONE
// node and no child re-made; the bound is 12 for those two label writes, not for any re-mount.
export const budget = { frameRepaints: 1, fillViewMounts: 1, statusRepaints: 1, fillButtonNodes: 1, buttonMutations: 12, panelMutations: 40 };

/** Installed in the page's MAIN world. Reads only draft's own (open) shadow roots; changes nothing. */
function installRecorder() {
  if (window.__t21) return;
  const R = window.__t21 = { frameRepaints: 0, fillViewMounts: 0, statusRepaints: 0, panelMutations: 0, dockMutations: 0,
    statusMutations: 0, buttonMutations: 0, buttons: [], btnIds: new WeakMap(), states: [], blankFrames: 0, sampling: true };
  const seen = new WeakSet();
  const watch = (root, kind) => {
    if (!root || seen.has(root)) return;
    seen.add(root);
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (kind === 'dock') {
          R.dockMutations++;
          { const el = r.target.nodeType === 1 ? r.target : r.target.parentElement; if (el?.closest?.('[data-role="fill"]')) R.buttonMutations++; }
          if (r.type === 'childList' && [...r.removedNodes].some(n => n.classList?.contains('hd') || n.classList?.contains('slim'))) R.frameRepaints++;
        } else if (kind === 'status') {
          R.statusMutations++;
          if (r.type === 'childList' && [...r.removedNodes].some(n => n.classList?.contains('bar'))) R.statusRepaints++;
        } else R.panelMutations++;
      }
    }).observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
  };
  const scan = () => {
    const dock = document.getElementById('rm-draft-dock');
    if (dock) {
      watch(dock.shadowRoot, 'dock');
      if (!seen.has(dock)) {
        seen.add(dock);
        new MutationObserver((recs) => {
          for (const r of recs) for (const n of r.addedNodes) {
            if (n.getAttribute?.('data-draft-view') === 'fill') { R.fillViewMounts++; queueMicrotask(() => watch(n.shadowRoot, 'panel')); }
            if (n.id === 'rm-draft-autofill-badge') queueMicrotask(() => watch(n.shadowRoot, 'status'));
          }
        }).observe(dock, { childList: true });
        for (const n of dock.children) {
          if (n.getAttribute('data-draft-view') === 'fill') { R.fillViewMounts++; watch(n.shadowRoot, 'panel'); }
          if (n.id === 'rm-draft-autofill-badge') watch(n.shadowRoot, 'status');
        }
      }
    }
  };
  new MutationObserver(scan).observe(document.documentElement, { childList: true });
  scan();
  // Every animation frame: what the Fill tab SHOWS, and which button node it is.
  let nextId = 1;
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const tick = () => {
    if (!R.sampling) return;
    scan();
    const dock = document.getElementById('rm-draft-dock');
    let state = 'no dock';
    if (dock) {
      const collapsed = dock.dataset.collapsed === 'true';
      const view = dock.querySelector(':scope > [data-draft-view="fill"]');
      const btn = dock.shadowRoot?.querySelector('[data-role="fill"]');
      if (btn) { if (!R.btnIds.has(btn)) { R.btnIds.set(btn, nextId++); R.buttons.push(btn.textContent); } }
      const status = dock.querySelector(':scope > #rm-draft-autofill-badge')?.shadowRoot?.querySelector('[data-role="text"]')?.textContent || '';
      const pane = collapsed ? 'slim' : visible(view) ? `panel ${view.shadowRoot?.querySelector('.rm-hd')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) || '(empty)'}`
        : visible(btn) ? `button "${btn.textContent}"` : 'blank';
      if (pane === 'blank') R.blankFrames++;
      state = `${pane} | ${status}`;
    }
    if (R.states[R.states.length - 1] !== state) R.states.push(state);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const reset = (page) => page.evaluate(() => {
  const R = window.__t21;
  Object.assign(R, { frameRepaints: 0, fillViewMounts: 0, statusRepaints: 0, panelMutations: 0, dockMutations: 0, statusMutations: 0, buttonMutations: 0, buttons: [], btnIds: new WeakMap(), states: [], blankFrames: 0 });
});
const snapshot = (page) => page.evaluate(() => {
  const R = window.__t21;
  return { frameRepaints: R.frameRepaints, fillViewMounts: R.fillViewMounts, statusRepaints: R.statusRepaints, fillButtonNodes: R.buttons.length,
    buttonMutations: R.buttonMutations, dockMutations: R.dockMutations, panelMutations: R.panelMutations, statusMutations: R.statusMutations, blankFrames: R.blankFrames,
    states: R.states.slice(0, 40) };
});

/** Run a fill (started by `start`), end the wizard's wait with the ×, and return the recorder's counts. */
async function measure(h, start) {
  await reset(h.page);
  const sent = start();
  let answered = null;
  sent.then((v) => { answered = { v }; }, (e) => { answered = { v: { ok: false, message: String(e) } }; });
  await waitUntil(async () => answered || (await h.readBadge().then(b => (b && b.state !== 'progress' ? b : null))), BUSY_MS);
  if (!answered) await h.dismissBadge();
  await waitUntil(() => answered, BUSY_MS);
  await sleep(600);                                  // the last draw lands; the sampler sees it settle
  return { reply: answered?.v || null, counts: await snapshot(h.page) };
}

export default async function run(h, { check, observe, section }) {
  section('1 · setup — the job is on the board, the page read and prepared');
  await h.open(OWNER_STAGE);
  const cap = await h.capture();
  check('captured', cap?.success === true, cap?.message);
  await h.page.evaluate(installRecorder);

  section('2 · the popup\'s Fill (FILL_ACTIVE_TAB) — through the wizard step\'s wait');
  const a = await measure(h, () => h.send({ type: 'FILL_ACTIVE_TAB' }));
  observe('fill reply', { ok: a.reply?.ok, message: a.reply?.message });
  observe('counts', a.counts);
  for (const [k, max] of Object.entries(budget)) check(`popup fill · ${k} ≤ ${max}`, a.counts[k] <= max, String(a.counts[k]));
  check('popup fill · the Fill tab is never blank', a.counts.blankFrames === 0, String(a.counts.blankFrames));

  section('3 · the dock\'s own "Fill this page" — pressed as the person would');
  // The Fill tab's empty state: the panel goes (as when a fill is refused), the dock stays.
  await h.page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(300);
  await h.page.evaluate(installRecorder);
  await h.send({ type: 'DOCK_OPEN', tab: 'fill' }).catch(() => null);
  const opened = await waitUntil(() => h.page.evaluate(() => !!document.getElementById('rm-draft-dock')?.shadowRoot?.querySelector('[data-role="fill"]')), 8000);
  observe('dock open with its Fill button', !!opened);
  if (opened) {
    const b = await measure(h, async () => {
      await h.page.click('#rm-draft-dock >>> [data-role="fill"]');
      // The dock's press answers in the page, not here: the run has ended when its button (in the DOM behind the panel)
      // no longer reads as filling.
      await sleep(200);
      await waitUntil(() => h.page.evaluate(() => {
        const btn = document.getElementById('rm-draft-dock')?.shadowRoot?.querySelector('[data-role="fill"]');
        return !!btn && !/Filling/.test(btn.textContent) && btn.dataset.busy !== 'true';
      }), BUSY_MS);
      return { ok: true };
    });
    observe('counts', b.counts);
    for (const [k, max] of Object.entries(budget)) check(`dock fill · ${k} ≤ ${max}`, b.counts[k] <= max, String(b.counts[k]));
    check('dock fill · the Fill tab is never blank', b.counts.blankFrames === 0, String(b.counts.blankFrames));
  }
}
