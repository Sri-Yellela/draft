// ── ⭐ T31 (owner, 10-25) · THE TOOLBAR ICON IS THE DOCK'S TOGGLE, AND A PAGE IS TOLD ONLY WHAT IT NEEDS ────────────────
//
// The owner: "I want as much info moved away from the current panels as possible; info should be relayed when it is
// needed, relevant and makes sense to see; everything else moved away, or into the background, as needed."
//
// So there is no toolbar popup any more. The icon (or its shortcut, _execute_action) is ONE press:
//   · on a page draft cannot run on (chrome://, the Web Store, a PDF) it opens your board in draft
//   · the dock open on this tab → it closes to the launcher; closed or collapsed → it opens
//   · opening it, the press READS the page — the press is the person's own trigger (D23: every read begins with a click
//     or a keystroke) — and says, as the dock's popups, only what this page calls for:
//       signed out ............ "Sign in to draft to use it here"  [Sign in]
//       a posting draft does not hold ... "Add this job to draft?"  [Capture] [Draft]
//       answers this press prepared ..... "Answers prepared — fill when you are ready"  [Fill]
//     (a job already yours is the intent line's to say — "Viewing this posting — Draft it…", "Filling by hand…" — with
//     its own switch: intent.js; it is never said twice)
//       prepared, but for another address of the application ... the server's sentence (a toast)
//       the company notice (§8 row 10: "You applied here 28 Sep · …") ... a toast
//     and nothing at all otherwise. The job card, the score, the today ring, the recent captures and the packet
//     summary the popup used to lay out are the dock's tabs' or draft's own — or nowhere, until they matter.
//   · a popup's buttons answer through DOCK_ACT (background.js) — the person's own click, in the page's top frame.
//
// relayFor is PURE (the tests read it); renderRelay is INJECTED (it closes over nothing); toolbarPress is the press, its
// browser work handed in as `deps` so it is tested without a browser.

/** What the press says about this page — the popups, in order (one is shown at a time). */
export function relayFor({ identity = null, ctx = null } = {}) {
  if (!identity?.authenticated) {
    return [{ id: 'draft-relay', kind: 'question', icon: 'info', text: 'Sign in to draft to use it here.',
      actions: [{ id: 'sign-in', label: 'Sign in to draft', word: 'Sign in', primary: true }] }];
  }
  if (!ctx) return [];
  const out = [];
  const id = ctx.identity || null;
  const job = (p) => [p?.title, p?.company].filter(Boolean).join(' at ');
  if (id?.action === 'sign_in') {
    out.push({ id: 'draft-relay', kind: 'question', icon: 'info', text: id.message || 'Sign in to draft to use it here.',
      actions: [{ id: 'sign-in', label: 'Sign in to draft', word: 'Sign in', primary: true }] });
  } else if (id && !id.bind && !ctx.binding && id.action === 'capture') {
    // a posting draft does not hold — the two things a person does with one
    out.push({ id: 'draft-relay', kind: 'question', icon: 'info', text: 'Add this job to draft?',
      actions: [{ id: 'capture', label: 'Capture it — add it to your board', word: 'Capture', primary: true },
        { id: 'draft', label: 'Draft it — add it and queue its résumé', word: 'Draft' }] });
  } else if (ctx.handoff?.state === 'elsewhere' && ctx.handoff.message) {
    out.push({ id: 'draft-relay', kind: 'toast', icon: 'info', text: ctx.handoff.message, ms: 6000 });
  } else if (ctx.prepared) {
    out.push({ id: 'draft-relay', kind: 'toast', icon: 'check', tone: 'ok', ms: 6000,
      text: ctx.binding ? `Answers prepared for ${job(ctx.binding)} — fill when you are ready.` : 'Answers prepared — fill when you are ready.',
      actions: [{ id: 'fill', label: 'Fill this page', icon: 'fill', primary: true }] });
  }
  if (ctx.notice) out.push({ id: 'draft-notice', kind: 'toast', icon: 'info', text: String(ctx.notice), ms: 6000 });
  return out;
}

/**
 * What a FILL has to say that only a popup can carry — said only when it is so:
 *   a form inside a frame draft may not read yet → "Allow draft on Greenhouse" [Allow] (owner 10-23: the settings page)
 *   a form draft does not recognise → that sentence [Report] (it replaces the status line's own news of it)
 */
export function fillRelay(result) {
  if (result?.reason === 'frame_needs_permission' && result.site?.name) {
    return [{ id: 'draft-relay', kind: 'question', icon: 'need', tone: 'need', text: result.message || `Allow draft on ${result.site.name} to fill this form.`,
      actions: [{ id: 'allow-site', label: `Allow draft on ${result.site.name} — opens Settings`, word: 'Allow', primary: true }] }];
  }
  if (result?.reason === 'form_not_recognised') {
    return [{ id: 'rm-draft-status-toast', kind: 'toast', icon: 'need', tone: 'need', ms: 8000,
      text: result.message || "This form isn't recognised — nothing was filled.",
      actions: [{ id: 'report', label: 'Report this form to draft', word: 'Report' }] }];
  }
  return [];
}

/**
 * Injected, TOP frame, after dock.js and popup-layer.js: show the press's popups. A button answers with the person's own
 * click only — DOCK_ACT, and what the worker says back (a sentence, or the next question) is shown in turn.
 * Closes over nothing: the popups, the palettes and the dock's meta come as arguments.
 */
export function renderRelay(specs, theme) {
  const pop = globalThis.__draftPopups;
  if (!pop?.show || !Array.isArray(specs)) return { shown: 0 };
  const show = (s) => {
    void pop.show({ ...s, theme, actions: (s.actions || []).map(a => ({ ...a })),
      onAction: (answer) => {
        if (!answer.trusted) return 'ignore';                         // ⛔ a page script's click asks for nothing
        chrome.runtime.sendMessage({ type: 'DOCK_ACT', act: answer.action, trigger: 'click' }, (r) => {
          void chrome.runtime.lastError;
          if (r?.next) show(r.next);
          else if (r?.say) show({ id: 'draft-relay-said', kind: 'toast', icon: r.ok ? 'check' : 'need', tone: r.ok ? 'ok' : 'need', text: r.say, ms: 6000 });
        });
        return undefined;                                             // the answer is on its way: this popup closes
      } });
  };
  for (const s of specs) show(s);
  return { shown: specs.length };
}

/** Injected, TOP frame: is draft's dock on this page, and is it open? (A page without dock.js has none.) */
export function dockStateInPage() {
  const d = globalThis.__draftDock?.current?.();
  return d ? { exists: true, collapsed: !!d.collapsed() } : { exists: false, collapsed: false };
}
/** Injected, TOP frame: close the open dock to its launcher. */
export function collapseDockInPage() {
  const d = globalThis.__draftDock?.current?.();
  if (d) d.collapse();
  return { ok: !!d };
}

const isWebPage = (tab) => { try { return /^https?:$/.test(new URL(tab?.url || '').protocol); } catch { return false; } };

/**
 * The toolbar press, on `tab`. deps: { state(tab), collapse(tab), openDock(tab), identity(), context(tab), relay(tab, specs),
 * openBoard() }. → { ok, did: 'board' | 'closed' | 'opened', said: n }
 */
export async function toolbarPress(tab, deps) {
  if (!tab?.id || !isWebPage(tab)) { await deps.openBoard(); return { ok: true, did: 'board', said: 0 }; }
  let st;
  try { st = await deps.state(tab); } catch { await deps.openBoard(); return { ok: true, did: 'board', said: 0 }; }   // a page Chrome keeps from extensions
  if (st?.exists && !st.collapsed) { await deps.collapse(tab); return { ok: true, did: 'closed', said: 0 }; }
  const opened = await deps.openDock(tab).catch(() => null);
  if (!opened?.ok) { await deps.openBoard(); return { ok: true, did: 'board', said: 0 }; }
  const identity = await deps.identity().catch(() => ({ authenticated: false }));
  const ctx = identity?.authenticated ? await deps.context(tab).catch(() => null) : null;
  const specs = relayFor({ identity, ctx });
  if (specs.length) await deps.relay(tab, specs).catch(() => null);
  return { ok: true, did: 'opened', said: specs.length };
}
