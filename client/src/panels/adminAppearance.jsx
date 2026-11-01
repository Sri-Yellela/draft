// ⭐ D133 · Admin → System → Appearance — the "Studio" theme (the admin sketch's look, docs/sketches/draft admin — testers.html)
// applied per SURFACE. Owner 11-01: "have it as a wrapper theme and be able to apply it to the admin or the site when we
// want". Two choices: (1) the Admin pages' own look on this browser — any registry theme or pair, or "follow the app"
// (themes/index.js setAdminSurfaceTheme: one more flag in the same stored value, applied with a reload like every
// palette change); (2) whether users are offered Studio in Settings → Appearance (POST /api/admin/appearance; off by
// default). A theme is data in the registry — nothing here draws its own colours.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { THEME_LIST, ACTIVE_THEME, adminSurfaceTheme, setAdminSurfaceTheme } from "../themes/index.js";
import { Panel, row, quiet } from "./adminKit.jsx";

const PAIRS = [["studio", "Studio · follow the system"], ["system", "Paper / Charcoal · follow the system"], ["contrast", "Contrast · follow the system"]];

export function AppearanceTab() {
  const mine = adminSurfaceTheme();
  const [users, setUsers] = useState(null);
  const [said, setSaid] = useState("");
  useEffect(() => { api("/api/admin/appearance").then((r) => setUsers(!!r.studioForUsers)).catch((e) => setSaid(e.message)); }, []);
  const offer = async (on) => {
    try { const r = await api("/api/admin/appearance", { method: "POST", body: JSON.stringify({ studioForUsers: on }) }); setUsers(!!r.studioForUsers);
      setSaid(r.studioForUsers ? "Users now see Studio in Settings → Appearance." : "Studio is no longer offered to users (anyone already on it keeps it)."); }
    catch (e) { setSaid(e.message); }
  };
  const choices = [[null, "Follow the app (the same look as the rest of draft)"], ...PAIRS, ...THEME_LIST.map((t) => [t.id, t.label])];
  return (
    <>
      <Panel data-admin-appearance="" title="The Admin pages' look"
        purpose={`On this browser only. Now: ${ACTIVE_THEME.label}${mine ? "" : " (following the app)"}. Studio is the look of the Testers sketch — a quiet ground, flat cards, blue bars, the orange kept for what matters. Choosing reloads the page.`}
        code="themes/index.js setAdminSurfaceTheme — the stored appearance's ;admin=<pref> flag">
        <div style={row}>
          {choices.map(([id, label]) => (
            <DepthButton key={String(id)} pressed={(mine || null) === id} primary={(mine || null) === id} onClick={() => setAdminSurfaceTheme(id)}>{label}</DepthButton>
          ))}
        </div>
      </Panel>
      <Panel data-admin-appearance-users="" title="Offer Studio to users"
        purpose="When on, Studio Light and Studio Dark appear in every user's Settings → Appearance beside the other themes. Off by default; nobody is switched to it."
        code="GET/POST /api/admin/appearance — app_settings studio_for_users · GET /api/config studioForUsers">
        <div style={row}>
          <DepthButton primary={users === true} pressed={users === true} disabled={users == null} onClick={() => offer(true)}>Offer it</DepthButton>
          <DepthButton pressed={users === false} disabled={users == null} onClick={() => offer(false)}>Don't offer it</DepthButton>
          <span style={quiet}>{users == null ? "Loading…" : users ? "Offered to users." : "Not offered to users."}</span>
        </div>
        {said && <p role="status" style={quiet}>{said}</p>}
      </Panel>
    </>
  );
}
