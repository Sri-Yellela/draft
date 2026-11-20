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
import { NarrationSection } from "../components/NarrationSettings.jsx";   // ⭐ D194 (2)
import { LAYOUT_OPTIONS, layoutDefaults } from "../themes/layoutOptions.js";
import { ACTIVE_THEME, CUES, layout, setLayout, applyLayout } from "../themes/index.js";
import { api } from "../lib/api.js";
import { useDeckGeometry } from "../hooks/useDeckGeometry.js";
import DeckGeometryControl from "../components/DeckGeometryControl.jsx";
import { orientationFor } from "../lib/fanGeometry.js";
import { DECK_ORDERS, readDeckOrder, writeDeckOrder } from "../lib/deckOrder.js";
import { DECK_PRESET_NAMES, DECK_PRESET_COPY, DECK_SIZES, DECK_SIZE_STANDARD } from "../../../shared/deckGeometry.js";
import "../components/Customise.css";

// ⭐ D93 (owner, 10-12: "mirror the deck layout and order on Customise") — the Daily Deck's two choices, through the
// SAME stores the deck's own quick controls use: the layout preset with the account (hooks/useDeckGeometry.js,
// /api/settings/deck-geometry), the order on this browser (lib/deckOrder.js). The deck keeps its controls; a custom
// layout (the deck's three sliders) is shown as such, and choosing a preset here replaces it.
// ⭐ D152 (3) · PICKS PER DAY: how many cards the deck deals, with the account (PUT /api/settings/deck-size, migration 220;
// GET /api/draft/today reads it). Today's deal is already frozen, so the note says a new count starts tomorrow.
const DECK_SIZE_COPY = { 5: "A short list — the five best.", 10: "The deck as designed.", 15: "More to look at each day.", 20: "The most the deck deals." };
function DeckSection({ geometry, order, size, onLayout, onOrder, onGeometry, onSize }) {
  const custom = geometry?.preset === "custom";
  return (
    <SettingsSection title="Today's picks" subtitle="How many cards you're dealt each day, how they are fanned out, and the order they come in.">
      <div className="cz-sub">Cards a day</div>
      <RadioCards label="Cards a day" name="deck-size" value={String(size)} onChange={(id) => onSize(Number(id))}
        items={DECK_SIZES.map((n) => ({ id: String(n), label: `${n} a day`, description: DECK_SIZE_COPY[n], tag: n === DECK_SIZE_STANDARD ? "default" : null }))} />
      <p className="cz-note" data-deck-size-note="">Today's cards are already dealt — a new count starts with tomorrow's deal.</p>
      <div className="cz-sub">Layout</div>
      <RadioCards label="Deck layout" name="deck-layout" value={geometry?.preset || "standard"} onChange={onLayout}
        items={DECK_PRESET_NAMES.map((id) => ({ id, label: DECK_PRESET_COPY[id][0], description: DECK_PRESET_COPY[id][1], tag: id === "standard" ? "default" : null }))} />
      {custom && <p className="cz-note" data-deck-custom="">You have your own layout, set with Fine-tune the fan. Choosing one of these replaces it.</p>}
      {/* ⭐ D149: the deck's own layout control (its three sliders included) moved here when the deck became just the card. */}
      <div data-deck-fine-tune="">
        <DeckGeometryControl label="Fine-tune the fan" orientation={orientationFor(typeof window !== "undefined" ? window.innerWidth : 1280)}
          pref={geometry} onChoose={onGeometry} reduced={typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches} />
      </div>
      <div className="cz-sub">Order</div>
      <RadioCards label="Deck order" name="deck-order" value={order} onChange={onOrder}
        items={DECK_ORDERS.map((o) => ({ ...o, tag: o.id === "best" ? "default" : null }))} />
    </SettingsSection>
  );
}

export default function CustomisePanel() {
  const [lay, setLay] = useState(() => layout());
  const [previewOpen, setPreviewOpen] = useState(true);
  const [geometry, chooseGeometry] = useDeckGeometry();
  const [order, setOrder] = useState(readDeckOrder);
  const chooseOrder = (next) => { setOrder(next); writeDeckOrder(next); };
  const [size, setSize] = useState(DECK_SIZE_STANDARD);
  useEffect(() => { api("/api/settings/deck-size").then((r) => { if (DECK_SIZES.includes(r?.size)) setSize(r.size); }).catch(() => {}); }, []);
  const chooseSize = (next) => {
    setSize(next);
    return api("/api/settings/deck-size", { method: "PUT", body: JSON.stringify({ size: next }) }).catch(() => {});
  };
  const chooseLayout = (preset) => chooseGeometry({ preset, custom: geometry?.custom || {} });

  // Leaving the page applies what was chosen here (the page itself never changed under the pointer).
  useEffect(() => () => applyLayout(layout()), []);

  const choose = (key, value) => {
    setLay((cur) => ({ ...cur, [key]: value }));
    setLayout({ [key]: value }, { apply: false });
    api("/api/settings/appearance", { method: "PUT", body: JSON.stringify({ [key]: value }) }).catch(() => {});
  };
  const reset = async () => {
    // The deck's defaults too. Its layout is saved on a debounce that a reload would cut short, so it is written
    // to the account directly and awaited before saveAppearance reloads.
    chooseOrder("best"); chooseLayout("standard");   // (the hook also refreshes the device's cached layout)
    await api("/api/settings/deck-geometry", { method: "PUT", body: JSON.stringify({ preference: { preset: "standard", custom: geometry?.custom || {} } }) }).catch(() => {});
    await chooseSize(DECK_SIZE_STANDARD);
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
          <NarrationSection />
          {LAYOUT_OPTIONS.map((o) => (
            <SettingsSection key={o.id} title={o.label} subtitle={o.description}>
              <RadioCards label={o.label} name={o.id} value={lay[o.id]} onChange={(v) => choose(o.id, v)}
                items={o.values.map((v) => ({ id: v.id, label: v.label, description: v.description, tag: v.default ? "recommended" : null,
                  preview: <div className="cz-mini"><CustomisePreview part={o.id} values={{ ...lay, [o.id]: v.id }} /></div> }))} />
            </SettingsSection>
          ))}
          <DeckSection geometry={geometry} order={order} size={size} onLayout={chooseLayout} onOrder={chooseOrder} onGeometry={chooseGeometry} onSize={chooseSize} />
          <SettingsSection title="Reset" subtitle="Back to the defaults: your system's light or dark setting, shapes off, the recommended layout, and ten picks a day, best first.">
            <div><DepthButton onClick={reset} data-customise-reset="">Reset to defaults</DepthButton></div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
