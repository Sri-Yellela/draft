// client/src/components/AdminLayout.jsx
// ⭐ D197 Wave 2 #21 · M5 (47m, lane outside) — the admin frame IN THE PLATE: tokens and components only (docs/revamp/admin.md,
// the mock client/src/pages/dev/platePages/Admin.jsx). The frame is a plate root (region IV — the rules and the selected
// tab's shadow), its bar the plate's: the /d tile, a mono ADMIN label, who is signed in, Sign Out as a paper plate button;
// the ruler under it. Every admin panel below draws inside the plate (panels/adminKit.jsx carries the tokens to all of them).
import PlateRoot from "../plate/PlateRoot.jsx";
import { PlateLogo, Ruler } from "../plate/Shell.jsx";
import { AdminPanel } from "../panels/AdminPanel.jsx";

export default function AdminLayout({ user, onLogout, children }) {
  return (
    <PlateRoot region="IV" data-plate-admin="" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* the bar — opaque (D83 39d: a glass bar let a scrolled panel show through), sticky */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "var(--pl-card)", flexShrink: 0 }}>
        <div style={{ height: 56, display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 16px)",
          // D131 (11-01): on a phone the gutter narrows and the "signed in as" line shrinks with an ellipsis
          padding: "0 clamp(12px, 3vw, 24px)", boxSizing: "border-box" }}>
          <a href="/admin" aria-label="Admin — home" style={{ display: "inline-flex", textDecoration: "none" }}><PlateLogo size="favicon"/></a>
          <span className="pl-label">ADMIN PANEL</span>
          <span style={{ flex: 1 }}/>
          <span className="pl-label pl-muted" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            LOGGED IN AS <strong style={{ color: "var(--pl-ink)" }}>{user?.username}</strong>
          </span>
          <button type="button" className="pl-btn" onClick={onLogout}>Sign Out</button>
        </div>
        <Ruler size="leg"/>
      </div>

      {/* Admin content */}
      <div style={{ flex: 1, minHeight: 0 }}>{children ?? <AdminPanel/>}</div>
    </PlateRoot>
  );
}
