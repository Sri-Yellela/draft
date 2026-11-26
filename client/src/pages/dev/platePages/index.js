// ⭐ D197 Wave 2 · M3 — the page mocks: each Wave 2 page as a mock made ONLY from the plate component library (plate/),
// with fixture data, at 1280 and 390 px. Served by the gallery: `/dev/plate?page=<id>` (`&w=390`). Each lane adds one
// file here and one line below; nothing here ships to a user (Admin only, its own chunk). The owner's M4 look approves
// a mock, and the approved mock becomes that page's F5 oracle.
export const PLATE_PAGES = {
  // id: { title, wave2: "#n", load: () => import("./<File>.jsx") },
  // 47j lane w2-public: #16 the public pages (docs/revamp/public.md)
  "public-jobs": { title: "The market, signed out (/jobs)", wave2: "#16", load: () => import("./PublicJobs.jsx") },
  "public-chrome": { title: "The signed-out nav + footer, on the server pages", wave2: "#16", load: () => import("./PublicChrome.jsx") },
  network: { title: "Correspondence (Network · Feed · Messages)", wave2: "#14", load: () => import("./Network.jsx") },
};
