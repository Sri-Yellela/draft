import PaperBackground from "./PaperBackground.jsx";

// The substrate under every page. D91: it used to look the Wrapper up in a one-theme registry by a
// stored id (rm_theme_id) — a stale id found nothing and the paper vanished. The substrate is not a
// theme choice: PaperBackground draws the live theme's own (themes/index.js ACTIVE_THEME.substrate).
export default function AppShell({ children }) {
  return (
    <>
      <PaperBackground />
      <div className="relative z-10 min-h-screen">{children}</div>
    </>
  );
}
