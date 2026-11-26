// ⭐ D196 F2 · the drawings that take data. A drawing is never re-imagined in code:
//   · CompassDial is the ported SurveyMatchDial (drawings/SurveyMatchDial.jsx, generated from the canvas) with its two
//     numbers made props — the same circle (r 58, 1.5 ink), the same ticks (64,10 → 64,20; lit 3 px green, the rest 1.5 ink),
//     the same needle (ink with its clay half) and hub. At 4 of 12 it draws the board's dial exactly
//     (test/d196Drawings… compares the two).
//   · RegionEmblem, IsometricTile and ElevationProfile are canvas v2 drawings (the Atlas pages), ported from the owner's
//     v2 export (docs/sketches/Atlas plate system v2.html, 47e): the emblem board's eight kinds, the Place page's tile (its
//     walk-through's seven live values are props, at rest by default) and its elevation profile. These wrap them with the
//     states every component has (R1); the drawings themselves are the generator's (drawings/*.jsx).
import { plateState } from "./PlateState.jsx";
import EmblemFound from "./drawings/EmblemFound.jsx";
import EmblemBits from "./drawings/EmblemBits.jsx";
import EmblemTree from "./drawings/EmblemTree.jsx";
import EmblemNet from "./drawings/EmblemNet.jsx";
import EmblemLock from "./drawings/EmblemLock.jsx";
import EmblemCode from "./drawings/EmblemCode.jsx";
import EmblemWorld from "./drawings/EmblemWorld.jsx";
import EmblemMind from "./drawings/EmblemMind.jsx";
import PlaceIsometricTile from "./drawings/PlaceIsometricTile.jsx";
import PlaceElevationProfile from "./drawings/PlaceElevationProfile.jsx";

/** The emblem board's `kind` order (the report: found, bits, tree, net, lock, code, world, mind). */
const EMBLEM_KINDS = Object.freeze({ found: EmblemFound, bits: EmblemBits, tree: EmblemTree, net: EmblemNet, lock: EmblemLock, code: EmblemCode, world: EmblemWorld, mind: EmblemMind });

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

/** A region's 120 × 120 duotone emblem (kind: found, bits, tree, net, lock, code, world, mind), at `size` px. `eight` shows
 *  all eight kinds side by side (the gallery). An unknown kind falls back to net (IV — the v3 boards' region). */
export function RegionEmblem({ kind = "net", region = "IV", size = 120, label, eight = false, ...s }) {
  const gate = plateState(s, { height: size, radius: "small", lines: 1 });
  if (gate) return gate;
  if (eight) return <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{Object.keys(EMBLEM_KINDS).map((k) => <RegionEmblem key={k} kind={k} size={56}/>)}</div>;
  const E = EMBLEM_KINDS[kind] || EMBLEM_KINDS.net;
  return <div data-region={region} data-kind={kind} style={{ width: size, height: size, lineHeight: 0, flex: "0 0 auto" }}><E {...(label ? { label } : null)}/></div>;
}

/** The isometric tile (Place · Webhooks): your server, Stripe, the road; the walk-through drives its seven live values
 *  (arcOp, beaconR, beaconFill, beaconOp, queueOp, serverLed, tallyOp — colours as plate tokens); at rest by default. */
export function IsometricTile({ label, state, emptyText, emptyAction, errorText, onRetry, ...live }) {
  const gate = plateState({ state, emptyText, emptyAction, errorText, onRetry }, { height: 240, radius: "plate" });
  if (gate) return gate;
  return <div style={{ aspectRatio: "600 / 300", width: "100%", maxWidth: 600 }}><PlaceIsometricTile {...(label ? { label } : null)} {...live}/></div>;
}

/** A place's elevation profile (Region IV's, from Place · Webhooks: lit foothills, you in the highlands, the summit last). */
export function ElevationProfile({ label, ...s }) {
  const gate = plateState(s, { height: 200, radius: "plate" });
  if (gate) return gate;
  return <div style={{ width: "100%" }}><PlaceElevationProfile {...(label ? { label } : null)}/></div>;
}

/**
 * ⭐ 47j (D197 Wave 2 · M3, lane w2-practice) · A DRAWING TO COME — the labelled placeholder plate a page mock shows where its
 * brief says "drawing needed". Never new art: the page's region tint, faint contours, a dashed border (the design doc's
 * "not yet"), the grid letters, and in mono caps what the drawing will show. `what` = the drawing's subject (it is also the
 * aria-label: "drawing to come: …"), `aspect` keeps the frame's shape so nothing shifts when the real drawing lands,
 * `note` = one line under it (where the drawing comes from — "from the design doc", "re-ink PlaceElevationProfile in VI").
 */
export function DrawingToCome({ what = "", aspect = "16 / 9", note, ...s }) {
  const gate = plateState(s, { height: 220, radius: "plate", label: "Loading the drawing" });
  if (gate) return gate;
  return (
    <div className="pl-tocome" role="img" aria-label={`drawing to come: ${what}`} style={{ "--pl-aspect": aspect }} data-drawing-to-come="">
      <span className="pl-tocome__grid" aria-hidden="true">{"ABCDEFG".split("").map((l) => <span key={l}>{l}</span>)}</span>
      <span className="pl-tocome__body" aria-hidden="true">
        <span className="pl-label">DRAWING TO COME</span>
        <span className="pl-tocome__what">{what}</span>
        {note ? <span className="pl-label pl-muted">{note}</span> : null}
      </span>
    </div>
  );
}
