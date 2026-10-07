// crawler/lib/guards.js — ⛔ D75 · THE RULES OF ENGAGEMENT, AS CODE (docs/CRAWLER_WORKER.md §2, §3).
//
// Pure and self-contained: the worker is deployed from crawler/ alone and imports nothing from draft;
// draft imports THIS file for its own lease-time checks, so the rule is written once.
//   · SSRF — task URLs come from untrusted data. A URL is refused when its host is a literal private,
//     loopback, link-local or metadata address, a `localhost` / `.internal` / `.local` name, or RESOLVES
//     to one — and the check runs again on every redirect hop.
//   · The deny-list — a domain and every subdomain of it. Data, owner-editable, and it wins over every task.
//   · robots.txt — the group for our User-Agent, else `*`; longest match wins, Allow over Disallow on a tie.
//   · Records keep an origin and a path, never a query string (tokens live there — D69(c)).
import dns from "node:dns/promises";
import net from "node:net";

export const USER_AGENT = "DraftCrawler/1.0 (+https://jobsviadraft.com/crawler; abuse@jobsviadraft.com)";
export const ROBOTS_AGENT = "draftcrawler";

const V4_FORBIDDEN = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const v4int = (ip) => ip.split(".").reduce((n, p) => (n << 8) + Number(p), 0) >>> 0;
function v4Forbidden(ip) {
  const x = v4int(ip);
  return V4_FORBIDDEN.some(([base, bits]) => ((x ^ v4int(base)) >>> (32 - bits)) === 0);
}
/** A literal IP that no public crawl has any business reaching. */
export function isForbiddenAddress(ip) {
  const v = net.isIP(ip);
  if (v === 4) return v4Forbidden(ip);
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return v4Forbidden(mapped[1]);
    return /^(fe[89ab]|fc|fd|ff)/.test(s);          // link-local, unique-local, multicast
  }
  return false;
}
const FORBIDDEN_NAMES = /^(localhost|metadata|metadata\.google\.internal)$|\.(localhost|internal|local|localdomain|home\.arpa)$/i;

/**
 * May the worker request this URL? `allowHosts` is a set of exact `host:port` strings a TEST harness
 * passes for its local fixtures — production constructs the guard with none.
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function checkUrl(rawUrl, { allowHosts = new Set(), resolve = defaultResolve } = {}) {
  let u;
  try { u = new URL(String(rawUrl)); } catch { return { ok: false, reason: "unreadable_url" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "scheme" };
  if (u.username || u.password) return { ok: false, reason: "credentials_in_url" };
  if (allowHosts.has(u.host)) return { ok: true };
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (FORBIDDEN_NAMES.test(host)) return { ok: false, reason: "private_host" };
  if (net.isIP(host)) return isForbiddenAddress(host) ? { ok: false, reason: "private_address" } : { ok: true };
  let addrs;
  try { addrs = await resolve(host); } catch { return { ok: false, reason: "dns_failed" }; }
  if (!addrs.length) return { ok: false, reason: "dns_failed" };
  if (addrs.some(isForbiddenAddress)) return { ok: false, reason: "resolves_private" };
  return { ok: true };
}
async function defaultResolve(host) {
  return (await dns.lookup(host, { all: true, verbatim: true })).map(a => a.address);
}

/** Is this host the deny-listed domain or a subdomain of it? `list` is plain domains, lowercase. */
export function deniedBy(hostOrUrl, list = []) {
  let host = String(hostOrUrl || "").toLowerCase();
  try { if (host.includes("/")) host = new URL(host).hostname.toLowerCase(); } catch { return null; }
  host = host.replace(/^www\./, "");
  for (const raw of list) {
    const d = String(raw || "").toLowerCase().trim().replace(/^\*?\.?/, "").replace(/^www\./, "");
    if (d && (host === d || host.endsWith("." + d))) return d;
  }
  return null;
}

// ── robots.txt ─────────────────────────────────────────────────────────────────────────────────────
export function parseRobots(text) {
  const groups = [];
  let cur = null, lastWasAgent = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [], delay: null }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "allow" || key === "disallow") cur.rules.push({ allow: key === "allow", path: val });
    if (key === "crawl-delay" && Number.isFinite(Number(val))) cur.delay = Number(val);
  }
  return groups;
}
function groupFor(groups, agent) {
  return groups.find(g => g.agents.some(a => a !== "*" && agent.includes(a))) || groups.find(g => g.agents.includes("*")) || null;
}
function ruleMatches(rulePath, path) {
  if (!rulePath) return false;
  const anchored = rulePath.endsWith("$");
  const body = rulePath.replace(/\$$/, "").split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp("^" + body + (anchored ? "$" : "")).test(path);
}
/** @returns {{ allowed: boolean, delaySeconds: number|null }} */
export function robotsVerdict(groups, path, agent = ROBOTS_AGENT) {
  const g = groupFor(groups, agent);
  if (!g) return { allowed: true, delaySeconds: null };
  let best = null;
  for (const r of g.rules) {
    if (r.path === "" && !r.allow) continue;                       // "Disallow:" (empty) allows everything
    if (!ruleMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return { allowed: best ? best.allow : true, delaySeconds: g.delay };
}

// ── what a record may keep ─────────────────────────────────────────────────────────────────────────
// Query parameters an ATS uses to NAME a board — kept so the evidence can name it; nothing else is.
const EVIDENCE_PARAMS = { "boards.greenhouse.io": ["for"], "job-boards.greenhouse.io": ["for"] };
/** origin + path, the query dropped — except the one parameter an ATS embed names its board with. */
export function recordUrl(rawUrl) {
  let u; try { u = new URL(String(rawUrl)); } catch { return null; }
  const keep = EVIDENCE_PARAMS[u.hostname.toLowerCase()] || [];
  const q = new URLSearchParams();
  for (const k of keep) if (u.searchParams.has(k)) q.set(k, u.searchParams.get(k));
  const qs = q.toString();
  return `${u.origin}${u.pathname}${qs ? "?" + qs : ""}`;
}
/** A path SHAPE for an Apply hop: ids → `:id`, so a record says where a form lives, not which one. */
export function pathShape(rawUrl) {
  let u; try { u = new URL(String(rawUrl)); } catch { return null; }
  const shape = u.pathname.split("/").map(s =>
    /^\d{3,}$/.test(s) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(s) || /^[A-Z0-9]{8,12}$/.test(s) ? ":id" : s).join("/");
  return `${u.origin}${shape}`;
}
