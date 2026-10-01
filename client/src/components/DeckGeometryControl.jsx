// ── The deck's layout, as a user control (queue 38) ──────────────────────────────────────────
//
// ⭐ Framed as accessibility as much as taste: "Tight" is the calm deck — the smallest sweep on the
// flattest arc, so a step moves every card least. ⚠ Presets first; the three sliders sit behind
// "Customise", because most people do not want to tune a radius.
//
// ⛔ The sliders cannot produce a broken deck: their ranges are the FITTED ones for the current
// combination (fanGeometry.js · spreadBounds / reachBounds), so the reach slider's ends move as the
// zoom and spread move, and every value still passes through clampGeometry before the fan draws it.
// ⛔ prefers-reduced-motion overrides all of it: the deck is Tight and still, and this says so.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../styles/colorTokens.js";
import { Z } from "../styles/zLayers.js";
import { glass } from "../styles/glass.js";
import { DECK_LIMITS, DECK_PRESET_NAMES } from "../../../shared/deckGeometry.js";
import { clampGeometry, geometryFor, reachBounds, spreadBounds } from "../lib/fanGeometry.js";

const PRESET_COPY = {
  tight:    ["Tight",    "The calmest: cards close together on a flat arc. A step moves every card least."],
  standard: ["Standard", "The deck as designed."],
  wide:     ["Wide",     "The most sweep: the cards fan out further, on a tighter curve."],
};
const PANEL_W = 340;
const AXIS_COPY = {
  zoom:   ["Size",   "How large the cards behind the front one are"],
  spread: ["Spread", "How far each card turns from the next"],
  reach:  ["Reach",  "How flat the arc is — further is flatter"],
};

export default function DeckGeometryControl({ orientation, pref, onChoose, reduced }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(pref?.preset === "custom");
  const id = useId();
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const [at, setAt] = useState(null);   // where the panel opens, in viewport px
  const preset = pref?.preset || "standard";
  // What the fan is drawing right now for this orientation (fitted), so the sliders start there.
  const current = geometryFor(orientation, pref);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // ⛔ PORTALLED, fixed, clamped to the screen. Inside the header it sat in the CONTENT tier with the
  // front card — which comes later in the DOM and so painted OVER it: clicks fell through to the card
  // (expanding it), and on a phone, right-aligned to a button on the left, it opened off the screen.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = document.documentElement.clientWidth;
      const width = Math.min(PANEL_W, vw - 32);
      setAt({ top: r.bottom + 8, left: Math.max(16, Math.min(r.right - width, vw - width - 16)), width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place); };
  }, [open]);

  const pick = (name) => onChoose({ preset: name, custom: pref?.custom || {} });
  const slide = (axis, value) => {
    const next = clampGeometry(orientation, { ...current, [axis]: Number(value) });
    onChoose({ preset: "custom", custom: { ...(pref?.custom || {}), [orientation]: { zoom: next.zoom, spread: next.spread, reach: next.reach } } });
  };
  // The fitted ends of each slider for the combination as it stands.
  const bounds = {
    zoom: DECK_LIMITS[orientation].zoom.slice(0, 2),
    spread: spreadBounds(orientation, current.zoom) || DECK_LIMITS[orientation].spread.slice(0, 2),
    reach: reachBounds(orientation, current.zoom, current.spread) || DECK_LIMITS[orientation].reach.slice(0, 2),
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls={`${id}-panel`}
        style={{ ...glass({ radius: 999 }), padding: "6px 12px", fontSize: 13, fontWeight: 800, color: C.INK, cursor: "pointer" }}>
        Layout
      </button>
      {open && at && createPortal(
        <div ref={panelRef} id={`${id}-panel`} role="dialog" aria-label="Deck layout" data-deck-geometry
          style={{ ...glass({ radius: 18 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU, position: "fixed", top: at.top, left: at.left,
                   width: at.width, maxHeight: `calc(100vh - ${Math.round(at.top) + 16}px)`, overflowY: "auto",
                   boxSizing: "border-box", padding: "16px 18px", zIndex: Z.NAV, color: C.INK, fontSize: 13.5 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 4 }}>Deck layout</div>
          <p style={{ margin: "0 0 12px", color: C.INK_MUTED, lineHeight: 1.5 }}>
            How far the cards fan out — and so how much they move. Tight is the calmest and the easiest to follow.
          </p>
          {reduced && (
            <p role="note" style={{ margin: "0 0 12px", padding: "8px 10px", borderRadius: 10, background: C.ACCENT_QUIET, color: C.INK, lineHeight: 1.5 }}>
              Your device asks for reduced motion, so the deck stays Tight and does not animate, whatever is chosen here.
            </p>
          )}
          <fieldset disabled={reduced} style={{ border: "none", margin: 0, padding: 0, opacity: reduced ? 0.55 : 1 }}>
            <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Preset</legend>
            <div role="radiogroup" aria-label="Preset" style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {DECK_PRESET_NAMES.map(name => {
                const on = preset === name;
                return (
                  <button key={name} type="button" role="radio" aria-checked={on} onClick={() => pick(name)} title={PRESET_COPY[name][1]}
                    style={{ flex: 1, padding: "8px 6px", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: "pointer",
                             border: `1px solid ${on ? C.ACCENT_INK : C.BORDER_STRONG}`,
                             background: on ? C.ACCENT : "transparent", color: on ? C.ON_ACCENT : C.INK }}>
                    {PRESET_COPY[name][0]}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12.5, color: C.INK_MUTED, minHeight: 36, lineHeight: 1.45 }}>
              {preset === "custom" ? "Your own layout, from the three controls below." : PRESET_COPY[preset][1]}
            </div>

            <button type="button" onClick={() => setCustom(v => !v)} aria-expanded={custom} aria-controls={`${id}-custom`}
              style={{ marginTop: 8, padding: 0, background: "transparent", border: "none", color: C.ACCENT_INK, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
              Customise {custom ? "▴" : "▾"}
            </button>
            {custom && (
              <div id={`${id}-custom`} style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {["zoom", "spread", "reach"].map(axis => {
                  const [, , step] = DECK_LIMITS[orientation][axis];
                  const [lo, hi] = bounds[axis];
                  return (
                    <label key={axis} style={{ display: "grid", gap: 2 }}>
                      <span style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        {AXIS_COPY[axis][0]}
                      </span>
                      <span style={{ fontSize: 12, color: C.INK_MUTED }}>
                        {lo === hi ? "Held where it is by the other two — at this size and spread, any other value would push cards out of view" : AXIS_COPY[axis][1]}
                      </span>
                      <input type="range" data-deck-axis={axis} min={lo} max={hi} step={step} value={current[axis]}
                        onChange={(e) => slide(axis, e.target.value)} aria-valuetext={`${AXIS_COPY[axis][0]} ${current[axis]}`}
                        style={{ width: "100%", accentColor: C.ACCENT }} />
                    </label>
                  );
                })}
                <button type="button" onClick={() => pick("standard")} disabled={preset === "standard"}
                  style={{ justifySelf: "start", padding: 0, background: "transparent", border: "none", color: C.ACCENT_INK, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                  Back to standard
                </button>
              </div>
            )}
          </fieldset>
          <div style={{ marginTop: 10, fontSize: 12, color: C.INK_FAINT }}>Saved to your account{orientation === "vertical" ? " — this is the phone-width deck" : ""}.</div>
        </div>,
        document.body,
      )}
    </div>
  );
}

