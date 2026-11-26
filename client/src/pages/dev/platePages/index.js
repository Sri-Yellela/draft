// ⭐ D197 Wave 2 · M3 — the page mocks: each Wave 2 page as a mock made ONLY from the plate component library (plate/),
// with fixture data, at 1280 and 390 px. Served by the gallery: `/dev/plate?page=<id>` (`&w=390`). Each lane adds one
// file here and one line below; nothing here ships to a user (Admin only, its own chunk). The owner's M4 look approves
// a mock, and the approved mock becomes that page's F5 oracle.
export const PLATE_PAGES = {
  // id: { title, wave2: "#n", load: () => import("./<File>.jsx") },
  // 47j lane w2-practice — docs/revamp/interview.md, atlas-extras.md, ask-draft.md
  interview: { title: "Interview → Proving ground", wave2: "#13", load: () => import("./Interview.jsx") },
  logbook: { title: "Atlas → Your map's Logbook (Your run, League, Challenges)", wave2: "#11", load: () => import("./Logbook.jsx") },
  "todays-question": { title: "Atlas → Your map's Today card (Today's question)", wave2: "#11", load: () => import("./TodaysQuestion.jsx") },
  "ask-draft": { title: "Ask draft", wave2: "#12", load: () => import("./AskDraft.jsx") },
};
