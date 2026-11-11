import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size
// client/src/components/PolicyProse.jsx — the prose parts of draft's public documents: a section with its
// heading, paragraphs, lists, a sub-heading and emphasis. Moved out of PrivacyPage.jsx (A93: built once) when
// the connector's documentation page (/docs/claude, D86 §6) needed the same parts. Styles unchanged.

// A93: a POLICY section heading — the document's own, not the settings card (SettingsSection).
export function PolicySection({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: 40 }}>
      <h2 style={{
        fontSize: ts(18), fontWeight: 400, color: "var(--color-text)",
        marginBottom: 12, paddingBottom: 8,
        borderBottom: "1px solid var(--color-border)",
        fontFamily: "var(--font-display)",
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function P({ children }) {
  return (
    <p style={{
      fontSize: ts(14), color: "var(--color-text-muted)",
      lineHeight: 1.8, margin: "0 0 12px",
      maxWidth: "66ch",
    }}>
      {children}
    </p>
  );
}

export function UL({ children }) {
  return (
    <ul style={{
      paddingLeft: 22, margin: "0 0 12px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      {children}
    </ul>
  );
}

export function LI({ children }) {
  return (
    <li style={{
      fontSize: ts(14), color: "var(--color-text-muted)",
      lineHeight: 1.75, maxWidth: "64ch",
    }}>
      {children}
    </li>
  );
}

export function H3({ children }) {
  return (
    <h3 style={{
      fontSize: ts(15), fontWeight: 700, color: "var(--color-text)",
      margin: "20px 0 8px",
    }}>
      {children}
    </h3>
  );
}

export function Strong({ children }) {
  return <strong style={{ fontWeight: 700, color: "var(--color-text)" }}>{children}</strong>;
}
