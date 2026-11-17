// client/src/components/TextBlocks.jsx — ⭐ A233 (46u, owner's pick 11-17: "go with your recommendations") · LINES OF TEXT,
// DESIGNED. The audit (docs/A233_TEXT_AUDIT.md) found ~400 prose lines; the owner picked C with two companions:
//   NoteCard   — an explanation or an empty state: a pastel card (stable per id, shared/pastel.js), a serif title, at most
//                two short lines, the action it is about. (C)
//   Facts      — a line that is mostly numbers: each figure in the serif with a short caption. (A's figures)
//   Promises   — what draft does and never does: a ✓ / ✕ checklist that keeps every item's full meaning. (A's checklist)
// Short status lines and the legal pages stay plain text. One implementation for the whole client (A93).
import "./TextBlocks.css";
import { pastelVar } from "../../../shared/pastel.js";

/** An explanation or an empty state as a note card. `id` picks its pastel; `actions` are buttons or links. */
export function NoteCard({ id = "note", title, children = null, actions = null, className = "", ...data }) {
  return (
    <div className={`tb-note${className ? ` ${className}` : ""}`} style={{ "--tb-c": pastelVar(id) }} data-note-card={id} {...data}>
      {title && <p className="tb-note__t">{title}</p>}
      {children && <div className="tb-note__s">{children}</div>}
      {actions && <div className="tb-note__acts">{actions}</div>}
    </div>
  );
}

/** Figures, not a sentence: [{ value, label }]. */
export function Facts({ items, className = "", ...data }) {
  const shown = (items || []).filter(f => f && f.value != null && f.value !== "");
  if (!shown.length) return null;
  return (
    <dl className={`tb-facts${className ? ` ${className}` : ""}`} data-facts="" {...data}>
      {shown.map((f, i) => (
        <div key={i} className="tb-fact"><dt className="tb-fact__l">{f.label}</dt><dd className="tb-fact__v">{f.value}</dd></div>
      ))}
    </dl>
  );
}

/** What happens (ok: true, ✓) and what never does (ok: false, ✕) — each item keeps its full meaning. */
export function Promises({ title = null, items, className = "", ...data }) {
  return (
    <div className={`tb-prom${className ? ` ${className}` : ""}`} data-promises="" {...data}>
      {title && <p className="tb-prom__t">{title}</p>}
      <ul className="tb-prom__list">
        {(items || []).map((it, i) => (
          <li key={i} className={`tb-prom__i tb-prom__i--${it.ok ? "yes" : "no"}`}>
            <span className="tb-prom__mark" aria-hidden="true">{it.ok ? "✓" : "✕"}</span>
            <span><span className="tb-sr">{it.ok ? "Yes: " : "Never: "}</span>{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
