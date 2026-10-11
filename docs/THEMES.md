# Themes — how colour works in draft, and how to add a theme in five steps

**D91.** A theme is **data, one file**. `client/src/themes/index.js` is the **only** place a theme is chosen. No component knows which theme is live: every colour reaches the screen through one object, `C`, which the registry resolves **once, at load**. Spec: `docs/THEME_MODULE.md`. Audit: `docs/THEME_AUDIT.md`. Sketch: `docs/themes-contrast.html`.

---

## How colour reaches the screen

```
themes/<id>.js  ──►  themes/index.js  resolve(preference, OS)  ──►  ACTIVE_THEME
                                                                     │
          ┌──────────────────────────────┬───────────────────────────┼───────────────────────────────┐
          ▼                              ▼                           ▼                               ▼
   C.TOKEN in code             theme.* (themes/cinematic.js,   var(--c-*) in CSS            index.html pre-paint
   (import { C } from          a name map onto C)              (installColorVars publishes  script (no flash; generated
   styles/colorTokens.js)                                       every token on <html>)       from the registry by Vite)
```

- **Resolved once.** A change of theme **reloads** the page. Inline styles, CSS variables and hex-alpha suffixes therefore always agree on one palette.
- **What `<html>` carries:**
  - `data-theme="<id>"` and `data-contrast="aa|aaa"`;
  - `data-cues="shape"` when shape cues are on;
  - `data-transparency="reduced"` under `prefers-reduced-transparency`;
  - an inline `color-scheme`.
- **What a theme never changes:** depth geometry, glass, the grain generator, radii, type, spacing, layout, copy. **Documents are never themed**: the résumé (its own HTML) and the cover letter (`DOC_PAPER` / `DOC_INK`, the same in every theme). Company logos sit on `LOGO_TILE`.
- **The preference** is stored in `localStorage['draft-theme']` and saved to the account (`PUT /api/settings/appearance` `{ theme, cues }`). The stored value is either a theme id or one of these:
  - `system`: Paper Light or Charcoal Dark, by the OS;
  - `contrast`: Contrast Light or Contrast Dark, by the OS;
  - `light` / `dark`: the older names for the Paper pair.

  A `;cues` suffix turns shape cues on.

## The contract (`test/d91ThemeModule.test.js`, `test/d91ContrastThemes.test.js`, `test/colorLiteralGuard.test.js`)

1. Every theme supplies **every** token key (key parity with Paper Light).
2. Every `CONTRAST_PAIRS` entry passes at the theme's **own** target. AA themes need 4.5 for text and 3 for large text and UI. AAA themes need **7** and **4.5**. The only pairs held at 4.5 in an AAA theme are the label on the orange fill and third-party sign-in buttons. Both are `AA_HELD` in `styles/colorTokens.js`, the test pins exactly eight such pairs, and `pairTarget()` is the one place that computes a pair's target.
3. An AAA theme's neutrals are **pure grey** (R = G = B). Its other colours are **only the brand set**: orange, amber, green, teal, blue, violet, red.
4. Contrast Light and Contrast Dark **invert**: canvas ↔ ink, border ↔ border.
5. Hex tokens are **6-digit**, because components append alpha suffixes (`${C.DANGER}44`).
6. **No colour literal** anywhere in `client/src` outside the token files (`test/colorLiteralGuard.test.js`).

## Add a theme in five steps

1. **Write the file.** Create `client/src/themes/<id>.js`, exporting `Object.freeze({ id, label, scheme: "light"|"dark", contrast: "aa"|"aaa", tokens, substrate })`.
   - Start by copying the closest theme.
   - For a high-contrast variant, add a block to `scripts/deriveThemeTokens.mjs` (`FIXED` for the values you choose, plus the rule for the rest) and run `node scripts/deriveThemeTokens.mjs --write`. Review the printed margins.
   - `substrate` holds the grain's numbers; the floor test proves them against your `CANVAS_SHADE`.
2. **Register it.** Add one `import` line and one entry in `THEME_LIST` in `client/src/themes/index.js`. The Settings → Appearance cards, the pre-paint script, the literal guard's exemption and the contract tests all read the registry, so nothing else needs listing.
3. **Prove it.** Run `npm test`. A missing key, a failing pair, a 3-digit hex or a stray tint fails here, and the failure names the token.
4. **Look at it.** Boot a throwaway server (WORKLOG D91 row) and run `node scripts/d91ThemeShots.mjs <base> <label> --prefs <id> --fast --scan --cues off,on`. Read `_scan.json`: no text below target, a visible focus on every stop, no page error.
5. **Ship nothing until a person has looked at the matrix.** It is in `../draft-screenshots/d91/<label>/`.

⛔ **Do not** branch on the theme in a component (`if (dark) …`), read `prefers-color-scheme` outside `themes/index.js`, or add a colour literal. If no token fits, add one to **every** theme file, together with its pair in `CONTRAST_PAIRS`.

## Shape cues (any theme)

`styles/cues.css` turns on under `data-cues="shape"`, and the shared components carry the hooks:
- `markStyle()` emits `--mark-glyph` / `--mark-edge`;
- `.mark--*` classes;
- `bandChipStyle()` emits `--band-*`;
- the pair's bar segments.

The cues are ✓ solid · ! dashed · ✕ double · i dotted. Bands are filled · hatched · outlined · dashed, and chart segments are solid · hatched · dotted. A new status surface uses `markStyle` / `.mark` and gets cues for free. A surface that draws its own colour needs a rule in `cues.css`. Cues never change a box's size: glyphs sit inside the existing padding.

## System preferences

| Preference | What happens |
|---|---|
| `prefers-color-scheme` | `system` / `contrast` pick the light or dark member of their pair |
| `prefers-contrast: more` | a one-line banner **offers** the Contrast pair; it never switches by itself |
| `prefers-reduced-transparency` | glass tokens resolve to their opaque composite and `backdrop-filter` is off |
| `forced-colors: active` | every control, mark and depth box gets a real system-colour border (box-shadows are dropped by the mode) |
