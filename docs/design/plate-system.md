# Atlas design report: the plate system

Nov 23, 2026 · @Sri Balaji Yellela

> Source of truth: the Claude Doc https://claude.ai/artifact/CBbJQPUY8q4cdPc8qwoLSt (rev 14), saved here for D196 on 2026-11-24. If the doc changes, re-export it over this file. Worked examples: the canvas https://claude.ai/artifact/H9cUn9GnRHUzjx2i6pqMkv (pages v2 and v3; v1 is superseded styling).

## The idea

Every Atlas page is a plate in an atlas: a printed, hand-inked map you walk lesson by lesson. Design from that metaphor first, then from the content; never start from another product's layout.

- **The shell is field-neutral.** Atlas is general; computing is Volume I. Nothing in the chrome may assume CS. Later fields arrive as new volumes on the same map.
- **Reinvent, don't extract.** When a reference (WhiteBox, getcracked) has a good pattern, ask what it does for the learner, then rebuild that job in atlas terms. WhiteBox's Map / Graph / List became Terrain / Route / Index; its workspace circles became region plates; its floating cards became callout tags pinned to landmarks.
- **Proof over progress.** A square lights only when the learner has explained, matched or answered something. Never light it for opening a page.
- **Crisp and graphic, never flat.** Every page carries drawn art, ink linework and hard shadows. A page made only of cards and text is unfinished.
- **One live detail at a time.** Motion explains (a route drawing itself, a packet travelling) or signals (a beacon). It never decorates the whole screen.

## Vocabulary

Use these names in UI, copy and file names. A new feature gets an atlas name before it gets a layout.

| Atlas term | Means | Seen as |
| --- | --- | --- |
| Volume | A whole field (Vol. I Computing, Vol. II [next field]) | VOL. I pill in the nav; Volumes panel |
| Region | A module inside a volume (8 in Vol. I) | Region plate card with emblem |
| Plate (PL. I–VIII) | The printed page for a region; also its number | PL. IV chip, PLATE IV header |
| Place | One lesson, with a grid reference (D3) | Place page; landmark on the terrain |
| Leg | One section of a place's walk (5 per place) | Outlined numeral 01–05 and the trail rail |
| Terrain | Spatial view of a region: lowlands to summit | Draggable topographic map |
| Route / the IV Line | Ordered view of a region as a transit line | Line diagram with stops and interchanges |
| Index / gazetteer | Lookup view with grid references | Searchable table |
| Stage | Elevation band: Start, Build, Deepen, Master | Lowlands, Foothills, Highlands, Summit |
| Waypoint | The next place to go | Perforated ticket |
| Interchange | A link into another region | ⇄ chip with that region's colour |
| Lit / squares | Proof that a check is done | Green squares; LIT stamp |
| Field note (FN-IV.1) | A short explainer, e.g. a harvested reel | Dark poster card in a region drawer |
| Primary source (IV.1 LAM) | A paper or original document | Catalogue card with call number |
| Your run | Days with at least one lit square | Seven-square chip in the nav |

## Color

Each page wears one region's palette, plus three fixed accents: clay for "you / next", green for "lit", ink for structure.

**Core tokens**

| Token | Hex | Use |
| --- | --- | --- |
| Paper | #F4EFE9 | Page ground, nav bar |
| Paper deep | #EFE8E1 | Alternate section bands (Home regions) |
| Paper warm | #FBF8F4 | Plate interiors, caption strips |
| Card | #FFFFFF | Cards, plates, inputs |
| Ink | #1B1B1B | Text, every border, every hard shadow |
| Ink soft | #3F3A36 | Body copy on paper |
| Muted | #55504C / #6F6964 | Secondary text, mono metadata |
| Rule | #E6DED8 / #E0D6CF | Hairlines inside cards |
| Clay | #C2593A (hover #AD4C30) | You are here, next waypoint, primary CTA accent |
| Clay text on tint | #8A3A22 on #FBEFEA | "UP NEXT" labels |
| Lit green | #3E6B5A | Lit squares, walked trails, success |
| Field-note poster | #111111 + #FACC15 | Only inside reel poster cards (the source's own look) |

**Region palettes** (colour = ink of the region, tint = its plate ground)

| Plate | Region | Colour | Tint | Ring / light |
| --- | --- | --- | --- | --- |
| I | Foundations | #C2593A | #FBEFEA | #F6E1D8 |
| II | [Part 2 name] | #4B3FA8 | #F0EEFA | #E6E3F6 |
| III | Algorithms | #B4532A | #FAEEE6 | #F5E2D6 |
| IV | Systems & networks | #1F3A63 | #EDF1F7 | #DFE6F0 |
| V | Security & money | #6A3E73 | #F4EDF5 | #EDE2EF |
| VI | Languages & media | #2F6B7A | #EAF3F5 | #DDEDF0 |
| VII | The physical world | #7A5A2A | #F5EFE5 | #EFE6D6 |
| VIII | Intelligence | #5A5F2E | #F1F2E8 | #E9EBDB |

**Hypsometric ramp (Region IV, light to deep):** #E9EEF4 → #DCE4EE → #CDD8E7 → #B9C8DC → #9FB3CE → #7F96B6 → #5D79A3 → #1F3A63 → #16294A → #0F1E36. Build the same 10-step ramp for any other region before designing its pages.

**Rules**

- A region page uses only its own ramp plus clay, green and ink. Borrowed colours from other regions appear only as chips that point there (interchanges, filters).
- Clay means "you" or "next", never decoration. One clay focal point per screen.
- Green means proven. Never use it for buttons or hover.
- Stage colours on Route and Index: Start #3E6B5A, Build #1F3A63, Deepen #C2593A, Master #6A3E73.
- Text contrast at least 4.5:1, including 10–11 px mono labels; pale tints never carry text without ink.

## Typography

Three faces, three jobs: Instrument Serif speaks, Inter Tight explains, JetBrains Mono labels the map.

| Role | Face | Size / line-height | Weight, case | Where |
| --- | --- | --- | --- | --- |
| Place title | Instrument Serif | 96–104 px / 0.9 | 400, −0.02em | "Webhooks." with a clay full stop |
| Hero headline | Instrument Serif | 82 px / 0.95 | 400 | Home: "Find your way through" |
| Region title | Instrument Serif | 56 px / 0.95 | 400 | "Systems & networks" |
| Section title | Instrument Serif | 40–52 px / 1.0 | 400 | Leg titles, "Eight plates, one territory" |
| Card title | Instrument Serif | 25–30 px / 1.0–1.08 | 400 | Plate names, hazard names, tickets |
| Leg numeral | Instrument Serif | 88 px / 0.8 | outlined: transparent fill, 1.5 px region stroke | 01–05 |
| Rotating phrase | Instrument Serif italic | same as headline | on a coloured label tape | "computers.", "money." |
| Body | Inter Tight | 15–17 px / 1.5–1.6 | 400–500 | Paragraphs, descriptions |
| Lead | Inter Tight | 17–19 px / 1.5 | 500 | Under titles |
| UI and buttons | Inter Tight | 13.5–15 px | 600–800 | Nav, buttons, chips |
| Labels and metadata | JetBrains Mono | 9.5–12 px | 700, CAPS, letter-spacing 0.08–0.14em | PLATE IV, GRID D3, LEG 2 · ≈ 3 MIN |
| Code | JetBrains Mono | 14.5 px / 2.0–2.1 | 400 | Code plates |
| Map labels in SVG | Instrument Serif italic, letter-spacing 3–4 | 16–20 px | CAPS | LOWLANDS · START |

Rules: serif for anything a person would read aloud as a name; mono for anything a map would print (grid refs, counts, codes); never set body copy in mono or serif. Stats strips pair a 26–28 px serif number with a 10–10.5 px mono caps label.

Load: `Inter Tight 400–800`, `Instrument Serif` (regular + italic), `JetBrains Mono 400/600/700` from Google Fonts, with system fallbacks.

## Linework, depth and shape

The look is a printed map: one ink weight for every edge, hard offset shadows instead of blur, and survey marks in the margins.

- **Borders:** 1.5 px solid #1B1B1B on every card, plate, chip, input and button. Inner dividers 1 px #E6DED8. Use 2 px only for markers and pins. Dashed 1.5–2 px borders mean "not yet" (ahead, to design, empty drawer).
- **Hard shadows** (no blur, ink unless noted): 3 px for chips and small buttons, 4 px for cards and tags, 5–6 px for plates and section cards, 8 px for hero-level plates and open menus, 10 px for the main hero plate. A coloured shadow (clay or region colour) marks the one primary action or the title label.
- **Hover:** translate(−3 px, −3 px) and grow the shadow by 3 px over 0.25 s. Never lighten or blur.
- **Radii:** 6–8 px stamps and mono tags, 10–12 px buttons and inputs, 14 px chips and small cards, 18–22 px cards and plates, 24–26 px hero plates, 999 px only for markers, dots and run squares' cousins.
- **Map-scale ruler:** under every nav, a 12 px strip with a 1.5 px top rule and ticks every 16 px (5 px tall) and 80 px (12 px tall), drawn with two repeating linear gradients. Leg headers reuse a 6 px version along their bottom rule.
- **Grid references:** plate and terrain art carry A–G letters along the top and 1–5 down the side in 10 px mono, at 55–60% opacity, over a 0.5 px grid at 14–20% opacity.
- **Patterns:** 45° hatching (6–7 px pitch) for a second region or the walked part of a profile; 1 px dots on a 16–22 px grid behind interactive stages; ruled ledger lines (24–36 px pitch) for registers and catalogue cards.
- **Tickets:** perforations are two radial-gradient circles of paper colour (10–12 px) on the left and right edges at 60–62% height, plus a 2 px dashed divider.
- **Stamps:** mono 12–22 px caps, letter-spacing 0.14–0.2em, 2.5–4 px double border, rotated −10° to +8°.

## Illustration

Every section of a page gets one drawing that explains its idea; drawings are inline SVG in the region's duotone, inked like the cards.

**Rules for any drawing**

1. Sit it on a tinted plate (the region's lightest ramp step), with faint contour lines and, where there is ground, a ground strip: a filled band with a 1.4 px ink top edge.
2. Fill shapes from the region ramp; outline every shape in ink at 1.2–1.8 px with round joins. Use clay for the one thing the eye should land on, green for anything proven.
3. Prefer isometric 2:1 for objects and places. A box is three polygons: top (x, y−20) (x+40, y) (x, y+20) (x−40, y); left and right faces drop 36 px, left face one ramp step darker than the right.
4. Give each drawing exactly one live detail: a pulsing pad, a marching dash, a waving flag, a rotating hand, a blinking bit. Use SVG `<animate>` for radius, opacity and dash offset; CSS for sway and float.
5. Label inside the drawing with mono caps (YOUR SERVER, STRIPE, QUEUE) or italic serif map labels. Every drawing has `role="img"` and an `aria-label` that says what it shows.
6. Never use stock icons, emoji, gradient washes or soft shadows. Line icons in the nav are 16–18 px, 1.7–2 px stroke.

**The reusable pieces**

| Piece | What it is | Reuse it for |
| --- | --- | --- |
| Region emblem (Emblem component) | 120 × 120 duotone plate per region: chip, layers, tree, globe, lock and coins, code and waveform, contour summit, neural lattice | Region plates, volume panel, drawers, interchanges (pass `kind` and `size`) |
| Volume plate | Region tints, hatching, contours, grid letters, compass, scale bar, a walked route (green) and a route ahead (clay, marching) | The hero of any volume |
| Terrain | Concentric contour bands deepening toward a summit, stage labels along the bands, trails as curves | The main view of any region |
| Elevation profile | Filled profile with the hypsometric gradient, hatched walked part, markers, flag at the current place | The hero of any place |
| Isometric tile | A diamond ground plate with hatched sides, roads, buildings and a moving token | Any "how it works" walk-through |
| Signpost | A post with arrow boards: dead end vs summit | Any leg that corrects a common wrong answer |
| Hazard plate | A scene of what goes wrong (door, stopwatch, duplicate letters) | Any "what breaks in production" or pitfalls section |

## Motion

Motion either explains a step or marks where to look; default easing is cubic-bezier(.2,.8,.2,1).

| Name | Does | Timing | Used on |
| --- | --- | --- | --- |
| Draw-on | Walked route draws itself (stroke-dashoffset to 0) | 2.6–3.2 s, once, 0.2–0.3 s delay | Volume plate, elevation profile |
| March | Route ahead and live connections crawl (dashoffset −28) | 1.4 s linear, loop | Trails to the next place, call arcs |
| Beacon | Ring grows and fades round "you are here" or the next place | 2 s ease-out, loop | Plates, terrain, inset maps |
| Label flip | Rotating headline phrase flips up on its tape | 0.55 s, every 2.6 s | Home hero |
| Float | Callout tags bob 8 px | 5.5–6.5 s, staggered 0.8 s | Tags pinned on plates |
| Sway | Flags and signboards rock ±2–6° | 2.4–4 s, loop | Flags, signpost |
| Token travel | Packet moves between positions | 0.6 s on left/top | Walk-throughs |
| View in | New view slides up 10 px and fades in | 0.35 s | Tab switches |
| Menu drop | Panel drops 10 px and fades in | 0.25–0.28 s | Volumes, More |
| Stamp | Lands from 1.9× scale, rotated −10° | 0.3 s | LIT, EXPLAINED |
| Light | Square pops 0.4 → 1.25 → 1 | 0.45 s | Lit squares |
| Hover lift | Card translates −3 px with a bigger shadow | 0.25 s | Plates, notes, hazards |

Rules: one looping animation per component. Everything that loops or moves stops under `prefers-reduced-motion: reduce`; draw-on shows the finished line instead.

## Components

Build new pages from these parts before inventing new ones; when you must invent, give it an atlas name and the same linework.

| Component | Anatomy | Specs | States |
| --- | --- | --- | --- |
| Nav bar | Graticule logo + serif "Atlas"; VOL. I pill; main links with 16 px line icons; search "Make sense of…" with Ctrl K key; run chip; square avatar; ruler strip | Height 44 px targets; logo 34 px; pill = ink mono tag + bold name, 1.5 px border | Pill opens Volumes; open state gets white fill + 3 px shadow |
| Breadcrumb chain | VOL. I / PL. IV / D3 chips joined by mono slashes | Region chip filled in region colour; current place white with region shadow | Current chip is not a link |
| Volumes panel | Ink column of volume cards (active clay, next dashed "in preparation") + grid of region rows with 56 px emblems | 1.5 px border, 20 px radius, 8 px shadow | Drop-in 0.28 s |
| Region plate card | PLATE n header strip, tinted emblem area (132 px), serif name, lit squares, one-line blurb | 20 px radius, 4 px shadow, sections divided by 1.5 px rules | Hover lift; "BEGIN HERE" stamp on the first region |
| Plate hero | Framed SVG plate + figcaption strip in mono | Aspect ratio fixed (640/520), 10 px shadow, callout tags placed in % | Tags float; hidden below 980 px |
| Callout tag | Mono kicker (YOU ARE HERE / NEXT / AHEAD) + bold line + mini content | 150–190 px wide, 12 px radius, 4 px shadow | Float |
| Label tape | Rotating word on a coloured tape, italic serif, 6 px ink shadow, rotated −2° | Colour = the region the word belongs to | Flips every 2.6 s |
| Stats strip | Ink-bordered row of cells: serif number + mono caps label | 14 px radius, cells split by 1.5 px rules | Static |
| Binder tabs | Tabs sitting on the panel's top edge: icon + bold label + mono sub-label | Active tab white, bottom border removed; inactive #E8E0D8, 4 px lower | Switches the view below |
| Compass dial | Ring of ticks (one per place, lit in green), needle in ink and clay | 128 px | Needle angle = progress |
| Waypoint ticket | Clay ticket: NEXT WAYPOINT + grid ref, serif place name, dashed tear line, Set out button | Perforations, 22 px radius, 6 px shadow | Links to the place |
| Terrain | Draggable host (1400 × 720) inside a 660 px viewport; background SVG bands; landmark markers; labels; field card at top right | Markers 24–30 px circles (summit is a rounded square); labels are bordered chips | Lit green ✓, next clay + beacon + flag, open white, ahead dashed; selected = ink label + ring |
| Field card | Grid ref + stage strip, serif name, check squares, status line, sources, Open this place | 270 px, 5 px shadow | Updates on select |
| Route line | Snaking line in stage colours with 16 px ink casing; stops; ⇄ interchange chips | Stops 26 px, next 34 px | Lit stops ink with ✓ |
| Gazetteer | Ink header row in mono caps; rows of grid, place, elevation, checks, sources, status tag | Min width 760 px, scrolls sideways | Row click jumps to Terrain |
| Leg header | Outlined serif numeral + mono meta (LEG n · ≈ x MIN · SQUARE n) + serif title, on a ruled bottom edge | Numeral 88 px, stroke in region colour | Static |
| Trail rail | Bordered list of legs on a dashed vertical trail, numbered markers, summit as a square | 34 px markers | Done legs turn green with ✓ |
| Code plate | Deep navy plate, line numbers, file name, pins list beside the code | 14.5 px mono, 2.1 line-height | Pins open and highlight; all opened lights a square |
| Register | Ledger-ruled check with a dark side panel of big squares | Options as bordered tickets with a region-colour shadow | Right = green + LIT stamp; wrong = dashed, struck through |
| Field-note card | Dark 9:16 poster with kicker, duration, highlighted phrase, play + progress; label strip with FN code and views | 184 px wide, 16 px radius | Hover lift and −1° tilt |
| Catalogue card | Ruled card, call number tag, serif title, mono authors, punch hole | 6 px corners with one 18 px corner | EXPLAINED stamp when marked |
| Filter chips | Mono region tag (I, IV, VIII) in region colour + name + count | 42 px tall, 12 px radius | Active ink fill + clay shadow |
| Lit squares | 10–16 px squares, 2–3 px radius, 1–1.5 px ink border | Green = lit, white = not, clay = today | Pop when lit |

## Layout and responsiveness

One 1280 px column, 24 px side padding, everything built from wrapping flex rows so it folds to a phone without a separate design.

- **Container:** max-width 1280 px, padding 24 px. Heroes 30–44 px top padding; sections 48–64 px apart; leg sections 64 px apart.
- **Two-part rows:** main content `flex: 999 1 560–640px; min-width: 0`, side part `flex: 1 1 220–460px`. They stack on narrow screens. Sidebars cap at 250–270 px and are never sticky.
- **Grids:** `repeat(auto-fill, minmax(260–300px, 1fr))` for plates and cards, gap 18–22 px.
- **Plates keep their shape:** set `aspect-ratio` on the frame, draw the SVG at 100% × 100%, and place HTML overlays (tags, tokens, labels) in percentages of the viewBox.
- **Wide things scroll inside their own box:** route line, gazetteer, code, rails. The page itself never scrolls sideways.
- **Below 980 px:** hide decorative callout tags; keep the plate. Nav items wrap; the search keeps its place on the right of the wrapped row.
- **Rhythm inside cards:** 14–18 px padding, 8–10 px between label, title and body; headers and footers split off with a 1.5 px ink rule.

## Interaction, state and accessibility

Every page has one model the learner can operate, and every place has exactly three squares tied to things they prove.

- **Place states, everywhere the place appears:** lit (green fill, ✓), next (clay fill, beacon, flag), underway (white, solid border), ahead (paper fill, dashed border). Use the same four on the terrain, the route, the gazetteer and the trail rail.
- **Three squares per place:** one for walking the model to its last step, one for a matching or reading check (all pins opened), one for the register question. Each square shows in the nav chip, the trail rail and the register at once.
- **One operable model per page:** drag the terrain, switch the walk-through between two ways, open code pins, toggle EXPLAINED. Keep state on the page; a selection elsewhere (a gazetteer row) jumps to the model.
- **Dragging:** ignore clicks that end a drag of more than 4 px; offer a Recenter button; clamp the pan.
- **Feedback:** wrong answers go dashed and struck through with one plain sentence of why; right answers go green with the LIT stamp.
- **Accessibility:** real buttons and links only; targets at least 44 px; `aria-pressed`, `aria-current` and `aria-expanded` on toggles, steps and menus; `aria-live` on captions that change; every drawing labelled; colour is never the only signal (✓, dashes and words carry state too).

## Voice and copy

Write like a good field guide: plain, concrete, a little wry, never hype.

- **Sentence case** for titles and buttons; mono CAPS only for map-print metadata.
- **Speak in the metaphor where it helps, in plain words where it doesn't:** "Set out →", "Open this place", "Drag to explore · tap a place", "The same news, twice". Never force it into instructions people must follow exactly.
- **Titles name the idea, not the format:** "Two ways to hear news", not "Interactive diagram".
- **Lead with the point:** the first line under a title says what the learner will be able to do or explain.
- **Placeholders stay in brackets** ([Part 2 name], [Next field]) until the real name exists; never invent course names or stats.
- **Example data is labelled** as example on the canvas; real data (reels, views, durations) is kept exact.

## The page recipe

Follow these steps in order for any new or redesigned page; a page is done when every box is ticked.

- [ ] **Name it in the atlas.** What is this page: a volume, a region, a place, a collection, a register? Name its parts (legs, drawers, tickets) before drawing anything.
- [ ] **Pick its palette.** One region ramp (build the 10-step ramp if it's new), plus clay, green and ink. Write down where the single clay focal point goes.
- [ ] **Set the nav.** Logo, VOL pill, breadcrumb chain down to this page, run chip, avatar, ruler strip. Same on every page.
- [ ] **Draw the hero plate.** A framed SVG that shows where the learner is: a volume plate, terrain inset or elevation profile, with grid letters, a beacon and one draw-on line. Pair it with a big serif title, a mono kicker row and a stats strip.
- [ ] **Split the content into legs or sections,** each with a leg header (outlined numeral, mono meta, serif title) and one lead sentence.
- [ ] **Give every section one drawing** from the Illustration rules: a signpost for a wrong answer, an isometric tile for a process, hazard plates for pitfalls, a code plate with pins for code.
- [ ] **Build one operable model** the learner drives (switch, steps, drag, pins), with a caption that changes and an aria-live region.
- [ ] **Tie three squares to proof** and show them in the nav chip, the rail and the register.
- [ ] **End with onward tickets:** source (field note or primary source), next waypoint, one interchange to another region.
- [ ] **Check the finish:** 1.5 px ink everywhere, hard shadows on the right scale, no blur, no emoji, mono only for metadata, 44 px targets, reduced motion handled.

**Anti-patterns** (each one was a real round of feedback)

- Copying a reference's labels or layout ("Map / Graph / List", workspace circles as-is).
- Flat, simple cards with no drawing: "too simple and dull".
- Borrowing colours from other regions or from a reel's style inside a region page.
- A CS-only frame in the shell: interview-prep copy on Home, "Modules" for what is really a volume.
- Generic pills and soft UI: rounded grey chips, blurred shadows, gradient washes.
- More than one looping animation in a component, or motion that explains nothing.

## Reference: the three pages

Use these as the worked examples; open them on the [Atlas canvas](https://claude.ai/artifact/H9cUn9GnRHUzjx2i6pqMkv) next to this report.

|  | [Home](https://claude.ai/artifact/H9cUn9GnRHUzjx2i6pqMkv#artboard-Home) | [Region IV](https://claude.ai/artifact/H9cUn9GnRHUzjx2i6pqMkv#artboard-Map) | [Place · Webhooks](https://claude.ai/artifact/H9cUn9GnRHUzjx2i6pqMkv#artboard-Lesson) |
| --- | --- | --- | --- |
| Atlas level | Volume I | Region IV | Place D3 |
| Palette | All eight regions, paper ground | Region IV navy ramp | Region IV navy ramp |
| Clay focal point | "You are here" on the plate | Next-waypoint ticket | Flag on the elevation profile |
| Hero art | Volume plate with regions, contours, compass, scale bar, draw-on route, three callout tags | Region header with 150 px emblem and compass dial | Contoured plate behind a framed title, elevation profile |
| Title | 82 px serif + rotating label tape | 56 px serif | 104 px serif, clay full stop |
| Structure | Hero → eight region plates → footer | Header → binder tabs → Terrain / Route / Index | Hero → five legs on a trail rail → onward tickets |
| Operable model | Volumes panel, rotating phrase | Draggable terrain with field card; route line; searchable gazetteer | Two-way walk-through, code pins, register |
| Drawings | Emblems ×8, volume plate | Terrain bands and trails, route line | Signpost, isometric tile, three hazard plates, code plate, register |
| Squares | Run chip; squares per region | 4 of 15 lit on the dial | Three squares in nav, rail and register |

Shared parts live in the canvas too: the Region emblem component (`kind`: found, bits, tree, net, lock, code, world, mind) and the nav, which every page copies exactly.

---

## Addendum (2026-11-24, D196 — the owner's decisions after the v3 sketches)

These override the report above where they differ; everything else stands.

- **The shell (owner 11-24, final): the retained dock + an Atlas-style nav per area.** draft's current **dock** stays exactly as it is in items, order and badges (/d · Home · Atlas · Interview · Network · Profile · — · Ask draft), restyled: paper rail, 1.5 px ink border, 20 px radius, 4 px hard shadow, 84 px wide; active item = white tile, 1.5 px ink border, 3 px ink shadow; badges = ink mono tags. The **/d logo** stays: ink *d*, clay slash, white 1.5 px-bordered tile (44 px dock, 28 px favicon); signed out, the **/draft** wordmark. **Each area gets the Atlas nav** as one shared component: an area pill only where the area has a panel to open (the ledger and Atlas; **the market has none**, its location lives in the bearing) · views with 16 px line icons + More · search with Ctrl K · one chip · the 12 px ruler. Profile lives in the dock only (no avatar in an area nav). Phones: the dock becomes a bottom bar with the same items; a top bar holds the /d tile, search, and the area pill where there is one. Worked example: canvas v3, *The shell*. *(This replaces the "five text links" nav written earlier the same day.)*
- **New atlas names for draft's job-search pages:** The market (the jobs board) · Sector (a role family, wearing its nearest region palette; clay is never a sector colour) · The bearing (the sentence filter, as a cartouche) · Opening (a posting, as a perforated ticket) · The ledger (Home's applications) · Survey sheet (a company page). Worked examples: canvas page v3.
- **Not the spec:** canvas page v1 ("Lesson page — Webhooks (first draft)") is older styling, superseded by v2's Place · Webhooks.
- **A header that earns its space (owner 11-25, D200):** working pages (the market, the ledger, settings) get **one plain line** — serif 34–44 px, the thing in plain words (*"Openings for you"*) — a mono kicker for where / when, and at most one short sentence only if it tells the person something they'd otherwise miss; counts and controls do the rest. The 82–104 px serif titles stay for destinations (an Atlas place, a survey sheet, an opening sheet).
- **Every mark answers (D200):** a stamp, logo, chip or number that looks like information does something when tapped or focused (the H-1B stamp opens the filings; a company logo opens its technographics); a mark with nothing behind it says so.
- **Two maps (D200):** Atlas's map is the **physical** map (terrain, elevation = what you've proven); the market's map is the **political** map (hand-drawn territories, area = openings, hatching = the share that fits you, capitals = the companies hiring most). Only Atlas uses elevation; only the market uses borders. *Your survey* is the bridge between them.
