// ── <CompanyBubble> — THE BUBBLE STANDARD, built once (D113 UI, owner 10-31) ──────────────────────
//
// Owner: "use the same bubble as the draft square logo with rounded edges, this is a standard as to when
// bubbles should be used." Wherever a company or a job is shown as a bubble, it is THIS:
//   · a rounded SQUARE in the draft logo's shape (radius ≈ 27% of the side) — never a circle, never a
//     pill (D60);
//   · the company's mark inside it — CompanyLogo, the ONE logo component (D61): the real logo on its
//     paper tile, or the letter tile when there is none;
//   · a raised look: a top-light sheen, a soft drop shadow (the depth tokens) and an inner bottom shade;
//   · ONE status ring of the same shape carrying the state (styles/rings.js) — stage is shown by the ring
//     alone. Needs you, Ready for your review and Working on it pulse; reduced motion stops it.
//   · the two contrast themes swap the shadow for a solid outline (CompanyBubble.css).
// Draft House uses it now. ⚠ To adopt it next: the board's Draft button family (JobBubble's squares),
// The Table's company column (ApplicationHistory) and the Atlas's company nodes (pages/atlas).
// `vtTitle` makes it the landing place of a Draft's shared-element flight (lib/viewTransitions.js) — ONE per job.
import CompanyLogo from "./CompanyLogo.jsx";
import { RINGS, ringVar } from "../styles/rings.js";
import "./CompanyBubble.css";

// D149 (11-03): `row` and `tl` are tracker-options.html's two — the table's 36 px logo and the timeline's 30 px bubble.
const SIZES = { sm: 28, md: 44, row: 36, tl: 30 };

export default function CompanyBubble({ company, iconUrl, ring = null, size = "md", selected = false, dim = false,
                                        label, onClick, expanded, dataKey, title, vtTitle }) {
  const px = SIZES[size] || SIZES.md;
  const r = RINGS[ring] || null;
  const name = label || [company, r?.label].filter(Boolean).join(", ");
  const Tag = onClick ? "button" : "span";
  return (
    <Tag className="cb" data-company-bubble="" data-ring={ring || undefined} data-size={size}
      data-pulse={r?.pulse ? "true" : undefined} data-selected={selected ? "true" : undefined}
      data-dim={dim ? "true" : undefined} data-key={dataKey}
      data-vt-title={vtTitle || undefined}
      style={{ "--cb-size": `${px}px`, "--cb-ring": ringVar(ring) }}
      {...(onClick ? { type: "button", onClick, "aria-label": name, "aria-expanded": expanded, title: title || name }
                   : { role: "img", "aria-label": name })}>
      <span className="cb__face" aria-hidden="true">
        <CompanyLogo company={company} iconUrl={iconUrl} size={px} radius={Math.round(px * 0.27)} />
      </span>
      {r && <span className="cb__ring" aria-hidden="true" />}
    </Tag>
  );
}
