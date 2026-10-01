// ── The deal, behind the sign-in form (queue 30) ─────────────────────────────────────────────
//
// docs/BRAND_OUTLAY_AND_MOTION.md §Login: "the product's own motion, not a stock animation". Face-down
// cards — the deck's own backs, each a company's logo in blurred orange — are dealt slowly onto a fan
// behind the form. Someone signing in sees what the product does before they are in it.
//
// ⛔ NONE OF IT MAY DELAY THE FORM. This layer is decorative (aria-hidden, no pointer events), sits on
// the FAN tier under every piece of content, and animates with CSS on the compositor: the form is in
// the DOM and focusable on the first paint whatever this is doing.
// ⛔ prefers-reduced-motion: the fan is simply there, dealt.
import CardBack, { CardBackDefs } from "./CardBack.jsx";
import { Z } from "../styles/zLayers.js";
import { fanTransform } from "../lib/fanGeometry.js";

const COMPANIES = ["Figma", "Airbnb", "Stripe", "Notion", "Datadog", "Shopify", "Linear", "Cloudflare", "GitHub"];
const GEOMETRY = { zoom: 1, spread: 9, reach: 900, visible: 5 };

export default function DealBackdrop({ compact = false }) {
  const w = compact ? 200 : 280, h = compact ? 280 : 390;
  const mid = Math.floor(COMPANIES.length / 2);
  return (
    <div aria-hidden="true" data-deal-backdrop
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: Z.FAN }}>
      <CardBackDefs />
      <style>{`
        @keyframes draft-deal-in {
          from { transform: translate3d(0, 120vh, 0) rotate(28deg); opacity: 0; }
        }
        [data-deal-card] { animation: draft-deal-in 900ms cubic-bezier(0.2, 0.9, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) { [data-deal-card] { animation: none; } }
      `}</style>
      {/* The fan's pivot sits BELOW the cards, like a hand — the vertical orientation of the deck. */}
      <div style={{ position: "absolute", left: compact ? "50%" : "74%", bottom: compact ? -h * 0.45 : "8%",
                    width: w, height: h, marginLeft: -w / 2, opacity: compact ? 0.32 : 0.6 }}>
        {COMPANIES.map((company, i) => {
          const t = fanTransform(i - mid, "vertical", GEOMETRY);
          return (
            <div key={company} style={{ position: "absolute", inset: 0, zIndex: -Math.abs(i - mid),
                                        transform: `translate3d(${t.x}px, ${t.y}px, 0) rotate(${t.rotate}deg)` }}>
              {/* Slowly: one card every 0.45 s, from the outside in, the centre card last. */}
              <div data-deal-card style={{ position: "absolute", inset: 0, animationDelay: `${0.3 + 0.45 * order(i, mid)}s` }}>
                <CardBack company={company} radius={22} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Deal order: the outermost cards land first, the centre last — the hand closes onto its front card.
function order(i, mid) { return mid - Math.abs(i - mid); }
