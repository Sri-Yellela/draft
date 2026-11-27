// client/src/pages/marketing/PricingPage.jsx — ⭐ 46v 0d (owner 11-18: "yes do the other pages too"): the landing's
// treatment — the frame (components/MarketingFrame.jsx), the plans as three cards, each plan's list as ✓ items (A233).
// Routed only while monetisation is on (App.jsx).
import { MarketingFrame, MkLink, MkPlan, MkPromises } from "../../components/MarketingFrame.jsx";   // 47m: the notes and promises on the plate

const TIERS = [
  {
    name: "Basic",
    price: "Included",
    period: "",
    badge: null,
    recommended: false,
    comingSoon: false,
    features: [
      "Your jobs board and today's picks",
      "Applications in Ask me first",
      "The ATS check",
      "Profile-isolated saved jobs",
    ],
    cta: "Get started free",
    ctaLink: "/login",
  },
  {
    name: "Plus",
    price: "Request",
    period: "",
    badge: "Generate",
    recommended: true,
    comingSoon: false,
    features: [
      "Everything in Basic",
      "Generate tool on expanded job cards",
      "Focused resumes from selected jobs",
      "Resume history and preview",
    ],
    cta: "Request upgrade",
    ctaLink: "/login",
  },
  {
    name: "Pro",
    price: "Request",
    period: "",
    badge: "A+ Resume",
    recommended: false,
    comingSoon: false,
    features: [
      "Everything in Plus",
      "The A+ résumé when you Draft a job",
      "A+ resume workflow",
      "Admin-approved access changes",
    ],
    cta: "Request upgrade",
    ctaLink: "/login",
  },
];

export function PricingPage() {
  return (
    <MarketingFrame eyebrow="Pricing" title="Simple pricing. No surprises."
      lede="Start with your jobs board and today's picks. Ask for an upgrade from Plans when you need more tools.">
      <div className="mk-plans" data-plans="">
        {TIERS.map((t) => (
          <MkPlan key={t.name} name={t.name} price={`${t.price}${t.period}`} badge={t.badge} recommended={t.recommended} data-plan={t.name}>
            <MkPromises items={t.features.map((f) => ({ ok: true, text: f }))} />
            {t.comingSoon
              ? <p className="mk-quiet">Coming soon</p>
              : <div><MkLink primary={t.recommended} to={t.ctaLink}>{t.cta}</MkLink></div>}
          </MkPlan>
        ))}
      </div>
      <p className="mk-quiet">Upgrade requests are handled through Plans and granted by an admin while paid upgrades are being prepared.</p>
    </MarketingFrame>
  );
}
