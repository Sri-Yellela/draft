/**
 * D42 (owner, 10-06) — THE COMPANY'S SECTOR, a different thing from the JOB'S DOMAIN.
 *
 * "A finance job at OpenAI is more of a finance job the user cares about than an SDE role at
 * Fidelity." So the two are tagged separately:
 *   domain   the kind of WORK the posting is (jobTags.js tag_function, from the title's role bucket)
 *            — the sentence's first word.
 *   sector   the industry the EMPLOYER is in — a property of the company, not of the posting, so it
 *            is read from the company name here. A drawer filter ("more filters"), not a sentence word.
 *
 * ⛔ DETERMINISTIC ONLY (D17): a closed list, keyed by the company name as the board stores it. A
 * company not on the list has NO SECTOR ON FILE — it is never guessed from a posting's words. The
 * per-posting `bucket_domain` regex (classifyJob.js detectDomain) was measured noisy for this job on
 * 10-06: Mercury 32 of 43 rows "general", OpenAI 25 rows "edtech", Wealthfront "general".
 *
 * `value` IS THE PARAM VALUE (`sectors=finance,ai`), per shared/jobFilterOptions.js's rule.
 */
export const SECTORS = {
  param: "sectors",
  multi: true,
  options: [
    { value: "finance",    label: "Finance & payments" },
    { value: "ai",         label: "AI" },
    { value: "devtools",   label: "Developer tools" },
    { value: "software",   label: "Software & productivity" },
    { value: "consumer",   label: "Consumer & marketplaces" },
    { value: "media",      label: "Media & entertainment" },
    { value: "education",  label: "Education" },
    { value: "health",     label: "Health & life sciences" },
    { value: "adtech",     label: "Advertising & marketing tech" },
    { value: "industrial", label: "Industrial & automotive" },
    { value: "retail",     label: "Retail & e-commerce" },
    { value: "people",     label: "HR & people software" },
  ],
  dbOnly: [],
};

/** Company (lower-cased, as stored) -> sector. Add a row to tag a company; nothing else changes. */
export const COMPANY_SECTOR = Object.freeze({
  "stripe": "finance", "brex": "finance", "ramp": "finance", "mercury": "finance",
  "wealthfront": "finance", "tala": "finance", "plaid": "finance", "chime": "finance",
  "robinhood": "finance", "affirm": "finance", "coinbase": "finance", "marqeta": "finance",
  "openai": "ai", "anthropic": "ai", "scale ai": "ai", "cohere": "ai", "hugging face": "ai",
  "vercel": "devtools", "linear": "devtools", "retool": "devtools", "hygraph": "devtools",
  "figma": "software", "notion": "software",
  "airbnb": "consumer", "match group": "consumer", "blueground": "consumer",
  "spotify": "media", "ubisoft": "media",
  "duolingo": "education",
  "veeva systems": "health",
  "openx": "adtech", "persado": "adtech",
  "bosch": "industrial",
  "skroutz": "retail", "channable": "retail",
  "rippling": "people",
  "adobe": "software",
});

const VALUES = new Set(SECTORS.options.map(o => o.value));

/** The sector of a company name, or null when it is not on file. */
export const sectorForCompany = (company) =>
  COMPANY_SECTOR[String(company || "").trim().toLowerCase()] || null;

/**
 * The SQL expression for a row's sector — a CASE over the list, inlined as literals (every key and
 * value is from this file, never a caller's text). NULL when the company is not on the list.
 */
export function sectorSql(companyCol = "sj.company") {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const whens = Object.entries(COMPANY_SECTOR).map(([c, s]) => `WHEN ${q(c)} THEN ${q(s)}`).join(" ");
  return `(CASE LOWER(TRIM(${companyCol})) ${whens} ELSE NULL END)`;
}

/** Only values in the vocabulary survive. */
export const validSectors = (values) => (values || []).map(String).filter(v => VALUES.has(v));
