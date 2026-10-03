// ── The draft browser extension: where it is installed from (D12) ─────────────────────────────
//
// Since D11 the extension is the ONLY import path — Full House has no IMPORT control — so installing
// it is a dependency, not a nice-to-have. Every "get the extension" control on the site reads this
// one value, so the day the listing moves (unlisted -> public, or a new item) is a one-line change.
//
// ⛔ NULL UNTIL THE OWNER SUPPLIES THE ITEM. The Chrome Web Store item id is not in this repository
// (WORKLOG O55). While it is null the page says the store link is not published yet and offers
// nothing to click — a fake or guessed install link is worse than none. An UNLISTED item is still
// installable by anyone holding its link, so the link works before any decision to go public.
//
// Shape when set: "https://chromewebstore.google.com/detail/<item-id>" (optionally with a name slug
// before the id); test/d12ExtensionInstall.test.js refuses anything else.
export const EXTENSION_STORE_URL = null;

/** The site's own page that explains and installs the extension. */
export const EXTENSION_PAGE = "/extension";

/** True when `url` is a Chrome Web Store detail link (the only kind EXTENSION_STORE_URL may hold). */
export function isStoreDetailUrl(url) {
  return typeof url === "string" && /^https:\/\/chromewebstore\.google\.com\/detail\/([^/?#]+\/)?[a-p]{32}$/.test(url);
}
