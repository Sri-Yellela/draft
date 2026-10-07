// crawler/lib/j2.js — ⛔ D75 J2 · WHERE APPLY LANDS (D67 part 1). One sample posting from our own board:
// load it, follow its Apply link, follow the redirect chain, and STOP at the first form, login wall or
// account wall. Records each hop's origin and path SHAPE. It never fills, types or submits — following the
// Apply link is a navigation (the link's own href), and the form at the end is not read, only noticed.
import { extractRefs, hasForm, hasPasswordField, looksLikeAccountWall } from "./html.js";
import { pathShape } from "./guards.js";
import { CrawlStop } from "./fetcher.js";

const APPLY = /\bapply\b/i;
const stopOf = (html) => hasPasswordField(html) ? "login-wall"
  : (looksLikeAccountWall(html) && hasForm(html)) ? "account-wall" : hasForm(html) ? "form" : null;

/** @returns {Promise<{ status, postingOrigin, formOrigin, hops: string[], stoppedAt, error? }>} */
export async function followApply({ postingUrl }, fetcher) {
  const postingOrigin = new URL(postingUrl).origin;
  const hops = [];
  try {
    const posting = await fetcher.fetchPage(postingUrl);
    hops.push(pathShape(posting.url));
    // Some ATSes put the form on the posting page itself (Lever, Ashby): that is the answer.
    const here = stopOf(posting.html);
    if (here) return { status: "found", postingOrigin, formOrigin: new URL(posting.url).origin, hops, stoppedAt: here };
    const apply = extractRefs(posting.html, posting.url)
      .find(r => r.how === "link" && (APPLY.test(r.text) || /\/apply\b/i.test(new URL(r.url).pathname)));
    if (!apply) return { status: "none", postingOrigin, formOrigin: null, hops, stoppedAt: "no-apply-link" };
    const landed = await fetcher.fetchPage(apply.url, { kind: "apply" });
    hops.push(pathShape(apply.url));
    for (const h of landed.hops) hops.push(pathShape(h.to));
    return { status: "found", postingOrigin, formOrigin: new URL(landed.url).origin, hops, stoppedAt: stopOf(landed.html) || "page" };
  } catch (e) {
    if (e instanceof CrawlStop && e.code === "blocked") return { status: "blocked", postingOrigin, formOrigin: null, hops, stoppedAt: "blocked" };
    return { status: "error", error: String(e?.message || e).slice(0, 200), postingOrigin, formOrigin: null, hops, stoppedAt: null };
  }
}
