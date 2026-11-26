// ⭐ D197 Wave 2 · M3 (47j, lane w2-public) · what the public mocks share: the signed-out chrome (the plate public nav +
// the public footer) around a page, and the example data (synthetic companies from the canvas — Kestrel Payments,
// Northwind Analytics, Halcyon Robotics …; synthetic people). Dev only — nothing here reaches a user.
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { PublicNav } from "../../../plate/PublicPages.jsx";
import { AtlasFooter } from "../../../plate/AtlasHome.jsx";

export const PUBLIC_LINKS = [
  { id: "jobs", label: "Jobs", href: "#jobs" },
  { id: "atlas", label: "Atlas", href: "#atlas" },
  { id: "pricing", label: "Pricing", href: "#pricing" },   // only while monetisation is on (the caller's list)
  { id: "about", label: "About", href: "#about" },
  { id: "blog", label: "Blog", href: "#blog" },
];

// Today's footer columns (components/Footer.jsx) + a proposed third, Explore, that links the server-rendered pages
export const FOOTER_GROUPS = [
  { label: "Product", links: [{ label: "Features", href: "#features" }, { label: "How it works", href: "#how" }, { label: "Browser extension", href: "#extension" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }] },
  { label: "Company", links: [{ label: "About", href: "#about" }, { label: "Contact", href: "#contact" }, { label: "Privacy policy", href: "#privacy" }, { label: "Terms of service", href: "#terms" }] },
  { label: "Explore", links: [{ label: "Open jobs", href: "#jobs" }, { label: "Atlas", href: "#atlas" }, { label: "Data engineering roadmap", href: "#roadmap" }, { label: "The 3-minute audit", href: "#audit" }, { label: "Check a résumé", href: "#ats" }] },
];

export const isPhone = (width) => Number(width) < 600;

/** The signed-out page frame: paper, the public nav, the page, the footer. `clay` = false when the page's clay point is its own. */
export function PublicFrame({ width, region = "IV", current, clay = true, user = null, children }) {
  const phone = isPhone(width);
  return (
    <PlateRoot region={region} style={{ minHeight: "100vh", fontSize: "var(--pl-t-ui-lg)", lineHeight: 1.5 }}>
      <PublicNav links={PUBLIC_LINKS} current={current} phone={phone} clay={clay} user={user}/>
      {children}
      <div style={{ marginTop: 72 }}>
        <AtlasFooter brand="/draft" line="Find the job. Fit the résumé. Apply." groups={FOOTER_GROUPS}/>
      </div>
    </PlateRoot>
  );
}

export const SECTORS = [
  { id: "swe", name: "Software engineering", n: 4812, capitals: ["Kestrel", "Northwind"], subs: [{ label: "Backend", n: 1612 }, { label: "Frontend", n: 1008 }, { label: "Full-stack", n: 1154 }] },
  { id: "data", name: "Data & AI", n: 2236, capitals: ["Halcyon"], subs: [] },
  { id: "pm", name: "Project mgmt", n: 1604, capitals: ["Granite Build"], subs: [] },
  { id: "biz", name: "Business & finance", n: 1415, capitals: ["Ledgerline"], subs: [] },
  { id: "design", name: "Design", n: 588, capitals: ["Fieldwork"], subs: [] },
];

export const POSTINGS = [
  { id: "1", title: "Frontend Engineer II, Checkout", company: "Kestrel Payments", place: "Boston, MA", pay: "$150k–$180k", mode: "Hybrid", posted: "2 hours ago", region: "IV" },
  { id: "2", title: "Software Engineer, Frontend (Dashboards)", company: "Northwind Analytics", place: "Remote · US", pay: null, mode: "Remote", posted: "today", region: "IV" },
  { id: "3", title: "UI Engineer, Fleet Console", company: "Halcyon Robotics", place: "Pittsburgh, PA", pay: "$135k–$160k", mode: "On-site", posted: "yesterday", region: "VIII" },
  { id: "4", title: "Software Engineer, Design Systems", company: "Brightline Health", place: "New York, NY", pay: "$160k–$190k", mode: "Hybrid", posted: "2 days ago", region: "V" },
  { id: "5", title: "Frontend Engineer", company: "Sailor Health", place: "Remote · US", pay: null, mode: "Remote", posted: "3 days ago", region: "VI" },
  { id: "6", title: "Web Engineer, Growth", company: "Orbital Works", place: "Austin, TX", pay: "$140k–$165k", mode: "Hybrid", posted: "4 days ago", region: "VII" },
];
