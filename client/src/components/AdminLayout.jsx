// client/src/components/AdminLayout.jsx
import { useTheme } from "../styles/theme.jsx";
import { AdminPanel } from "../panels/AdminPanel.jsx";
import { StampLogo } from "./StampLogo.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

export default function AdminLayout({ user, onLogout, children }) {
  const { theme } = useTheme();

  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:ts(13),
                  background:theme.bg, minHeight:"100vh", color:theme.text }}>
      {/* Header */}
      <div style={{
        // D83 (39d): opaque — the glass surface let a scrolled panel show through the sticky header.
        height:56, background:"var(--c-surface-solid)",
        borderBottom:`3px solid ${theme.accent}`,
        display:"flex", alignItems:"center",
        // D131 (11-01): on a phone the email + Sign Out ran 87 px past the screen on every admin page — the gutter
        // narrows and the "Logged in as" line shrinks with an ellipsis instead.
        padding:"0 clamp(12px, 3vw, 24px)", gap:"clamp(8px, 2vw, 16px)", flexShrink:0,
        position:"sticky", top:0, zIndex:100,
      }}>
        <StampLogo size="sm" />
        <span style={{ fontSize:ts(11), color:theme.textMuted,
                       borderLeft:`1px solid ${theme.border}`, paddingLeft:16,
                       fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>
          Admin Panel
        </span>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:ts(12), color:theme.textMuted, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          Logged in as{" "}
          <strong style={{ color:theme.text }}>{user?.username}</strong>
        </span>
        <button className="dbx-depth"
          onClick={onLogout}
          style={{
            background:"transparent", border:`1px solid ${theme.border}`,
            padding:"5px 16px", cursor:"pointer",
            fontSize:ts(12), color:theme.textMuted, fontWeight:600,
            fontFamily:"'DM Sans',system-ui", transition:"all 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = "var(--c-danger)";
            e.currentTarget.style.borderColor = "var(--c-danger)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = theme.textMuted;
            e.currentTarget.style.borderColor = theme.border;
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Admin content */}
      {children ?? <AdminPanel/>}
    </div>
  );
}
