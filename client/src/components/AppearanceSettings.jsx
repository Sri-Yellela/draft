// D91 P5 · APPEARANCE — four preview cards, "follow my system", and the shape-cues switch.
// ⭐ D93 · MOVED to the Customise page (panels/CustomisePanel.jsx, /app/customise): the Theme and Accessibility
// cards there are these two sections. Nothing of Appearance is left on the Account page.
//
// Every choice is saved to the ACCOUNT first (PUT /api/settings/appearance, so it follows the person to their
// other devices), then applied: the palette resolves ONCE at load (themes/index.js), so applying is a reload.
// The cards are drawn in each theme's OWN tokens (its canvas, surface, ink, the orange and two markers) — a
// preview, read from the registry, never a copy. ContrastOffer is the one-line banner shown when the system
// asks for more contrast (prefers-contrast: more): it OFFERS the Contrast pair and never forces it.
import { useState } from "react";
import SettingsSection from "./SettingsSection.jsx";
import DepthButton from "./DepthButton.jsx";
import RadioCards from "./RadioCards.jsx";
import { api } from "../lib/api.js";
import { useStudioForUsers } from "../lib/monetisation.jsx";
import { THEME_LIST, STUDIO_IDS, DUSK_IDS, ACTIVE_THEME, appearance, layout, setAppearance, pairPreference, CONTRAST_OFFER, dismissContrastOffer } from "../themes/index.js";

/** Save the whole appearance to the account (theme, cues and the layout options), then apply it (a reload). */
export function saveAppearance(next) {
  const lay = next.layout || layout();
  api("/api/settings/appearance", { method: "PUT", body: JSON.stringify({ theme: next.pref, cues: next.cues, ...lay }) })
    .catch(() => {}).finally(() => setAppearance(next));
}

function Preview({ t }) {
  const k = t.tokens;
  return (
    <div aria-hidden="true" style={{ background: k.CANVAS, borderRadius: 8, padding: 8, border: `1px solid ${k.BORDER_STRONG}` }}>
      <div style={{ background: k.SURFACE_SOLID, borderRadius: 6, padding: "7px 8px", boxShadow: k.DEPTH_REST, display: "grid", gap: 5 }}>
        <div style={{ height: 6, width: "70%", borderRadius: 3, background: k.INK }} />
        <div style={{ height: 5, width: "45%", borderRadius: 3, background: k.INK_FAINT }} />
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ width: 22, height: 10, borderRadius: 3, background: k.ACCENT }} />
          <span style={{ width: 10, height: 10, borderRadius: 3, borderLeft: `3px solid ${k.SUCCESS}`, background: k.SUCCESS_QUIET }} />
          <span style={{ width: 10, height: 10, borderRadius: 3, borderLeft: `3px solid ${k.DANGER}`, background: k.DANGER_QUIET }} />
        </div>
      </div>
    </div>
  );
}

/** The Theme card: the four themes (from the registry) and "follow my system". */
export function ThemeSection() {
  const cur = appearance();
  const [follow, setFollow] = useState(cur.pref === "system" || cur.pref === "contrast" || cur.pref === "studio" || cur.pref === "dusk" || cur.pref === "plain");
  // ⭐ D133: the Studio pair is offered once the owner turns it on (the app's one /api/config read); a person already
  // on Studio always sees it, so their own choice never disappears from the list.
  const studioOn = useStudioForUsers() || STUDIO_IDS.includes(ACTIVE_THEME.id);
  // ⭐ D144 → D149: Dusk is the DEFAULT now, so it is always offered (its admin switch no longer gates it).
  const duskOn = true;
  const choose = (id) => { const t = THEME_LIST.find((x) => x.id === id); saveAppearance({ pref: follow ? pairPreference(t) : t.id, cues: cur.cues }); };
  return (
    <SettingsSection title="Theme"
      subtitle="How draft looks on this account, on every device. Documents — your résumé and cover letter — always stay black on white.">
      <div data-appearance-cards="">
        <RadioCards label="Theme" name="theme" value={ACTIVE_THEME.id} onChange={choose}
          items={THEME_LIST.map((t) => ({ id: t.id, label: t.label, preview: <Preview t={t} />,
            description: `${t.contrast === "aaa" ? "High contrast · " : ""}${t.scheme === "dark" ? "Dark" : "Light"}${t.id === ACTIVE_THEME.id ? " · in use" : ""}` }))
            .filter((c) => studioOn || !STUDIO_IDS.includes(c.id))
            .filter((c) => duskOn || !DUSK_IDS.includes(c.id))} />
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--c-ink)" }}>
        <input type="checkbox" checked={follow} data-appearance-follow=""
          onChange={(e) => { const f = e.target.checked; setFollow(f);
            saveAppearance({ pref: f ? pairPreference(ACTIVE_THEME) : ACTIVE_THEME.id, cues: cur.cues }); }} />
        Follow my system's light / dark setting
      </label>
    </SettingsSection>
  );
}

/** The Accessibility card: shape cues. */
export function AccessibilitySection() {
  const cur = appearance();
  return (
    <SettingsSection title="Accessibility">
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--c-ink)" }}>
        <input type="checkbox" role="switch" checked={cur.cues} aria-checked={cur.cues} data-appearance-cues=""
          onChange={(e) => saveAppearance({ pref: cur.pref, cues: e.target.checked })} />
        <span>Shape cues<br />
          <span style={{ fontSize: 11, color: "var(--c-ink-faint)" }}>
            Adds a symbol and a line style to every status and fit band — ✓ solid, ! dashed, ✕ double, i dotted — so
            nothing depends on telling colours apart. Recommended if orange and amber, or red and green, look alike to you.
          </span>
        </span>
      </label>
    </SettingsSection>
  );
}

/** The one-line offer when the system asks for more contrast. Never switches by itself. */
export function ContrastOffer() {
  const [gone, setGone] = useState(false);
  if (!CONTRAST_OFFER || gone) return null;
  const cur = appearance();
  return (
    <div role="status" data-contrast-offer=""
      style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", flexWrap: "wrap", padding: "8px 16px",
        background: "var(--c-surface-solid)", color: "var(--c-ink)", borderBottom: "1px solid var(--c-border-strong)", fontSize: 13 }}>
      <span>Your system asks for more contrast. draft has high-contrast themes.</span>
      <DepthButton size="compact" primary onClick={() => saveAppearance({ pref: "contrast", cues: cur.cues })}>Use high contrast</DepthButton>
      <DepthButton size="compact" onClick={() => { dismissContrastOffer(); setGone(true); }}>Not now</DepthButton>
    </div>
  );
}
