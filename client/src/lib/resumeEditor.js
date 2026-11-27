// lib/resumeEditor.js — ⭐ D157 (option A) + D171 FIX 4 · open the résumé in draft's embedded editor, from anywhere.
//
// The editor is resume-master's tool (the tools service's /editor/), embedded by components/ResumeEditorHost.jsx, which
// is mounted once in the app shell. A screen asks for it with `openResumeEditor(request)`; the host opens a focused
// full-screen view and Back / Esc returns to exactly where the person was (the page under it never unmounts).
//
// request: {
//   html, jobId, company, title,          the document and what it was tailored for
//   tool, version,                         which stored version an edit saves to (POST /api/resumes/:jobId/html)
//   readOnly, readOnlyNote,                a résumé that was already sent: read, highlight, download — never change
//   changes,                               lines tailoring rewrote, for "Review changes" (else read from the job)
//   onSave(html), onExport(html),          the opener's own save / PDF export (the posting's); defaults below
//   downloadPdfUrl,                        a ready PDF for this document (an attempt's), used by Download PDF
//   fallback(),                            the opener's own preview, when the editor can't load
// }
// e2e step 3 (moved from panels/SandboxPanel.jsx, deleted 47m): page frames made <body> editable (contenteditable /
// spellcheck) — editing state, not résumé content. Saved html, the HTML download and the printed PDF take the document
// without them.
export function cleanDocHtml(html) {
  return String(html || "").replace(/<body\b[^>]*>/i, (tag) => tag
    .replace(/\s+contenteditable="[^"]*"/gi, "")
    .replace(/\s+spellcheck="[^"]*"/gi, ""));
}

// e2e step 3 (moved from panels/SandboxPanel.jsx, deleted 47m): page frames made <body> editable (contenteditable /
// spellcheck) — editing state, not résumé content. Saved html, the HTML download and the printed PDF take the document
// without them.
export function cleanDocHtml(html) {
  return String(html || "").replace(/<body\b[^>]*>/i, (tag) => tag
    .replace(/\s+contenteditable="[^"]*"/gi, "")
    .replace(/\s+spellcheck="[^"]*"/gi, ""));
}

export const RESUME_EDITOR_EVENT = "draft:resume-editor";
// ⭐ D157 (i) (45n) · the editor's OWN ADDRESS — /draft/resume/<job>. Opening a job's résumé shows it in the address bar;
// a reload (or a shared link to yourself) lands on the jobs page with that résumé open again (REOPEN_KEY → the host).
export const editorPath = (jobId) => `/draft/resume/${encodeURIComponent(jobId)}`;
export const REOPEN_KEY = "draft:reopen-editor";

export function openResumeEditor(request) {
  if (!request || typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent(RESUME_EDITOR_EVENT, { detail: request }));
  return true;
}

/** The lines tailoring wrote, from GET /api/jobs/:id/resume-changes (services/resumeChanges.js) — every `after` text
 *  whose status says it was added or rewritten. */
export function changedLines(report) {
  const out = [];
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if ((v.status === "added" || v.status === "rewritten" || v.status === "changed") && typeof v.after === "string") out.push(v.after);
    for (const k of Object.keys(v)) if (k !== "before" && typeof v[k] === "object") walk(v[k]);
  };
  walk(report);
  return [...new Set(out.map(s => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim()).filter(s => s.length >= 8))];
}

/** draft's live theme, as rm-editor/1's tokens — read from the --color-* bridge (styles/theme.jsx), so whatever theme
 *  is on (Dusk, Dusk Light, Studio, …) the editor's chrome follows it, the accent included. */
export function themeTokens(doc = document) {
  const cs = getComputedStyle(doc.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  // The page's own colour is the canvas (--c-canvas, themes/index.js); --color-bg is a translucent card that only reads
  // right over the canvas, so it is the fallback. The card is the solid one, so the editor's menu is a card on the page.
  return {
    bg: v("--c-canvas") || v("--color-bg"), card: v("--c-surface-solid") || v("--color-surface"),
    raise: v("--color-surface-offset"), raise2: v("--color-surface-offset"),
    line: v("--color-border"), ink: v("--color-text"), body: v("--color-text-muted"), muted: v("--color-text-faint"),
    accent: v("--color-primary"), accent2: v("--color-primary-hover"), onAccent: v("--color-on-primary"),
    // 46y (D157 walk vs resume-master 2f890f7): the theme's interface face (--shape-font-ui, Inter Tight in Dusk / Plain), not
    // the body's — the shell sets an inline DM Sans on <body> that every themed screen overrides, so the editor drew DM Sans.
    font: v("--shape-font-ui") || getComputedStyle(doc.body).fontFamily,
  };
}
