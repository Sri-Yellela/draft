// ⭐ D196 F2 · the drawings that take data. A drawing is never re-imagined in code:
//   · CompassDial is the ported SurveyMatchDial (drawings/SurveyMatchDial.jsx, generated from the canvas) with its two
//     numbers made props — the same circle (r 58, 1.5 ink), the same ticks (64,10 → 64,20; lit 3 px green, the rest 1.5 ink),
//     the same needle (ink with its clay half) and hub. At 4 of 12 it draws the board's dial exactly
//     (test/d196Drawings… compares the two).
//   · RegionEmblem, IsometricTile and ElevationProfile are canvas v2 drawings (the Atlas pages). The export in the repo
//     holds only the v3 boards, so they are NOT drawn yet: each renders the "not yet" drawer naming what it waits for.
//     They are ported by scripts/d196PortDrawings.mjs the day the v2 boards are exported (WORKLOG D196, owner step).
import { plateState, Drawer } from "./PlateState.jsx";

/** The compass dial: one tick per item (lit = proven, green), the needle at lit / total of the way round. */
export function CompassDial({ lit = 0, total = 12, label, size = 128, ...s }) {
  const gate = plateState(s, { height: size, radius: "small", lines: 1, label: "Loading the dial" });
  if (gate) return gate;
  const n = Math.max(1, Math.round(total));
  const k = Math.min(n, Math.max(0, Math.round(lit)));
  const step = 360 / n;
  const needle = k * step;
  return (
    <svg role="img" aria-label={label || `Compass dial: ${k} of ${n}`} viewBox="0 0 128 128" width={size} height={size} style={{ flex: "0 0 auto" }}>
      <circle cx="64" cy="64" r="58" strokeWidth="1.5" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
      {Array.from({ length: n }, (_, i) => (
        <line key={i} x1="64" y1="10" x2="64" y2="20" strokeWidth={i < k ? "3" : "1.5"} transform={`rotate(${+(i * step).toFixed(4)} 64 64)`}
          style={{ stroke: i < k ? "var(--pl-lit)" : "var(--pl-ink)" }}/>
      ))}
      <g transform={`rotate(${+needle.toFixed(4)} 64 64)`}>
        <path d="M64 22 L69 64 L64 106 L59 64 Z" style={{ fill: "var(--pl-ink)" }}/>
        <path d="M64 22 L69 64 L59 64 Z" style={{ fill: "var(--pl-clay)" }}/>
      </g>
      <circle cx="64" cy="64" r="5" strokeWidth="1.5" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
    </svg>
  );
}

const AWAITING = "Drawn on the canvas's v2 boards, which the export in the repo doesn't hold yet. It is ported path for path once they're exported — never redrawn by hand.";

/** A region's 120 × 120 duotone emblem (kind: found, bits, tree, net, lock, code, world, mind). ⏸ awaiting the v2 export. */
export function RegionEmblem({ kind = "net", region = "IV", size = 120, ...s }) {
  const gate = plateState(s, { height: size, radius: "small", lines: 1 });
  if (gate) return gate;
  return <div data-region={region} data-kind={kind} style={{ maxWidth: 360 }}><Drawer text={`The ${kind} emblem (region ${region}). ${AWAITING}`}/></div>;
}

/** The isometric tile (a 2:1 diamond ground plate, hatched sides, a moving token). ⏸ awaiting the v2 export. */
export function IsometricTile(props) {
  const gate = plateState(props, { height: 240, radius: "plate" });
  if (gate) return gate;
  return <Drawer text={`The isometric tile. ${AWAITING}`}/>;
}

/** A place's elevation profile (hypsometric fill, hatched walked part, the flag). ⏸ awaiting the v2 export. */
export function ElevationProfile(props) {
  const gate = plateState(props, { height: 200, radius: "plate" });
  if (gate) return gate;
  return <Drawer text={`The elevation profile. ${AWAITING}`}/>;
}
