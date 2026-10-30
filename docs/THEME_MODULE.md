# D91 — Contrast Light / Contrast Dark, and a modular theme system

**Owner, 10-10:** *"Two plain themes — high-contrast black and white, invertible like dark and light, with the same depth and glass effects — only the colour coding changes; they can keep the Draft orange accent and the green and red markers. For the entire site. A separate module so applying new themes, and working with UI/UX, is modular and plug and play."*
**The sketch is the specification:** `docs/sketches/themes-contrast.html` *(path corrected 10-11, and again 10-30: sketches live in `docs/sketches/`)* (four themes, four views, a computed contrast table). ⛔ **Build to the file, not to this prose.**

---

## 1 · What changes and what does not
- **Changes:** colour tokens only. The **neutrals** (canvas, surfaces, text, borders) go to **pure black and white** — no cream, no warm charcoal. The **brand stays**: the logo orange, and green, red, amber and blue for indicators and fit bands — each **re-tuned** to the theme's contrast target.
- **Does not change:** depth, glass, the paper grain, radii, type, spacing, layout, copy. *Effects are a separate axis from colour — a theme can never break them.*
- **Documents are never themed.** The résumé preview, the exported PDF / DOCX, the cover letter and anything that represents a document an employer will read **stay black on white in every theme.** *(A test pins it.)*
- **Company logos** stay on their paper-white tile in every theme (D61).

---

## 2 · What exists today (audit, 10-10 — the agent re-measures in P0)
- `client/src/styles/colorTokens.js` — **`C_LIGHT`** (cream paper, orange, glass) and **`C_DARK`** (warm charcoal), ~90 named tokens each, **published once as `--c-*` CSS custom properties** (`installColorVars`), `data-theme` set on `<html>`. The header: *"dark mode later has to be a matter of RE-POINTING these names."*
- **`CONTRAST_PAIRS`** (every declared text-on-background pair) and **`FORBIDDEN_PAIRS`**, proved in **both** themes by `test/colorTokens.test.js`; **`test/colorLiteralGuard.test.js`** ratchets the colour literals still in components (887 measured 09-29; fewer now — **P0 reports the number**); `test/inkPairD32.test.js` pins the ink pair.
- `client/src/themes/index.js` — a registry with **one** theme (`cinematic`); `styles/theme.jsx` hard-codes `isDark = false`, stores `rm_theme_id` in localStorage, publishes `activeTheme.cssVars`.
- Depth and glass are tokens already: `DEPTH_REST / HOVER / PRESS / ACCENT`, `SHADOW_*`, `GLASS_*` (consumed through `styles/glass.js`), plus the paper-grain substrate (`GRAIN`, `SHEEN_TINT`, `PaperBackground`).
- ⚠ **A hex-with-alpha pattern is in use** (`${theme.border}44`) — valid only on a 6-digit hex; **every theme's hex tokens stay 6-digit.**
- ⚠ The extension has **generated** `tokens.css` / `tokens.js`; admin consoles and marketing pages may hold their own literals. **P0 inventories them.**

---

## 3 · The two themes — the representative token set (from the sketch)

*Names are the sketch's CSS variables; the site's key follows in the second column.* **The agent derives every remaining key** (§4).

| Sketch var | Site key | Contrast Light | Contrast Dark |
|---|---|---|---|
| canvas | `CANVAS` | `#FFFFFF` | `#000000` |
| shade *(worst-case substrate pixel)* | `CANVAS_SHADE` | `#EDEDED` | `#1A1A1A` |
| surf / surf2 / menu | `SURFACE` / `_2` / `_MENU` | `rgba(255,255,255,.72)` / `rgba(250,250,250,.86)` / `rgba(255,255,255,.98)` | `rgba(26,26,26,.72)` / `rgba(36,36,36,.84)` / `rgba(12,12,12,.98)` |
| solid | `SURFACE_SOLID` | `#FFFFFF` | `#121212` |
| hover / scrim / input | `HOVER` / `SCRIM` / `SURFACE_INPUT` | `rgba(0,0,0,.07)` / `rgba(0,0,0,.60)` / `rgba(0,0,0,.04)` | `rgba(255,255,255,.12)` / `rgba(0,0,0,.78)` / `rgba(255,255,255,.08)` |
| spec / sheen / bodyTop / body / rim | `GLASS_SPECULAR` / `_SHEEN` / `_BODY_TOP` / `_BODY` / `_RIM` | `rgba(255,255,255,1)` / `.7` / `rgba(255,255,255,.88)` / `rgba(246,246,246,.60)` / `rgba(0,0,0,.26)` | `rgba(255,255,255,.50)` / `.09` / `rgba(40,40,40,.80)` / `rgba(16,16,16,.58)` / `rgba(255,255,255,.32)` |
| ink / muted / faint | `INK` / `_MUTED` / `_FAINT` | `#000000` / `#1A1A1A` / `#404040` | `#FFFFFF` / `#E6E6E6` / `#BDBDBD` |
| border / strong / control | `BORDER` / `_STRONG` / `_CONTROL` | `#C8C8C8` / `#8C8C8C` / `#404040` | `#404040` / `#737373` / `#BDBDBD` |
| accent / hover / on-accent | `ACCENT` / `_HOVER` / `ON_ACCENT` | `#FD4600` / `#FF6424` / `#000000` | `#FD4600` / `#FF6424` / `#000000` |
| accent-ink / quiet | `ACCENT_INK` / `_QUIET` | `#8A2A00` / `#FFE3D5` | `#FF9466` / `#3A1A0C` |
| success · quiet | `SUCCESS` · `_QUIET` | `#005A26` · `#E6F4EC` | `#46D683` · `#0C2A1A` |
| warning · quiet | `WARNING` · `_QUIET` | `#6B4500` · `#FBF0D9` | `#FFC044` · `#2C2208` |
| danger · quiet | `DANGER` · `_QUIET` | `#9E0B0B` · `#FDEEEE` | `#FF8080` · `#301010` |
| info · quiet | `INFO` · `_QUIET` | `#0B4F8A` · `#E4EEF9` | `#6DB8FF` · `#0E2236` |
| bands strong / moderate / weak (text · quiet) | `BAND_*` | = success / warning / danger | = success / warning / danger |
| band unknown · edge | `BAND_UNKNOWN` · `_EDGE` | `#1A1A1A` · `#404040` | `#E6E6E6` · `#BDBDBD` |
| depth rest / hover / accent | `DEPTH_REST` / `_HOVER` / `_ACCENT` | hairline + shadow: `0 0 0 1px rgba(0,0,0,.20), 0 4px 10px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.95)` · hover `…rgba(0,0,0,.32), 0 9px 20px rgba(0,0,0,.26)…` · accent `0 0 0 1px #A32E00, 0 5px 14px rgba(253,70,0,.45), inset 0 1px 0 rgba(255,255,255,.35)` | **light, not shadow**: `0 0 0 1px rgba(255,255,255,.16), 0 6px 16px rgba(255,255,255,.07), inset 0 1px 0 rgba(255,255,255,.30)` · hover `…rgba(255,255,255,.28), 0 10px 26px rgba(255,255,255,.12)…` · accent `0 0 0 1px #FF6424, 0 6px 20px rgba(253,70,0,.45), inset 0 1px 0 rgba(255,255,255,.35)` |
| glass shadow | `SHADOW_GLASS` | `0 0 0 1px rgba(0,0,0,.16), 0 14px 30px -10px rgba(0,0,0,.34)` | `0 0 0 1px rgba(255,255,255,.14), 0 18px 40px -14px rgba(255,255,255,.16)` |
| logo slash · word | `LOGO_SLASH` · `LOGO_WORD` | `#FD4600` · `#000000` | `#FD4600` · `#FD4600` *(all-orange, as today's dark)* |
| logo tile | `LOGO_TILE` | `#FFFFFF` | `#FFFFFF` |
| chart: yours / missing / generic | `PAIR_MATCHED` / `_MISSING` / `_GENERIC` | `#005A26` / `#9E0B0B` / `#5A5A5A` | `#46D683` / `#FF8080` / `#A8A8A8` |
| grain | `GRAIN` alpha | `.06`, neutral | `.10`, neutral |

**Targets:** text **7:1 (AAA)** · control edges, focus rings and chart segments **4.5:1** · the label on the orange fill **4.5:1** *(brand-fill exception, §9)*.
**The lowest text pair in the sketch is 7.13:1 (light) and 7.17:1 (dark)** — thin margins; **P3 keeps them, never loosens them.**

---

## 4 · Deriving the remaining tokens (P3)
The sketch fixes the representative set. **Every other key** — `VIOLET`, `TEAL` (+ quiet), `PROVIDER_*`, `PAIR_*`, `FH_*`, `PP_ATS_NUMBER`, `SHADOW_SM/MD/LG/XL`, `DEPTH_PRESS`, `LOGO_SHADOW`, `GRAIN`, `SHEEN_TINT`, the remaining ink-pair keys — is derived by **one rule**:
1. **Neutrals are pure grey (R = G = B).** *Translucent neutrals too.*
2. **Chromatic tokens are only the brand set** — orange, green, red, amber, blue, violet, teal — and **keep their hue**; **only lightness moves**, in the smallest step that reaches the target on **every** pair that token is declared in.
3. **Derive by a script, review by a person:** `scripts/deriveThemeTokens.mjs` reads the declared `CONTRAST_PAIRS`, nudges lightness, prints the result and the margin. *Nothing is hand-copied from the sketch beyond §3.*
4. **Third-party sign-in buttons keep their brand colours** (Google `#1A73E8`, LinkedIn `#0A66C2`, GitHub `#24292E`) — each already passes its own pair; **no change.**

---

## 5 · The module — a theme is data, one file
```
client/src/themes/
  index.js             registry + resolve(preference, system)   ← the ONLY place a theme is chosen
  paper-light.js       generated from today's C_LIGHT   { id, label, scheme:'light', contrast:'aa',  tokens, substrate }
  charcoal-dark.js     generated from today's C_DARK    { …scheme:'dark',  contrast:'aa'  }
  contrast-light.js    { …scheme:'light', contrast:'aaa' }
  contrast-dark.js     { …scheme:'dark',  contrast:'aaa' }
```
- **Adding a theme = one new file + one line in the registry.** *No component changes. A contributor guide (`docs/THEMES.md`) says how, in five steps.*
- **The contract (each enforced by a test):**
  1. **every theme supplies every token key** (key parity with `C_LIGHT`);
  2. **every `CONTRAST_PAIRS` entry passes at the theme's own target** (AA or AAA); `FORBIDDEN_PAIRS` still fail;
  3. **a contrast theme's neutral tokens are R = G = B**, and **its chromatic tokens are only the brand set**;
  4. **contrast-light and contrast-dark share a key set and their neutrals are inverses** (canvas ↔ ink, within tolerance);
  5. **no colour literal in any component** — the guard's ratchet goes to **zero**;
  6. **hex tokens are 6-digit.**
- **Publishing:** `installColorVars(theme.tokens)` sets `--c-*`; `<html>` gets `data-theme`, `data-contrast`, `data-cues`; `color-scheme` follows `scheme`.
- **Shape cues are a USER SETTING, not a theme.** `data-cues="shape"` turns on a **glyph + an edge style** on status marks (✓ solid · ! dashed · ✕ double · i dotted), a **fill style** on fit bands (filled · hatched · outlined · dashed) and **patterns** on chart segments (solid · hatch · dots) — for **any** theme. **Implemented once, in the shared mark / band / segment components** (`styles/mark.js`, `bandStyle.js`) — **not screen by screen.** *The P0 audit lists every place that draws its own status or band and bypasses them.* **Default off.**
- **Effects stay put:** `glass.js`, `zLayers.js`, the grain, radii and type take no part in a theme.

---

## 6 · How a person gets it
- **Settings → Appearance:** four **preview cards** (Paper Light · Charcoal Dark · Contrast Light · Contrast Dark) and the **Shape cues** switch; no dropdown.
- **Saved to the account** (an additive `appearance` setting; the mobile contract bumps additively) **and cached locally** — it follows the person across devices and **never flashes** on load (a tiny inline script sets the attributes before first paint).
- **Defaults respect the system:** `prefers-color-scheme` → Paper Light or Charcoal Dark · `prefers-contrast: more` **offers** the Contrast pair in a one-line banner (**never forces it**) · `prefers-reduced-transparency` → **glass becomes opaque** · **`forced-colors: active`** (Windows High Contrast) is honoured — **every control has a real border so nothing disappears.**
- **The extension** receives the chosen theme id with its token and builds its popup, options, badge and review overlay from **the same registry** (`extension/tokens.css` / `tokens.js` are generated from it — D63's pipeline).
- ⛔ **No new permission, no new data leaves the page** — the Web Store review is unaffected.

---

## 7 · Scope
**In:** marketing and pricing · sign-in and sign-up · the board · Draft House · The Table · the posting panel and ATS report · Settings and Help · **every Admin panel** · menus, modals, toasts, tooltips · the extension's popup, options, badge and review overlay · error and empty states.
**Out (for now):** Resume Master's own site, the Android app, emails, **documents (never themed)**.

---

## 8 · Phases — each reported before the next
- **P0 · AUDIT (read-only).** Measure: the colour-literal count and **every file** that holds one (by area: client, admin, marketing, extension) · every inline `theme.*` / `isDark` branch · every place that **draws its own status, band or chart colour** (bypassing the shared components) · every place **meaning rides on hue alone** · what `C_DARK` is used for today and **whether dark is reachable by a user** · the extension's token pipeline · tests that pin `C_LIGHT` / `C_DARK` · the `PaperBackground` and its colour inputs · third-party colour uses. **Deliver `docs/THEME_AUDIT.md`** with a size estimate per area.
- **P1 · THE MODULE, ZERO VISUAL CHANGE.** The registry contract, `paper-light.js` and `charcoal-dark.js` **generated from the existing objects**, `resolve()`, the no-flash script, the parity / contrast / literal tests. ⛔ **Pixel-identical:** Paper Light must be **byte-for-byte the same on every screenshot.** Existing tests all pass.
- **P2 · BURN THE LITERALS DOWN TO ZERO**, area by area (client → admin → marketing → extension), **each batch pixel-diffed against Paper Light.** The guard's ratchet falls with each.
- **P3 · THE CONTRAST TOKEN SETS** (§3–4), the derivation script, the contrast proof.
- **P4 · SHAPE CUES** in the shared components; the user setting; the bypass list from P0 fixed.
- **P5 · SETTINGS → APPEARANCE**, account persistence, system preferences, forced-colors, reduced transparency.
- **P6 · COVERAGE.** The **screenshot matrix** — every route × four themes × desktop and phone, **cues off and on** — with **no page error, no contrast failure** (an automated axe-style contrast scan), keyboard focus visible everywhere. The extension and every Admin panel included.
- **P7 · THE GUIDE** — `docs/THEMES.md`: add a theme in five steps.
⛔ **Nothing ships to production before P6's matrix is reviewed by the owner.**

---

## 9 · Tests — each red when its rule is removed
Key parity across all four themes · every declared pair at the theme's target · a contrast theme's neutrals are R = G = B and its chromatics are only the brand set · light and dark neutrals invert · hex tokens 6-digit · **the colour-literal count is zero** · Paper Light's output is **unchanged** (P1) · **documents (résumé preview, PDF, DOCX, cover letter) render black on white in every theme** · shape cues change **no layout** (no reflow) and add a glyph and edge style to every mark · a theme chosen on one device appears on the next · **no flash** (attributes set before first paint) · `forced-colors` screenshot has visible borders on every control · reduced transparency makes glass opaque · **the extension's generated tokens equal the registry's** · no new network request, storage key or permission.

---

## 10 · Risks
- **The literal burn-down is the real work** — 887 literals in 60 files at 09-29; the ratchet has fallen since, **P0 measures what is left.**
- **Thin contrast margins** (7.13 and 7.17) — a later "tweak" can break them; the test is the guard.
- **Orange and amber are close** — shape cues are the mitigation; offer them prominently.
- **Third-party and user content** (company logos, any image) does not follow a theme — logos sit on their paper tile.
- **Pixel-identical P1** is strict on purpose: it is the proof the module changed nothing.

---

## 11 · The owner decides *(defaults below; the agent starts P0 regardless)*
1. **Names** — *Contrast Light* and *Contrast Dark*. (Alternatives: High Contrast Light / Dark.)
2. **The brand fill** — keep `#FD4600` with a black label (**6.05:1** — better than today's 5.02:1 and AA, but **not AAA**) **or** lighten the fill to about `#FF6A1F` (7.3:1). *Default: keep the brand.*
3. **The mark in Contrast Dark** — all-orange (as today's dark) or a white word. *Default: all-orange.*
4. **Grain** — keep the subtle neutral grain or make the contrast themes flat. *Default: keep.*
5. **Amber and blue** — kept for warning and info. *Default: kept.*
6. **Offer the Contrast pair automatically under `prefers-contrast: more`?** *Default: offer, never force.*
