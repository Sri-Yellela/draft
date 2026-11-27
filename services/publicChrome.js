// ⭐ D197 Wave 2 #16 / #22 · M5 (47m, lane public) · THE PLATE CHROME FOR THE SERVER-RENDERED PUBLIC PAGES — a posting
// (/<company>/<id>), the landing pages (/jobs/role|tech|sponsor-h1b/…), the data-engineering roadmap and their 404s.
// docs/revamp/public.md §6 asked how the plate look reaches HTML strings (no React on the server): ⚠ agent's pick (owner may
// reverse) — option (b), hand-kept HTML in the plate's own class names and tokens, here, in one place:
//   · PLATE_STYLE — the plate tokens (paper, ink, clay, Region IV navy, the three type faces) and the few pieces these pages
//     wear: the public nav (the /draft wordmark with its clay slash, Jobs · Atlas · About · Blog, Sign in, Get started — the
//     approved mock `public-chrome`), the serif title, the mono kicker, ink-ruled cards with the plate's hard shadow, the
//     plate button (primary = the page's ONE clay point), stack chips, the stamp, the public footer;
//   · publicNavHtml / publicFooterHtml — the same items as the client's PublicNav and footer (components/PublicChrome.jsx,
//     components/Footer.jsx);
//   · offTheMapPage — Off the map (mock `off-the-map`) as a whole page: the status the caller passes (404 stays 404),
//     noindex, the edge of the known map (the approved Drawings sheet's drawing, path for path), one way back in clay and
//     the other roads.
// The class names the pages already wore (.wrap, header.site, .facts, .card, .mark, .cta, .closed, .small, .posting) keep
// their meaning — the pages' markup and every SEO part of their heads (JSON-LD, canonical, og, noindex) are unchanged.

/** The plate's colour tokens as the server pages use them (styles/plate.css's sketch palette; dark follows the system). */
export const PLATE_STYLE = `
:root{--pl-paper:#F4EFE9;--pl-paper-warm:#FBF8F4;--pl-card:#FFFFFF;--pl-ink:#1B1B1B;--pl-ink-soft:#3F3A36;--pl-muted:#55504C;--pl-rule:#E6DED8;
--pl-clay:#C2593A;--pl-clay-hover:#AD4C30;--pl-clay-tint:#FBEFEA;--pl-on-clay:#FFFFFF;--pl-region:#1F3A63;--pl-region-tint:#E9EEF4;--pl-shade:#1B1B1B;
--pl-serif:'Instrument Serif',Georgia,serif;--pl-sans:'Inter Tight',system-ui,-apple-system,'Segoe UI',sans-serif;--pl-mono:'JetBrains Mono',ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root{--pl-paper:#161513;--pl-paper-warm:#1D1B18;--pl-card:#211F1C;--pl-ink:#ECE6DE;--pl-ink-soft:#CFC7BD;--pl-muted:#A79F95;--pl-rule:#3A3631;
--pl-clay:#D9714F;--pl-clay-hover:#E58463;--pl-clay-tint:#2E1E18;--pl-on-clay:#161513;--pl-region:#9FB3CE;--pl-region-tint:#1B2430;--pl-shade:#000000}}
*{box-sizing:border-box}body{margin:0;background:var(--pl-paper);color:var(--pl-ink);font:16px/1.6 var(--pl-sans)}
a{color:var(--pl-ink);overflow-wrap:anywhere}
a:focus-visible,button:focus-visible{outline:2px solid var(--pl-clay);outline-offset:3px}
.wrap{max-width:min(1280px,100%);margin:0 auto;padding:24px 24px 24px}
.wrap>main{max-width:860px}
header.site{max-width:1280px;margin:0 auto;padding:14px 24px 0;display:flex;flex-wrap:wrap;align-items:center;gap:8px 6px}
header.site a.brand{color:var(--pl-ink);font-family:var(--pl-sans);font-weight:800;font-size:22px;text-decoration:none;letter-spacing:-.02em;margin-right:12px}
header.site a.brand b{color:var(--pl-clay)}
header.site nav{display:flex;flex-wrap:wrap;gap:2px}
header.site nav a{display:inline-flex;align-items:center;min-height:40px;padding:0 12px;border-radius:10px;color:var(--pl-ink);text-decoration:none;font-weight:700;font-size:14.5px}
header.site nav a:hover{background:var(--pl-paper-warm)}
header.site .end{margin-left:auto;display:flex;gap:8px}
.pl-ruler{max-width:1280px;margin:10px auto 0;height:12px;border-top:1.5px solid var(--pl-ink);background:repeating-linear-gradient(90deg,var(--pl-ink) 0 1.5px,transparent 1.5px 24px);background-size:24px 6px;background-repeat:repeat-x}
.btn,.cta{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:10px;border:1.5px solid var(--pl-ink);background:var(--pl-card);color:var(--pl-ink);font-weight:700;font-size:14.5px;text-decoration:none;box-shadow:3px 3px 0 var(--pl-shade)}
.cta,.btn.primary{background:var(--pl-clay);color:var(--pl-on-clay);font-weight:800;box-shadow:4px 4px 0 var(--pl-shade)}
.cta:hover,.btn.primary:hover{background:var(--pl-clay-hover)}
.btn.ink{background:var(--pl-ink);color:var(--pl-paper)}
.kicker{font-family:var(--pl-mono);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--pl-ink-soft);margin:0 0 10px}
h1{font-family:var(--pl-serif);font-weight:400;font-size:clamp(40px,7vw,82px);line-height:.95;letter-spacing:-.01em;margin:8px 0 14px;overflow-wrap:anywhere}
h1 .stop{color:var(--pl-clay)}
.facts{color:var(--pl-ink-soft);margin:0 0 16px;font-size:16px}
.card{background:var(--pl-card);border:1.5px solid var(--pl-ink);border-radius:20px;box-shadow:5px 5px 0 var(--pl-shade);padding:18px 20px;margin:22px 0}
.card h2{font-family:var(--pl-mono);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--pl-ink-soft);margin:0 0 12px}
.mark{display:inline-flex;align-items:center;min-height:30px;border:1.5px solid var(--pl-ink);border-radius:10px;padding:0 10px;margin:0 6px 6px 0;font-size:14px;font-weight:700;text-decoration:none;background:var(--pl-card)}
.closed{background:var(--pl-paper-warm);border-style:dashed;box-shadow:none}
.stamp{display:inline-block;transform:rotate(-6deg);border:3px double var(--pl-region);color:var(--pl-region);font-family:var(--pl-mono);font-weight:700;font-size:12px;letter-spacing:.08em;padding:3px 8px;border-radius:6px;text-transform:uppercase}
.small{font-size:13.5px;color:var(--pl-muted)}
.posting h3{font-family:var(--pl-serif);font-weight:400;font-size:24px;margin:20px 0 6px}
.posting{line-height:1.65}
footer.pl-foot{margin-top:72px;border-top:1.5px solid var(--pl-ink);background:var(--pl-paper-warm)}
footer.pl-foot .in{max-width:1280px;margin:0 auto;padding:32px 24px 24px;display:flex;flex-wrap:wrap;gap:28px 48px}
footer.pl-foot .brand{flex:1 1 220px;display:flex;flex-direction:column;gap:6px}
footer.pl-foot .brand b{font-size:22px;font-weight:800;letter-spacing:-.02em}
footer.pl-foot nav{flex:0 1 180px;display:flex;flex-direction:column;gap:6px}
footer.pl-foot nav span{font-family:var(--pl-mono);font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--pl-muted)}
footer.pl-foot nav a{color:var(--pl-ink-soft);text-decoration:none;font-size:14px}
footer.pl-foot nav a:hover{color:var(--pl-ink);text-decoration:underline}
footer.pl-foot .fine{max-width:1280px;margin:0 auto;padding:0 24px 24px;font-family:var(--pl-mono);font-size:10px;color:var(--pl-muted)}
.otm{display:flex;flex-wrap:wrap;gap:32px;align-items:center}
.otm .main{flex:999 1 420px;min-width:0}
.otm .plate{flex:1 1 320px;min-width:0;max-width:560px;border:1.5px solid var(--pl-ink);border-radius:22px;overflow:hidden;box-shadow:10px 10px 0 var(--pl-shade);background:var(--pl-paper-warm)}
.otm .plate svg{display:block;width:100%;height:auto}
.tickets{display:flex;flex-wrap:wrap;gap:20px;margin-top:22px}
.ticket{flex:1 1 260px;max-width:380px;display:flex;flex-direction:column;gap:6px;padding:16px 18px;border:1.5px solid var(--pl-ink);border-radius:20px;background:var(--pl-card);box-shadow:5px 5px 0 var(--pl-shade);text-decoration:none;color:var(--pl-ink)}
.ticket.clay{background:var(--pl-clay);color:var(--pl-on-clay)}
.ticket .k{font-family:var(--pl-mono);font-size:10px;font-weight:700;letter-spacing:.08em}
.ticket .t{font-family:var(--pl-serif);font-size:28px;line-height:1.05}
.ticket .go{border-top:2px dashed currentColor;padding-top:8px;margin-top:6px;font-weight:800}
.at-tick{animation:atTick 1.2s ease-in-out infinite}
@keyframes atTick{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.at-tick{animation:none}}
@media (max-width:640px){header.site nav{display:none}.wrap{padding:16px}header.site{padding:12px 16px 0}}
`;

/** The plate's type faces — the same three the client loads (Google Fonts, the one allowed stylesheet host). */
export const PLATE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600;700&display=swap">`;

/** The public nav: the wordmark → /, the public links, Sign in, Get started (ink when the page has its own clay point). */
export function publicNavHtml({ clay = true } = {}) {
  return `<header class="site pl-nav" data-public-nav=""><a class="brand" href="/" aria-label="draft — home"><b>/</b>draft</a>`
    + `<nav aria-label="Site"><a href="/jobs">Jobs</a><a href="/atlas">Atlas</a><a href="/about">About</a><a href="/blog">Blog</a></nav>`
    + `<span class="end"><a class="btn" href="/login" data-public-signin="">Sign in</a><a class="btn ${clay ? "primary" : "ink"}" href="/register" data-public-start="">Get started</a></span></header>`
    + `<div class="pl-ruler" aria-hidden="true"></div>`;
}

const FOOTER_GROUPS = [
  ["PRODUCT", [["Features", "/features"], ["How it works", "/how-it-works"], ["Browser extension", "/extension"], ["FAQ", "/faq"]]],
  ["COMPANY", [["About", "/about"], ["Contact", "/contact"], ["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"]]],
  ["EXPLORE", [["Open jobs", "/jobs"], ["Atlas", "/atlas"], ["Data engineering roadmap", "/learn/data-engineering-roadmap"], ["The 3-minute audit", "/audit"], ["Check a résumé", "/tools/ats"]]],
];
/** The public footer (components/Footer.jsx's items; Pricing is left out here — the server does not read the lever). */
export function publicFooterHtml({ year = new Date().getFullYear() } = {}) {
  return `<footer class="pl-foot" data-public-footer=""><div class="in"><div class="brand"><b>/draft</b><span class="small">Find the job. Fit the résumé. Apply.</span></div>`
    + FOOTER_GROUPS.map(([k, links]) => `<nav aria-label="${k[0]}${k.slice(1).toLowerCase()}"><span>${k}</span>${links.map(([l, h]) => `<a href="${h}">${l}</a>`).join("")}</nav>`).join("")
    + `</div><p class="fine">© ${year} draft. All rights reserved.</p></footer>`;
}

// The edge of the known map — the approved Drawings sheet's drawing (docs/sketches/final/project/DrawingsPublic.dc.html,
// drawing 19), path for path; the client's port is client/src/plate/drawings/OffTheMapEdge.jsx.
export const OFF_THE_MAP_SVG = `<svg role="img" aria-label="Contour lines stop at a dashed edge; beyond it, the words Here the survey ends and a clay marker with a pulsing beacon" viewBox="0 0 360 220" width="100%" style="display: block"><rect width="360" height="220" fill="#FBF8F4"></rect><path d="M0 200 C 50 190, 110 206, 190 188" fill="none" stroke="#1B1B1B" stroke-opacity="0.2" stroke-width="1.2"></path><path d="M0 176 C 50 164, 110 182, 190 163" fill="none" stroke="#1B1B1B" stroke-opacity="0.25" stroke-width="1.2"></path><path d="M0 152 C 50 138, 110 158, 190 138" fill="none" stroke="#1B1B1B" stroke-opacity="0.30000000000000004" stroke-width="1.2"></path><path d="M0 128 C 50 112, 110 134, 190 113" fill="none" stroke="#1B1B1B" stroke-opacity="0.35000000000000003" stroke-width="1.2"></path><path d="M0 104 C 50 86, 110 110, 190 88" fill="none" stroke="#1B1B1B" stroke-opacity="0.4" stroke-width="1.2"></path><path d="M0 80 C 50 60, 110 86, 190 63" fill="none" stroke="#1B1B1B" stroke-opacity="0.45" stroke-width="1.2"></path><path d="M0 56 C 50 34, 110 62, 190 38" fill="none" stroke="#1B1B1B" stroke-opacity="0.5" stroke-width="1.2"></path>
<path d="M196 10 C 186 60, 204 110, 192 160 S 198 200, 196 214" fill="none" stroke="#1B1B1B" stroke-width="2" stroke-dasharray="6 6"></path>
<text x="276" y="96" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="19" font-weight="400" font-style="italic" fill="#1B1B1B">Here the survey ends</text><g><circle cx="276" cy="140" r="7" fill="#C2593A" stroke="#1B1B1B" stroke-width="1.6"></circle><circle class="at-tick" cx="276" cy="140" r="13" fill="none" stroke="#C2593A" stroke-width="1.5"></circle></g>
<text x="18" y="26" text-anchor="start" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" letter-spacing="1"  fill="#1B1B1B">404 · NO SUCH PAGE</text></svg>`;

const escText = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const ticketHtml = ({ kicker, title, line, go, href }, clay = false) => `<a class="ticket${clay ? " clay" : ""}" href="${escText(href)}">`
  + `${kicker ? `<span class="k">${escText(kicker)}</span>` : ""}<span class="t">${escText(title)}</span>${line ? `<span>${escText(line)}</span>` : ""}${go ? `<span class="go">${escText(go)}</span>` : ""}</a>`;

/**
 * Off the map as a whole server page. `status` is the caller's and is returned untouched (a 404 stays a 404 — SEO); the page
 * is always noindex. `back` = the one way back (the clay ticket); `roads` = the other roads.
 * @returns {{ status: number, html: string }}
 */
export function offTheMapPage({ status = 404, docTitle = "Off the map", kicker = ["404"], title = "Off the map", lead = "", back, roads = [] } = {}) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escText(docTitle)} | draft</title><meta name="robots" content="noindex">${PLATE_FONTS}<style>${PLATE_STYLE}</style></head>
<body>${publicNavHtml({ clay: false })}<div class="wrap"><main data-off-the-map="" style="max-width:none">
<section class="otm" aria-labelledby="otm-title"><div class="main">
<p class="kicker">${kicker.map(escText).join(" · ")}</p>
<h1 id="otm-title">${escText(title)}<span class="stop">.</span></h1>
${lead ? `<p class="facts">${escText(lead)}</p>` : ""}
${back ? `<div class="tickets">${ticketHtml({ kicker: "THE ONE WAY BACK", ...back }, true)}</div>` : ""}
</div><div class="plate">${OFF_THE_MAP_SVG}</div></section>
${roads.length ? `<section class="tickets" aria-label="Other roads">${roads.map((r) => ticketHtml(r)).join("")}</section>` : ""}
</main></div>${publicFooterHtml()}</body></html>`;
  return { status, html };
}

/** The two other roads every signed-out Off-the-map page offers. */
export const OTHER_ROADS = Object.freeze([
  { kicker: "THE MARKET", title: "Open jobs", line: "Every job on draft, open to read.", go: "Browse →", href: "/jobs" },
  { kicker: "ATLAS · VOL. I", title: "Atlas", line: "The skills each role asks for, drawn as a map you walk.", go: "Open Atlas →", href: "/atlas" },
]);

// The data-engineering roadmap drawn across the terrain — the approved Drawings sheet's drawing 16, path for path (the
// client's port: client/src/plate/drawings/RoadmapRoute.jsx). The route sheet's hero plate (public.md §6).
export const ROADMAP_ROUTE_SVG = `<svg role="img" aria-label="The data-engineering roadmap as a route climbing across terrain from SQL in the lowlands to streaming at the summit" viewBox="0 0 360 220" width="100%" style="display: block"><rect width="360" height="220" fill="#FBF8F4"></rect><rect width="360" height="220" fill="#E9EEF4"></rect><path d="M0 220 C 90 200, 200 214, 360 150 L360 220 L0 220 Z" fill="#DCE4EE" stroke="#1B1B1B" stroke-opacity=".3"></path><path d="M0 190 C 90 164, 200 180, 360 120 L360 220 L0 220 Z" fill="#CDD8E7" stroke="#1B1B1B" stroke-opacity=".3"></path><path d="M0 160 C 90 128, 200 146, 360 90 L360 220 L0 220 Z" fill="#B9C8DC" stroke="#1B1B1B" stroke-opacity=".3"></path><path d="M0 130 C 90 92, 200 112, 360 60 L360 220 L0 220 Z" fill="#9FB3CE" stroke="#1B1B1B" stroke-opacity=".3"></path><path d="M0 100 C 90 56, 200 78, 360 30 L360 220 L0 220 Z" fill="#7F96B6" stroke="#1B1B1B" stroke-opacity=".3"></path>
<path d="M30 196 C 80 190, 90 150, 140 146 S 210 104, 250 96 S 300 50, 330 40" fill="none" stroke="#1B1B1B" stroke-width="10" stroke-linecap="round"></path><path d="M30 196 C 80 190, 90 150, 140 146 S 210 104, 250 96 S 300 50, 330 40" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"></path>
<circle cx="30" cy="196" r="9" fill="#C2593A" stroke="#1B1B1B" stroke-width="2"></circle><text x="30" y="180" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="15" font-weight="400"  fill="#1B1B1B">SQL</text><circle cx="140" cy="146" r="9" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="2"></circle><text x="140" y="130" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="15" font-weight="400"  fill="#1B1B1B">Python</text><circle cx="250" cy="96" r="9" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="2"></circle><text x="250" y="80" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="15" font-weight="400"  fill="#1B1B1B">warehouses</text><circle cx="330" cy="40" r="9" fill="#FFFFFF" stroke="#1B1B1B" stroke-width="2"></circle><text x="322" y="24" text-anchor="end" font-family="Instrument Serif, Georgia, serif" font-size="15" font-weight="400"  fill="#1B1B1B">streaming</text>
<text x="18" y="26" text-anchor="start" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" letter-spacing="1"  fill="#1B1B1B">ROADMAP · 4 LEGS · START HERE</text></svg>`;
