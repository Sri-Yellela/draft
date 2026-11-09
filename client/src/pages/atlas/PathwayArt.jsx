// ⭐ A154 (45o, the D172 sketch: "every course cover has a relevant drawing … AI engineering: a small neural network · Data
// engineering: a database → a job → a warehouse · System design: a client, a load balancer, servers and a database ·
// Security: a shield with a keyhole · Engineering management: a small org chart"). One line drawing per D155 pathway, in
// the covers' own classes (LibraryPanel.css .lib-art__* — theme tokens only, d172ShelfCoversFromTokens).

const Art = ({ children }) => (
  <svg className="lib-cover__art" viewBox="0 0 120 100" aria-hidden="true" focusable="false">{children}</svg>
);

function SoftwareArt() {
  return (
    <Art>
      <rect x="8" y="40" width="20" height="20" rx="4" className="lib-art__body" />
      <rect x="40" y="40" width="16" height="20" rx="3" className="lib-art__core" />
      {[22, 50, 78].map((y) => <rect key={y} x="70" y={y - 8} width="20" height="16" rx="3" className="lib-art__body" />)}
      <rect x="100" y="38" width="14" height="24" rx="6" className="lib-art__window" />
      <path d="M 28 50 h 12 M 56 50 L 70 22 M 56 50 h 14 M 56 50 L 70 78 M 90 22 L 100 46 M 90 50 h 10 M 90 78 L 100 54" className="lib-art__code" />
    </Art>
  );
}

function DataArt() {
  return (
    <Art>
      <ellipse cx="20" cy="34" rx="12" ry="5" className="lib-art__body" />
      <path d="M 8 34 v 30 a 12 5 0 0 0 24 0 v -30" className="lib-art__body" />
      <rect x="48" y="40" width="24" height="20" rx="4" className="lib-art__core" />
      <rect x="88" y="30" width="26" height="40" rx="3" className="lib-art__window" />
      {[40, 50, 60].map((y) => <line key={y} x1="92" y1={y} x2="110" y2={y} className="lib-art__pin" />)}
      <path d="M 32 50 h 16 m -5 -4 l 5 4 l -5 4 M 72 50 h 16 m -5 -4 l 5 4 l -5 4" className="lib-art__code" />
    </Art>
  );
}

const LAYERS = [[20, [30, 50, 70]], [60, [22, 40, 60, 78]], [100, [40, 60]]];
function NeuralArt() {
  const lines = [];
  LAYERS.forEach(([x, ys], li) => {
    const next = LAYERS[li + 1];
    if (next) for (const y of ys) for (const y2 of next[1]) lines.push(<line key={"l" + x + "-" + y + "-" + y2} x1={x} y1={y} x2={next[0]} y2={y2} className="lib-art__pin" />);
  });
  return (
    <Art>
      {lines}
      {LAYERS.flatMap(([x, ys], li) => ys.map((y) => <circle key={"n" + x + "-" + y} cx={x} cy={y} r="6" className={li === 1 ? "lib-art__core" : "lib-art__body"} />))}
    </Art>
  );
}

function CloudArt() {
  return (
    <Art>
      <path d="M 30 62 a 14 14 0 0 1 4 -27 a 20 20 0 0 1 38 -4 a 16 16 0 0 1 18 31 z" className="lib-art__body" />
      {[44, 60, 76].map((x) => <rect key={x} x={x - 6} y="70" width="12" height="12" rx="2" className="lib-art__core" />)}
      <path d="M 44 62 v 8 M 60 62 v 8 M 76 62 v 8" className="lib-art__code" />
    </Art>
  );
}

function ShieldArt() {
  return (
    <Art>
      <path d="M 60 14 L 88 24 V 48 C 88 66 76 80 60 88 C 44 80 32 66 32 48 V 24 Z" className="lib-art__body" />
      <circle cx="60" cy="46" r="7" className="lib-art__core" />
      <path d="M 57 52 h 6 l 2 14 h -10 z" className="lib-art__core" />
    </Art>
  );
}

function BoardArt() {
  return (
    <Art>
      <rect x="22" y="22" width="76" height="56" rx="6" className="lib-art__body" />
      <rect x="46" y="38" width="28" height="24" rx="3" className="lib-art__core" />
      <path d="M 22 36 h -10 M 22 50 h -10 M 22 64 h -10 M 98 36 h 10 M 98 50 h 10 M 98 64 h 10 M 30 30 h 10 v 8 M 90 70 h -10 v -8" className="lib-art__code" />
    </Art>
  );
}

function ChecksArt() {
  return (
    <Art>
      {[30, 50, 70].map((y, i) => (
        <g key={y}>
          <rect x="22" y={y - 7} width="14" height="14" rx="3" className="lib-art__body" />
          <path d={"M 25 " + y + " l 3 4 l 6 -8"} className="lib-art__code" />
          <line x1="44" y1={y} x2={i === 1 ? 84 : 98} y2={y} className="lib-art__pin" />
        </g>
      ))}
      <circle cx="92" cy="74" r="10" className="lib-art__window" />
      <path d="M 99 81 l 8 8" className="lib-art__code" />
    </Art>
  );
}

function OrgArt() {
  return (
    <Art>
      <rect x="48" y="12" width="24" height="16" rx="3" className="lib-art__core" />
      {[20, 60, 100].map((x) => <rect key={x} x={x - 12} y="62" width="24" height="16" rx="3" className="lib-art__body" />)}
      <path d="M 60 28 V 46 M 20 46 H 100 M 20 46 V 62 M 60 46 V 62 M 100 46 V 62" className="lib-art__code" />
    </Art>
  );
}

function CompassArt() {
  return (
    <Art>
      <circle cx="60" cy="50" r="30" className="lib-art__body" />
      <path d="M 60 26 L 68 50 L 60 74 L 52 50 Z" className="lib-art__core" />
      <text x="60" y="18" textAnchor="middle" className="lib-art__glyph">N</text>
    </Art>
  );
}

/** The drawing for a D155 pathway id (the compass for one without its own). */
export const PATHWAY_ART = Object.freeze({
  software: SoftwareArt, data: DataArt, "ml-ai": NeuralArt, cloud: CloudArt, security: ShieldArt,
  embedded: BoardArt, qa: ChecksArt, management: OrgArt, beyond: CompassArt,
});
export const artForPathway = (id) => PATHWAY_ART[id] || CompassArt;
