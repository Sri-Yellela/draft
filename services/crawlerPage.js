// services/crawlerPage.js — ⛔ D75 · the public page the crawler's User-Agent names (docs/CRAWLER_WORKER.md §2):
// what it is, what it reads, the rules it keeps, and how a site owner excludes it. Served at /crawler.
// Words only — no tracking, no script.
import { CANONICAL_ORIGIN } from "../shared/brand.js";
import { USER_AGENT } from "../crawler/lib/guards.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

export const CRAWLER_PAGE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DraftCrawler</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;color:#222;background:#fff}
code,pre{font:14px ui-monospace,monospace;background:#f3f3f3;padding:.1rem .3rem}pre{padding:.6rem;overflow:auto}
@media (prefers-color-scheme:dark){body{color:#e6e6e6;background:#151515}code,pre{background:#262626}}</style></head>
<body>
<h1>DraftCrawler</h1>
<p>DraftCrawler is the crawler of <a href="${esc(CANONICAL_ORIGIN)}">${esc(new URL(CANONICAL_ORIGIN).host)}</a>, a job board.
It identifies itself as:</p>
<pre>${esc(USER_AGENT)}</pre>
<h2>What it reads</h2>
<p>Public career pages, to learn <strong>which applicant-tracking system a company uses</strong> and where its public job
board lives, and — for a posting already on our board — <strong>which address its Apply link leads to</strong>. It stops at
the first form it reaches and reads nothing in it.</p>
<h2>The rules it keeps</h2>
<ul>
<li>Public pages only. It never logs in, creates an account, types into a field, submits a form, or presses anything but a
navigation link and an Apply link.</li>
<li>It honours <code>robots.txt</code>, including <code>Crawl-delay</code>, and waits at least two seconds between requests to one host.</li>
<li>It never solves or works around a CAPTCHA or a bot challenge — it stops, and does not retry that site that day.</li>
<li>It does not keep query strings.</li>
<li>It does not visit sites whose terms restrict automated access; a request to stop is honoured the same day.</li>
</ul>
<h2>To exclude it</h2>
<pre>User-agent: DraftCrawler
Disallow: /</pre>
<p>Or write to <a href="mailto:abuse@${esc(new URL(CANONICAL_ORIGIN).host)}">abuse@${esc(new URL(CANONICAL_ORIGIN).host)}</a> with your domain,
and it is added to the crawler's deny-list.</p>
</body></html>`;
