// ── The brand mark's sizes — ONE definition (D47, owner 10-07) ──────────────────────────────────────
//
// The mark's rendered height per size, read by StampLogo (the artwork) AND by the Full House sentence,
// which the owner asked to be "the same font as the draft logo and the same size". The mark is artwork
// (two masked images), so its "size" is its height; the sentence's font-size is that same number, from
// here, so the two cannot drift apart. A plain module (no image imports) so node tests can read it.
export const MARK_SIZES = Object.freeze({ mini: 18, sm: 24, md: 28, nav: 30, lg: 34 });   // nav: the app bar's (D10)

// The logo face — the heavy italic geometric sans of the /draft wordmark (Poppins 800 italic,
// self-hosted). Every surface that sets type "in the logo face" reads these three.
export const LOGO_FACE = Object.freeze({ family: "'Poppins', var(--font-body)", weight: "800", style: "italic" });
