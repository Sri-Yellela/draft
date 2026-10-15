// ── D99 J11 · OPEN A POSTING — the ONE way the web app opens a job's posting ─────────────────────────────────────
//
// Owner, 10-13: "a job from the board is on the board." When the draft extension is installed, its one content
// script (extension/boardBridge.js, on this origin only) marks <html data-draft-extension="<nonce>">. Then a posting
// is not opened by the page: the page hands the JOB ID to the extension, which asks draft's server whether the job is
// on this user's board, opens the address the SERVER gives, and binds that tab to the job — so the extension knows it
// at once ("From your board"), with no capture and no "Read this page".
//
// Without the extension — or when it says no (signed out, not on the board, no address, rate-limited) — the page
// opens its own link, exactly as before. ⛔ The page never tells the extension an address; only a job id.
//
//   openPosting(job)                    — for a button or a card click: hands over, or window.open's the link
//   openPosting(job, { intent: "apply" }) ⭐ T24 — the board's INTENT rides along: "apply" (Draft House's "Apply yourself",
//                                         the board's Draft / Apply) or "view" (Open posting — the default, sent as nothing),
//                                         so the extension knows which path the user is on in the tab it opens
//   postingClick(job, event)            — an <a href>'s onClick: a plain left click hands over (preventDefault);
//                                         a modified click (new tab, new window) is left to the browser

const HANDOFF_TIMEOUT_MS = 2500;   // under Chrome's ~5 s user-activation window, so the fallback open is not blocked

export const postingUrlOf = (job) => job?.applyUrl || job?.url || null;
const jobIdOf = (job) => {
  const id = job?.jobId ?? job?.id ?? null;
  return id == null ? null : String(id);
};

/** The nonce the extension's content script put on this page, or null when the extension is not here. */
export function extensionNonce(doc = typeof document === "undefined" ? null : document) {
  const n = doc?.documentElement?.dataset?.draftExtension;
  return typeof n === "string" && n ? n : null;
}

/** T24: the two intents the board may name. Anything else is sent as nothing — the extension reads that as "view". */
export const POSTING_INTENTS = Object.freeze(["apply", "view"]);

/** Ask the extension to open this job. → { ok: true } or { ok: false, error }. Never throws. */
export function handOffToExtension(jobId, { win = typeof window === "undefined" ? null : window, nonce = extensionNonce(), timeoutMs = HANDOFF_TIMEOUT_MS, intent = null } = {}) {
  if (!win || !nonce || !jobId) return Promise.resolve({ ok: false, error: "no_extension" });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (done) return; done = true; win.removeEventListener("message", onMessage); clearTimeout(timer); resolve(r); };
    const onMessage = (event) => {
      if (event.source !== win || event.origin !== win.location.origin) return;
      const d = event.data;
      if (!d || d.source !== "draft-extension" || d.type !== "OPEN_JOB_RESULT" || d.nonce !== nonce) return;
      finish(d.ok ? { ok: true } : { ok: false, error: typeof d.error === "string" ? d.error : "unavailable" });
    };
    const timer = setTimeout(() => finish({ ok: false, error: "timeout" }), timeoutMs);
    win.addEventListener("message", onMessage);
    // ⭐ T24: "apply" only — "view" is the default and is sent as nothing, so an Open posting carries exactly what it did
    const named = intent === "apply" ? { intent } : {};
    win.postMessage({ source: "draft-board", type: "OPEN_JOB", jobId, nonce, ...named }, win.location.origin);
  });
}

function openLink(url, win) {
  if (url && win) win.open(url, "_blank", "noopener,noreferrer");
}

/** Open a job's posting: through the extension when it is here and agrees, else the page's own link. */
export async function openPosting(job, { url = postingUrlOf(job), win = typeof window === "undefined" ? null : window, intent = null } = {}) {
  const jobId = jobIdOf(job);
  if (!url && !jobId) return { via: "none" };
  if (jobId && extensionNonce(win?.document)) {
    const r = await handOffToExtension(jobId, { win, nonce: extensionNonce(win?.document), intent });
    if (r.ok) return { via: "extension" };
  }
  openLink(url, win);
  return { via: url ? "link" : "none" };
}

/** An <a href={posting}>'s onClick. Returns true when the click was handed to the extension. */
export function postingClick(job, event, opts = {}) {
  const win = opts.win || (typeof window === "undefined" ? null : window);
  if (!event || event.defaultPrevented) return false;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (!jobIdOf(job) || !extensionNonce(win?.document)) return false;   // the browser follows the link, as before
  event.preventDefault();
  void openPosting(job, { url: opts.url ?? event.currentTarget?.href ?? postingUrlOf(job), win, intent: opts.intent ?? null });
  return true;
}
