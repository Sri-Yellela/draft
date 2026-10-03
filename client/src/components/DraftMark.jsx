// ── The /d mark, as TYPE — the job card's Draft button and the top bar's Draft tab (D6) ──────────
//
// D1 set the card's primary button as the mark itself: "/d" in the logo face (Poppins 800 italic,
// self-hosted — see main.jsx), on the orange. D6 puts the same mark on the nav tab, because the
// product's verb is draft and the nav said AUTO APPLY: two names for one action. This is the ONE
// implementation both render — StampLogo's rule ("three copies of one mark is the mechanism a rename
// half-ships through") applies to the small mark too.
//
// Decorative: the word next to it (the tab's "Draft") or the button's aria-label carries the name, so
// a screen reader never hears "slash d". `textTransform: none` because the tab row is uppercase and
// "/D" is not the mark. Size and colour inherit from the host — the card sets 19px on the orange,
// the tab sets its own.
export function DraftMark({ style }) {
  return (
    <span aria-hidden="true" data-draft-mark=""
      style={{ fontFamily: "'Poppins', var(--font-body)", fontStyle: "italic", fontWeight: 800,
               letterSpacing: "-.02em", textTransform: "none", lineHeight: 1, ...style }}>
      /d
    </span>
  );
}
