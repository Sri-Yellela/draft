// ── Shared-element transitions (queue 29) ────────────────────────────────────────────────────
//
// docs/BRAND_OUTLAY_AND_MOTION.md §Navigation: every transition answers "where did that go?". A
// job's title on the deck card BECOMES the heading on the board's detail, BECOMES the line in the
// review queue — the browser's View Transitions API morphs one into the other because they carry
// the same `view-transition-name`. No cross-fade between two unrelated elements.
//
// WHY A HELPER AND NOT React Router's `viewTransition` prop: that prop only works under a DATA
// router, and App.jsx mounts a declarative <BrowserRouter>. There it is silently ignored — a
// transition that looks wired and never runs.
//
// ⛔ AND WHY NOT flushSync, which was the first version of this file and was measured to do nothing:
// BrowserRouter commits every history update inside React.startTransition (react-router 7,
// `unstable_useTransitions` unset), and flushSync cannot force a transition-lane update. The update
// callback returned with the OLD page still in the DOM, so the browser snapshotted the deck twice and
// morphed it into itself — found by a browser probe, after the source-level tests had passed. So the
// callback now WAITS for the route's commit: <RouteCommitSignal/> (App.jsx) calls routeCommitted()
// from a layout effect inside the router, after React has written the new route to the DOM.
//
// ⛔ Never gates input: the transition overlay takes no pointer events (index.css), so a click
// during the 180 ms lands on the live page underneath.
// ⛔ prefers-reduced-motion: no transition is started at all, and index.css also drops the
// animation, so a browser that starts one anyway shows the new page at once.
// ⛔ A name must be UNIQUE on the page at snapshot time, or the browser abandons the whole
// transition — and the review queue can show one job in more than one section. So components never
// set the name themselves: they mark a title with data-vt-title={jobId}, and nameSharedTitles()
// names the FIRST visible one per job, on both sides of the navigation, at the moment of the snapshot.
export const TITLE_ATTR = "data-vt-title";
// ⛔ The update callback freezes rendering; it may never cost more than this. A destination slower
// than that (a detail still fetching its job) simply cross-fades instead of morphing.
export const COMMIT_WAIT_MS = 200;

let onCommit = null;
/** Called by App.jsx's <RouteCommitSignal/> once a navigation has been committed to the DOM. */
export function routeCommitted() { const f = onCommit; onCommit = null; f?.(); }

/** The shared name for a job's title, valid as a CSS <custom-ident> whatever the id looks like. */
export const jobTitleTransitionName = (id) => `job-title-${String(id).replace(/[^A-Za-z0-9_-]/g, "_")}`;

export function prefersReducedMotion(win = typeof window !== "undefined" ? window : null) {
  try { return !!win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches; } catch { return false; }
}

export function canViewTransition(doc = typeof document !== "undefined" ? document : null) {
  return typeof doc?.startViewTransition === "function" && !prefersReducedMotion();
}

/** Name the first visible title per job; clear every other. Returns the names given (for tests). */
export function nameSharedTitles(root = typeof document !== "undefined" ? document : null) {
  const given = [];
  if (!root?.querySelectorAll) return given;
  const seen = new Set();
  for (const el of root.querySelectorAll(`[${TITLE_ATTR}]`)) {
    const id = el.getAttribute(TITLE_ATTR);
    const visible = typeof el.getClientRects !== "function" || el.getClientRects().length > 0;
    if (!id || seen.has(id) || !visible) { el.style.viewTransitionName = ""; continue; }
    seen.add(id);
    el.style.viewTransitionName = jobTitleTransitionName(id);
    given.push(el.style.viewTransitionName);
  }
  return given;
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolves once the route has committed — or at the cap, whichever is first. */
function committed(cap) {
  return Promise.race([new Promise((r) => { onCommit = r; }), settle(cap)]);
}

/** Polls (until the deadline) for the destination's copy of a title that is leaving. */
async function titleArrives(id, deadline, doc = document) {
  while (Date.now() < deadline) {
    if (doc.querySelector?.(`[${TITLE_ATTR}="${CSS.escape(String(id))}"]`)) return true;
    await settle(16);
  }
  return false;
}

/**
 * navigate(to), as a view transition where the browser can and the user has not asked for less
 * motion. `awaitTitle`: a job id whose title should land on the destination — wait for it, within
 * the same 200 ms cap, so a destination that renders it a beat after the route commits still morphs.
 */
export function transitionTo(navigate, to, options, { awaitTitle } = {}) {
  if (!canViewTransition()) { navigate(to, options); return; }
  nameSharedTitles();                       // the page being left
  const deadline = Date.now() + COMMIT_WAIT_MS;
  document.startViewTransition(async () => {
    const done = committed(COMMIT_WAIT_MS);
    navigate(to, options);
    await done;
    if (awaitTitle != null) await titleArrives(awaitTitle, deadline);
    nameSharedTitles();                     // the page arrived at
  });
}

/** A plain-click handler for an <a>/<Link>: modified clicks (new tab, new window) stay the browser's. */
export function transitionClick(navigate, to, opts) {
  return (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    transitionTo(navigate, to, undefined, opts);
  };
}
