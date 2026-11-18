// ── The /d mark, as TYPE — the job card's Draft button, the board's Pending chip, /extension ──────────
//
// D1 set the card's primary button as the mark itself: "/d" in the logo face (Poppins 800 italic,
// self-hosted — see main.jsx), on the orange. D6 puts the same mark on the nav tab, because the
// product's verb is draft and the nav said AUTO APPLY: two names for one action. (D18 took it OFF the
// tab again: no tab carries a symbol, and the /d beside the /draft logo read as one thing twice.) This is the ONE
// implementation both render — StampLogo's rule ("three copies of one mark is the mechanism a rename
// half-ships through") applies to the small mark too.
//
// Decorative: the word next to it or the button's aria-label carries the name, so
// a screen reader never hears "slash d". `textTransform: none` because the tab row is uppercase and
// "/D" is not the mark. Size and colour inherit from the host — the card sets 19px on the orange,
// the others set their own.
//
// ⭐ D167 (owner 11-06: "i want the draft option on the menu to come out such that raft comes out to me it whole
// smoothly"): `drawOut` sets the WHOLE wordmark once — "/d" then "raft" in its own span (data-draft-raft) — so the dock
// can uncover "raft" with clip-path while the mark slides (AppNav.css). The text is never re-set and never resized.
//
// ⭐ 46v 0c (owner 11-18: "change the font colorway of the draft on the menu to mimic the logo"): `logo` paints the mark in
// the logo's colourway — the slash in LOGO_SLASH, the letters in LOGO_WORD (theme tokens, so each theme's logo rule holds:
// the dark themes' word is the orange too). Without it the mark inherits its host's colour as before (the card's button).
export function DraftMark({ style, drawOut = false, logo = false }) {
  const slash = logo ? <span data-draft-slash="" style={{ color: "var(--c-logo-slash)" }}>/</span> : "/";
  return (
    <span aria-hidden="true" data-draft-mark="" {...(drawOut ? { "data-draft-drawout": "" } : null)} {...(logo ? { "data-draft-logo": "" } : null)}
      style={{ fontFamily: "'Poppins', var(--font-body)", fontStyle: "italic", fontWeight: 800,
               letterSpacing: "-.02em", textTransform: "none", lineHeight: 1, ...(logo ? { color: "var(--c-logo-word)" } : null), ...style }}>
      {slash}d{drawOut && <span data-draft-raft="">raft</span>}
    </span>
  );
}
