// ⭐ D196 F5 · the regression run's build side — each fixture composes plate components with the SKETCH's example data
// (the same words, counts and order the board shows), so scripts/d196Regress.mjs can diff the build against the board.
// A fixture is never tuned to pass: when a diff fails, the component is fixed (D196 F5), and the fixture keeps the
// board's data.
import PlateRoot from "./PlateRoot.jsx";
import { AreaNav, Dock } from "./Shell.jsx";

const MARKET_VIEWS = [
  { id: "picks", label: "Today’s picks", href: "#picks", icon: "picks" },
  { id: "all", label: "All jobs", href: "#all", icon: "list" },
  { id: "starred", label: "Starred", href: "#starred", icon: "starred" },
  { id: "imported", label: "Imported", href: "#imported", icon: "imported" },
];
// the board's dock: Home 1, Network 3, Profile MC with 9+
const BOARD_DOCK = [
  { id: "auto-apply", label: "Home", href: "#home", icon: "home", badge: 1 },
  { id: "atlas", label: "Atlas", href: "#atlas", icon: "atlas" },
  { id: "interview", label: "Interview", href: "#interview", icon: "interview" },
  { id: "network", label: "Network", href: "#network", icon: "network", badge: 3 },
  { id: "profile", label: "Profile", href: "#profile", initials: "MC", badge: 12 },
];

/** The market board's shell: the dock (the /d tile current) beside the market's area nav (no pill), 1280 wide. */
export function ShellMarket() {
  return (
    <PlateRoot style={{ minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        <Dock items={BOARD_DOCK} ask={{ href: "#ask" }} current="home"/>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <AreaNav area="The market" views={MARKET_VIEWS} current="picks" more={[{ label: "Companies", href: "#co" }]}
            search={{ placeholder: "Company, role, tech…" }} chip={{ kind: "drafts", used: 7, of: 10, href: "#ledger" }}/>
        </div>
      </div>
    </PlateRoot>
  );
}

export const FIXTURES = { ShellMarket };
