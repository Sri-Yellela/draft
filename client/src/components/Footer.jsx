// client/src/components/Footer.jsx
import { Link } from "react-router-dom";
import { useMonetisationEnabled } from "../lib/monetisation.jsx";
import { BRAND } from "../../../shared/brand.js";
import { StampLogo } from "./StampLogo.jsx";

export function Footer() {
  const monetisationEnabled = useMonetisationEnabled();
  return (
    <footer style={{
      background: "var(--c-surface-2)", borderTop: "1px solid var(--c-border)",
      padding: "48px 24px 32px", fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
          {/* Column 1 — Brand */}
          <div style={{ flex: "1 1 200px", minWidth: 180 }}>
            <div style={{ marginBottom: 10 }}>
              <StampLogo size="md" />
            </div>
            <p style={{ fontSize: 13, color: "var(--c-ink-muted)", lineHeight: 1.6, marginBottom: 16, maxWidth: 220 }}>
              Find the job. Fit the résumé. Apply.
            </p>
            <p style={{ fontSize: 11, color: "var(--c-ink-faint)" }}>
              © 2025 {BRAND}. All rights reserved.
            </p>
          </div>

          {/* Column 2 — Product */}
          <div style={{ flex: "1 1 120px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-ink-faint)",
                          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Product
            </div>
            {[
              { label: "Features",     to: "/features" },
              { label: "How It Works", to: "/how-it-works" },
              // D12: the extension is the import path; the site has to say where to get it.
              { label: "Browser extension", to: "/extension" },
              ...(monetisationEnabled ? [{ label: "Pricing", to: "/pricing" }] : []),
              { label: "FAQ",          to: "/faq" },
            ].map(({ label, to }) => (
              <Link key={to} to={to} style={{
                display: "block", fontSize: 13, color: "var(--c-ink-muted)",
                textDecoration: "none", marginBottom: 10,
              }}
              onMouseEnter={e => e.target.style.color = "var(--c-ink)"}
              onMouseLeave={e => e.target.style.color = "var(--c-ink-muted)"}>
                {label}
              </Link>
            ))}
          </div>

          {/* Column 3 — Company */}
          <div style={{ flex: "1 1 120px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-ink-faint)",
                          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Company
            </div>
            {[
              { label: "About",          to: "/about" },
              { label: "Contact",        to: "/contact" },
              { label: "Privacy Policy", to: "/privacy" },
              { label: "Terms of Service", to: "/terms" },
            ].map(({ label, to }) => (
              <Link key={to} to={to} style={{
                display: "block", fontSize: 13, color: "var(--c-ink-muted)",
                textDecoration: "none", marginBottom: 10,
              }}
              onMouseEnter={e => e.target.style.color = "var(--c-ink)"}
              onMouseLeave={e => e.target.style.color = "var(--c-ink-muted)"}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
