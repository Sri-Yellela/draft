// ⭐ D105 P4 · THE NEIGHBOURHOOD GRAPH — the node and its FIRST RING, inline SVG. Click (or Tab + Enter) a neighbour to
// walk to its page; the walk is the way to the second ring, never a bigger drawing (atlasModel.firstRing).
// Every colour is a theme token through AtlasPage.css (d105FourThemes); the dots are perfect circles (D60 allows).
import { ringLayout, shortLabel, edgeLabel } from "./atlasModel.js";

export default function AtlasGraph({ node, hrefFor, onWalk, max = 12 }) {
  const g = ringLayout(node, { max });
  if (!g.ring.length) return null;
  return (
    <figure className="atl__graph" data-atlas-graph="" data-ring={g.ring.length}>
      <svg viewBox={`0 0 ${g.w} ${g.h}`} role="group" aria-label={`${node.name} and the ${g.ring.length} pages next to it`}
        preserveAspectRatio="xMidYMid meet">
        {g.ring.map(n => (
          <line key={`e-${n.slug}`} className="atl__gedge" data-edge={n.type} x1={g.centre.x} y1={g.centre.y} x2={n.x} y2={n.y} />
        ))}
        <g className="atl__gcentre" data-graph-centre={g.centre.slug}>
          <circle cx={g.centre.x} cy={g.centre.y} r="11" className={`atl__gdot atl__gdot--${g.centre.kind}`} />
          <text x={g.centre.x} y={g.centre.y + 27} textAnchor="middle" className="atl__glabel atl__glabel--centre">{shortLabel(g.centre.name, 24)}</text>
        </g>
        {g.ring.map(n => (
          <a key={n.slug} href={hrefFor(n.slug)} className="atl__gnode" data-graph-node={n.slug}
            aria-label={`${n.name} — ${edgeLabel(n.type, n.dir).toLowerCase()}`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault(); onWalk?.(n.slug);
            }}>
            <title>{`${n.name} · ${edgeLabel(n.type, n.dir)}`}</title>
            <circle cx={n.x} cy={n.y} r="7" className={`atl__gdot atl__gdot--${n.kind}`} />
            <text x={n.lx} y={n.ly} textAnchor={n.anchor} className="atl__glabel">{shortLabel(n.name)}</text>
          </a>
        ))}
      </svg>
      {g.more > 0 && <figcaption className="atl__gmore">+{g.more} more in the lists</figcaption>}
    </figure>
  );
}
