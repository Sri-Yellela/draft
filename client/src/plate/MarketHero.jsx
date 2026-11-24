// ⭐ D196 P1 · THE MARKET'S HERO — the board's first section on real data: the kicker row, "The market.", the lead, the
// stats strip, the two actions, and the survey plate with the person marked in their sector.
// Nothing invented (R1 / R2): a figure the board has no count for is left out (never a 0 or a guess); the plate's best-match
// pin and route are drawn only when the page knows the best match (`best`); the YOU ARE HERE tag says only what the
// résumé placed (role, level) — no file name, no city the page wasn't given.
import PlateRoot from "./PlateRoot.jsx";
import { TitleBlock, PlateHero } from "./Plates.jsx";
import MarketSurveyPlate from "./drawings/MarketSurveyPlate.jsx";
import { sectorRegion } from "./marketPlate.js";

// Where "you" sit on the plate, per sector — the middle of each territory polygon in the drawing's viewBox (640 × 520),
// read from MarketSurveyPlate's paths (IV is the board's own beacon, 192,166, inside its summit contours).
export const SECTOR_SPOTS = Object.freeze({ IV: [192, 166], VIII: [480, 120], VII: [470, 300], V: [270, 400], VI: [95, 370] });
const SECTOR_NAME = { IV: "Software engineering", VIII: "Data and AI", VII: "Project management", V: "Business and finance", VI: "Design" };

/** Pure: the stats strip's cells — only the figures the board actually counted. */
export function marketCells({ fit, newToday, filed, strong } = {}) {
  return [
    Number.isFinite(fit) ? { label: "FIT YOUR BEARING", value: fit } : null,
    Number.isFinite(newToday) ? { label: "NEW TODAY", value: newToday } : null,
    Number.isFinite(filed) ? { label: "FILED H-1B", value: filed } : null,
    Number.isFinite(strong) ? { label: "STRONG FIT", value: strong } : null,
  ].filter(Boolean);
}

/** Pure: the plate's spot and words for a sector name (unknown → IV, as the palette falls back). */
export function youOnPlate(sector) {
  const region = sectorRegion(sector);
  const spot = SECTOR_SPOTS[region] || SECTOR_SPOTS.IV;
  return { region, spot, name: sector ? SECTOR_NAME[region] || sector : null };
}

export default function MarketHero({ figures = {}, sector = null, role = null, level = null, from = null, place = null, week = null, best = null, onBest, onBearing }) {
  const cells = marketCells(figures);
  const you = youOnPlate(sector);
  const where = [role, level].filter(Boolean).join(" · ");
  const label = `The market as a survey plate: sectors drawn as territories${you.name ? `, you marked in ${you.name}` : ""}${best ? `, with a route to your best match${best.company ? ` at ${best.company}` : ""}` : ""}`;
  const tags = [
    // the board's three tags at the board's places (left / top in % of the plate)
    where ? { kicker: "YOU ARE HERE", line: where, sub: from, x: 28, y: 2, kind: "here" } : null,
    best ? { kicker: "BEST MATCH", line: [best.match, best.company].filter(Boolean).join(" · "), sub: best.title || null, x: 63, y: 30, kind: "best" } : null,
    Number.isFinite(figures.newToday) && figures.newToday > 0 ? { kicker: "NEW TODAY", line: `${figures.newToday.toLocaleString("en-US")} openings`, sub: "posted in the last day", x: 5, y: 66 } : null,
  ].filter(Boolean);
  return (
    <PlateRoot className="pl-markethero" data-plate-market-hero="">
      <section className="pl-hero" aria-labelledby="mk-title">
        <TitleBlock kickers={["THE MARKET", place ? `MKT · ${String(place).toUpperCase()}` : null, week ? `WEEK ${week}` : null].filter(Boolean)} title="The market" titleId="mk-title"
          lead={best ? "Every opening that fits you, surveyed from your résumé. You’re marked where your résumé places you; the route runs to the job that matches you most."
            : "Every opening that fits you, surveyed from your résumé. You’re marked where your résumé places you."}
          stats={cells.length ? { cells, label: "The market in figures" } : null}
          actions={<>
            {onBest ? <button type="button" className="pl-btn pl-btn--primary" onClick={onBest}>See your best match →</button> : null}
            {onBearing ? <button type="button" className="pl-btn pl-btn--secondary" onClick={onBearing}>Change the bearing</button> : null}
          </>}/>
        <PlateHero aspect="640 / 520" tags={tags} captionBox
          caption={<><span className="pl-label">PLATE · THE MARKET{week ? `, WEEK ${week}` : ""}</span><span className="pl-label pl-muted">◆ YOU · ○ OPENING{best ? " · ‒ ‒ ROUTE TO BEST MATCH" : ""}</span></>}>
          <MarketSurveyPlate label={label} you={you.spot} best={best ? [Math.min(600, you.spot[0] + 160), Math.max(40, you.spot[1] - 64)] : null}/>
        </PlateHero>
      </section>
    </PlateRoot>
  );
}
