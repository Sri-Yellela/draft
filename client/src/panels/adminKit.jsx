// ⭐ D83 · THE ADMIN KIT — the parts every rebuilt admin panel is made of, built once (A93): the ? that holds project
// codes (rule 1), the number box (rule 2), the numbered step (rule 4), the confirm dialog that states what changes
// (rule 5) and the panel styles. First built for Admin → Enrichment (D83 BUILD 1); moved here at the map (39d).
// ⭐ D197 Wave 2 #21 · M5 (47m, lane outside) — TOKENS AND COMPONENTS ONLY: every admin panel is drawn from this kit, so the
// kit carries the plate's tokens to all of them (docs/revamp/admin.md): a panel is a plate card (white, a 1.5 px ink edge, a
// hard shadow), its heading the serif, its purpose the muted body, labels mono, a number the serif numeral (green only for
// proven), a step a numbered ticket, the confirm a ticket over a dimmed page. The admin frame is a plate root
// (components/AdminLayout.jsx), so every var(--pl-*) here resolves; dense — the paddings are trimmed.
import { createContext, useContext, useState, useEffect } from "react";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
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
        style={{ width: 18, height: 18, borderRadius: "50%", border: "var(--pl-border)", padding: 0,
                 background: "var(--pl-card)", color: "var(--pl-ink)", fontWeight: 700, fontSize: ts(11), lineHeight: 1, cursor: "help" }}>?</button>
      {open && (
        <span role="tooltip" style={{ position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)",
          width: 240, background: "var(--pl-ink)", color: "var(--pl-on-ink)", fontWeight: 500, fontSize: ts(11.5), lineHeight: 1.4, padding: "8px 10px",
          borderRadius: "var(--pl-r-stamp)", zIndex: 9, textAlign: "left" }}>{tip}</span>
      )}
    </span>
  );
}

// ⭐ D197 Wave 2 #21 (47n) · THE ADMIN'S BUTTON — the plate's (docs/revamp/admin.md: a read is paper, THE one write of a
// panel is clay). It took DepthButton's place inside Admin with the same props, so no call site changed meaning: primary →
// clay, size="compact" → the dense plate button (Admin's trimmed rows), pressed → aria-pressed, disabled → the plate's
// dashed disabled; the click never bubbles to a row (DepthButton's rule kept). adminOps.jsx's own classic Btn (theme / danger,
// used by Ops and People) is folded in here (A93: one button): danger → the guarded write, the plate's secondary (admin.md: a
// destructive write is a secondary that opens the confirm); "theme" is accepted and unused — the plate carries the palette.
export function Btn({ children, primary = false, danger = false, pressed = false, disabled = false, size, title, onClick, theme, className = "", ...rest }) {
  const cls = ["pl-btn", primary ? "pl-btn--primary" : danger ? "pl-btn--secondary pl-btn--dense" : "pl-btn--paper",
    size === "compact" ? "pl-btn--dense" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} title={title} aria-pressed={pressed || undefined} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }} {...rest}>{children}</button>
  );
}

export function Mark({ tone, children }) { return <span style={markStyle(tone)}>{children}</span>; }

export function NumberBox({ value, label, good }) {
  return (
    <div style={{ background: "var(--pl-card)", border: "var(--pl-border)", borderRadius: "var(--pl-r-small)", padding: "10px 12px" }}>
      <b style={{ display: "block", fontFamily: "var(--pl-serif)", fontWeight: 400, fontSize: "var(--pl-t-card)", lineHeight: 1, color: good ? "var(--pl-lit)" : "var(--pl-ink)" }}>{value}</b>
      <span className="pl-label pl-muted" style={{ display: "block", marginTop: 6 }}>{label}</span>
    </div>
  );
}

export const panel = { background: "var(--pl-card)", border: "var(--pl-border)", borderRadius: "var(--pl-r-card)", boxShadow: "var(--pl-s4)",
  padding: "16px 18px", marginBottom: 14, color: "var(--pl-ink)" };
export const h2 = { fontFamily: "var(--pl-serif)", fontWeight: 400, fontSize: "var(--pl-t-card)", lineHeight: 1.1, color: "var(--pl-ink)", margin: 0 };
export const what = { fontSize: ts(13), color: "var(--pl-ink-soft)", margin: "6px 0 14px", maxWidth: "80ch" };
export const row = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
export const quiet = { fontSize: ts(12), color: "var(--pl-muted)" };
export const sub = { border: "var(--pl-border-rule)", borderRadius: "var(--pl-r-input)", padding: "10px 12px", background: "var(--pl-paper-warm)" };
// a state is a word with a rule beside it, never a fill (admin.md: amber / red are words with a dot)
export const callout = (tone) => ({ borderLeft: `3px solid ${tone}`, background: "var(--pl-paper-warm)",
  borderRadius: "0 var(--pl-r-stamp) var(--pl-r-stamp) 0", padding: "8px 11px", fontSize: ts(12), color: "var(--pl-ink-soft)" });
export const field = { background: "var(--pl-card)", border: "var(--pl-border)", color: "var(--pl-ink)", borderRadius: "var(--pl-r-input)",
  padding: "8px 10px", fontWeight: 500, fontSize: ts(12.5), fontFamily: "var(--pl-sans)" };

export function Step({ n, state, title, children }) {
  const active = state === "active", done = state === "done";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 12, marginBottom: 10 }}>
      <div style={{ width: 34, height: 34, boxSizing: "border-box", borderRadius: "var(--pl-r-stamp)", display: "grid", placeItems: "center", marginTop: 10,
        fontFamily: "var(--pl-mono)", fontWeight: 700, fontSize: "var(--pl-t-mono-lg)", border: "var(--pl-border)",
        background: active ? "var(--pl-clay)" : done ? "var(--pl-card)" : "var(--pl-paper-warm)", color: active ? "var(--pl-on-clay)" : done ? "var(--pl-lit)" : "var(--pl-muted)" }}>{n}</div>
      <section aria-current={active ? "step" : undefined} aria-label={`Step ${n}: ${title}`}
        style={{ background: "var(--pl-card)", border: active ? "var(--pl-border)" : "var(--pl-border-rule)",
          boxShadow: active ? "var(--pl-s3)" : "none", borderRadius: "var(--pl-r-small)", padding: "12px 15px",
          opacity: state === "locked" ? 0.6 : 1 }}>
        <div style={{ ...row }}>
          <h3 style={{ fontFamily: "var(--pl-serif)", fontWeight: 400, fontSize: "var(--pl-t-num-sm)", lineHeight: 1.1, color: "var(--pl-ink)", flex: 1, margin: 0 }}>{title}</h3>
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
        style={{ background: "var(--pl-card)", border: "var(--pl-border)", borderRadius: "var(--pl-r-card)", boxShadow: "var(--pl-s5)", padding: 20, maxWidth: 440, color: "var(--pl-ink)" }}>
        <span className="pl-label pl-muted">CONFIRM</span>
        <h4 style={{ fontFamily: "var(--pl-serif)", fontWeight: 400, fontSize: "var(--pl-t-card)", lineHeight: 1.1, color: "var(--pl-ink)", margin: "6px 0 8px" }}>{title}</h4>
        <div style={{ fontSize: ts(12.5), color: "var(--pl-ink-soft)" }}>{children}</div>
        <div style={{ ...row, marginTop: 14 }}>
          <Btn onClick={onCancel}>Go back</Btn>
          <Btn primary disabled={busy || disabled} onClick={onConfirm} autoFocus>{busy ? "Working…" : confirmLabel}</Btn>
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
