// ⭐ D196 P1 → D199 C5 + D200 Rule 3 (owner 11-25, 47h) · THE MARKET'S HERO — the `Market` board: ONE LINE OF HEADER (a mono
// kicker "THE MARKET · WEEK 48", the serif "Openings for you", one line of counts "11,247 fit your bearing · 5 new today",
// the two actions) beside THE POLITICAL MAP (plate/MarketMap.jsx). No 96–104 px title, no lead restating the page (D200
// Rule 3: a header earns its space); the stats box moved under the filters (C4).
// Nothing invented (R1 / R2): a count the board didn't answer with is left out of the line, never a 0.
import PlateRoot from "./PlateRoot.jsx";
import { Kickers } from "./Marks.jsx";
import { MarketMap } from "./MarketMap.jsx";
import { sectorRegion } from "./marketPlate.js";

// ⚠ kept for the old board's coordinates (the P1 survey plate, still in the gallery): where "you" sat per sector.
export const SECTOR_SPOTS = Object.freeze({ IV: [192, 166], VIII: [480, 120], VII: [470, 300], V: [270, 400], VI: [95, 370] });
const SECTOR_NAME = { IV: "Software engineering", VIII: "Data and AI", VII: "Project management", V: "Business and finance", VI: "Design" };

/** Pure: the four figures' cells — only the figures the board actually counted (the stats box's own list, MarketControls). */
export function marketCells({ fit, newToday, filed, strong } = {}) {
  return [
    Number.isFinite(fit) ? { label: "FIT YOUR BEARING", value: fit } : null,
    Number.isFinite(newToday) ? { label: "NEW TODAY", value: newToday } : null,
    Number.isFinite(filed) ? { label: "FILED H-1B", value: filed } : null,
    Number.isFinite(strong) ? { label: "STRONG FIT", value: strong } : null,
  ].filter(Boolean);
}

/** Pure: the old plate's spot and words for a sector name (unknown → IV, as the palette falls back). */
export function youOnPlate(sector) {
  const region = sectorRegion(sector);
  const spot = SECTOR_SPOTS[region] || SECTOR_SPOTS.IV;
  return { region, spot, name: sector ? SECTOR_NAME[region] || sector : null };
}

/** Pure: the header's one line — "11,247 fit your bearing · 5 new today"; a missing count is left out; null when none. */
export function heroLine({ fit, newToday } = {}) {
  const f = (n) => n.toLocaleString("en-US");
  const parts = [Number.isFinite(fit) ? `${f(fit)} fit your bearing` : null, Number.isFinite(newToday) ? `${f(newToday)} new today` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export default function MarketHero({ figures = {}, week = null, best = null, sectors = [], picked = null, you = null, onPick, onBest, onBearing, captionTail = null }) {
  const line = heroLine(figures);
  return (
    <PlateRoot className="pl-markethero" data-plate-market-hero="">
      <section className="pl-mk-hero" aria-labelledby="mk-title">
        <div className="pl-mk-hero__main" data-market-header="">
          <Kickers parts={["THE MARKET", week ? `WEEK ${week}` : null].filter(Boolean)}/>
          <h1 id="mk-title" className="pl-mk-hero__title">Openings for you</h1>
          {line ? <p className="pl-mk-hero__line" data-hero-line="">{line}</p> : null}
          <div className="pl-actions">
            {onBest ? <button type="button" className="pl-btn pl-btn--primary" onClick={onBest}>See your best match →</button> : null}
            {onBearing ? <button type="button" className="pl-btn pl-btn--secondary" onClick={onBearing}>Change the bearing</button> : null}
          </div>
        </div>
        <MarketMap sectors={sectors} picked={picked} figures={figures} you={you} best={best} onPick={onPick}
          caption={<><span className="pl-label">THE POLITICAL MAP{week ? ` · WEEK ${week}` : ""}{captionTail ? ` · ${captionTail}` : ""}</span>
            <span className="pl-label pl-muted">TAP A TERRITORY · + / − TO ZOOM · DRAG TO PAN</span></>}/>
      </section>
    </PlateRoot>
  );
}
