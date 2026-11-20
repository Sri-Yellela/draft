# TRACKS triage — the older rows of docs/WORKLOG.md "TRACKS — THE WORK, BY LABEL" (lines ~75–160)

Read-only triage, 2026-11-20. Evidence = WORKLOG line numbers (as of 7,785 lines) + draft commits (every cited SHA checked
`git merge-base --is-ancestor <sha> origin/main` → IN; local main = origin/main, 0 ahead / 0 behind). "Live" = on origin/main,
which production runs (46y measured `c3c4736`…`faafe84`, then the log commit `b9bc6c70`).

Classes: DONE · SUPERSEDED · OPEN-AGENT · OPEN-OWNER · UNKNOWN. Sizes S/M/L. "Needs" = Chrome / scale fixture / production / RM / server.js / migration / client / extension.

| item | class | evidence | what's left | size | needs |
|---|---|---|---|---|---|
| **T1 RELIABILITY** | | | | | |
| D173 (1) untrusted text is data | DONE | `c1fa0f3` + RM `c8bffe2` (45g, pushed L1772); tail `a0b1836` (45n L1533: `callTask` refuses unfenced kinds) | — | | |
| D173 (2)+(3) assistant security model, three memories | DONE | `a335c3d` docs/ASSISTANT.md (L1536); enforced by the fence | — | | |
| D173 (4) one definition per number | DONE | `0271582` shared/metricDefinitions.js + d173OneDefinitionPerMetric (L1534) | — | | |
| D173 (5)+(8) one request id; SERVICES.md / VENDORS.md | DONE | `7677b15` + RM `17128b6` (L1761, live L1724) | — | | |
| D173 (9) funnel as one chain | DONE | `68d0f35` (L1535) | — | | |
| D173 (6) coding-agent tool hygiene | OPEN-OWNER | never mentioned after the row (L5350) | pin MCP server versions, allowlist servers, narrow file access, no prod keys on the laptop — Claude Code / MCP settings are the owner's (the agent may not change its own config) | S | owner |
| D173 (7) harden the extension | OPEN-AGENT | never addressed after the row (L5351); content script already isolated-world (L2717); 46w host-permission justification exists | a written review of what each content script can read + the tightest host permissions check against manifest v1.7.0 (`extension/manifest.json`), recorded in a doc; any narrowing = a new zip/version | S | extension |
| D173 (10) pricing | OPEN-OWNER | row → [OPEN]; billing scaffolding migration 267 exists; Stripe TEST keys / real prices still owner items (L937, L968) | value metric + prices + Stripe keys | — | owner |
| D170 (1) semi-auto didn't wait for the résumé | DONE | answered by D165 R1 `7b36987` / `996b139` (L1877, L1908) | — | | |
| D170 (2) full A+ on Sonnet by default | DONE | `5aff83bb` tailoring = strategy × model, lean default (L1800); M-6: no DRAFT_TAILORING needed | — | | |
| D170 (3) ATS weights cliff | DONE | `2e5360ee` 45h FA8 green; CURRENT STATE: fresh 3.3 d, 3,701 terms (11-10) | — | | |
| D170 (4) crawler failures | DONE | `84736ab`, `1c710b7f` (L1879) | — | | |
| D170 (5) logo providers | DONE | `1c263e59` | — | | |
| D170 (6) log noise | DONE | `9c0ec25` (L1878) | — | | |
| D170 (7) Railway variables | OPEN-OWNER | still on owner lists L1042 / L1500 / 46j L730, L760; O3, O104 | remove `JOBO_API_KEY` (+ revoke), delete stray `RESUME_MASTER_CLIENT_TOKENS` on draft, webhook `Authorization: Bearer` header (O104, 401 since D76), `INBOX_RETENTION_DAYS=180`; Gmail / Resend / VAPID keys when wanted | S | owner, production |
| D170 (8) 90 question drafts on production | OPEN-OWNER (UNKNOWN if done) | L1042 "(if not done)", L1500 (16); production DB not readable | owner checks Admin → Data → Question bank on production | S | owner |
| A126 (1)(2)(3) site-wide freeze, read pool | DONE | `6fc54d97`, `0f114fd6`, `888dc0f5` + (4)–(9) `bb314f0c`…`70f3bec2`; the row's "Next" reads moved too: `ded7bb16` (best-bets, deal, suggest index), `765f8d9c` (board-fit plan pages) | — | | |
| A133 frozen deck | DONE | `7571b038` (45a, L1933), pushed | production `[deck] re-dealt` read never recorded (no traffic at the time, L1874) — not worth a row | | |
| D156 (6) loading bug | DONE | client guard `038c221` + server cause `39854cf` (L2066–2067), pushed 44v (L2074); A126 behind it | — | | |
| D151 Rule 1 listen first / healthcheck | DONE | `812b93c` `0bfc733` (L2154); boots now listen ≈1.9 s, ready 4–5 s (46y readyMs 4,187) | the deploy window itself is structural (volume = old container stops first, L2152; memory "Railway volume") — only an infra change (no volume / external DB) removes it → owner | — | owner (infra) |
| D151 Rule 2 one background job system | DONE | `39690237` migration 261 bg_jobs (L5188); Admin view `e65a7800` (46c) | — | | |
| D151 Rules 3 / 6 | DONE | `1b6beb0` systemHealth, Diagnostics, scoped token (L1531) | — | | |
| D151 Rule 4 nightly archive | OPEN-OWNER | `d3d815f` migration 265, behind `posting_archive_enabled` OFF (L1403); "turning on, when wanted: … the posting archive" (L1414) | the owner's switch-on (agent then watches the first night) | S | owner, production |
| D151 Rule 5 scale fixture + suite | DONE (100k) / OPEN-AGENT (500k) / OPEN-OWNER (CI) | `dd811b6` (L1729); `npm run test:scale` + `test:scale:500k` in package.json; 100k board p95 278 ms passes the 300 ms budget (46n L606 item 3); no `.github/workflows` exists; no 500k measurement anywhere in the log | agent: one 500k run with the budgets reported (memory-heavy; heavy-job lock); owner: whether to add CI at all | L | scale fixture |
| D153 (2) filter counts add up | DONE | `beb83d1`, `6c17591` (L5601, L5603) | — | | |
| D153 (3) classify the unclassified board (≥ 95 %) | OPEN-OWNER → then agent | `99e5911e` background walk; production facets 11-09: 9,947 unclassified of 78,948 (≈ 87 % classified, L1382); A141 "past 55 %" waits on the 50 taxonomy spot-checks (L1393, L1404) | owner: the 50 spot-checks in `content/taxonomy/labelled-v1.json`; then agent: the next classifier pass, measured | M | owner, scale fixture |
| D153 (6) computed once, cached | DONE | `bd382cc4` lastGood (L1532) + the client half (44w) | — | | |
| The 11-03 deck bug | DONE | `b43f87be` (no request blocks on the Atlas queue) + D156 (6) guard + A126 | — | | |
| A127 dependency audit | DONE | `ba6b2a52` (in-range), `0e53ba8c` session store on better-sqlite3, `32933a91` puppeteer-core 25; O101 decided + built `f18d409` (L3117) | [OPEN] 9 (c) node-cron/exceljs and (d) vite 8 **accepted by decision** — nothing open | | |
| [OPEN] 9 a–d | DONE | = O101 above: (a) store replaced, (b) taken, (c) (d) accepted | — | | |
| A112 crawler boost | DONE | board 3,734 → 81,510 (L2166); fit precompute `9ae06fba` | — | | |
| D127 category leak rule | DONE | `services/jobs/professionalScope.js` holds `held:non_professional`; server.js L8182 "never for a held posting"; A171 `14c5f6b7` | the remaining unclassified-but-professional share is D153 (3) | | |
| D137 ghost score | DONE | `b8b72d1b`, P3 `1051ca8b` | — | | |
| D140 job-data feed | SUPERSEDED (TheirStack) / OPEN-OWNER (Hirebase) | P0 done (L2220); TheirStack PARKED 11-09 (L5184, harness `9c427073`); Hirebase first (D185, L1248); HB-1…HB-8 infra built `eb591b1f` `7cb86b7b` | owner: set `HIREBASE_ENABLED=1` / `HIREBASE_DRY_RUN=0`, run the 100-job sample, buy Starter (L1042) | — | owner, production |
| **T2 SCREENS** | | | | | |
| D149 build sketches as designed | OPEN-OWNER (sign-off) | rule followed throughout (e.g. `e12cfedc`, `6a2017ed` "D149's sketch wins"); O98 "sign off the jobs page" still open (L3114) | owner's per-screen sign-off (O98 for the jobs page) | — | owner |
| D152 + D156 jobs page ("draft screen") | DONE | D152 (2)–(8) `42719315` `c70e1404` `c0848ae8` `051e03a7` `237fe084` `4869415d` `1e5324c1`; D156 (1c)(1d) `2d5e2d11` | owner sign-off = O98 | | |
| D146 one tracker | DONE | `7bffa183`; title Home decided (O99 a, A134 `0c4411f`) | — | | |
| D147 posting restyle | DONE | `afc1c751`; now the deck card's long post (D156 1c) | — | | |
| D148 auto-apply settings | DONE | `d7f20310`, `d1536143` | the *Answer routine questions for me* fold has no setting (A120, L5667) — hangs on D123 P7 (owner) | | |
| D145 declutter | DONE | `b71f7892` audit, `3877b140`, side menu retired `ffd57262` | [OPEN] 2 (feedback section data) is owner | | |
| D133 Studio theme | DONE | `0464fd1e`, live `b02b385` with `studioForUsers: false` (L2320) | offering it to users = owner's call (low value) | | |
| D153 (1) (5) layout, facts box | DONE | `237fe084`, `d705aff4` | — | | |
| A109 sponsorship in expanded posting + filter | DONE | `e9396c33`; later D121 `81734aab` | — | | |
| D163 use the space | DONE | `bfade24f`, `737f1ad7`; 46q FULL WIDTH `92db11bc` | sign-off under O98 | | |
| D166 legacy screens | DONE (T1) / OPEN-OWNER (T2) / OPEN-AGENT (refresh) | T1 `4400e5b4` docs/D166_INVENTORY.md (L1728); T2 = "the chat assistant sketches each, owner approves" (L5444) — no T2 sketch logged; since then 46q/46u/A233 redesigns touched many screens | agent: re-mark D166_INVENTORY.md against today's code (which legacy screens remain); owner: sketches for what remains | S (refresh) | client, Chrome |
| D167 site map / dock | DONE (mostly) / OPEN-AGENT (Home fidelity) | dock `21ff9b53`, Atlas nav `a6f216cf`, Profile + Interview `5104dbfc`, PlaceNav `256895f0`; Tiny replaced Ask draft (46n, `57339bb0`); "Home sketched 11-06, waiting on the owner" (L103) and "Home was rebuilt on D146's tracker" (L1648) — no log line shows Home checked piece-by-piece against `docs/sketches/home-sketch.html` (Inbox inside Home, auto-apply bar + timeline) | agent: a D179-style fidelity probe of Home vs `home-sketch.html` (both themes, 1440/400), build the missing pieces | M | client, Chrome |
| D168 one open path, wheel | DONE | `0ce1dcd5` | — | | |
| T2 "Next": jobs page → Home → settings | DONE | as the three rows above | — | | |
| **T3 LEARNING** | | | | | |
| D169 Your skills in Atlas; prove before résumé | DONE (revised) | `0ca534bb` migration 223; 11-19 ATS card option C `0c8007fa` removed prove-it/claims from the posting panel; quick check reachable from Atlas → Your skills `5545ff43` | — | | |
| D150 T01–T09, T12 data, T16 | DONE | `5bd1c11a` T01–T03, `2756be53` T04, `9660daf6`+`98d015c8` T05–T08, `127d0c9b` T08 OG, `864be2a2` T09 (m248), `835483d0` T12 (m249), `d2f8c3fb` T16 | — | | |
| D150 T10 / T11 / T13 / T15 | OPEN-OWNER | each "waits for its sketch" (L5636–5641); T09's data exists (`/api/admin/market-week`) | owner: sketches for the in-app market card (T10), public `/market/<field>` pages (T11), company-guide page (T13), route-as-stack (T15) | — | owner |
| D150 T12 consent checkbox | OPEN-OWNER | data layer built, "Share anonymously" NOT offered — waits on privacy wording + counsel (L1530, 16h) | counsel / privacy wording | — | owner |
| D150 T14 questions inside Learn + spaced review | OPEN-AGENT (partial) | spaced review exists in the daily question (`services/learn/dailyQuestion.js` REVIEW_DAYS 1/3/7/21); per-piece "checked" state, the 3–5 items per Learn piece and the quiet "3 to review" line on the Learn home not found | agent: piece-level checked state + review line from existing bank items; new items need owner approval | M | client, server |
| D154 daily practice | DONE | P1/P3/P5 `7864c78e`, P2 `413b2312`, P1(4) `27b11b1f`, P1 step 3 `be165fc9`, P4 `97eb365c`, P6+P7 `acd99c48`, P8 `52b0400d`, P9 `331dc649`; 12 practice items approved 11-08 ([OPEN] 7) | owner: approve the five AI-engineering builds `content/decks/builds-v1.json` (16d); P10 discussion is the owner's call | — | owner |
| D155 playbook + Part C content | DONE | decks v2…v24, owner approved all `90178ed4` ("193 questions live") | — | | |
| D142 CHECK | DONE | `1ab486f` migration 217 | owner: the 20 readiness drafts' review (L2230) if never done | | |
| D142 CLOSE / PLAY | OPEN-OWNER | CLOSE = the builds (D154 P8, approval pending); PLAY = League / Challenges built behind switches (L1414 "turning on, when wanted") | owner: approve builds; switch on League/Challenges | — | owner |
| D142 DEFEND | OPEN-AGENT | `client/src/pages/interview/InterviewPage.jsx:11` "Defend not built"; L239 a "Coming" card | per-bullet follow-up questions, deterministic (templates from the bullet's skills/claims + the honesty check's flags; no model per D190), on the Interview page's Defend panel | M | client, server |
| D143 navigator | DONE | `3b2554f9` m215; now "Your route" panel after A228 | — | | |
| D141 honesty check | DONE / OPEN-AGENT (small) | `b39a6dec` /tools/honesty; "Not built: sign-up to save and fix" (L5777); "privacy page names no public tools" | agent: sign-up-to-save hand-off; owner: privacy wording for public tools | S | client, server |
| D139 career changers | DONE (P1–P2) / OPEN-OWNER (rest) | `8e5c1a13`; "Not built: résumé framing inside tailoring (tools service), P3" (L5763) | framing inside tailoring changes the tailoring prompt → needs the D123 blind check; owner to schedule | — | owner, RM |
| D116 / D117 / D120 Your map + Learn | DONE then partly SUPERSEDED | D116 `b79cad36` `0afbf7f0`, D117 `1357106f` `d54f4054`, D120 `e518907f` `383bc512`; A228 `9c7833bb` (46r) retired the market tree, ring map, For a role, Compare roles, AtlasHome; A230 `5afb7390` removed the orphan endpoints | — | | |
| D125 ATS calibration desk | DONE | `d39dfbf3`, `b174bec5` (walked 14/14), pushed 43z | A122 "kafka" ambiguous-word decision is owner (16g) | | |
| **T4 MODELS** | | | | | |
| D162 G1–G4 | DONE | `5f611620` m221; G4 card `2b86c193` (46f) | — | | |
| D162 G6 source on outputs | DONE | `a4ab2fd3` m247 | the "dataset builds refuse Claude rows" half belongs to D160 (not started) | | |
| D162 G3 thresholds | DONE (decided) | O105 decision (1) recorded 11-08 (L1520) | — | | |
| D162 G5 providers (open-weight hosted) | OPEN-OWNER | L114 "G5 needs a D17 / A87 decision"; no provider key | owner: a hosted open-model provider + key + spend, and the D17 / D190 reading | — | owner |
| D123 P3 provider-neutral client | DONE | RM `src/model/modelClient.js` (L2426) | — | | |
| D123 P5 open-model trial | OPEN-OWNER | never run (no Nemotron result in the log) | provider account/key + spend cap | — | owner, RM |
| D123 P6 payload tailoring | DONE | `51c7eea0`, `417b827e`; FIX 5 harness run $1.33 (L1522) | owner's blind pairs (16f) in `d171-fix5-live/blind/` | | |
| D123 P7 routine answers by Haiku | OPEN-OWNER | `shared/modelTasks.js:81` `answers.routine` status **planned**; A120 setting missing; since then A182 / A197 answer free text from the résumé deterministically and D190 (11-14) says site data never calls a model | owner: is P7 still wanted after D190 + A197, or retire it (then drop the task + D148's fold) | — | owner |
| D160 P0–P1 own model | OPEN-OWNER | "LOGGED, NOT SCHEDULED" (L5468); [OPEN] 8 consent wording before D160 | consent wording, data register sign-off, GPU/hardware | L | owner |
| D160 P2 / T5 assistant | SUPERSEDED | T5 v1 `b3bf9dcd` (m271); D190 Tiny (T1 actions / T2 lookups without a model, T3 only on explicit ask) `79810166` `a9ce5eb9`; Tiny floating 46n | the model key for T3 on production was FAILED at 46m (L8 of CURRENT STATE) — owner | | |
| **T6 INTERVIEW** | | | | | |
| D110 interview mode | DONE | `607f29cf` / merge `d892ace3` m186 | BYOM tool listing is an owner call (D86) | | |
| D161 voice coach | OPEN-OWNER | 0 commits; "LOGGED, NOT SCHEDULED"; [OPEN] 8 voice consent | consent wording, hosted speech vendor + spend, how it fits D190 | L | owner |
| **T7 APPLY** | | | | | |
| D175 FA1 read the chain | SUPERSEDED | replaced by A-2's run trace `db827526` (Admin → System → Runs) because prod DB reads are refused | reading a real chain needs a real run (owner M-4) | | |
| D175 FA2 canary | DONE (code) | `11206edb`; canary account made 11-09 (L1042) | owner: re-upload Maya Chen on the canary (D186-6, L1246) | | |
| D175 FA3 / FA4 / FA5 / FA6 | DONE | `ae85d6e4`, `1b0c8385`, `1cd9ae6e` (+A207 `8888fd65`, A209 `ece59e54`), `449ee13a` | FA6's four checks turn green only with M-1 (cost alarm) + M-3 (two safety tests) — owner | | |
| D175 FA7 claim guard refusal rate | OPEN-OWNER | 0 commits; needs real generations, read in Admin → Runs (admin session) | owner runs (M-4) then agent reads with an admin session the owner provides | S | owner, production |
| D175 FA8 ATS weights | DONE | `2e5360ee` | — | | |
| D175 FA9 first real full-auto run | OPEN-OWNER | gated on M-5 "go FA9" (L1280) | owner | — | owner |
| D171 the owner's semi-auto try | DONE | FIX 1+2 `1c4dbeac` (m224), FIX 3 `cc37ca43`, FIX 4 `a3e4ce9a` `84b08fc8`, FIX 5 harness `5a3cf931`; lean default `5aff83bb` | owner: M-1 cost alarm, FIX 5 blind pairs | | |
| D165 semi-auto failed — audit + rules | DONE | R1–R3 `996b1390`, (3) `514e3e2a`, (5) `a2fbaf8c` `aa51f779`, A6 `23e7acd7` | — | | |
| D164 T1–T3 | DONE | `af1cbb24`, `afad12f5`, `ec4b21ea` | — | | |
| D164 T4 owner's semi-auto walk (O106) | OPEN-OWNER | O106 open (L3122); the owner has since run real drafts (46j L861) but no formal T4 acceptance is recorded | owner | — | owner, production |
| D157 résumé editor = RM's tool | DONE | 45c T2–T5 RM `6d8d379` + draft `84b08fc8` `db1619d4`; (i) `/draft/resume/<job>` `4e10cc14`; (ii) Profile → *Open in the editor* `client/src/pages/profile/YourProfile.jsx:325`; T6 RM `3ef29de` `7940c2f` | 46y RM P4 (`2f890f7`) restyled the editor — "draft's EMBEDDED editor against the new RM not walked live" (L196) → OPEN-AGENT walk (below) | | |
| D157 embedded editor vs RM 2f890f7 | OPEN-AGENT | L196 Unknown | real-Chrome walk: draft posting → Résumé → editor (rm-editor/1) loads, saves, exports, Back/Esc; both themes | S | Chrome, RM, production/staging |
| D158 managed portals | OPEN-OWNER | 0 commits; "security review first" + [OPEN] 8 | security review, per-board terms, consent wording | L | owner |
| D159 T1 follow a company | DONE | `237285f5` m237 | — | | |
| D159 T2–T4 search / URL / platform trackers | OPEN-AGENT | no commits; D185-2 new-match alerts `4856fdb1` covers part of T2's "hear when something new fits" | T2 saved sentence as a tracker with "new since last seen" count; T3 paste a careers URL → candidate pipeline (Admin approve, A196 path); T4 follow an ATS board as a feed | M | server.js, migration (next free 279), client |
| D113 remote auto-apply | DONE | `26c77c1c`, `a2d6fd09`, `ae298635`, `12163dee` (10-30/31) | web push needs VAPID keys (owner, D170 (7)) | | |
| D138 warm paths | DONE / OPEN-OWNER (privacy line) | `a2fed70d` m216; "Pushed WITHOUT the D138 privacy-policy line" (L2235); `client/src/pages/marketing/PrivacyPage.jsx` has no warm-paths/connections-upload wording and L206 says "no LinkedIn … connections" | owner approves the privacy line (agent can draft it) | S | owner, client |
| D128 P1 public job pages + P2 sitemap | DONE | `1d4b6138` (JSON-LD, jobs sitemap); D179 open board `708eb628` | — | | |
| D128 P2 IndexNow | OPEN-AGENT | no `indexnow` anywhere in services/server/scripts | IndexNow key file at the site root + ping on publish/update (batched, daily cap) | S | server.js |
| D128 P3 aggregator feeds / Search Console | OPEN-OWNER | "later, the owner's call" (L5895); Search Console is the owner's (L1580) | owner picks feeds after terms check | — | owner |
| D104 eligibility | DONE | `7f34e839`, `a6a892c5`, `182287dd` (eligibility asked once) | — | | |
| **T8 ATLAS PLATFORM** | | | | | |
| D134 Atlas as its own module | OPEN-OWNER | P0+P1 docs `1fdfbd56`; "P1 written, AWAITING THE OWNER'S REVIEW" (L5806) | owner reviews `contract/atlas/v1/` (Q1–Q6); then P2 | — | owner |
| **T9 TESTERS & GROWTH** | | | | | |
| D124 the trial | SUPERSEDED | `628d0b87` "The trial removed" (owner 11-07) | — | | |
| D129 the tour | SUPERSEDED | same commit deleted GuidedTour.jsx (mounted only by the trial) | — | | |
| D130 standalone survey | DONE | `a666ca87`; `client/src/pages/SurveyPublicPage.jsx` | — | | |
| D131 Admin → Testers | DONE | `2aa27b9d`; now People → Testers (`panels/adminTesterDetails.jsx`, 628d0b87) | — | | |
| Skills Index / market public pages | OPEN-OWNER | = D150 T11 (sketch) | — | | |
| **[OPEN] list** | | | | | |
| [OPEN] 2 clutter audit feedback data | OPEN-OWNER | unchanged since 11-05 | one read-only prod query, or the Testers CSV kept outside the repo | — | owner |
| [OPEN] 5 push plan | SUPERSEDED | everything pushed (origin/main..main = 0, measured 11-20) | — | | |
| [OPEN] 8 security review + consent before D158/D160/D161 | OPEN-OWNER | still on the counsel list (L1500 D(21), L1042) | — | | owner |
| **TRACK ORDER 0 (FIRST PRIORITY)** | | | | | |
| A-0 / A148 avatar | DONE | `5157837` | owner's check: tester account's sign-in methods have no Google (L1444) | | |
| A-1 / A-2 / A-3 / A-4 | DONE | `5f68077` m254, `db82752`, pushed 45p `4462973..0e4f5b0`, A-4 steps written (L1261) | — | | |
| A-5 mark the canary test_account | UNKNOWN | canary made 11-09 (L1042); no line records `test_account = 1` set or the sample recognised | owner confirms in Admin → People (or gives an admin session) | S | owner, production |
| A-6 read the owner's Ask-me-first run | OPEN-OWNER (gated) | waits on M-4 | — | | |
| A-7 first real full-auto run | OPEN-OWNER (gated) | waits on M-5 | — | | |
| B-1 … B-5 | DONE | `5779421` m255, `57a3922`, `1693e23` m256, B-4/B-5 tests (L1298–1300) | — | | |
| B-6 / B-7 / B-8 / S-1 (D184) | DONE | `0e4f5b0`; B-8 tiebreaker `7c176154` `1bf0c7bf` `c3c47367` m278 (46y) | owner: key after or before the skill score (46y step 5); M-7 the three-résumé walk | | |
| M-1 … M-5, M-7 | OPEN-OWNER | unchanged on every owner list since 11-08 (L1027, L1042) | — | | owner |
