// ── A106 · THE SANDBOX'S TOOLBAR — Word-like editing on the tailored résumé ────────────────────────────────
// Font · size · B I U · lists · indent · alignment · line spacing · colour · clear · undo / redo, and the résumé's
// own tools: add a section, move a section, margins, Fit to one page, Reset. The commands are lib/docFormat.js; this
// is only their buttons. Every button acts on mousedown with preventDefault, so the page keeps its selection.
// D60: rectangles (radius 6) — no capsule.
import { useState } from "react";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size
import { FONTS, SIZES_PT, LINE_SPACING, MARGINS, SELECTION, DOCUMENT, setSelectionSize, setSelectionLineSpacing,
  moveSection, insertSection } from "../lib/docFormat.js";

const box = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28, height: 28, padding: "0 7px",
  borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)",
  fontSize: ts(12), fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
const sel = { ...box, padding: "0 4px", fontWeight: 600, cursor: "pointer" };
const sep = { width: 1, alignSelf: "stretch", background: "var(--color-border)", margin: "0 2px" };

/**
 * @param getDoc()      the focused page's Document (null when no page is ready)
 * @param getAllDocs()  every page's Document — document commands apply to all of them
 * @param onChanged(doc) the sandbox's input path (dirty, save, the other pages' sync)
 */
export default function DocToolbar({ getDoc, getAllDocs, onChanged }) {
  const [msg, setMsg] = useState("");
  const say = (m) => { setMsg(m); if (m) setTimeout(() => setMsg(""), 2500); };

  const onSelection = (fn) => {
    const doc = getDoc();
    if (!doc) return;
    const ok = fn(doc);
    if (ok === false) say("Select some text on the page first.");
    onChanged(doc);
  };
  const onDocument = (fn) => {
    const docs = getAllDocs();
    if (!docs.length) return;
    let r;
    for (const d of docs) r = fn(d);
    onChanged(docs[0]);
    return r;
  };
  const press = (fn) => ({ onMouseDown: (e) => { e.preventDefault(); fn(); } });
  // A render helper, not a component: a component defined here would remount every button on each render.
  const B = ({ cmd, label, title, style }) => (
    <button type="button" style={{ ...box, ...style }} title={title} aria-label={title} data-cmd={cmd}
      {...press(() => onSelection(SELECTION[cmd]))}>{label}</button>
  );

  return (
    <div role="toolbar" aria-label="Edit the résumé" data-doc-toolbar=""
      style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", padding: "6px 8px",
        borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <select style={{ ...sel, maxWidth: 150 }} aria-label="Font" defaultValue=""
        onChange={(e) => {
          const v = e.target.value; e.target.value = "";
          if (!v) return;
          const doc = getDoc();
          const s = doc?.getSelection();
          // Text selected → that text; nothing selected → the whole résumé.
          if (s && s.rangeCount && !s.isCollapsed) onSelection(d => SELECTION.font(d, v));
          else { onDocument(d => DOCUMENT.font(d, v)); say("Font set for the whole résumé."); }
        }}>
        <option value="">Font…</option>
        {FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <select style={sel} aria-label="Size" defaultValue=""
        onChange={(e) => { const v = Number(e.target.value); e.target.value = ""; if (v) onSelection(d => setSelectionSize(d, v)); }}>
        <option value="">Size</option>
        {SIZES_PT.map(p => <option key={p} value={p}>{p} pt</option>)}
      </select>
      <span style={sep} />
      {B({ cmd: "bold", label: "B", title: "Bold (Ctrl+B)" })}
      {B({ cmd: "italic", label: "I", title: "Italic (Ctrl+I)", style: { fontStyle: "italic" } })}
      {B({ cmd: "underline", label: "U", title: "Underline (Ctrl+U)", style: { textDecoration: "underline" } })}
      <label style={{ ...box, gap: 4 }} title="Text colour">
        A<input type="color" aria-label="Text colour"
          style={{ width: 18, height: 18, padding: 0, border: 0, background: "none" }}
          onChange={(e) => onSelection(d => SELECTION.color(d, e.target.value))} />
      </label>
      <span style={sep} />
      {B({ cmd: "bullets", label: "• List", title: "Bulleted list" })}
      {B({ cmd: "numbers", label: "1. List", title: "Numbered list" })}
      {B({ cmd: "outdent", label: "⇤", title: "Decrease indent" })}
      {B({ cmd: "indent", label: "⇥", title: "Increase indent" })}
      <span style={sep} />
      {B({ cmd: "left", label: "⯇", title: "Align left" })}
      {B({ cmd: "center", label: "≡", title: "Center" })}
      {B({ cmd: "right", label: "⯈", title: "Align right" })}
      {B({ cmd: "justify", label: "☰", title: "Justify" })}
      <select style={sel} aria-label="Line spacing" defaultValue=""
        onChange={(e) => { const v = Number(e.target.value); e.target.value = ""; if (v) onSelection(d => setSelectionLineSpacing(d, v)); }}>
        <option value="">Spacing</option>
        {LINE_SPACING.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      {B({ cmd: "clear", label: "T̸", title: "Clear formatting" })}
      <span style={sep} />
      {B({ cmd: "undo", label: "↶", title: "Undo (Ctrl+Z)" })}
      {B({ cmd: "redo", label: "↷", title: "Redo (Ctrl+Y)" })}
      <span style={sep} />
      <button type="button" style={box} title="Add a section after the one you are in" data-cmd="insertSection"
        {...press(() => onSelection(insertSection))}>+ Section</button>
      <button type="button" style={box} title="Move the section you are in up" aria-label="Move section up" data-cmd="sectionUp"
        {...press(() => onSelection(d => moveSection(d, -1)))}>Section ↑</button>
      <button type="button" style={box} title="Move the section you are in down" aria-label="Move section down" data-cmd="sectionDown"
        {...press(() => onSelection(d => moveSection(d, 1)))}>Section ↓</button>
      <select style={sel} aria-label="Margins" defaultValue=""
        onChange={(e) => { const m = MARGINS.find(x => x.label === e.target.value); e.target.value = ""; if (m) onDocument(d => DOCUMENT.margins(d, m)); }}>
        <option value="">Margins</option>
        {MARGINS.map(m => <option key={m.label} value={m.label}>{m.label}</option>)}
      </select>
      <button type="button" style={box} data-cmd="fitStep" title="Tighten text size, line spacing and section gaps one step"
        {...press(() => { const r = onDocument(DOCUMENT.fitStep); if (r) say(`Body ${r.fs} pt · lines ${Math.round(r.lh * 100) / 100}. Press again to tighten more.`); })}>
        Fit to one page</button>
      <button type="button" style={box} data-cmd="reset" title="Back to the template's font, sizes and margins"
        {...press(() => { onDocument(DOCUMENT.reset); say("Font, sizes and margins reset."); })}>Reset</button>
      {msg && <span role="status" style={{ fontSize: ts(11), color: "var(--color-text-muted)", marginLeft: 4 }}>{msg}</span>}
    </div>
  );
}
