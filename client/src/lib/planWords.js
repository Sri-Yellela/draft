// ⭐ A167 · the plan card's words (components/PlanSettings.jsx). Pure — test/a167Monetisation reads it.

/** The plan card's words. Pure (tested). */
export function planWords(status) {
  if (!status?.enabled) return null;
  const t = status.trial || { drafts: 10, used: 0, left: 10 };
  if (status.subscription) {
    const s = status.subscription;
    const until = s.renewsAt ? new Date(s.renewsAt * 1000).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : null;
    return { headline: `You're on ${(status.tiers.find(x => x.id === s.tier)?.name) || "a plan"}`,
      line: s.cancelAtPeriodEnd ? `It ends${until ? ` on ${until}` : ""} — you can restart it in Manage billing.` : until ? `Renews ${until}.` : "Active." };
  }
  return { headline: t.left > 0 ? `${t.left} of ${t.drafts} trial drafts left` : `Your ${t.drafts} trial drafts are used`,
    line: "Everything on draft stays open without a plan. A plan is only for applying through draft — Ask me first and Apply for me." };
}
