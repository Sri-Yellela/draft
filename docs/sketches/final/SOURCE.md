# The approved canvas, from its own sources (47h, 11-25)

**What this is:** the board sources of the one canvas the owner approved on 11-25 (*draft · the plate system — final
sketches*, https://claude.ai/artifact/H9cUn9GnRHUzjx2i6pqMkv), read from the artifact at **version `1795629220-5103`**.
`project/canvas.json` is the canvas index; each `project/<Board>.dc.html` is one board's whole source; `project/support.js`
is the canvas's runtime (`artifact-type/dc-runtime.js`, sha256 `c4929939…ea482`), which each board loads as `./support.js`.

**Why not the HTML export:** `docs/sketches/Platesystem Final sketch.html` (the owner's export) holds only the board that was
in view, the explainer storyboard (A244). These sources hold every board.

**Render one:** `node scripts/d196FinalCanvas.mjs serve 4321`, then open `http://127.0.0.1:4321/Market.dc.html` (a board
fetches itself, so `file://` does not work). The fonts come from Google Fonts (Inter Tight, Instrument Serif, JetBrains Mono).
`d196Regress` pairs with `source: "final"` use these.

**The boards (approved, `page: "final"`):** Shell · Market · Opening · Ledger · Survey · ATSCard · Home · Map · Gazetteer ·
YourSurvey · Library · Emblem · Maps · Explainer · Storyboard. **Retired (no page; never build from them):** Lesson ·
Shelves.

**Refresh after a canvas change:** read the artifact's `project/` files again into this folder (the Artifact tool's read with
`paths`, `out_dir` = `docs/sketches/final`), copy the runtime to `project/support.js`, update the version above, commit.
All data on the boards is example data; the person is fictional.
