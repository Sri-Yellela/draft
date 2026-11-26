// ⭐ D197 Wave 2 · M3 — the page mocks: each Wave 2 page as a mock made ONLY from the plate component library (plate/),
// with fixture data, at 1280 and 390 px. Served by the gallery: `/dev/plate?page=<id>` (`&w=390`). Each lane adds one
// file here and one line below; nothing here ships to a user (Admin only, its own chunk). The owner's M4 look approves
// a mock, and the approved mock becomes that page's F5 oracle.
export const PLATE_PAGES = {
  // id: { title, wave2: "#n", load: () => import("./<File>.jsx") },
  profile: { title: "Your passport (Profile)", wave2: "#9", load: () => import("./Profile.jsx") },   // 47j w2-person
  onboarding: { title: "Setting out (onboarding)", wave2: "#15", load: () => import("./Onboarding.jsx") },   // 47j w2-person
  settings: { title: "Settings: Appearance, Notifications, Privacy, Account", wave2: "#17", load: () => import("./Settings.jsx") },   // 47j w2-person
  signin: { title: "Sign in / sign up", wave2: "#17", load: () => import("./SignIn.jsx") },   // 47j w2-person
};
