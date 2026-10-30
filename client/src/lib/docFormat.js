// ── A106 · THE SANDBOX'S EDITING COMMANDS — Word-like tools on the résumé's own HTML ─────────────────────────
//
// Every command acts on a Document the sandbox renders (one iframe per A4 page; SandboxPanel keeps their bodies in
// sync). Two kinds:
//   · SELECTION commands act on the focused page's selection, through the browser's editing engine. ⚠
//     document.execCommand is deprecated but is still the only engine that edits a contentEditable selection with
//     undo history in every browser; it is used HERE ONLY, behind these names, so it can be replaced in one place.
//   · DOCUMENT commands (font, margins, fit to one page) change the template's own CSS variables
//     (services/resumeFormatter.js RESUME_STYLE_BLOCK: --fs-body, --lh-body, --margin-x, --gap-section …) on
//     <html style>, so the saved HTML and the exported PDF carry them. They are applied to EVERY page's document.
// Keyboard: Ctrl / ⌘ + B I U Z Y are the browser's own in a contentEditable page — nothing here re-binds them.
// After a command the caller fires the document's `input` event — the sandbox's one path to dirty / save / sync.

/** Résumé-safe fonts: no web-font fetch; each stack ends in a generic family so the PDF never falls back blindly. */
export const FONTS = Object.freeze([
  { label: "Garamond (default)", value: "'Garamond','EB Garamond',Georgia,serif" },
  { label: "Georgia", value: "Georgia,'Times New Roman',serif" },
  { label: "Times New Roman", value: "'Times New Roman',Times,serif" },
  { label: "Cambria", value: "Cambria,Georgia,serif" },
  { label: "Arial", value: "Arial,Helvetica,sans-serif" },
  { label: "Calibri", value: "Calibri,Carlito,Arial,sans-serif" },
  { label: "Helvetica", value: "Helvetica,Arial,sans-serif" },
]);
export const SIZES_PT = Object.freeze([7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12, 14, 16]);
export const LINE_SPACING = Object.freeze([1, 1.15, 1.3, 1.42, 1.5, 2]);
export const MARGINS = Object.freeze([
  { label: "Narrow", x: "0.4in", y: "0.35in" },
  { label: "Normal", x: "0.55in", y: "0.45in" },
  { label: "Wide", x: "0.8in", y: "0.6in" },
]);
// The template's defaults — "Fit to one page" steps down from here, and "Reset" returns to it.
const BASE = { fsBody: 8.5, lh: 1.42, gap: 9 };

const exec = (doc, cmd, value = null) => {
  try { doc.execCommand("styleWithCSS", false, true); } catch { /* older engines: inline tags instead */ }
  return doc.execCommand(cmd, false, value);
};
const hasSelection = (doc) => { const s = doc.getSelection(); return !!s && s.rangeCount > 0 && !s.isCollapsed; };

// ── selection commands ────────────────────────────────────────────────────────────────────────────────
export const SELECTION = Object.freeze({
  bold: (doc) => exec(doc, "bold"),
  italic: (doc) => exec(doc, "italic"),
  underline: (doc) => exec(doc, "underline"),
  bullets: (doc) => exec(doc, "insertUnorderedList"),
  numbers: (doc) => exec(doc, "insertOrderedList"),
  indent: (doc) => exec(doc, "indent"),
  outdent: (doc) => exec(doc, "outdent"),
  left: (doc) => exec(doc, "justifyLeft"),
  center: (doc) => exec(doc, "justifyCenter"),
  right: (doc) => exec(doc, "justifyRight"),
  justify: (doc) => exec(doc, "justifyFull"),
  clear: (doc) => exec(doc, "removeFormat"),
  undo: (doc) => exec(doc, "undo"),
  redo: (doc) => exec(doc, "redo"),
  color: (doc, value) => exec(doc, "foreColor", value),
  font: (doc, value) => exec(doc, "fontName", value),
});

/** The selection's text at an exact point size. The engine only knows sizes 1–7, so it marks with 7, then we restate. */
export function setSelectionSize(doc, pt) {
  if (!hasSelection(doc)) return false;
  exec(doc, "fontSize", "7");
  for (const el of doc.body.querySelectorAll('span[style*="xxx-large"], font[size="7"]')) {
    if (el.tagName === "FONT") { el.removeAttribute("size"); }
    el.style.fontSize = `${pt}pt`;
  }
  return true;
}

const BLOCKS = "p,li,div,h1,h2,h3,h4,h5,h6,ul,ol";
/** Line spacing for the blocks the selection touches (the caret's block when nothing is selected). */
export function setSelectionLineSpacing(doc, lh) {
  const sel = doc.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  const near = (n) => (n?.nodeType === 1 ? n : n?.parentElement)?.closest?.(BLOCKS);
  const hit = new Set([near(range.startContainer), near(range.endContainer)].filter(Boolean));
  for (const el of doc.body.querySelectorAll(BLOCKS)) if (range.intersectsNode(el) && !el.querySelector(BLOCKS)) hit.add(el);
  for (const el of hit) el.style.lineHeight = String(lh);
  return hit.size > 0;
}

// ── sections: the template's flat run — a .section-title and its siblings up to the next one ─────────────────
const isTitle = (el) => el?.classList?.contains("section-title");
function sectionsOf(doc) {
  const out = [];
  for (const el of Array.from(doc.body.children)) {
    if (isTitle(el)) out.push([el]);
    else if (out.length) out[out.length - 1].push(el);
  }
  return out;
}
function sectionAtCaret(doc) {
  const sel = doc.getSelection();
  const node = sel?.rangeCount ? sel.getRangeAt(0).startContainer : null;
  let el = node?.nodeType === 1 ? node : node?.parentElement;
  while (el && el.parentElement !== doc.body) el = el.parentElement;
  const all = sectionsOf(doc);
  return { all, i: el ? all.findIndex(s => s.includes(el)) : -1 };
}

/** Move the caret's section up (-1) or down (+1). */
export function moveSection(doc, dir) {
  const { all, i } = sectionAtCaret(doc);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return false;
  const [a, b] = dir < 0 ? [all[j], all[i]] : [all[i], all[j]];   // b moves before a
  for (const el of b) a[0].before(el);
  return true;
}

/** A new, empty section after the caret's (or at the end). */
export function insertSection(doc, title = "New section") {
  const { all, i } = sectionAtCaret(doc);
  const t = doc.createElement("div");
  t.className = "section-title";
  t.textContent = title;
  const body = doc.createElement("div");
  body.textContent = "Write here.";
  const after = i >= 0 ? all[i][all[i].length - 1] : null;
  if (after) after.after(t, body); else doc.body.append(t, body);
  return true;
}

// ── document commands: the template's variables, on <html style> ──────────────────────────────────
const root = (doc) => doc.documentElement;
const readVar = (doc, name, fallback) => {
  const v = parseFloat(root(doc).style.getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
};

export const DOCUMENT = Object.freeze({
  font: (doc, value) => { doc.body.style.fontFamily = value; },
  margins: (doc, m) => {
    root(doc).style.setProperty("--margin-x", m.x);
    root(doc).style.setProperty("--margin-top", m.y);
    root(doc).style.setProperty("--margin-bot", m.y);
  },
  /** One step tighter: body text 0.25pt smaller, lines and section gaps closer — floors that keep it readable. */
  fitStep: (doc) => {
    const fs = Math.max(7, readVar(doc, "--fs-body", BASE.fsBody) - 0.25);
    const lh = Math.max(1.15, readVar(doc, "--lh-body", BASE.lh) - 0.05);
    const gap = Math.max(4, readVar(doc, "--gap-section", BASE.gap) - 1);
    root(doc).style.setProperty("--fs-body", `${fs}pt`);
    root(doc).style.setProperty("--fs-section", `${Math.max(7, fs - 0.5)}pt`);
    root(doc).style.setProperty("--lh-body", String(Math.round(lh * 100) / 100));
    root(doc).style.setProperty("--lh-bullets", String(Math.round((lh - 0.04) * 100) / 100));
    root(doc).style.setProperty("--gap-section", `${gap}pt`);
    return { fs, lh, gap };
  },
  reset: (doc) => {
    for (const v of ["--fs-body", "--fs-section", "--lh-body", "--lh-bullets", "--gap-section", "--margin-x", "--margin-top", "--margin-bot"]) {
      root(doc).style.removeProperty(v);
    }
    doc.body.style.removeProperty("font-family");
  },
});
