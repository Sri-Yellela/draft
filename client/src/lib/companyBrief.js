// ⭐ D199 C6 + D200 Rule 2 (owner 11-25, 47h) · A COMPANY IN BRIEF — what the market's marks open: the FILED H-1B stamp's
// filings, a logo / name's technographics (its stack from its own postings — services/companies/companyTech.js stackFor,
// D179 P5a; NOT the old company_technographics table), and the field card's "the company in brief" (filings, the hiring
// trend, open roles, their top five technologies with your marks).
// One read per company per page: GET /api/public/companies/:slug (the survey sheet's own answer, cached 5 min at the edge)
// and, signed in, GET /api/companies/:slug/match (your marks on their top technologies). A failed read is not kept, so the
// next open asks again. Nothing invented: a part the answer doesn't hold is null, and the mark says so ("no filings found").
import { useEffect, useState } from "react";
import { api } from "./api.js";
import { companySlug } from "./companySlug.js";

const cache = new Map();
function read(slug) {
  if (!cache.has(slug)) {
    const page = api(`/api/public/companies/${encodeURIComponent(slug)}`);
    const match = api(`/api/companies/${encodeURIComponent(slug)}/match`).catch(() => null);
    const p = Promise.all([page, match]).then(([pg, m]) => ({ page: pg, match: m }));
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return cache.get(slug);
}

/** Pure: the hiring trend from the page's monthly postings — the latest month against the first of the window. */
export function hiringTrend(months = []) {
  const rows = (months || []).filter((m) => Number.isFinite(m?.postings));
  if (rows.length < 2 || !(rows[0].postings > 0)) return null;
  const first = rows[0], last = rows[rows.length - 1];
  const pct = Math.round(((last.postings - first.postings) / first.postings) * 100);
  const [y, mo] = String(first.month || "").split("-").map(Number);
  const since = Number.isFinite(mo) ? new Date(Date.UTC(y || 2000, mo - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }) : null;
  return { pct, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat", since };
}

/** Pure: the brief from the two answers → { name, slug, filings, fiscalYear, uscis, wage, source, note, openJobs, trend, tech, ofPostings }. */
export function companyBrief(page = null, match = null) {
  if (!page?.company) return null;
  const s = page.sponsorship || null;
  const proven = new Set((match?.proven || []).map((t) => String(t?.tech ?? t).toLowerCase()));
  const listed = new Set((match?.listed || []).map((t) => String(t?.tech ?? t).toLowerCase()));
  const all = Object.values(page.stack?.groups || {}).flat().sort((a, b) => (b.postings || 0) - (a.postings || 0));
  return {
    name: page.company.name, slug: page.company.slug,
    filings: s && Number.isFinite(s.filings) ? s.filings : null, fiscalYear: s?.fiscalYear ?? null,
    uscis: s?.uscis || null, wage: s?.wage || null, source: s?.source || null, note: s?.note || null, sponsorText: s?.text || null,
    openJobs: Number.isFinite(page.openJobs) ? page.openJobs : null,
    trend: hiringTrend(page.hiringTrend),
    ofPostings: page.stack?.ofPostings ?? null,
    tech: all.slice(0, 8).map((t) => {
      const k = String(t.tech).toLowerCase();
      return { name: t.tech, postings: t.postings ?? null, of: t.of ?? page.stack?.ofPostings ?? null, atlasSlug: t.atlasSlug || null,
        yours: match ? (proven.has(k) ? "proven" : listed.has(k) ? "listed" : "missing") : null };
    }),
  };
}

/** The brief for a company name: { status: idle | loading | ready | error | none, brief }. `on` false → no read. */
export function useCompanyBrief(name, on = true) {
  const slug = name ? companySlug(name) : null;
  const [st, setSt] = useState({ slug: null, status: "idle", brief: null });
  useEffect(() => {
    if (!on || !slug) { setSt({ slug, status: slug ? "idle" : "none", brief: null }); return undefined; }
    let live = true;
    setSt({ slug, status: "loading", brief: null });
    read(slug).then(({ page, match }) => { if (live) setSt({ slug, status: "ready", brief: companyBrief(page, match) }); })
      .catch((e) => { if (live) setSt({ slug, status: e?.status === 404 ? "none" : "error", brief: null }); });
    return () => { live = false; };
  }, [slug, on]);
  return st;
}
