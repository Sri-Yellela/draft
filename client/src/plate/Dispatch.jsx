// ⭐ D197 Wave 2 #18 (47j, lane w2-outside) · DISPATCHES — the email form of the plate system: a 600 px table, every style
// inline (that's what mail clients read), every value a plate token. docs/revamp/emails.md is the brief: the masthead (/d tile,
// wordmark, a mono kicker) over a ruled edge, a serif title, one lead, the entries (the Gazetteer as ruled rows), ONE clay
// action, the small print and the foot. No SVG, no script, no web font required (the token faces carry their fallbacks).
// ⛔ The gallery and the M3 mock render it with `var(--pl-*)`; the real template (M5) resolves the same names to the token
// VALUES from styles/plate.css at build time — mail clients don't read custom properties. Nothing here ships to a user yet.
import { plateState } from "./PlateState.jsx";

const T = {
  paper: "var(--pl-paper)", warm: "var(--pl-paper-warm)", card: "var(--pl-card)", ink: "var(--pl-ink)", soft: "var(--pl-ink-soft)",
  muted: "var(--pl-muted)", rule: "var(--pl-rule)", clay: "var(--pl-clay)", onClay: "var(--pl-on-clay)", lit: "var(--pl-lit)",
  region: "var(--pl-r4)", tint: "var(--pl-r4-tint)", serif: "var(--pl-serif)", sans: "var(--pl-sans)", mono: "var(--pl-mono)",
};
const LINE = `1.5px solid ${T.ink}`;
const mono = (size = "var(--pl-t-mono)") => ({ fontFamily: T.mono, fontSize: size, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: T.ink });
const cell = (extra = {}) => ({ padding: 0, ...extra });

/** The one action: a bulletproof link in a clay cell (≥ 44 px), or ink text when `tone="ink"` (a per-entry link). */
export function DispatchButton({ label, href = "#", tone = "clay", ...s }) {
  const gate = plateState(s, { height: 48, radius: "input", lines: 1, label: "Loading the action" });
  if (gate) return gate;
  if (tone === "ink") {
    return <a href={href} style={{ fontFamily: T.sans, fontSize: "var(--pl-t-small)", fontWeight: 700, color: T.ink, textDecoration: "underline" }}>{label}</a>;
  }
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" style={{ borderCollapse: "separate" }}>
      <tbody><tr>
        <td style={cell({ background: T.clay, border: LINE, borderRadius: "var(--pl-r-input)", boxShadow: "var(--pl-s4)" })}>
          <a href={href} style={{ display: "inline-block", padding: "14px 22px", fontFamily: T.sans, fontSize: "var(--pl-t-ui-lg)", fontWeight: 800,
            color: T.onClay, textDecoration: "none", lineHeight: "20px" }}>{label}</a>
        </td>
      </tr></tbody>
    </table>
  );
}

/**
 * One entry: a ruled row — a region number tag, the serif title, the company, a mono facts line, the skill squares as
 * table cells (`squares` = { of, lit }, green = on your résumé), and its links (ink text, never clay).
 */
export function DispatchEntry({ n, title, company, facts = [], squares = null, links = [], ...s }) {
  const gate = plateState(s, { height: 96, radius: "card", lines: 3, label: "Loading the entry" });
  if (gate) return gate;
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: "collapse", borderTop: `1px solid ${T.rule}` }}>
      <tbody><tr>
        <td valign="top" width="44" style={cell({ paddingTop: 16 })}>
          <span style={{ ...mono("var(--pl-t-mono-tag)"), display: "inline-block", padding: "3px 6px", border: `1.5px solid ${T.region}`, color: T.region, background: T.tint, borderRadius: "var(--pl-r-stamp)" }}>
            {String(n).padStart(2, "0")}
          </span>
        </td>
        <td valign="top" style={cell({ padding: "14px 0 16px" })}>
          <div style={{ fontFamily: T.serif, fontSize: "var(--pl-t-num-sm)", lineHeight: 1.15, color: T.ink, overflowWrap: "anywhere" }}>{title}</div>
          {company ? <div style={{ fontFamily: T.sans, fontSize: "var(--pl-t-small)", fontWeight: 700, color: T.soft, marginTop: 4, overflowWrap: "anywhere" }}>{company}</div> : null}
          {facts.length ? <div style={{ ...mono(), color: T.muted, marginTop: 8, lineHeight: 1.6 }}>{facts.join(" · ")}</div> : null}
          {squares ? (
            <table role="img" cellPadding="0" cellSpacing="0" style={{ marginTop: 8, borderCollapse: "separate", borderSpacing: "3px 0" }} aria-label={`${squares.lit} of your ${squares.of} top skills`}>
              <tbody><tr>
                {Array.from({ length: squares.of }, (_, i) => (
                  <td key={i} width="10" height="10" style={{ width: 10, height: 10, border: `1px solid ${T.ink}`, background: i < squares.lit ? T.lit : T.card, fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
                ))}
              </tr></tbody>
            </table>
          ) : null}
          {links.length ? (
            <div style={{ marginTop: 10 }}>
              {links.map((l, i) => <span key={l.label}>{i ? <span style={{ color: T.muted }}>{"  ·  "}</span> : null}<DispatchButton tone="ink" label={l.label} href={l.href}/></span>)}
            </div>
          ) : null}
        </td>
      </tr></tbody>
    </table>
  );
}

/**
 * The dispatch: the 600 px table on paper. `kicker` (mono, the kind · the date), `title` (serif), `lead`, `stats`
 * ([{ value, label, tone: "lit" }] — green only for proven), `children` (the entries), `action` ({ label, href } — the one
 * clay point), `smallPrint` (strings), `foot` (strings). `width` narrows it for the phone frame (100 % below 620 px).
 */
export function DispatchFrame({ kicker, title, lead, stats = [], children, action, smallPrint = [], foot = [], width = 600, ...s }) {
  const gate = plateState(s, { height: 420, radius: "plate", lines: 6, label: "Loading the dispatch" });
  if (gate) return gate;
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: "collapse", background: T.paper }}>
      <tbody><tr><td align="center" style={cell({ padding: "24px 12px" })}>
        <table role="presentation" width={width} cellPadding="0" cellSpacing="0" style={{ width: "100%", maxWidth: width, borderCollapse: "separate", textAlign: "left" }}>
          <tbody>
            {/* the masthead: the /d tile + the wordmark, then the kicker; a ruled edge with a tick strip under it */}
            <tr><td style={cell({ paddingBottom: 10 })}>
              <table role="presentation" cellPadding="0" cellSpacing="0"><tbody><tr>
                <td style={cell({ width: 28, height: 28, border: LINE, background: T.card, borderRadius: "var(--pl-r-stamp)", textAlign: "center",
                  fontFamily: T.serif, fontSize: "var(--pl-t-num-sm)", lineHeight: "26px", color: T.ink })}>
                  <span style={{ color: T.clay }}>/</span>d
                </td>
                <td style={cell({ paddingLeft: 10, fontFamily: T.serif, fontSize: "var(--pl-t-num-sm)", color: T.ink })}>draft</td>
              </tr></tbody></table>
            </td></tr>
            <tr><td style={cell({ borderTop: LINE, height: 6, fontSize: 0, lineHeight: 0,
              background: `repeating-linear-gradient(90deg, ${T.ink} 0 1px, transparent 1px 16px)` })}>&nbsp;</td></tr>
            <tr><td style={cell({ paddingTop: 16 })}>
              <div style={mono("var(--pl-t-mono-lg)")}>{kicker}</div>
            </td></tr>
            {/* the card */}
            <tr><td style={cell({ paddingTop: 12 })}>
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0"
                style={{ borderCollapse: "separate", background: T.card, border: LINE, borderRadius: "var(--pl-r-card)", boxShadow: "var(--pl-s5)" }}>
                <tbody><tr><td style={cell({ padding: "24px 24px 22px" })}>
                  <h1 style={{ margin: 0, fontFamily: T.serif, fontWeight: 400, fontSize: "var(--pl-t-card-xl)", lineHeight: 1.05, color: T.ink, overflowWrap: "anywhere" }}>
                    {title}<span style={{ color: T.clay }}>.</span>
                  </h1>
                  {lead ? <p style={{ margin: "12px 0 0", fontFamily: T.sans, fontSize: "var(--pl-t-body)", lineHeight: 1.55, color: T.soft }}>{lead}</p> : null}
                  {stats.length ? (
                    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ marginTop: 18, borderCollapse: "separate", border: LINE, borderRadius: "var(--pl-r-small)" }}>
                      <tbody><tr>
                        {stats.map((c, i) => (
                          <td key={c.label} valign="top" style={cell({ padding: "10px 12px", borderLeft: i ? LINE : "none" })}>
                            <div style={{ fontFamily: T.serif, fontSize: "var(--pl-t-card)", lineHeight: 1, color: c.tone === "lit" ? T.lit : T.ink }}>{c.value == null ? "—" : Number(c.value).toLocaleString("en-US")}</div>
                            <div style={{ ...mono(), color: c.tone === "lit" ? T.lit : T.muted, marginTop: 6 }}>{c.label}</div>
                          </td>
                        ))}
                      </tr></tbody>
                    </table>
                  ) : null}
                  {children ? <div style={{ marginTop: 18 }}>{children}</div> : null}
                  {action ? <div style={{ marginTop: 22 }}><DispatchButton {...action}/></div> : null}
                  {smallPrint.length ? (
                    <div style={{ marginTop: 18, paddingTop: 12, borderTop: `2px dashed ${T.rule}` }}>
                      {smallPrint.map((p) => <p key={p} style={{ margin: "0 0 6px", fontFamily: T.sans, fontSize: "var(--pl-t-tiny)", lineHeight: 1.5, color: T.muted }}>{p}</p>)}
                    </div>
                  ) : null}
                </td></tr></tbody>
              </table>
            </td></tr>
            {/* the foot: why you get it, where to change it */}
            <tr><td style={cell({ padding: "16px 4px 0" })}>
              {foot.map((f) => <p key={f} style={{ margin: "0 0 6px", fontFamily: T.sans, fontSize: "var(--pl-t-tiny)", lineHeight: 1.5, color: T.muted }}>{f}</p>)}
            </td></tr>
          </tbody>
        </table>
      </td></tr></tbody>
    </table>
  );
}
