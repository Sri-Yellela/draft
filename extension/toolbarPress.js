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
export function relayFor({ identity = null, ctx = null, auto = null, away = null, home = null, card = null } = {}) {
  if (!identity?.authenticated) {
    // ⭐ D191 P4 · signed out, still useful: the posting's employer from draft's PUBLIC data, and the reason to sign up
    const pub = companyLine(card);
    return [{ id: 'draft-relay', kind: 'question', icon: 'info', text: 'Sign in to draft to use it here.',
      actions: [{ id: 'sign-in', label: 'Sign in to draft', word: 'Sign in', primary: true }] },
      ...(pub ? [{ id: 'draft-company', kind: 'toast', icon: 'info', ms: 9000, text: `${pub} — sign up to see your match and apply with one click.`,
        actions: [{ id: 'sign-up', label: 'Sign up for draft — free', word: 'Sign up' }] }] : [])];
  }
  if (!ctx) return Array.isArray(away) ? [...away] : [];   // ⭐⭐ D112 item 7: the portal line needs no page context
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
  // ⭐ D191 (2d) · the employer, from draft's own records — said only when draft knows something about them
  const co = companyLine(ctx.company);
  if (co) out.push({ id: 'draft-company', kind: 'toast', icon: 'info', ms: 8000, text: co,
    actions: ctx.company?.href ? [{ id: 'open-company', label: `Open ${ctx.company.name}'s page on draft`, word: 'Company' }] : [] });
  // automatic reading — offered only where it would work, and only until it is set up (or put off).
  // ⭐ D112: while the ONE global-read ask is due, the press opens its window instead (toolbarPress → deps.ask) — no
  // per-site offer beside it; with global read on there is nothing to set up anywhere.
  if (auto?.globalAsk || auto?.global) { /* the window asks, or nothing is needed */ }
  else if (auto?.here && !auto.here.on && auto.here.host && !auto.frameAsk) {
    out.push({ id: 'draft-auto', kind: 'toast', icon: 'read', ms: 8000, text: `Read ${auto.here.host}'s application pages for you automatically?`,
      actions: [{ id: 'always-here', label: `Set up reading ${auto.here.host} automatically — opens Settings`, word: 'Set up' }] });
  } else if (auto?.frameAsk?.name && auto.here?.host) {
    // a site already chosen whose form turned out to sit in another site's frame (the popup's old "second click")
    out.push({ id: 'draft-auto', kind: 'toast', icon: 'read', ms: 8000, text: `Read ${auto.frameAsk.name}'s form on ${auto.here.host} too?`,
      actions: [{ id: 'always-here', label: `Set up reading ${auto.frameAsk.name}'s form here — opens Settings`, word: 'Set up' }] });
  } else if (auto?.card && auto.cardSite) {
    out.push({ id: 'draft-auto', kind: 'toast', icon: 'read', ms: 8000, text: `draft can read ${auto.cardSite} application pages for you automatically.`,
      actions: [{ id: 'auto-setup', label: 'Set up automatic reading — opens Settings', word: 'Set up' }, { id: 'auto-later', label: 'Not now', word: 'Later' }] });
  }
  // ⭐⭐ D112 item 7: on a connectable portal's page — "Let draft apply here while you're away?" (signed in there, not yet
  // connected) or the connected line with Disconnect. The specs are applyAway.js awayRelay's (deps.away gathers the facts).
  if (Array.isArray(away)) out.push(...away);
  // ⭐ D191 P1 · on a page with nothing else to say: the person's day (draft's home, in one line) — never on top of a question
  // ⭐ A211 (1a) (b): applications waiting to be sent from this browser → the runner is the first thing offered (no timer:
  // said only on a press, as the day line is)
  const waiting = !out.length ? runnerLine(home) : null;
  const day = !out.length ? [homeLine(home), waiting].filter(Boolean).join(' · ') || null : null;
  if (day) out.push({ id: 'draft-home', kind: 'toast', icon: 'info', ms: 7000, text: day,
    // ⭐ D191 (3): Open = the extension's own panel (the day, a search of draft, Tiny); Matches = draft's board
    actions: [...(waiting ? [{ id: 'open-runner', label: 'Open the runner — fill them here, then one press sends them', word: 'Runner', primary: true }] : []),
      { id: 'open-ask', label: "Open draft's panel — your day, search, Tiny", word: 'Open', primary: !waiting }, { id: 'open-draft', label: 'Open your matches in draft', word: 'Matches' }] });
  return out;
}

/** "Kestrel: Filed 412 certified LCAs in FY2025 · 23 open jobs on draft" — or null when draft knows nothing to say. Pure. */
export function companyLine(c) {
  if (!c?.name) return null;
  const facts = [c.sponsorship, Number.isFinite(c.openJobs) && c.openJobs > 0 ? `${c.openJobs} open job${c.openJobs === 1 ? '' : 's'} on draft` : null].filter(Boolean);
  return facts.length ? `${c.name}: ${facts.join(' · ')}` : null;
}
/** "Today: 3 new matches · 1 needs you · 2 drafted" — or null when there is nothing to tell. Pure. */
export function homeLine(h) {
  if (!h) return null;
  const parts = [Number(h.newMatches) > 0 ? `${h.newMatches} new match${h.newMatches === 1 ? '' : 'es'}` : null,
    Number(h.needsYou) > 0 ? `${h.needsYou} need${h.needsYou === 1 ? 's' : ''} you` : null,
    Number(h.drafted) > 0 ? `${h.drafted} drafted` : null, Number(h.sent) > 0 ? `${h.sent} sent` : null].filter(Boolean);
  return parts.length ? `Today: ${parts.join(' · ')}` : null;
}
/** ⭐ A211 (1a) (b) · "3 waiting to send from this browser" — or null when none. Pure. */
export function runnerLine(h) {
  const n = Number(h?.toSend) || 0;
  return n > 0 ? `${n} waiting to send from this browser` : null;
}

/**
 * What a FILL has to say that only a popup can carry — said only when it is so:
 *   a form inside a frame draft may not read yet → "Allow draft on Greenhouse" [Allow] (⭐ D112 b2: the ONE global-read ask's window)
 *   a form draft does not recognise → that sentence [Report] (it replaces the status line's own news of it)
 */
export function fillRelay(result) {
  if (result?.reason === 'frame_needs_permission' && result.site?.name) {
    return [{ id: 'draft-relay', kind: 'question', icon: 'need', tone: 'need', text: result.message || `Allow draft on ${result.site.name} to fill this form.`,
      actions: [{ id: 'allow-site', label: `Allow draft on ${result.site.name} — a small window asks`, word: 'Allow', primary: true }] }];
  }
  // D36·6: a fill that worked but whose review panel did not open — the one place the person learns the answers were not
  // laid out for checking (the retired popup stayed open for it); said on the page, and it stays until it is read
  if (result?.ok && result.overlay && result.overlay.rendered === false) {
    return [{ id: 'draft-relay', kind: 'question', icon: 'need', tone: 'need', text: result.message || 'Filled — but the review panel could not open. Check every answer on the page yourself.',
      actions: [] }];
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
  const auto = identity?.authenticated && deps.auto ? await deps.auto(tab).catch(() => null) : null;
  const away = identity?.authenticated && deps.away ? await deps.away(tab).catch(() => null) : null;
  // ⭐ D191: signed in — the day (home line); signed out — the posting's employer from draft's public data
  const home = identity?.authenticated && deps.home ? await deps.home(tab).catch(() => null) : null;
  const card = !identity?.authenticated && deps.publicCard ? await deps.publicCard(tab).catch(() => null) : null;
  const specs = relayFor({ identity, ctx, auto, away, home, card });
  if (specs.length) await deps.relay(tab, specs).catch(() => null);
  // ⭐ D112 b2: the ONE ask — a small window over this posting, opened by this press while it is due (never answered)
  const asked = auto?.globalAsk && deps.ask ? await deps.ask(tab).catch(() => null) : null;
  return { ok: true, did: 'opened', said: specs.length, ...(asked?.opened ? { asked: true } : {}) };
}

/** ⭐ D191 (46o) · whether the notice page opens for this install / update (background.js onInstalled). Pure. */
export function noticeDue(details) {
  if (details?.reason === 'install') return true;
  if (details?.reason !== 'update') return false;
  const [a = 0, b = 0] = String(details.previousVersion || '').split('.').map(Number);
  return a < 1 || (a === 1 && b < 7);
}
