# Crawler worker — the pilot

**Status:** design, written 2026-10-08 (D75). Nothing here is built.
**Owner's direction:** *the crawl, the freshness and adding companies via the ATS domains is where a VM could
prove useful — it could explore companies and come back with the URLs.* **Public, non-ToS pages only — nothing
in the LinkedIn class.**

**Read with:** `D74` in `WORKLOG.md` (the ingestion probe), `COMPANY_LIST_STRATEGY.md` (§3, §4),
`E3_SECURITY_DESIGN.md` (the worker boundary), `VM_EXECUTION.md` (the later user-session worker).

---

## 0 · What a VM adds — and what it does not

**It adds nothing to the crawl itself.** Greenhouse, Lever, Ashby, Workable, Recruitee and SmartRecruiters publish
public JSON; one HTTP request beats a browser on cost, speed and reliability. **The existing adapters keep
crawling postings, and no postings are crawled by the worker in the pilot.** Freshness is cadence and scoring on
arrival (D74 P1 / P2), not a browser.

**It adds a browser where there is no API** — exactly one problem: **finding which ATS a company uses, and where
its board lives, when the answer is not in a list.** That is the *volume* problem (D74 P3): the board is ~22
companies and grows only by adding companies.

---

## 1 · The jobs

| | Job | What the worker does | Why a browser |
|---|---|---|---|
| **J1** | **Find a company's board** | Given a company domain: open its careers page, follow job links, and report **which ATS** (vendor + slug) it loads | career pages are often rendered by JavaScript; the vendor shows up in the **network requests**, not the HTML |
| **J2** | **Learn where Apply lands** (D67 part 1) | For one sample posting per site, follow the **Apply** link and record **the posting origin and the form origin**; **stop at the first form** | an Apply click redirects (Amazon: `amazon.jobs` → `account.amazon.jobs`); only a browser sees the hop |
| J3 | Custom career sites (iCIMS, Oracle, bespoke) | read JSON-LD `JobPosting` | **not in the pilot** — one adapter per vendor later, chosen by what J1 finds most often |

**The pilot is J1 + J2.**

---

## 2 · Rules of engagement — the line is ToS and robots, not technique

⛔ **Public pages only: anything an anonymous visitor can load.**

**The worker WILL:**
- honour **`robots.txt`** (fetched per host, cached; a disallowed path is never requested) and any `Crawl-delay`;
- **identify itself:** `User-Agent: DraftCrawler/1.0 (+https://jobsviadraft.com/crawler; abuse@jobsviadraft.com)`,
  with a public `/crawler` page saying what it is, what it reads, and how to be excluded;
- **rate-limit per host** (default one request per 2 s, a cap on pages per company, a total budget per run);
- use a **fresh browser context per company** — no cookies carried between companies.

**The worker will NEVER:**
- **log in, create an account, type into a field, submit a form, or press anything but a navigation link and the
  Apply link;**
- **solve or evade a CAPTCHA, a bot challenge or a rate-limit** — a challenge means *stop, record `blocked`, do not
  retry that host that day*;
- visit a **deny-listed domain:** `linkedin.com`, `indeed.com`, `glassdoor.com`, `ziprecruiter.com`, `monster.com`,
  and any aggregator whose terms restrict automated access. **The deny-list is data, owner-editable, and wins over
  every task.** A takedown request adds a domain to it the same day;
- record a **query string** — only origins and path *shapes*, because query strings carry tokens (D69(c)'s rule);
- use a model. **No model call anywhere (D17)** — a fixed ladder of link patterns, not an agent exploring.

⚠ This is a design position, **not legal advice.** Sites' terms vary; the posture above (public pages, robots,
identification, low rate, takedown) is the conservative one, and the owner's counsel agenda should cover it before
the worker runs at volume.

---

## 3 · Architecture — a worker that cannot reach the database

```
 draft (web app)                                   crawler worker  (separate service / VM)
 ───────────────                                   ──────────────────────────────────────
 crawler_tasks table  ◀── lease ──  GET  /api/crawler/next      {type, domain|url, budget}
 validates results    ◀── push ───  POST /api/crawler/result    HMAC-signed JSON
 harvest → validateBoard → admin add (dry by default; NEVER auto-enable)
```

- ⛔ **The worker holds NO database credentials and NO user data.** It sees a task and returns a result. **Draft
  decides what to do with it.** The only secret on the worker is `CRAWLER_TOKEN` (HMAC signing + lease auth).
- ⛔ **A separate service from the one that will later hold users' portal sessions (E3).** A crawler opens
  arbitrary hostile pages; a browser exploit reaching a process with decrypted sessions would defeat the whole
  encryption design. **Separate container, separate deploy permissions.** Building the pilot this way **rehearses
  the boundary E3 requires**, with no user data at stake.
- **The queue lives in draft** — `crawler_tasks(id, type, input_json, status, lease_until, attempts, result_json,
  created_at)` — so a dead worker's task is simply re-leased, and **draft** enforces the kill switch and the budgets.
- **Kill switch:** `CRAWLER_PAUSED` is checked at **lease time** and by the worker **between pages**; it stops within
  one task.
- **Limits:** one or two concurrent browser contexts, a per-task wall-clock timeout, a per-run page and byte budget,
  Chromium run **non-root, sandboxed, downloads / notifications / geolocation off.**
- ⛔ **SSRF guard.** Task URLs derive from untrusted data. The worker **refuses `localhost`, private ranges
  (RFC 1918), link-local and cloud-metadata addresses (`169.254.169.254`)**, **re-checks after every redirect**, and
  **only follows `http` / `https`.**

---

## 4 · J1 — finding a board: the ladder, **browser last**

1. **Plain HTTP first** (cheap): fetch the domain's `/careers`, `/jobs`, `/careers/jobs`, `/join-us`; parse every
   link, `<script src>` and `<iframe src>` for **known ATS hosts** (`boards.greenhouse.io`, `jobs.lever.co`,
   `jobs.ashbyhq.com`, `apply.workable.com`, `*.recruitee.com`, `jobs.smartrecruiters.com`, `*.myworkdayjobs.com`,
   `*.icims.com` …). The detection already exists — `detectKnownAtsMatch` in `services/jobs/importJob.js`.
2. **Only if that finds nothing and the page is client-rendered** (an empty body, almost no links): launch the
   browser, load the page, **follow `careers / jobs / openings / join us` links to a depth of two**, and read:
   - ⭐ **the network log** — the page's own requests to `boards-api.greenhouse.io/v1/boards/<slug>` or
     `api.ashbyhq.com/posting-api/job-board/<slug>` are the strongest evidence;
   - iframes, redirects, `<script src>`.
3. **Report**, per company: `status` (`found` · `none` · `blocked` · `error`), `careersUrl`, `atsType`, `slug`,
   and **the evidence** — each item `{url shape, how: link | iframe | redirect | script | network}`.
4. Draft feeds `found` pairs into the **existing** harvest path → `validateBoard` (live, non-empty, **description
   coverage — never 0%**, US evidence) → the admin dry-run add. ⛔ **Never auto-enabled** — a URL proves a page
   exists, not that a board is worth crawling.
5. **Tally the `none`s by vendor** — the ATSes the worker finds most often **without** an adapter are *the* input
   to deciding what to build next.

**Where tasks come from:** curated lists with domains · **captured jobs from unconfigured companies** (a real
person cared; the `ashby/hims-and-hers` capture is one) · user "add a company" requests · D20's sweep companies
that returned no slug.

---

## 5 · J2 — where Apply lands (D67 part 1)

- **The sample postings come from our own board** — one per ATS / site family, from the apply URLs we already hold.
  **No web browsing to find them.**
- The worker loads the posting, **clicks the Apply link, follows the redirect chain, and stops at the first form,
  login wall or account wall.** It records the **origin and path shape of each hop** — `posting origin → form
  origin` — and `stoppedAt`: `form` · `login-wall` · `account-wall` · `blocked`.
- Output goes to D67's **`apply_origin_pairs`** as an **observed** pair with `source = 'crawler'`.
- ⛔ **The Workday exception stands:** its application site is shared by every Workday employer, so a mapping would
  let a packet be filled on the wrong employer's form. **The worker records the Workday observation but the table's
  guard refuses to insert a shared-host mapping.**
- ⛔ It **never fills, types or submits** — it ends on the first form and reads nothing in it.

---

## 6 · What must be true before the first live task

| | Test |
|---|---|
| Robots | a fixture whose `robots.txt` disallows a path → **never requested** |
| Deny-list | a task for `linkedin.com` is **refused at lease time** |
| SSRF | `http://169.254.169.254/`, `localhost`, and **a redirect into a private range** are all refused |
| No interaction | an **interaction audit log** shows **zero** keystrokes, form submits or clicks other than navigation and Apply |
| No secrets | a test asserts the worker's environment contains **only** the allowed variables — **no DB path, no API keys, no user data** |
| Kill switch | `CRAWLER_PAUSED` stops a running task within one page |
| Budgets | a task past its page / time budget ends with `error: budget`, not a hang |

**Local fixtures first — no external network.** Extend `scripts/fakeAts.js` with fake **careers sites**: a static
link to a board · **a JS-rendered page whose board appears only in a network request** · an iframe · **a two-origin
Apply hop (the Amazon shape)** · a page that throws a bot challenge · a `robots.txt` that forbids. The worker runs
against them in CI.

---

## 7 · The pilot's acceptance

- **J1:** on a **known-answer set of ~30 companies** (Linear → ashby/linear, Stripe → greenhouse/stripe, …) it names
  the correct `(vendor, slug)` for **≥ 90%** and **names a wrong one for none** — *a wrong answer is worse than none.*
- **J2:** the sweep fills `apply_origin_pairs` for the sites O84 listed, with **no Workday mapping.**
- **Cost and safety:** a stated cost per 100 companies; **zero** interaction-audit violations; the kill switch proven
  mid-run.
- **Yield (D74's lens):** **new crawlable `(vendor, slug)` pairs per 100 companies**, and the `none`s tallied by
  vendor.

---

## 8 · Wiring — what the owner provides, and in what order

**The worker is a Docker image; where it runs is a choice, not a design constraint.**

| Option | What you need | Notes |
|---|---|---|
| **A · A third service in the existing Railway project** *(recommended for the pilot)* | nothing new — a service beside `draft` and `resume-master`, deployed from this repo's `crawler/` folder | no new vendor, one Railway workflow. Variables, domain and volume are **per service**, so the worker's container sees none of theirs; draft's data is **SQLite on a service-private volume — there is no network-reachable database.** **Guardrails:** mount no volume · reference no other service's variables · call draft by its **public** URL, never `.railway.internal`. ⚠ What *is* shared project-wide is the private network and who can open the project. **Move to a separate workspace or a VPS (B) before E3's session worker, or before a second person joins** — and note that an account-level suspension is not isolated by any Railway layout |
| **B · A small VPS** (Hetzner, DigitalOcean …) | the provider account, an **SSH key**, Docker | cheapest per month; one more thing to patch |
| **C · A hosted-browser API** | its API key | least code; ties a core step to a vendor, and per-minute pricing |

**Whichever you pick, you also generate one secret:** `CRAWLER_TOKEN` — **long, random, set on the draft service
and on the worker, never committed, never pasted into chat.**

**Order:** (0) the agent builds the worker, the queue, the endpoints and the **fixture tests locally** — **no keys
needed** → (1) you provide the host and `CRAWLER_TOKEN` → (2) deploy; `/health`; **dry-run mode** (logs the requests
it *would* make) → (3) **5 live tasks**, read the results by hand → (4) **25** → (5) review the report, **then** a
schedule.

---

## 9 · Not in the pilot

Logged-in crawling of **any** site · LinkedIn-class sites · CAPTCHA solving · proxies or residential IPs · a
model-driven explorer · **anything touching a user's session** (that is E3, behind O12) · crawling postings
themselves.

---

*Related: D74 (ingestion) · D20 (slug harvest) · D67 (Apply origins) · D17 (no model calls) · E3 / O12 · AUTOFILL_TARGET.md §7.*
