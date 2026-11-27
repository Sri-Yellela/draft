// client/src/components/PolicyProse.jsx — the prose parts of draft's public documents: a section with its
// heading, paragraphs, lists, a sub-heading and emphasis. Moved out of PrivacyPage.jsx (A93: built once) when
// the connector's documentation page (/docs/claude, D86 §6) needed the same parts.
// ⭐ 47m (D197 · marketing.md 16i–16k, M5): the LOOK is the plate's (the two pages render inside PlateRoot — plate tokens,
// the serif heading on a ruled line, Inter Tight at the reading measure). The words are the pages' own and are unchanged.

// A93: a POLICY section heading — the document's own, not the settings card (SettingsSection).
export function PolicySection({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: "var(--pl-t-card)", fontWeight: 400, color: "var(--pl-ink)", lineHeight: 1.1,
        margin: "0 0 12px", paddingTop: 16,
        borderTop: "var(--pl-border-rule)",
        fontFamily: "var(--pl-serif)",
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
      fontSize: "var(--pl-t-body)", color: "var(--pl-ink-soft)",
      lineHeight: 1.7, margin: "0 0 12px",
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
      fontSize: "var(--pl-t-body)", color: "var(--pl-ink-soft)",
      lineHeight: 1.7, maxWidth: "64ch",
    }}>
      {children}
    </li>
  );
}

export function H3({ children }) {
  return (
    <h3 style={{
      fontSize: "var(--pl-t-ui-lg)", fontWeight: 800, color: "var(--pl-ink)",
      margin: "20px 0 8px",
    }}>
      {children}
    </h3>
  );
}

export function Strong({ children }) {
  return <strong style={{ fontWeight: 700, color: "var(--pl-ink)" }}>{children}</strong>;
}
