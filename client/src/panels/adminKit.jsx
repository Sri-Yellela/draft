// ⭐ D83 · THE ADMIN KIT — the parts every rebuilt admin panel is made of, built once (A93): the ? that holds project
// codes (rule 1), the number box (rule 2), the numbered step (rule 4), the confirm dialog that states what changes
// (rule 5) and the panel styles. First built for Admin → Enrichment (D83 BUILD 1); moved here at the map (39d).
import { createContext, useContext, useState, useEffect } from "react";
import { C } from "../styles/colorTokens.js";
import { markStyle, LOGO_FACE } from "../styles/mark.js";
import DepthButton from "../components/DepthButton.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// ── the parts ──────────────────────────────────────────────────────────────────────────────────

// A ? that holds the project vocabulary (and any detail) out of the main text. A perfect circle — allowed (D60).
export function Help({ tip }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", verticalAlign: "middle", marginLeft: 5 }}>
      <button type="button" aria-label={tip} title={tip} data-tip={tip}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        style={{ width: 18, height: 18, borderRadius: "50%", border: `1px solid ${C.BORDER_STRONG}`, padding: 0,
                 background: "transparent", color: C.INK_FAINT, fontWeight: 700, fontSize: ts(11), lineHeight: 1, cursor: "help" }}>?</button>
      {open && (
        <span role="tooltip" style={{ position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)",
          width: 240, background: C.INK, color: C.SURFACE_SOLID, fontWeight: 500, fontSize: ts(11.5), lineHeight: 1.4, padding: "8px 10px",
          borderRadius: 8, zIndex: 9, textAlign: "left" }}>{tip}</span>
      )}
    </span>
  );
}

export function Mark({ tone, children }) { return <span style={markStyle(tone)}>{children}</span>; }

export function NumberBox({ value, label, good }) {
  return (
    <div style={{ background: C.SURFACE_SOLID, border: `1px solid ${C.BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
      <b style={{ display: "block", font: "400 34px/1 'Instrument Serif', Georgia, serif", color: good ? C.SUCCESS : C.ACCENT_INK }}>{value}</b>
      <span style={{ fontSize: ts(11.5), color: C.INK_FAINT }}>{label}</span>
    </div>
  );
}

export const panel = { background: C.SURFACE_SOLID, border: `1px solid ${C.BORDER}`, borderRadius: 16, padding: "18px 20px", marginBottom: 14 };
export const h2 = { font: `800 italic 20px/1.1 ${LOGO_FACE}`, color: C.INK, margin: 0 };
export const what = { fontSize: ts(13), color: C.INK_MUTED, margin: "6px 0 16px", maxWidth: "80ch" };
export const row = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
export const quiet = { fontSize: ts(12), color: C.INK_FAINT };
export const sub = { border: `1px solid ${C.BORDER}`, borderRadius: 11, padding: "11px 13px", background: C.CANVAS };
export const callout = (tone) => ({ borderLeft: `3px solid ${tone}`, background: `color-mix(in srgb, ${tone} 10%, transparent)`,
  borderRadius: "0 9px 9px 0", padding: "8px 11px", fontSize: ts(12), color: C.INK_MUTED });
export const field = { background: C.SURFACE_INPUT, border: `1px solid ${C.BORDER_CONTROL}`, color: C.INK, borderRadius: 9,
  padding: "8px 10px", fontWeight: 500, fontSize: ts(12.5) };

export function Step({ n, state, title, children }) {
  const active = state === "active", done = state === "done";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 12, marginBottom: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", marginTop: 10,
        font: `800 italic 14px ${LOGO_FACE}`, border: `1px solid ${active ? C.ACCENT : done ? C.SUCCESS : C.BORDER}`,
        background: active ? C.ACCENT : done ? C.SUCCESS_QUIET : C.CANVAS, color: active ? C.ON_ACCENT : done ? C.SUCCESS : C.INK_FAINT }}>{n}</div>
      <section aria-current={active ? "step" : undefined} aria-label={`Step ${n}: ${title}`}
        style={{ background: C.SURFACE_SOLID, border: `1px solid ${active ? C.ACCENT_INK : C.BORDER}`,
          borderLeft: `4px solid ${active ? C.ACCENT : done ? C.SUCCESS : C.BORDER}`, borderRadius: 13, padding: "12px 15px",
          opacity: state === "locked" ? 0.6 : 1 }}>
        <div style={{ ...row }}>
          <h3 style={{ font: `800 italic 15px/1.1 ${LOGO_FACE}`, color: C.INK, flex: 1, margin: 0 }}>{title}</h3>
          {done ? <Mark tone={C.SUCCESS}>Done</Mark> : active ? <Mark tone={C.ACCENT_INK}>Your turn</Mark> : <Mark tone={C.INK_FAINT}>Waiting</Mark>}
        </div>
        {state !== "locked" && <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>}
      </section>
    </div>
  );
}

export function Dialog({ title, children, onCancel, confirmLabel, onConfirm, busy, disabled = false }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: C.SCRIM, display: "grid", placeItems: "center", zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ background: C.SURFACE_MODAL, border: `1px solid ${C.BORDER}`, borderRadius: 16, padding: 20, maxWidth: 440 }}>
        <h4 style={{ font: `800 italic 17px ${LOGO_FACE}`, color: C.INK, margin: "0 0 8px" }}>{title}</h4>
        <div style={{ fontSize: ts(12.5), color: C.INK_MUTED }}>{children}</div>
        <div style={{ ...row, marginTop: 14 }}>
          <DepthButton onClick={onCancel}>Go back</DepthButton>
          <DepthButton primary disabled={busy || disabled} onClick={onConfirm} autoFocus>{busy ? "Working…" : confirmLabel}</DepthButton>
        </div>
      </div>
    </div>
  );
}

/** The selected admin tab's label (AdminPanel provides it) — D182: a Panel titled the same draws no heading. */
export const AdminSection = createContext("");

/** The panel shell: a title, one sentence of purpose (codes behind the ?), then the numbers, then the work. */
export function Panel({ title, purpose, code, numbers, children, ...rest }) {
  const tab = useContext(AdminSection);
  // ⭐ D182 (45n, owner 11-08): a heading equal to the selected tab above it is not drawn; its Help tip moves first.
  const repeats = typeof title === "string" && !!tab && title.trim().toLowerCase() === String(tab).trim().toLowerCase();
  return (
    <section style={panel} aria-label={repeats ? title : undefined} {...rest}>
      {repeats
        ? <p style={{ ...what, marginTop: 0 }}>{code && <><Help tip={code}/>{" "}</>}{purpose}</p>
        : <><h2 style={h2}>{title}{code && <Help tip={code}/>}</h2><p style={what}>{purpose}</p></>}
      {numbers?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 18 }}>
          {numbers.map(([value, label, good]) => <NumberBox key={label} value={value} label={label} good={good}/>)}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Rule 5's confirm, in the page — never the browser's confirm(). `ask({ title, body, label })` resolves true on
 * the confirm button and false on Go back / Escape; render `dialog` once in the panel.
 */
export function useConfirm() {
  const [pending, setPending] = useState(null);
  const ask = (opts) => new Promise(resolve => setPending({ ...opts, resolve }));
  const close = (v) => { pending?.resolve(v); setPending(null); };
  const dialog = pending ? (
    <Dialog title={pending.title} confirmLabel={pending.label || "Confirm"} onCancel={() => close(false)} onConfirm={() => close(true)}>
      {pending.body}
    </Dialog>
  ) : null;
  return { ask, dialog };
}
