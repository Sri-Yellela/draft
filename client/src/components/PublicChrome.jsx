// ⭐ D197 Wave 2 #16 · M5 (47m, lane public) · THE SIGNED-OUT CHROME, live — the approved mock `public-chrome`
// (pages/dev/platePages/PublicChrome.jsx) built on the app: the plate public nav (plate/PublicPages.jsx PublicNav) with the
// real links, the reader's auth state and the inline sign-in popover; the one public footer (components/Footer.jsx); and
// `PublicPage`, the frame every signed-out page wears (paper, the nav, the page, the footer). It replaces
// components/NavBar.jsx (deleted) and, on the marketing / tool pages, components/ScrollDock.jsx's marketing / tools bars.
// Every item NavBar carried has its home here (docs/revamp/public.md §5b): the wordmark → /, the links (Pricing only while
// monetisation is on — "off means absent"), Sign in (the popover; on a phone → loginHref(), back to this page after),
// Get started → /register (the page's one clay point unless the page has its own), signed in: Open draft / Admin / Sign out.
// ⚠ agent's pick (owner may reverse): Products leaves the nav (a "coming soon" page; /products now goes to /features), and
// Jobs joins it (the open board had no link from the nav) — the approved mock's link set.
import { createContext, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PlateRoot from "../plate/PlateRoot.jsx";
import { PublicNav } from "../plate/PublicPages.jsx";
import InlineLoginPopover from "./InlineLoginPopover.jsx";
import { Footer } from "./Footer.jsx";
import { useViewport } from "../hooks/useViewport.js";
import { useMonetisationEnabled } from "../lib/monetisation.jsx";
import { loginHref } from "../lib/signInReturn.js";   // A138: back to this page after sign-in

/** The reader's auth state for the public chrome — App.jsx provides it (user, onLogout, onLogin); signed out by default. */
const PublicAuth = createContext({ user: null, onLogout: null, onLogin: null });
export function PublicAuthProvider({ value, children }) {
  return <PublicAuth.Provider value={value}>{children}</PublicAuth.Provider>;
}
export function usePublicAuth() { return useContext(PublicAuth); }

/** The public links — Pricing only while monetisation is on (a link is a claim that the destination exists). */
export function publicLinks(monetisationEnabled) {
  return [
    { id: "/jobs", label: "Jobs", href: "/jobs" },
    // ⭐ D105 P4: the Atlas is public (no sign-in) — a place on the public nav.
    { id: "/atlas", label: "Atlas", href: "/atlas" },
    ...(monetisationEnabled ? [{ id: "/pricing", label: "Pricing", href: "/pricing" }] : []),
    { id: "/about", label: "About", href: "/about" },
    { id: "/blog", label: "Blog", href: "/blog" },
  ];
}

/** The live public nav. `clay` = false when the page's own clay point is elsewhere (the survey sheet, a 404). */
export function PublicHeader({ clay = true }) {
  const { user, onLogout, onLogin } = usePublicAuth();
  const monetisationEnabled = useMonetisationEnabled();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { w } = useViewport();
  const phone = w < 640;
  const links = publicLinks(monetisationEnabled);
  const current = links.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))?.id;
  const signIn = phone
    ? { href: loginHref() }
    : { wrap: (button) => <InlineLoginPopover onLogin={onLogin} trigger={button}/> };
  return (
    <PublicNav links={links} current={current} phone={phone} clay={clay} signIn={signIn}
      user={user ? { admin: !!user.isAdmin } : null} onSignOut={onLogout || undefined}
      onGo={(href) => navigate(href)}/>
  );
}

/** A signed-out page: paper (the region's palette), the public nav, the page, the public footer. */
export function PublicPage({ region = "IV", clay = true, children, className = "", ...data }) {
  return (
    <PlateRoot region={region} className={`pl-public ${className}`.trim()} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--pl-paper)" }} {...data}>
      <PublicHeader clay={clay}/>
      <div style={{ flex: "1 0 auto" }}>{children}</div>
      <div style={{ marginTop: 72 }}><Footer/></div>
    </PlateRoot>
  );
}
