// ⭐ D133 · Admin → System → Appearance — the "Studio" theme (the admin sketch's look, docs/sketches/draft admin — testers.html)
// applied per SURFACE. Owner 11-01: "have it as a wrapper theme and be able to apply it to the admin or the site when we
// want". Two choices: (1) the Admin pages' own look on this browser — any registry theme or pair, or "follow the app"
// (themes/index.js setAdminSurfaceTheme: one more flag in the same stored value, applied with a reload like every
// palette change); (2) whether users are offered Studio in Settings → Appearance (POST /api/admin/appearance; off by
// default). A theme is data in the registry — nothing here draws its own colours.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { ACTIVE_THEME, adminSurfaceTheme, setAdminSurfaceTheme } from "../themes/index.js";
import { Panel, row, quiet } from "./adminKit.jsx";

export function AppearanceTab() {
  const mine = adminSurfaceTheme();
  const [users, setUsers] = useState(null);
  const [dusk, setDusk] = useState(null);   // ⭐ D144: Dusk's own switch
  const [said, setSaid] = useState("");
  useEffect(() => { api("/api/admin/appearance").then((r) => { setUsers(!!r.studioForUsers); setDusk(!!r.duskForUsers); }).catch((e) => setSaid(e.message)); }, []);
  const offerDusk = async (on) => {
    try { const r = await api("/api/admin/appearance", { method: "POST", body: JSON.stringify({ duskForUsers: on }) }); setDusk(!!r.duskForUsers);
      setSaid(r.duskForUsers ? "Users now see Dusk in Settings → Appearance." : "Dusk is no longer offered to users (anyone already on it keeps it)."); }
    catch (e) { setSaid(e.message); }
  };
  const offer = async (on) => {
    try { const r = await api("/api/admin/appearance", { method: "POST", body: JSON.stringify({ studioForUsers: on }) }); setUsers(!!r.studioForUsers);
      setSaid(r.studioForUsers ? "Users now see Studio in Settings → Appearance." : "Studio is no longer offered to users (anyone already on it keeps it)."); }
    catch (e) { setSaid(e.message); }
  };
  // ⭐ D197 #21 M5 (47m, agent's pick — owner may reverse; admin.md's unclear home (a), its recommendation): the plate
  // replaces Studio on Admin, so the Admin pages' own-look switch is STRUCK — Admin is a plate page and takes the app's
  // palette like every plate page. Nothing is lost: a browser that still holds an old Admin look is shown it once, with the
  // one way back (Follow the app); the two user offers below are unchanged.
  return (
    <>
      {mine ? (
        <Panel data-admin-appearance="" title="The Admin pages' look"
          purpose={`On this browser only, Admin still wears an old look of its own (${ACTIVE_THEME.label}). Admin is now drawn in the plate and follows the app's palette; the per-surface switch is retired. Choosing reloads the page.`}
          code="themes/index.js setAdminSurfaceTheme(null) — clears the stored appearance's ;admin=<pref> flag">
          <div style={row}>
            <DepthButton primary onClick={() => setAdminSurfaceTheme(null)}>Follow the app (the same look as the rest of draft)</DepthButton>
          </div>
        </Panel>
      ) : null}
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
      <Panel data-admin-appearance-dusk="" title="Offer Dusk to users"
        purpose="When on, Dusk Light and Dusk Dark appear in every user's Settings → Appearance. Dusk is warm charcoal with a peach accent, larger corners and the Inter Tight face. Off by default; nobody is switched to it."
        code="GET/POST /api/admin/appearance — app_settings dusk_for_users · GET /api/config duskForUsers">
        <div style={row}>
          <DepthButton primary={dusk === true} pressed={dusk === true} disabled={dusk == null} onClick={() => offerDusk(true)}>Offer it</DepthButton>
          <DepthButton pressed={dusk === false} disabled={dusk == null} onClick={() => offerDusk(false)}>Don't offer it</DepthButton>
          <span style={quiet}>{dusk == null ? "Loading…" : dusk ? "Offered to users." : "Not offered to users."}</span>
        </div>
      </Panel>
    </>
  );
}
