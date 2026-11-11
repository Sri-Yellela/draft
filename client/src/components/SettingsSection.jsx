// A93 · THE SETTINGS SECTION — one card for every settings page. Account and Integrations each drew a
// private `Section` that was the same thing (a titled card with a subtitle and its contents) in two
// slightly different looks; this is the one, in the current language (glass, the display serif).
//   aside   an element on the title's right — Integrations' connection status
//   tone    "danger" for the destructive section (Account's delete)
import { glass } from "../styles/glass.js";
import { C } from "../styles/colorTokens.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const muted = { color: "var(--color-text-muted)", fontSize: ts(12), lineHeight: 1.5 };

export default function SettingsSection({ title, subtitle, aside = null, tone = null, children }) {
  return (
    <section data-settings-section="" style={{ ...glass({ radius: 14 }), padding: 18, display: "flex", flexDirection: "column", gap: 12,
      ...(tone === "danger" ? { border: `1px solid ${C.DANGER}55` } : {}) }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: ts(18),
            color: tone === "danger" ? C.DANGER : "var(--color-text)" }}>{title}</h2>
          {subtitle && <div style={{ ...muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
