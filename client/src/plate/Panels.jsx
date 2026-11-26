// ⭐ D197 Wave 2 #19 (47j, lane w2-outside) · THE FLOATING PANEL and THE /d SQUARE — the extension's one panel (D191) in the
// plate's linework: a paper plate with a 1.5 px ink edge and a hard shadow, a masthead (the /d tile, the header icons, a
// ruler), a mono status line, the body, the foot; closed, it is the /d square on the screen's edge. docs/revamp/extension.md
// is the brief. The extension can't import client code, so at M5 these are MIRRORS rows (extension/jobPanel.js, dock.js's
// .launch) — this file is the drawing both follow. Tiny's side panel on Resume Master (D190) can wear the same frame.
// ⛔ No capsule (D60): the square is a square tile; the need dot is a perfect circle. Nothing here drags or places itself —
// the extension's dock keeps that (geometry is behaviour, not look).
import { plateState } from "./PlateState.jsx";
import { PlateLogo, Ruler } from "./Shell.jsx";
import { Icon } from "./icons.jsx";

const HEAD_ICONS = [
  { id: "move", icon: "move", label: "Move the panel — arrow keys move it, Ctrl+arrow snaps it to that edge" },
  { id: "collapse", icon: "minimise", label: "Collapse the panel" },
  { id: "settings", icon: "filters", label: "draft settings" },
  { id: "close", icon: "close", label: "Close the panel (Esc)" },
];

/**
 * The floating panel. `label` (its region name), `status` = { text, tone: quiet | ok | busy } (a mono line with a 6 px dot —
 * the word carries the state), `children` (the body), `foot` (a node), `width` (380 = the dock's default), `onHead(id)`
 * for the header icons, `tabs` (a node — the binder tabs, only once a second view exists).
 */
export function SidePanel({ label = "draft — this job", status, children, foot, width = 380, tabs = null, onHead, ...s }) {
  const gate = plateState(s, { height: 320, radius: "plate", lines: 4, label: "Loading the panel" });
  const tone = status?.tone || "quiet";
  const dot = tone === "ok" ? "var(--pl-lit)" : tone === "busy" ? "var(--pl-clay)" : "var(--pl-muted-2)";
  return (
    <section role="region" aria-label={label} className="pl-card" data-plate-panel=""
      style={{ width, maxWidth: "100%", minWidth: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", background: "var(--pl-paper)", borderRadius: "var(--pl-r-card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 8px 6px 12px", background: "var(--pl-card)" }}>
        <PlateLogo size="favicon"/>
        <span className="pl-label" style={{ marginLeft: 8 }}>DRAFT</span>
        <span style={{ flex: 1 }}/>
        {HEAD_ICONS.map((h) => (
          <button key={h.id} type="button" className="pl-btn pl-btn--icon pl-btn--flat" aria-label={h.label} title={h.label} onClick={() => onHead?.(h.id)}
            style={{ border: 0, background: "transparent" }}>
            <Icon name={h.icon} size={16} stroke={2}/>
          </button>
        ))}
      </div>
      <Ruler size="leg"/>
      {tabs}
      {gate || (
        <>
          {status?.text ? (
            <div role="status" className="pl-label" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px 0", color: "var(--pl-ink-soft)" }} data-tone={tone}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flex: "none" }}/>
              <span style={{ overflowWrap: "anywhere" }}>{status.text}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 16px 16px", minWidth: 0 }}>{children}</div>
        </>
      )}
      {foot ? <div style={{ borderTop: "var(--pl-border)", padding: "10px 16px", background: "var(--pl-card)" }}>{foot}</div> : null}
    </section>
  );
}

/**
 * The /d square — the closed panel: the plate logo in a 52 px square tile; `need` adds the clay dot (something needs you);
 * its words are its name and tooltip ("Open draft — 1 needs you"). One press reopens the panel's last state.
 */
export function ReopenTab({ words = "", need = false, onOpen, ...s }) {
  const gate = plateState(s, { height: 52, radius: "input", lines: 1, label: "Loading" });
  if (gate) return gate;
  const name = `Open draft${words ? ` — ${words}` : ""}`;
  return (
    <button type="button" className="pl-btn" aria-label={name} title={name} aria-expanded="false" onClick={onOpen}
      style={{ position: "relative", width: 52, height: 52, padding: 0, borderRadius: "var(--pl-r-input)", background: "var(--pl-card)", boxShadow: "var(--pl-s4)" }}>
      <PlateLogo size="favicon"/>
      {need ? <span aria-hidden="true" style={{ position: "absolute", top: -4, right: -4, width: 12, height: 12, borderRadius: "50%", background: "var(--pl-clay)", border: "var(--pl-border)" }}/> : null}
      <span className="pl-sr">{words}</span>
    </button>
  );
}
