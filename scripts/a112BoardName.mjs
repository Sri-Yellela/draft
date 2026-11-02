// A112 · the name a discovered board is configured under — what every job card shows (d80ApplyTranche --names).
// The board's own employer name where the ATS publishes one; the slug made readable otherwise.

/** "acme-labs" → "Acme Labs"; "5|acme|External" → "Acme". */
export function prettySlug(atsType, slug) {
  const s = atsType === "workday" ? String(slug).split("|")[1] || slug : String(slug);
  return s.replace(/[-_.]+/g, " ").replace(/\b(inc|llc|careers|jobs|us|usa)\b/gi, "").trim()
    .replace(/\s+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) || s;
}

/** A board page's <title> → the employer: Ashby "Mural Group Jobs", Lever "AO Garcia Agency". */
export function nameFromTitle(atsType, html) {
  const t = String(html).match(/<title>([^<]*)<\/title>/i)?.[1]?.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").trim();
  if (!t) return null;
  const n = (atsType === "ashby" ? t.replace(/\s+jobs$/i, "") : t).replace(/\s+/g, " ").trim();
  return n && !/^(jobs|careers|not found|404)$/i.test(n) ? n : null;
}

export async function boardName(atsType, slug) {
  const ask = async (u, as = "json") => {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(15000) }); return r.ok ? (as === "json" ? r.json() : r.text()) : null; } catch { return null; }
  };
  const s = encodeURIComponent(slug);
  if (atsType === "greenhouse") return (await ask(`https://boards-api.greenhouse.io/v1/boards/${s}`))?.name || null;
  if (atsType === "workable") return (await ask(`https://apply.workable.com/api/v1/widget/accounts/${s}`))?.name || null;
  if (atsType === "smartrecruiters") return (await ask(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`))?.content?.[0]?.company?.name || null;
  if (atsType === "ashby") return nameFromTitle("ashby", await ask(`https://jobs.ashbyhq.com/${s}`, "text"));
  if (atsType === "lever") return nameFromTitle("lever", await ask(`https://jobs.lever.co/${s}`, "text"));
  return null;
}
