// ⭐ D197 Wave 2 · M3 — the page mocks: each Wave 2 page as a mock made ONLY from the plate component library (plate/),
// with fixture data, at 1280 and 390 px. Served by the gallery: `/dev/plate?page=<id>` (`&w=390`). Each lane adds one
// file here and one line below; nothing here ships to a user (Admin only, its own chunk). The owner's M4 look approves
// a mock, and the approved mock becomes that page's F5 oracle.
export const PLATE_PAGES = {
  // id: { title, wave2: "#n", load: () => import("./<File>.jsx") },
  dispatches: { title: "Dispatches (emails)", wave2: "#18", load: () => import("./Dispatches.jsx") },
  "extension-panel": { title: "The extension’s panel (D191)", wave2: "#19", load: () => import("./ExtensionPanel.jsx") },
  admin: { title: "Admin (dense)", wave2: "#21", load: () => import("./Admin.jsx") },
  // 47j lane w2-public: #16 the public pages (docs/revamp/public.md)
  "public-jobs": { title: "The market, signed out (/jobs)", wave2: "#16", load: () => import("./PublicJobs.jsx") },
  "public-chrome": { title: "The signed-out nav + footer, on the server pages", wave2: "#16", load: () => import("./PublicChrome.jsx") },
  network: { title: "Correspondence (Network · Feed · Messages)", wave2: "#14", load: () => import("./Network.jsx") },
  "off-the-map": { title: "Off the map (404, faults, empty states)", wave2: "#22", load: () => import("./OffTheMap.jsx") },
  landing: { title: "The front door (/) — PROPOSED, owner to place", wave2: "#16a (proposed)", load: () => import("./Landing.jsx") },
  // 47j lane w2-practice — docs/revamp/interview.md, atlas-extras.md, ask-draft.md
  interview: { title: "Interview → Proving ground", wave2: "#13", load: () => import("./Interview.jsx") },
  logbook: { title: "Atlas → Your map's Logbook (Your run, League, Challenges)", wave2: "#11", load: () => import("./Logbook.jsx") },
  "todays-question": { title: "Atlas → Your map's Today card (Today's question)", wave2: "#11", load: () => import("./TodaysQuestion.jsx") },
  "ask-draft": { title: "Ask draft", wave2: "#12", load: () => import("./AskDraft.jsx") },
  profile: { title: "Your passport (Profile)", wave2: "#9", load: () => import("./Profile.jsx") },   // 47j w2-person
  onboarding: { title: "Setting out (onboarding)", wave2: "#15", load: () => import("./Onboarding.jsx") },   // 47j w2-person
  settings: { title: "Settings: Appearance, Notifications, Privacy, Account", wave2: "#17", load: () => import("./Settings.jsx") },   // 47j w2-person
  signin: { title: "Sign in / sign up", wave2: "#17", load: () => import("./SignIn.jsx") },   // 47j w2-person
};
