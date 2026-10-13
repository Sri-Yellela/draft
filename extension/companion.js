// ── D13: THE COMPANION — which action this page calls for ───────────────────────────────────────
//
// The extension does the same four things it always did — capture a posting, fill an application,
// score a posting, open draft. The companion's only change is that the popup PICKS the one this page
// calls for and says why:
//
//   an application form you drafted  -> Fill it   "You drafted this 2 days ago · résumé ready · 14 fields prepared"
//   a job posting                    -> Capture it + Score it, and whether it is on your board yet
//   neither                          -> your recent captures
//
// ⚠ Context detection can be wrong, and a wrong primary action is worse than a menu — so popup.html
// keeps all four actions visible underneath, whatever this decides.
//
// Pure functions, no chrome.* and no DOM, loaded as a classic script before popup.js (and run in a
// plain VM by test/d13Companion.test.js). Nothing here stores anything.

/* exported companionMode, draftedLine, postingLine, questionsLine, ageWords, prepareLine, ringState,
            jobCard, factMarks, packetRows, firstPartyLogo, shortAge, boundLine, capturedTodayLine */

function ageWords(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * @param {{ preview?: object|null, context?: object|null }} input
 *   preview — PREVIEW_ACTIVE_TAB's answer (the extractor, run locally)
 *   context — POPUP_CONTEXT's answer (the server's view of this page), or null if it failed
 */
function companionMode({ preview, context } = {}) {
  // A form you drafted wins: a prepared packet for THIS origin is the strongest signal there is —
  // the server put it there because you queued this application. Newest first, stale ones ignored
  // (the server refuses to release a stale packet, so offering it would fail).
  const fresh = (context?.packets || []).filter(p => !p.stale)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const notice = context?.notice || null;
  if (fresh.length) return { mode: 'form', primary: ['fill'], packet: fresh[0], others: fresh.length - 1, notice };

  // ⛔ D56: no packet fills this page — and the server says which of the three truthful cases it is.
  //   a job of yours with nothing prepared (or an expired packet) -> Prepare this application
  //   a job of yours whose packet lives on another address        -> say so, and where it fills
  // (draft not knowing the job falls through to the posting / recent views, which offer Capture.)
  const h = context?.handoff || null;
  if (h?.canPrepare) return { mode: 'prepare', primary: ['prepare'], handoff: h, notice };
  if (h?.state === 'not_this_address') return { mode: 'elsewhere', primary: [], handoff: h, notice };

  if (preview?.capturable && preview.ok) {
    return { mode: 'posting', primary: ['capture', 'score'], posting: context?.posting || null, ats: context?.ats || null };
  }
  return { mode: 'neither', primary: [], recent: (context?.recent || []).slice(0, 5) };
}

function draftedLine(packet, now = Date.now()) {
  if (!packet) return '';
  // D56: a packet the manual route prepared was never drafted — say what actually happened.
  const verb = packet.gateReason === 'prepared' ? 'You prepared this' : 'You drafted this';
  const parts = [`${verb} ${ageWords(now - (packet.createdAt || now))}`];
  parts.push(packet.resumeAvailable ? 'résumé ready' : 'no résumé attached');
  const n = packet.answerCount || 0;
  parts.push(`${n} ${n === 1 ? 'field' : 'fields'} prepared`);
  return parts.join(' · ');
}

// D56: the line above "Prepare this application" — what one click will and will not do.
function prepareLine(h) {
  if (!h) return '';
  const what = h.job ? [h.job.title, h.job.company].filter(Boolean).join(' at ') : 'this job';
  const lead = h.state === 'stale' ? `The answers prepared for ${what} have expired.` : `Nothing is prepared for ${what} yet.`;
  if (h.resume === 'ready') return `${lead} Your résumé for it is ready — one click prepares your answers and fills them.`;
  if (h.resume === 'out_of_date') return `${lead} Your résumé for it is out of date, so Prepare fills your answers only — regenerate the résumé on draft.`;
  return `${lead} No résumé for it yet — Prepare fills your answers; attach a résumé yourself.`;
}

/**
 * ⭐ §8 row 15, decision D — THE TODAY RING: what the last 24 hours used of YOUR CAP (the day's Draft
 * slots: a Draft or a new résumé uses one). ⛔ Never a goal and never a nudge: it reads as a quota, and
 * a full ring says the cap is reached, not "well done".
 */
function ringState(slots) {
  if (!slots || !Number.isFinite(slots.limit) || slots.limit <= 0) return null;
  const used = Math.max(0, Math.min(slots.limit, Number(slots.used) || 0));
  return {
    used, limit: slots.limit, percent: Math.round((used / slots.limit) * 100), full: used >= slots.limit,
    short: `${used}/${slots.limit}`,
    // ⭐ D63 (decision D): the ring SAYS what it counts — your cap, never a goal.
    capText: `${used} of ${slots.limit} · your cap`,
    label: `${used} of your ${slots.limit} drafts used in the last 24 hours — a Draft or a new résumé uses one.`,
  };
}

function postingLine(posting) {
  if (!posting) return '';                          // the board check failed: say nothing rather than guess
  if (posting.captured) return 'Captured ✓';
  if (posting.saved) return 'Saved on your board';
  if (posting.known) return 'On draft, not saved by you yet';
  return 'Not on your board yet';
}

// The unanswered questions, at the moment they matter: on the form, before you fill it. An answer
// given once is kept against the question's exact wording and offered again next time
// (custom_answers), so the line says so.
function questionsLine(packet) {
  const n = packet?.unresolvedCount || 0;
  if (!n) return '';
  return `${n} ${n === 1 ? 'question needs' : 'questions need'} your answer — answer once and draft reuses it.`;
}

/**
 * ⭐ THE TAB BINDING, said in one line (owner 10-12): on a bound or known job the popup says "Captured ✓ —
 * <title> at <company>", never "Capture it" — on the posting and on every later stage of its application.
 */
function boundLine(context) {
  const b = context?.binding || null;
  const p = context?.posting || null;
  const job = b || (p?.captured ? p : null);
  if (!job) return '';
  const what = [job.title, job.company].filter(Boolean).join(' at ') || 'this job';
  return (b?.via === 'recognised' && !p?.captured) ? `On draft — ${what}` : `Captured ✓ — ${what}`;
}

/** "Captured: 2 today · 1 already on your board" — distinct jobs captured in the last 24 hours, by any route. */
function capturedTodayLine(t) {
  if (!t || !Number.isFinite(t.today)) return '';
  const n = t.today, m = t.alreadyOnBoard || 0;
  return `Captured: ${n} today · ${m} already on your board`;
}

// ── ⭐ D63 · THE POPUP LEADS WITH THE JOB CARD (extension-latest.html, "Suggested") ────────────────

/** "2d ago" / "3h ago" / "just now" — the short age a mark carries. */
function shortAge(ms) {
  const h = Math.floor(Math.max(0, ms) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * ⛔ A logo is drawn ONLY when draft itself serves it (/api/company-logo/…). Any other address — the
 * logo host the web board uses, an employer's favicon — would be a request from the extension to a
 * third party that no disclosure names; the letter tile is drawn instead.
 */
function firstPartyLogo(logo, base) {
  if (typeof logo !== 'string' || !logo) return null;
  if (logo.startsWith('/api/company-logo/')) return `${base}${logo}`;
  if (base && logo.startsWith(`${base}/api/company-logo/`)) return logo;
  return null;
}

/** The posting in the job card's own language: company, title, logo, and the D50 number. */
function jobCard(c, preview) {
  const fromScores = (s) => ({ score: Number.isFinite(s?.shown) ? s.shown : null, tailored: !!s?.tailoredShown });
  if (c?.mode === 'form' && c.packet) {
    return { company: c.packet.company || '', title: c.packet.title || '', logo: c.packet.logo || null, ...fromScores(c.packet.scores) };
  }
  if ((c?.mode === 'prepare' || c?.mode === 'elsewhere') && c.handoff?.job) {
    const j = c.handoff.job;
    return { company: j.company || '', title: j.title || '', logo: j.logo || null, ...fromScores(j.scores) };
  }
  if (c?.mode === 'posting' && preview?.ok) {
    return { company: preview.company || c.posting?.company || '', title: [preview.title, preview.location].filter(Boolean).join(' · '),
             logo: c.posting?.logo || null, ...fromScores(c.posting?.scores) };
  }
  return null;
}

/** ⛔ D60: status as MARKS — a tone, the words and, where the sketch has one, an icon. Never a capsule. */
function factMarks(c, now = Date.now()) {
  const out = [];
  if (c?.mode === 'form' && c.packet) {
    out.push(c.packet.resumeAvailable ? { tone: 'ok', icon: 'doc', text: 'Résumé ready' } : { tone: 'warn', text: 'No résumé attached' });
    const verb = c.packet.gateReason === 'prepared' ? 'Prepared' : 'Drafted';
    out.push({ tone: 'dim', text: `${verb} ${shortAge(now - (c.packet.createdAt || now))}` });
  } else if (c?.mode === 'prepare') {
    const r = c.handoff?.resume;
    out.push(r === 'ready' ? { tone: 'ok', icon: 'doc', text: 'Résumé ready' }
      : r === 'out_of_date' ? { tone: 'warn', text: 'Résumé out of date' } : { tone: 'dim', text: 'No résumé yet' });
    out.push({ tone: 'warn', text: c.handoff?.state === 'stale' ? 'Answers expired' : 'Not drafted' });
  } else if (c?.mode === 'posting' && c.posting) {
    out.push({ tone: c.posting.saved ? 'ok' : 'info', text: postingLine(c.posting) });
    if (c.posting.resumeReady) out.push({ tone: 'ok', icon: 'doc', text: 'Résumé ready' });
  }
  return out;
}

/** ⭐ D63 · "show the packet before you fill" — Résumé tailored · 62 → 81 · Fields prepared · Will stop and ask. */
function packetRows(packet) {
  if (!packet) return [];
  const s = packet.scores || null;
  const resume = s?.base != null && s?.tailored != null ? `tailored · ${s.base} → ${s.tailored}`
    : s?.tailored != null ? `tailored · ${s.tailored}`
    : packet.resumeAvailable ? 'ready' : 'none attached';
  return [
    { label: 'Résumé', value: resume, lower: !!s?.lower },
    { label: 'Fields prepared', value: String(packet.answerCount || 0) },
    { label: 'Will stop and ask', value: String(packet.unresolvedCount || 0), ask: (packet.unresolvedCount || 0) > 0 },
  ];
}
