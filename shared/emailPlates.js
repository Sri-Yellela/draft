// shared/emailPlates.js — ⭐ D197 Wave 2 #18 · M5 (47m, lane outside) · the email's token VALUES and its three HEADER PLATES.
// Pure (no I/O), shared by the server's dispatch template (services/dispatchHtml.js), the PNG build
// (scripts/buildEmailPlates.mjs) and the F5 fixture (client/src/plate/fixtures.jsx EmailPlateBoard — the plates against
// DrawingsPublic's Drawing 23, scripts/d196Regress.mjs email-plate-*).
// PLATE_EMAIL is client/src/styles/plate.css's literal values (mail clients read no custom property) — pinned by
// test/dispatchHtml47m.test.js, one map, so a token change reaches the email or fails the suite.

export const PLATE_EMAIL = Object.freeze({
  paper: "#F4EFE9", paperWarm: "#FBF8F4", card: "#FFFFFF", ink: "#1B1B1B", inkSoft: "#3F3A36", muted: "#55504C",
  rule: "#E6DED8", clay: "#C2593A", onClay: "#FFFFFF", clayText: "#8A3A22", clayTint: "#FBEFEA", lit: "#3E6B5A",
  r4: "#1F3A63", r4Tint: "#EDF1F7",
});
/** The plate.css custom property each PLATE_EMAIL key is the value of (the pin's map). */
export const PLATE_EMAIL_VARS = Object.freeze({
  paper: "--pl-paper", paperWarm: "--pl-paper-warm", card: "--pl-card", ink: "--pl-ink", inkSoft: "--pl-ink-soft", muted: "--pl-muted",
  rule: "--pl-rule", clay: "--pl-clay", onClay: "--pl-on-clay", clayText: "--pl-clay-text", clayTint: "--pl-clay-tint", lit: "--pl-lit",
  r4: "--pl-r4", r4Tint: "--pl-r4-tint",
});

/** The three header plates (Drawing 23), served from the client's public folder (/email/<file>). alt = what it shows. */
export const EMAIL_PLATES = Object.freeze({
  dispatch: Object.freeze({ file: "plate-dispatch.png", alt: "draft — a dispatch" }),
  "run-report": Object.freeze({ file: "plate-run-report.png", alt: "draft — the run report" }),
  digest: Object.freeze({ file: "plate-digest.png", alt: "draft — the digest" }),
});

/**
 * The plates' SVG sources. A sent plate is the same for every send of its kind, so by default it carries no per-send words:
 * a fixed serif line and the kind's mark (the count box holds the /d). `words` = { dispatch: { title, count },
 * "run-report": { title }, digest: { title } } draws Drawing 23's example words instead (the F5 fixture — like with like).
 * `faces` = { serif, mono } (the PNG build puts the rasteriser's installed faces first).
 */
export function plateSvgs({ words = {}, faces = {} } = {}) {
  const T = PLATE_EMAIL;
  const SERIF = faces.serif || "Instrument Serif, Georgia, serif";
  const MONO = faces.mono || "JetBrains Mono, monospace";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const contours = (stroke) => [130, 110, 90, 70, 50].map((y, i) =>
    `<path d="M0 ${y} C 140 ${y - 14 - 2 * i}, 300 ${y + 6}, 560 ${y - 26}" fill="none" stroke="${stroke}" stroke-opacity="${(0.18 + 0.05 * i).toFixed(2)}" stroke-width="1.2"/>`).join("");
  const tag = (w) => `<rect x="20" y="20" width="92" height="22" rx="5" fill="${T.ink}"/>`
    + `<text x="66" y="35" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="700" fill="${T.paper}">${w}</text>`;
  const title = (t) => `<text x="20" y="92" font-family="${SERIF}" font-size="34" fill="${T.ink}">${esc(t)}</text>`;
  const frame = (label, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 140" width="560" height="140" role="img" aria-label="${esc(label)}">`
    + `<rect width="560" height="140" fill="${T.paperWarm}"/>${inner}</svg>`;
  const d = words.dispatch || {}, r = words["run-report"] || {}, g = words.digest || {};
  return {
    dispatch: frame(EMAIL_PLATES.dispatch.alt, contours(T.r4) + tag("DISPATCH") + title(d.title || "A dispatch from draft")
      + `<rect x="440" y="56" width="96" height="44" rx="6" fill="${T.card}" stroke="${T.ink}" stroke-width="1.5"/>`
      + (d.count != null
        ? `<text x="488" y="84" text-anchor="middle" font-family="${SERIF}" font-size="22" fill="${T.ink}">${esc(d.count)}</text>`
        : `<text x="488" y="86" text-anchor="middle" font-family="${SERIF}" font-size="26" fill="${T.ink}"><tspan fill="${T.clay}">/</tspan>d</text>`)),
    "run-report": frame(EMAIL_PLATES["run-report"].alt, contours(T.lit) + tag("RUN REPORT") + title(r.title || "The run report")
      + `<g transform="translate(470 78) rotate(-8)"><rect x="-50" y="-22" width="100" height="44" rx="6" fill="none" stroke="${T.lit}" stroke-width="3"/>`
      + `<text y="6" text-anchor="middle" font-family="${MONO}" font-size="13" font-weight="700" fill="${T.lit}">SENT</text></g>`),
    digest: frame(EMAIL_PLATES.digest.alt, contours(T.clay) + tag("DIGEST") + title(g.title || "New openings that fit")
      + `<path d="M430 104 C 460 96, 470 70, 500 66 S 530 44, 540 40" fill="none" stroke="${T.ink}" stroke-width="6" stroke-linecap="round"/>`
      + `<circle cx="540" cy="40" r="7" fill="${T.clay}" stroke="${T.ink}" stroke-width="1.5"/>`),
  };
}

/** Drawing 23's example words — what the F5 fixture draws so the plate is compared with the board like with like. */
export const DRAWING_23_WORDS = Object.freeze({
  dispatch: { title: "4 new openings that fit", count: "4" }, "run-report": { title: "Sent 6, held 2" }, digest: { title: "Your week on the map" },
});
