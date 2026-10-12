// D93 · RADIO CARDS — one choice from a few, drawn as cards (the Customise page: themes, the top bar, the sentence).
//
// A real radio group (WAI-ARIA APG): role="radiogroup" holding role="radio" cards, ONE tab stop (the checked
// card, roving tabindex); the arrow keys move AND select, Home / End go to the ends; Space and Enter select the
// focused card; a visible focus ring (Customise.css). Choosing the checked card again does nothing.
//
// Props: label (the group's accessible name), items [{ id, label, description, preview?, tag? }], value, onChange(id)
import { useRef } from "react";

export default function RadioCards({ label, items, value, onChange, name }) {
  const refs = useRef([]);
  const at = Math.max(0, items.findIndex((i) => i.id === value));
  const go = (i) => {
    const n = (i + items.length) % items.length;
    refs.current[n]?.focus();
    if (items[n].id !== value) onChange?.(items[n].id);
  };
  const onKeyDown = (e, i) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); go(i + step); return; }
    if (e.key === "Home") { e.preventDefault(); go(0); return; }
    if (e.key === "End") { e.preventDefault(); go(items.length - 1); return; }
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (items[i].id !== value) onChange?.(items[i].id); }
  };
  return (
    <div role="radiogroup" aria-label={label} className="cz-opts" data-radio-cards={name || ""}>
      {items.map((it, i) => {
        const on = i === at && it.id === value;
        return (
          <div key={it.id} ref={(el) => { refs.current[i] = el; }} role="radio" aria-checked={on} tabIndex={i === at ? 0 : -1}
            className="cz-opt" data-option={it.id}
            onClick={() => { if (!on) onChange?.(it.id); }} onKeyDown={(e) => onKeyDown(e, i)}>
            {it.preview}
            <span className="cz-opt__label">{it.label}{it.tag ? <span className="cz-opt__tag">{it.tag}</span> : null}</span>
            {it.description && <span className="cz-opt__desc">{it.description}</span>}
          </div>
        );
      })}
    </div>
  );
}
