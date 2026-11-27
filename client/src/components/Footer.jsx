// client/src/components/Footer.jsx — ⭐ D197 Wave 2 #16 · M5 (47m, lane public): THE PUBLIC FOOTER, in plate — the
// approved mock `public-chrome`'s footer: the plate footer (plate/AtlasHome.jsx AtlasFooter, built once — A93) with the
// shared mark, the line, and three columns: Product and Company (every link the classic footer had), and Explore (the
// open jobs, Atlas, the server-rendered roadmap, the audit and the ATS check — public.md §5b: so the server pages are linked
// from the client ones). The © year comes from the clock (it was hard-coded 2025). Every public page wears it
// (components/PublicChrome.jsx PublicPage), and so do the sign-in screen and Atlas's public pages, which render it here.
import { useNavigate } from "react-router-dom";
import PlateRoot from "../plate/PlateRoot.jsx";
import { AtlasFooter } from "../plate/AtlasHome.jsx";
import { useMonetisationEnabled } from "../lib/monetisation.jsx";
import { BRAND } from "../../../shared/brand.js";
import { StampLogo } from "./StampLogo.jsx";

const link = ({ label, to }) => ({ label, href: to });

export function Footer() {
  const monetisationEnabled = useMonetisationEnabled();
  const navigate = useNavigate();
  const groups = [
    { label: "Product", links: [
      { label: "Features",     to: "/features" },
      { label: "How it works", to: "/how-it-works" },
      // D12: the extension is the import path; the site has to say where to get it.
      { label: "Browser extension", to: "/extension" },
      ...(monetisationEnabled ? [{ label: "Pricing", to: "/pricing" }] : []),
      { label: "FAQ",          to: "/faq" },
    ].map(link) },
    { label: "Company", links: [
      { label: "About",          to: "/about" },
      { label: "Contact",        to: "/contact" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ].map(link) },
    { label: "Explore", links: [
      { label: "Open jobs", to: "/jobs" },
      { label: "Atlas", to: "/atlas" },
      // a server-rendered page: a full load, not the client router
      { label: "Data engineering roadmap", to: "/learn/data-engineering-roadmap" },
      { label: "The 3-minute audit", to: "/audit" },
      { label: "Check a résumé", to: "/tools/ats" },
    ].map(link) },
  ];
  const onGo = (href) => { if (href.startsWith("/learn/")) window.location.assign(href); else navigate(href); };
  return (
    <PlateRoot region="I" data-public-footer="">
      <AtlasFooter brand={<StampLogo size="md"/>} line="Find the job. Fit the résumé. Apply." groups={groups} onGo={onGo}/>
      <p className="pl-label pl-muted" style={{ margin: 0, padding: "0 var(--pl-gutter) 24px", maxWidth: "var(--pl-page)", marginInline: "auto", boxSizing: "border-box" }}>
        © {new Date().getFullYear()} {BRAND}. All rights reserved.
      </p>
    </PlateRoot>
  );
}
