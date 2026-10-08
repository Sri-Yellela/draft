# Admin audit — D83 BUILD 2, step one

**Written 2026-10-08 (38s) by the agent. The owner marks each row KEEP / MERGE / RETIRE in the last column.**
Nothing here has been changed yet — ⛔ D83: *"Do not redesign every panel blind."* The rebuild order follows the marks.

**How it was measured.** Every admin surface was opened on a throwaway server (scratch database, paid keys blank) and
screenshotted — 16 shots in `WebstormProjects/draft-screenshots/d83-admin-audit/` (not committed). Every endpoint the
admin client calls was read from the code (`AdminPanel.jsx`, `adminOps.jsx`, `adminEnrichment.jsx`, `DBInspector.jsx`)
and every read endpoint was probed as admin: **32 of 32 answer 200, no page error on any tab** — so nothing is dead
at the wiring level; what is wrong is *overlap* and *the six rules*.

⚠ **"Who uses it" is NOT measured.** The usage evidence is production's `admin_audit_log` (every admin write),
`enrichment_batches`, `contact_messages`, the request tables and the crawler tables — a read-only query was written
but the production read was not permitted this session. The *Used?* column below is therefore what the code and the
WORKLOG say, not a count. One read-only run (the query is ready) turns it into numbers.

**The six rules** (D83): ① one sentence of purpose, codes behind a `?` · ② the state as numbers, no click · ③ one
obvious next step, a harmless read never the loudest · ④ a path where there is a process · ⑤ every write has a
confirm and an undo · ⑥ plain words, real controls, no capsules, both themes, keyboard.

---

## The table

*Writes* = changes data or spends money. *Proposed* is the agent's suggestion and the group from D83's map
(**Today** · **The board** · **People** · **Data** · **System**); the owner's mark decides.

| # | Where | What it does | Writes? | Overlaps | Breaks rules | Proposed | Owner's mark |
|---|---|---|---|---|---|---|---|
| 1 | Admin → **Today** | The daily glance: alerts, per-source ingestion, an enrichment card, scoring, apply, spend, deploy | no (Re-measure) | alerts + sources = #20 Pipeline Health · enrichment card = #13 · spend = #11, #16 · deploy = #2 | ② ✅ · ① no purpose line | **KEEP** as *Today*; the enrichment card becomes one number linking to #13 | |
| 2 | Ops → **Deploy — /api/version** | The running commit, migrations, contract, ATS weights | no | #3, Today's deploy box | ① a URL as its title | **MERGE** with #3 → *Today · Deployments* | |
| 3 | Ops → **Deployments — Railway's webhook** | The deploy-event feed from Railway | no | #2 | ① code in title (D76) | **MERGE** with #2 | |
| 4 | Ops → **Disk — the volume** (+ the banner on every tab) | Volume use, backups' share, the largest files | no | #15 Backups | ① code in title (D77) | **MERGE** with #15 → *Today · Disk and backups*; keep the banner | |
| 5 | Ops → **Board policy — age and scope** | The 120-day limit and the CS-only scope: dry-run counts, then *Enforce* and sweeps | **yes** — retires postings | — | ③ **two red Enforce buttons are the loudest thing on the tab** · ⑤ no undo shown · ① code (D78) | **KEEP** → *The board · Scope and age*; rebuild to the pattern | |
| 6 | Ops → **Full-auto kill switch** | Stops / pins / clears full-auto submission to employers | **yes** | — | ⑤ ✅ (states what it changes) | **KEEP** → *System · Feature switches* | |
| 7 | Ops → **Board-fit precompute** | Scores every active profile against the board; dry run first | **yes** (scores) | — | ① jargon ("precompute", "basis") | **KEEP** → *Data* — or retire to a CLI if the nightly pass covers it | |
| 8 | Ops → **Job data — in and out** | Export the board as NDJSON; import postings through the gateway, dry run first, revertible | **yes** | ⛔ **#13 and #21's *Import Enrichment* — the "three data in and out places"** | ① no line on how it differs from enrichment | **MERGE** → *Data · Job data in and out* (one place: postings in/out here; enrichment is #13) | |
| 9 | Ops → **Companies** (+ *Candidates — found by discovery*) | The configured companies with hiring heat; add (probes first), disable/enable; approve/reject candidates | **yes** | Pipeline Health's company table (#20) | ① codes (D80, D82) · ⑥ 30-row table with no filter | **KEEP** → *The board · Companies and candidates* (D83's 2nd in the rebuild order) | |
| 10 | Ops → **Slug harvest** | Finds new boards by search (spends SerpApi), import decisions, revertible | **yes** (spends) | — | ① families named as codes (`swe_backend`) | **KEEP** → *The board · Slug harvest* | |
| 11 | Ops → **Resume Master** (tools service) | Is the tools service up; draft's client configured | no | — | ① ✅ | **KEEP** → *System* (status) | |
| 12 | Ops → **Spend — /api/admin/analytics/spend** | Model spend today / 7 / 30 days from the ledger | no | #1 spend, #16 Usage | ① a URL as its title | **MERGE** with #16 → *Today · Costs and quotas* | |
| 13 | Admin → **Enrichment** | ✅ **Rebuilt (D83 BUILD 1)** — the round trip as six steps | **yes** (import, undo) | #21's *Import Enrichment* | — (built to the rules) | **KEEP** → *The board · Enrichment* | |
| 14 | Admin → **Crawler** | Pause / resume, dry / live, caps, schedule; enqueue J1; queue; deny-list | **yes** | — | ③ **Resume and Live are both loud** · ① code (D75) · ⑥ Set cap / Set time are prompts, not fields | **KEEP** → *The board · Crawler* (3rd in the order) | |
| 15 | System → **Users** + **Backups** (sub-tabs) | Create user, plan, delete (preview first); upgrade and profile requests · backups: create, restore | **yes** | Users = #17 · Backups = #4 | ⑤ restore uses a browser `confirm()` · ⑥ two levels of tabs | Users **MERGE** with #17 → *People · Users*; Backups **MERGE** with #4 | |
| 16 | Admin → **Usage** | Active users, résumés generated, postings discovered, tokens, API cost, cache savings, model calls | no | #12, #1 spend | ② **reads 0 everywhere: draft makes no model calls since D17** (generation is Resume Master's) | **MERGE** the live parts (users, résumés, postings) into *Today*; **RETIRE** the token / cache / cost tiles here | |
| 17 | Admin → **Users** (analytics) | Per-user résumés, tokens, cost, cache %, last active; **Limits** (edit quotas) | **yes** (Limits) | #15 Users | ② token / cost columns are 0 (as #16) | **MERGE** with #15 | |
| 18 | Admin → **Cache** | Prompt-cache read ratio of draft's own model calls | no | #16 | ② **always 0 — no model calls since D17** | **RETIRE** | |
| 19 | **Contact messages** (under **every** tab) | Messages from the site's contact form; mark read | yes (read flag) | itself, ×8 | ③ repeated on every tab, at the top of System | **MOVE** → *People · Messages*, an unread count in *Today* | |
| 20 | DB Inspector → **Pipeline Health** | Alerts, per-source health, per-company health, enrichment coverage per column, unenriched rows | no | #1 (alerts, sources) · #9 (companies) · #13 (coverage — **the third coverage view**) | ⑥ status capsules to check against D60 | **KEEP** as *Today*'s detail page; drop its coverage block (→ #13) | |
| 21 | DB Inspector → **Schema Explorer** | Tables, map view, copy schema, download .sql; **Import Enrichment** (the old round trip) | yes (Import Enrichment) | ⛔ *Import Enrichment* = #13 · the table list = #22 | ③ the old round trip still offered | **KEEP** read parts → *Data · Database*; **RETIRE** *Import Enrichment* (now links to #13) | |
| 22 | DB Inspector → **Table Browser** | Pick a table, page its rows | no | #21's table list | — | **MERGE** with #21 | |
| 23 | DB Inspector → **User Pool** | One user's job pool (what their board holds) | no | — | — | **KEEP** → *Data* (diagnostic) | |
| 24 | DB Inspector → **Job Review** | Every posting's role family: suggested vs current, reassign, unclassify, undo | **yes** (logged, undoable) | — | ③ two loud buttons per row × hundreds of rows | **KEEP** → *Data · Tags* (D72) | |
| 25 | DB Inspector → **Job Trace** | One posting's path through ingest, enrich, score | no | — | — | **KEEP** → *Data* (diagnostic) | |
| 26 | DB Inspector → **Query Simulator** | Simulate a user's board query; a raw `SELECT` sandbox (200 rows) | no (SELECT only) | — | ③ *Run* is loud for a read | **KEEP** → *Data* (diagnostic) | |

## What the table says, in five lines

1. **Nothing is dead by wiring** (32 / 32 endpoints live). **Three surfaces are dead by data:** *Usage*'s token / cost
   tiles, *Users*' token / cost columns and the whole *Cache* tab measure draft's own model calls — which D17 removed.
2. **The near-duplicates, as counted:** data in and out ×3 (#8, #13, #21) · deploy ×3 (#1, #2, #3) · spend ×3 (#1,
   #12, #16) · enrichment coverage ×3 (#1, #13, #20) · users ×2 (#15, #17) · alerts and sources ×2 (#1, #20) · table
   lists ×2 (#21, #22) · contact messages ×8 (#19).
3. **Operations is eleven unrelated cards in one scroll** (deploy, disk, policy, a kill switch, scoring, imports,
   companies, harvest, a service check, spend) — D83's map splits them across *Today*, *The board*, *Data* and *System*.
4. **The commonest rule breaks:** project codes and URLs in titles (#2, #3, #4, #5, #9, #12, #14) · a loud button on
   a harmless or a dangerous action (#5, #14, #24, #26) · prompts and `confirm()` in place of fields and dialogs (#14, #15).
5. **Where it lands on D83's map:** *Today* #1 #2+#3 #4+#15b #12+#16 · *The board* #5 #9 #10 #13 #14 · *People*
   #15a+#17 #19 · *Data* #7 #8 #21+#22 #23 #24 #25 #26 · *System* #6 #11 · *retired* #18 and #21's import.

## ⛔ The owner decides
**The marks** (last column) · **the map's groups** · **the rebuild order** — D83 proposes *Ops → Companies and
Candidates → Crawler → Deployments → Slug harvest → Tags → the rest*; with the marks above, *Ops* stops being one
page and the order becomes *Companies → Crawler → Today (deploy, disk, costs) → Slug harvest → Tags → Data → People*.
