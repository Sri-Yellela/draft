// ⭐ D93 · CUSTOMISE (/app/customise) — its own page, linked from the avatar menu. Appearance moved here from
// the Account page (the Theme and Accessibility cards), and every D92 recommendation AND its alternate is a
// choice, the recommendation the default (top bar: ghost tabs | one track; filter sentence: marked words |
// calm boxes). The old designs are gone and not offered. The sketch: docs/sketches/customise-page.html.
//
// ⭐ PLUG AND PLAY: the layout cards are DRAWN FROM THE REGISTRY (themes/layoutOptions.js) — a new option is one
// registry entry, its ids in shared/appearance.js and its styles under its attribute; this page does not change.
//
// Saving: a layout choice goes to the ACCOUNT at once (PUT /api/settings/appearance, merged server-side) and to
// this device, but changes only the PREVIEW until you leave — the page applies it to <html> on unmount. A theme
// or shape-cues choice reloads (the palette resolves once, at load). Reset restores how draft ships.
import { useEffect, useState } from "react";
import SettingsSection from "../components/SettingsSection.jsx";
import DepthButton from "../components/DepthButton.jsx";
import RadioCards from "../components/RadioCards.jsx";
import CustomisePreview from "../components/CustomisePreview.jsx";
import { ThemeSection, AccessibilitySection, saveAppearance } from "../components/AppearanceSettings.jsx";
import { LAYOUT_OPTIONS, layoutDefaults } from "../themes/layoutOptions.js";
import { ACTIVE_THEME, CUES, layout, setLayout, applyLayout } from "../themes/index.js";
import { api } from "../lib/api.js";
import "../components/Customise.css";

export default function CustomisePanel() {
  const [lay, setLay] = useState(() => layout());
  const [previewOpen, setPreviewOpen] = useState(true);

  // Leaving the page applies what was chosen here (the page itself never changed under the pointer).
  useEffect(() => () => applyLayout(layout()), []);

  const choose = (key, value) => {
    setLay((cur) => ({ ...cur, [key]: value }));
    setLayout({ [key]: value }, { apply: false });
    api("/api/settings/appearance", { method: "PUT", body: JSON.stringify({ [key]: value }) }).catch(() => {});
  };
  const reset = () => {
    setLayout(layoutDefaults(), { apply: false });
    saveAppearance({ pref: "system", cues: false, layout: layoutDefaults() });
  };
  const label = (o) => o.values.find((v) => v.id === lay[o.id])?.label.toLowerCase();

  return (
    <div className="cz" data-customise-page="">
      <div className="cz-head">
        <h1>Customise</h1>
        <p>How draft looks and is laid out for you — saved to your account, so it follows you to every device.</p>
      </div>
      <div className="cz-lay">
        <aside className="cz-pvcard" data-preview-open={previewOpen ? "true" : "false"}>
          <div className="cz-pvcard__head">
            <b>Live preview</b>
            <span className="cz-pvcard__sum">
              {ACTIVE_THEME.label} · {LAYOUT_OPTIONS.map((o) => `${o.label.toLowerCase()}: ${label(o)}`).join(" · ")}{CUES ? " · shape cues on" : ""}
            </span>
            <button type="button" className="cz-pvcard__toggle" aria-expanded={previewOpen} aria-controls="cz-preview"
              onClick={() => setPreviewOpen((o) => !o)}>{previewOpen ? "Hide" : "Show"}</button>
          </div>
          <div id="cz-preview" hidden={!previewOpen}>
            <CustomisePreview part="all" values={lay} />
            <p className="cz-note">Drawn with the same styles as the page. Choosing here changes only this preview until you leave — your choice is saved to your account at once.</p>
          </div>
        </aside>
        <div className="cz-col">
          <ThemeSection />
          <AccessibilitySection />
          {LAYOUT_OPTIONS.map((o) => (
            <SettingsSection key={o.id} title={o.label} subtitle={o.description}>
              <RadioCards label={o.label} name={o.id} value={lay[o.id]} onChange={(v) => choose(o.id, v)}
                items={o.values.map((v) => ({ id: v.id, label: v.label, description: v.description, tag: v.default ? "recommended" : null,
                  preview: <div className="cz-mini"><CustomisePreview part={o.id} values={{ ...lay, [o.id]: v.id }} /></div> }))} />
            </SettingsSection>
          ))}
          <SettingsSection title="Reset" subtitle="Back to how draft ships: follow your system's light / dark setting, shape cues off, and the recommended layout.">
            <div><DepthButton onClick={reset} data-customise-reset="">Reset to defaults</DepthButton></div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
