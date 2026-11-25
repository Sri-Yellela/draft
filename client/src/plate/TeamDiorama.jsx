// ⭐ D199 C7 (47h, the card lane) · THE OPENING SHEET's hero plate — the survey sheet's team diorama (the canvas drawing
// SurveyTeamDiorama, ported by scripts/d196PortDrawings.mjs) with its four words made props, as CompassDial makes the dial's
// numbers props (plate/Drawings.jsx): the same plate, blocks, roads, beacon and compass, path for path. The words are the
// company's own: `team` = this opening's role (the beacon's block), `left` / `right` = the company's two other most-hiring
// roles (its open jobs by role), `place` = where the opening is. A word the page can't back is left blank — never invented.
// ⛔ Copied from the generated drawing ON PURPOSE (it is "do not edit"); the generator owns the original, this owns the words.
import { useId } from "react";
import { usePlateMotion } from "./motion.js";

export default function TeamDiorama({ team = "", left = "", right = "", place = "", company = "", label, className }) {
  const uid = useId().replace(/:/g, "");
  const motion = usePlateMotion();
  return (
    <svg role="img" aria-label={label || `${company || "The company"} drawn as an isometric plate of its teams: ${[left, team, right].filter(Boolean).join(", ")}. A beacon marks ${team}, where this opening sits`} viewBox="0 0 640 460" width="100%" height="100%" className={className} style={{"display":"block"}}>
      <defs>
        <pattern id={`${uid}svHatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" strokeWidth="1" opacity="0.3" style={{"stroke":"var(--pl-ink)"}}>
          </line>
        </pattern>
      </defs>
      <rect width="640" height="460" style={{"fill":"var(--pl-paper-warm)"}}>
      </rect>
      <g strokeWidth="0.5" opacity="0.14" style={{"stroke":"var(--pl-ink)"}}>
        <line x1="0" y1="0" x2="0" y2="460">
        </line>
        <line x1="20" y1="0" x2="20" y2="460">
        </line>
        <line x1="40" y1="0" x2="40" y2="460">
        </line>
        <line x1="60" y1="0" x2="60" y2="460">
        </line>
        <line x1="80" y1="0" x2="80" y2="460">
        </line>
        <line x1="100" y1="0" x2="100" y2="460">
        </line>
        <line x1="120" y1="0" x2="120" y2="460">
        </line>
        <line x1="140" y1="0" x2="140" y2="460">
        </line>
        <line x1="160" y1="0" x2="160" y2="460">
        </line>
        <line x1="180" y1="0" x2="180" y2="460">
        </line>
        <line x1="200" y1="0" x2="200" y2="460">
        </line>
        <line x1="220" y1="0" x2="220" y2="460">
        </line>
        <line x1="240" y1="0" x2="240" y2="460">
        </line>
        <line x1="260" y1="0" x2="260" y2="460">
        </line>
        <line x1="280" y1="0" x2="280" y2="460">
        </line>
        <line x1="300" y1="0" x2="300" y2="460">
        </line>
        <line x1="320" y1="0" x2="320" y2="460">
        </line>
        <line x1="340" y1="0" x2="340" y2="460">
        </line>
        <line x1="360" y1="0" x2="360" y2="460">
        </line>
        <line x1="380" y1="0" x2="380" y2="460">
        </line>
        <line x1="400" y1="0" x2="400" y2="460">
        </line>
        <line x1="420" y1="0" x2="420" y2="460">
        </line>
        <line x1="440" y1="0" x2="440" y2="460">
        </line>
        <line x1="460" y1="0" x2="460" y2="460">
        </line>
        <line x1="480" y1="0" x2="480" y2="460">
        </line>
        <line x1="500" y1="0" x2="500" y2="460">
        </line>
        <line x1="520" y1="0" x2="520" y2="460">
        </line>
        <line x1="540" y1="0" x2="540" y2="460">
        </line>
        <line x1="560" y1="0" x2="560" y2="460">
        </line>
        <line x1="580" y1="0" x2="580" y2="460">
        </line>
        <line x1="600" y1="0" x2="600" y2="460">
        </line>
        <line x1="620" y1="0" x2="620" y2="460">
        </line>
        <line x1="640" y1="0" x2="640" y2="460">
        </line>
        <line x1="0" y1="0" x2="640" y2="0">
        </line>
        <line x1="0" y1="20" x2="640" y2="20">
        </line>
        <line x1="0" y1="40" x2="640" y2="40">
        </line>
        <line x1="0" y1="60" x2="640" y2="60">
        </line>
        <line x1="0" y1="80" x2="640" y2="80">
        </line>
        <line x1="0" y1="100" x2="640" y2="100">
        </line>
        <line x1="0" y1="120" x2="640" y2="120">
        </line>
        <line x1="0" y1="140" x2="640" y2="140">
        </line>
        <line x1="0" y1="160" x2="640" y2="160">
        </line>
        <line x1="0" y1="180" x2="640" y2="180">
        </line>
        <line x1="0" y1="200" x2="640" y2="200">
        </line>
        <line x1="0" y1="220" x2="640" y2="220">
        </line>
        <line x1="0" y1="240" x2="640" y2="240">
        </line>
        <line x1="0" y1="260" x2="640" y2="260">
        </line>
        <line x1="0" y1="280" x2="640" y2="280">
        </line>
        <line x1="0" y1="300" x2="640" y2="300">
        </line>
        <line x1="0" y1="320" x2="640" y2="320">
        </line>
        <line x1="0" y1="340" x2="640" y2="340">
        </line>
        <line x1="0" y1="360" x2="640" y2="360">
        </line>
        <line x1="0" y1="380" x2="640" y2="380">
        </line>
        <line x1="0" y1="400" x2="640" y2="400">
        </line>
        <line x1="0" y1="420" x2="640" y2="420">
        </line>
        <line x1="0" y1="440" x2="640" y2="440">
        </line>
        <line x1="0" y1="460" x2="640" y2="460">
        </line>
      </g>
      <polygon points="320,110 560,230 320,350 80,230" strokeWidth="1.6" strokeLinejoin="round" style={{"fill":"var(--pl-iv-1)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <polygon points="80,230 320,350 320,372 80,252" fill={`url(#${uid}svHatch)`} strokeWidth="1.4" style={{"stroke":"var(--pl-ink)"}}>
      </polygon>
      <polygon points="560,230 320,350 320,372 560,252" strokeWidth="1.4" style={{"fill":"var(--pl-iv-3)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <path d="M200 170 L440 290 M440 170 L200 290" strokeWidth="10" style={{"stroke":"var(--pl-paper)"}}>
      </path>
      <path d="M200 170 L440 290 M440 170 L200 290" strokeWidth="1" strokeDasharray="6 6" opacity=".55" style={{"stroke":"var(--pl-ink)"}}>
      </path>
      <polygon points="230,170 270,190 230,210 190,190" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-iv-4)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <polygon points="190,190 230,210 230,274 190,254" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-iv-6)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <polygon points="270,190 230,210 230,274 270,254" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-iv-5)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <text x="230" y="300" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={{"fontFamily":"var(--pl-mono)","fill":"var(--pl-ink)"}}>
        {left}
      </text>
      <polygon points="410,170 450,190 410,210 370,190" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-iv-2)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <polygon points="370,190 410,210 410,254 370,234" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-iv-5)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <polygon points="450,190 410,210 410,254 450,234" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-iv-4)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <text x="410" y="280" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={{"fontFamily":"var(--pl-mono)","fill":"var(--pl-ink)"}}>
        {right}
      </text>
      <polygon points="320,230 360,250 320,270 280,250" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-card)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <polygon points="280,250 320,270 320,322 280,302" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-iv-3)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <polygon points="360,250 320,270 320,322 360,302" strokeWidth="1.5" strokeLinejoin="round" style={{"fill":"var(--pl-iv-1)","stroke":"var(--pl-ink)"}}>
      </polygon>
      <text x="320" y="348" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={{"fontFamily":"var(--pl-mono)","fill":"var(--pl-ink)"}}>
        {team}
      </text>
      <g transform="translate(320 224)">
        <circle r="10" fill="none" strokeWidth="2" style={{"stroke":"var(--pl-clay)"}}>
          {motion && (<>
          <animate attributeName="r" values="10;26" dur="2s" repeatCount="indefinite">
          </animate>
          </>)}
          {motion && (<>
          <animate attributeName="opacity" values="0.9;0" dur="2s" repeatCount="indefinite">
          </animate>
          </>)}
        </circle>
        <circle r="9" strokeWidth="2" style={{"fill":"var(--pl-clay)","stroke":"var(--pl-ink)"}}>
        </circle>
      </g>
      <g fontSize="10" opacity=".58" style={{"fontFamily":"var(--pl-mono)","fill":"var(--pl-ink)"}}>
        <text x="40" y="16">
          {"A"}
        </text>
        <text x="130" y="16">
          {"B"}
        </text>
        <text x="220" y="16">
          {"C"}
        </text>
        <text x="310" y="16">
          {"D"}
        </text>
        <text x="400" y="16">
          {"E"}
        </text>
        <text x="490" y="16">
          {"F"}
        </text>
        <text x="580" y="16">
          {"G"}
        </text>
      </g>
      <text x="24" y="430" fontStyle="italic" fontSize="16" letterSpacing="3" style={{"fontFamily":"var(--pl-serif)","fill":"var(--pl-ink)"}}>
        {place}
      </text>
      <g transform="translate(590 410)">
        <circle r="18" strokeWidth="1.4" style={{"fill":"var(--pl-card)","stroke":"var(--pl-ink)"}}>
        </circle>
        <path d="M0 -14 L4 0 L0 14 L-4 0 Z" style={{"fill":"var(--pl-ink)"}}>
        </path>
        <path d="M0 -14 L4 0 L-4 0 Z" style={{"fill":"var(--pl-clay)"}}>
        </path>
      </g>
    </svg>
  );
}
