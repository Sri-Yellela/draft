# Bug reporting and a ticket panel — design (D3)

**Design document. Nothing here is built.** ⛔ Do not write any of it into `ARCHITECTURE.md` until it is.
Brief: WORKLOG § "D3 · BUG REPORTING AND A TICKET PANEL". Written 2026-10-03 against `main` `c13af09`
(local; D1 `58547af` and D2 `35cc912` included). Every "today" claim below was read from code, with
file:line — not from a doc.

⛔ **The payload and the data model come first. The panel is the easy half.**

---

## 0 · What exists today — read from code, not from docs

```
LAYER 2 (AUTOMATIC) — NOTHING, ON EITHER SIDE
  client   no error boundary anywhere in client/src (no componentDidCatch / getDerivedStateFromError);
           main.jsx renders <ThemeProvider><App/></ThemeProvider> bare (client/src/main.jsx, last lines).
           ⚠ React 18 unmounts the WHOLE tree on an uncaught render error: today any render throw is a
           blank page, with nothing recorded anywhere.
           no window 'error' / 'unhandledrejection' listener. No Sentry, no telemetry dependency
           (client/package.json, package.json).
  server   Express 4.21 (package.json:36). NO 4-argument error middleware in server.js or routes/.
           NO process.on('unhandledRejection' | 'uncaughtException'). On Node ≥ 15 (Dockerfile: node:20)
           a rejected promise nobody catches TERMINATES the process — an async route that throws outside
           its own try is a restart, and the only trace is Railway's log. ⚠ How many async routes lack a
           try was not measured.
           The only failure recorder is for model-call accounting: services/trackingFailureSink.js
           (usage_tracking_failures + a JSONL sink). It is not an error log.

LAYER 1 (USER) — ONE CHANNEL, AND IT IS THE WRONG SHAPE
  POST /api/contact (server.js:10044-10051): public, no auth, no rate limit, no length cap, stores
  name + email + free text in contact_messages (server.js:740-750) with NO expiry. Read by the admin
  at GET /api/admin/contact-messages (server.js:10053) → AdminPanel.jsx:679. No URL, no build, no
  error, no status. ⛔ Not a base to build on; §10 gives it the same retention.

LAYER 3 (TRIAGE) — NOTHING. The owner relays through chat.
```

**What D3 can REUSE — it should build almost nothing generic:**

| Need | Exists | Where |
|---|---|---|
| Build SHA | ⭐ `resolveCommit()` → `BUILD_INFO` — Railway's `RAILWAY_GIT_COMMIT_SHA`, cut to 7; **null, never a guess** | `server.js:10417-10436`, `:10446`; route `:10449-10508` (no auth) |
| Credential redaction | `isSecretColumn` / `redactRow` / `redactRows` (A51) | `services/adminSafety.js:22-52`; enforced by `test/adminSafety.test.js:31,41,71,88` |
| A PII **allowlist** that refuses | ⭐ `GENERATION_FIELD_ALLOWLIST`, `EXCLUDED_FIELDS` (Article 9 + identifiers), `assertOutboundFields` — **refuses, never drops** | `shared/piiPolicy.js:28-38`, `:52-62`, `:71-94` |
| One fetch choke point | `api()` — every status branch in one function | `client/src/lib/api.js:101-140` |
| Job id in view | `jobIdFromSearch()` — the job is `?job=`, not a path segment | `client/src/lib/jobUrl.js` |
| Admin gate | `requireAdmin` (refuses the extension; `shared/authPolicy.js`) | `server.js:5214-5221` |
| Admin audit trail | `admin_audit_log` (migration 119, A58) | `scripts/migrations.js:3493-3507` |
| Reach the user | ⭐ `notifications` table + `insertNotification()` (SSE push) + the TopBar bell | `scripts/migrations.js:458-466`, `server.js:6781-6790`, `TopBar.jsx:79` |
| Email | `sendEmail()` — honest `ok:false` without `RESEND_API_KEY` | `services/emailService.js:19-36`; ⚠ key unset in production per WORKLOG O28/O47 (not re-read) |
| Rate-limit pattern | DB-counted window, **global ceiling checked first** | `standaloneRateLimit`, `server.js:10157-10190` |
| Cross-site write guard | `rejectCrossSiteWrites` — already global | `services/originGuard.js:10-19`, `server.js:84` |
| Account deletion / merge / export | FK `ON DELETE CASCADE`; `MERGE_PLAN` guard; `EXPORT_TABLES` | `services/accountService.js:188-226`; `test/accountService.test.js:38` |
| Retention that really deletes | Resume Master's A57/A65 store: `purgeExpired` boot + hourly; `secure_delete = ON` | resume-master `src/accounts/artifacts.js:8-14,92-94`, `server.js:38-39`, `src/store/db.js:119` |

⚠ **Three findings that shape the design:**

1. ⛔ **The inspector's redaction is CREDENTIALS-ONLY, on purpose.** `adminSafety.js:17-20`: *"only
   CREDENTIALS are redacted. Content … stay[s] visible"* — `email` is explicitly *not* a secret
   (`adminSafety.test.js:37`). The brief's *"the same redaction applies here"* would protect passwords
   and tokens and **nothing else**. Reusing it is necessary, not sufficient: content protection has to
   come from an **allowlist** — and `shared/piiPolicy.js` is already that, for model payloads.
2. ⛔ **A query string here can carry a live credential.** `authContextQuery()` puts the session's
   auth-context token in the URL (`api.js:45-48`) for the SSE stream, admin exports and AutoApply
   (`useSyncEvents.js:102`, `DBInspector.jsx:812,882,1357`, `AutoApplyContext.jsx:579`,
   `AccountPanel.jsx:23`, `adminOps.jsx:431`); the OAuth return lands with `?authContext=` in the
   address bar (`App.jsx:651-657`); `?jd=` can carry a job description. **"No query strings" is not
   tidiness — it is the line between a bug report and a credential leak.**
3. ⚠ **`express.static(CLIENT_DIST)` serves everything in `client/dist`** (`server.js:6253`), and the
   image has no `.git` (`.dockerignore`). So: source maps, if built, must be moved out of `dist` or
   they publish the private source; and production **cannot run `git merge-base`** — "deployed" needs
   another route (§7.4).

⭐ **What the four defects of session 21 tell us about the layers.** A71 (ATS panel did not open) was
a **viewport breakpoint** — 1100–1175 px (WORKLOG A71); A72 (search returned everything) and A73
(filters did nothing) threw **no error**; only A73's second cause — *"a failed `/api/jobs` was
silent"* — was an exception. **Layer 2 would have caught one of four. Layer 1 with this payload would
have answered all four's first question** — A71's in one field (`viewport`).

---

## 1 · The three layers

```
1  USER-INITIATED   "Report a problem" — profile menu + the crash fallback + a key in the board's
                    help. Captures the §2 payload NOW, adds the user's words. Catches SILENT
                    wrongness (A71–A73): the product cannot know a filter did nothing.
2  AUTOMATIC        client: one root <ReportBoundary> + named area boundaries; window 'error' and
                    'unhandledrejection'; api() records failed requests (5xx, network, unexpected
                    4xx). server: an Express error middleware + process 'unhandledRejection'.
                    Catches what users do not report — they leave.
3  TRIAGE           /admin/tickets — grouped tickets with counts, a status, a severity set by the
                    admin, the fixing commit, and "deployed" verified against the running build.
```

### ⭐ Build order — and why Layer 2 goes FIRST

```
SLICE A   foundation + LAYER 2 + LAYER 1      shared/bugReport.js (schema, scrubber, fingerprint),
          (one slice, one payload builder)    migration 125, POST /api/bug-reports, the boundary,
                                              the handlers, the server middleware, the button.
SLICE B   LAYER 3 minimal                     /admin/tickets: list, detail, status, severity,
                                              duplicate-of, fix commit.
SLICE C   resolution + close the loop         deploy check (§7.4), regression reopen, notifications.
SLICE D   (later) Resume Master's own copy    §11 decision 4.
```

**Why this order:**

- ⛔ **Layer 2 must ship in the FIRST slice or it ships never.** Layer 1 and Layer 3 are visible; the
  owner will ask for them. Layer 2 is invisible until it is the only thing that knew. Putting it in
  the slice everything else depends on is the only structural way to stop it being deferred.
- ⭐ **It fixes a live defect, not just an observability gap.** Today a render throw blanks the app.
  The root boundary turns that into *"Something broke — Reload · Report this"* — the crash fallback IS
  Layer 1's best entry point, at the exact moment the context is richest.
- **Layer 1 rides in the same slice because it costs one modal.** Both layers call the SAME
  `buildReport()`; Layer 1 adds `description`, `category`, `contact_ok`. Splitting them would mean two
  builders, which is the two-copies shape this repo keeps paying for.
- **Layer 3 second, not first:** for the days between A and B, reports are readable in the DB
  inspector's Table Browser (already redacting credentials). A panel with nothing in it is a demo.
- **Resolution last** because it needs real tickets to verify against — and it needs an owner
  decision (a GitHub read token, §7.4).

---

## 2 · ⭐ THE PAYLOAD — field by field

⛔ **This table IS the allowlist.** It is `shared/bugReport.js` `REPORT_SCHEMA`, imported by the client
(to build) and the server (to re-validate). A key not in it is **refused** (400, nothing stored) —
the `assertOutboundFields` rule (`piiPolicy.js:64-70`): *a field nobody has considered is refused
rather than sent.* Nothing is read from a React store, the DOM, `localStorage`, or the page.

**Sources.** `loc` = `window.location` through the route matcher · `ctx` = the report-context registry
(§3.2; panels push IDS ONLY) · `err` = the caught Error · `ring` = in-memory ring buffers in
`lib/bugReport` · `build` = compile-time constant · `srv` = **stamped by the server, never accepted
from the client**.

```
GROUP  FIELD                 TYPE / VALIDATION                          SRC    MAX     WHY
─────  ────────────────────  ─────────────────────────────────────────  ─────  ──────  ───────────────────────────────────────
ENV    v                     int, const 1                               build  —       schema version; a stale tab's older v is
                                                                                       validated against ITS schema, or refused
       source                enum user|boundary|window|rejection|       code   —       which layer; 'server' is server-only
                             request
       tab                   uuid v4 (sessionStorage, per tab)          code   36      ties several reports from one tab; NOT
                                                                                       the session id; purged with the report
WHERE  route                 one of ROUTE_PATTERNS (from App.jsx's      loc    80      "/app/jobs" — the PATTERN. Unknown path
                             table) or "(other)"                                       → "(other)", never the raw path
       panel                 enum of appTabs ids (App.jsx:309-319)      loc    32      today|console|auto-apply|…
       area                  /^[a-z0-9-]{1,40}$/ — the nearest named     err    40      which boundary caught it ("deck",
                             <ReportBoundary area="…">                                 "ats-report"); a string literal, so it
                                                                                       survives minification
       job_id                /^[A-Za-z0-9:_.-]{1,80}$/                  loc    80      jobIdFromSearch() — the open job. A
                                                                                       public posting id, not personal
       profile_id            int > 0; server NULLS it unless it is      ctx    —       which domain profile was active
                             the reporter's (domain_profiles.user_id)
       run_id                int > 0; same ownership re-check           ctx    —       the apply run in view (apply_runs.id)
WHAT   error.name            /^[A-Za-z_$][\w$]{0,59}$/                  err    60      TypeError, ChunkLoadError, …
       error.message         string → scrubbed (§3.3) → capped          err    300→200 the console error, made safe
       error.frames[]        ≤ 10 × {file, fn, line, col}; file =        err    120/80  the stack, PARSED — the raw stack string
                             path only (origin, query, hash stripped);                 is never sent (it can hold URLs)
                             unparseable lines DROPPED
       failed[]              ≤ 3 × {method enum, path, status 0-599,    ring   200     the last failed requests. path =
                             code, ago_ms}                                             pathname only, same-origin only (other
                                                                                       origin → origin alone); code = body
                                                                                       .error IF it is a machine code
                                                                                       /^[a-z0-9_]{1,60}$/ — NEVER body.message,
                                                                                       never a body
BUILD  client_build          /^[0-9a-f]{7,40}$/ or null                 build  40      the BUNDLE's commit (§4). A stale tab
                                                                                       runs an old bundle — this says which
       server_build          BUILD_INFO.commit                          srv    40      ⭐ MANDATORY. Stamped at intake from
                                                                                       server.js:10446; 'unknown' kept as such
WHO    user_id               req.user.id or NULL                        srv    —       ⛔ never accepted from the body
       plan                  publicUser().planTier                      srv    16      server.js:5254
       is_admin              bool                                       srv    —       ⭐ separates the owner's reports
       browser               {name enum chrome|edge|firefox|safari|     code   —       family + MAJOR only. ⛔ Not the UA
                             samsung|other, major int}                                 string (fingerprinting entropy)
       os                    enum windows|mac|ios|android|linux|other   code   —
       viewport              {w, h ints ≤ 10000, dpr ≤ 5 (1 dp)}         code   —       ⭐ A71 was a viewport question
       layout                enum desktop|mobile (the 390 layout)       code   —
       theme                 enum light|dark                            code   —       contrast bugs are theme bugs
WHEN   occurred_at           int ms epoch                               code   —       client clock (can be wrong)
       received_at           int s epoch                                srv    —       authoritative
       crumbs[]              ≤ 20 × {dt (ms before occurred_at, ≤ 0),   ring   —       a cheap trail: navigations, requests,
                             type nav|req|act, route | method+path+                    and NAMED actions. ⛔ No element text,
                             status | act}                                             no input values, no search terms
                             act: /^[a-z0-9.-]{1,40}$/ from ACTIONS                    (search.submit carries q_len, an int,
                             (deck.pass, deck.save, search.submit,                     never q)
                             filter.apply, ats.open, …)
USER   description           string → scrubbed (§3.3)                   user   2000    the reporter's words; the UI says
(L1)                                                                                   "don't paste your résumé"
       category              enum broken|looks-wrong|slow|other         user   —       the reporter's word for it. ⛔ NOT
                                                                                       severity (§6)
       contact_ok            bool, default true                         user   —       "Tell me when it's fixed" (in-app)
```

```
WHOLE PAYLOAD   ≤ 16 KB serialised. The intake route mounts its OWN express.json({ limit: "16kb" })
                BEFORE the global 4 MB parser (server.js:6190) — mounted after it, the body is
                already parsed and the cap would be decorative.
```

**⛔ Deliberately NOT captured — and why each one is tempting:**

```
the page / DOM / innerText     résumé text, addresses, EEO answers are ON SCREEN in ProfilePanel and AutoApply
React state or any store       ProfilePanel's form holds ethnicity / veteran_status / disability_status
                               (ProfilePanel.jsx:351, selects :1006-1031); AutoApplyPanel shows the custom
                               answers ("disability status", :765); /api/autofill returns SELECT * of
                               user_profile (routes/account.js:371-386)
request / response BODIES      a profile save posts every Article 9 column (routes/account.js:336-351)
query strings, hash            authContext token, ?jd= text (§0 finding 2)
console.error hooking          React and libraries log objects; the CAUGHT error is the console error
username, email                username can be derived from the email (server.js:5274-5276); user_id suffices
full user-agent, IP            fingerprinting; the coarse ipHint (server.js:6218) is not needed either
screenshot                     §3.5
```

---

## 3 · ⛔ PRIVACY — structural, not remembered

**Five walls, each one a test (§9), each one independent of the others.**

### 3.1 One schema, two sides

`shared/bugReport.js` exports `REPORT_SCHEMA`, `validateReport()`, `scrubText()`, `fingerprint()`.
The client builds with it; the server **re-validates with the same function** and trusts nothing it
did not stamp. Same file, same commit — the shared/ folder is already copied into the image before
the client build (Dockerfile `COPY shared/`).

`validateReport(body)` refuses (400, `error: "report_field_refused"`, nothing stored, the refused KEY
logged, never its value) when:

```
· any key, at any depth, is not in REPORT_SCHEMA
· any key is in piiPolicy.EXCLUDED_FIELDS (shared/piiPolicy.js:52-62) — ethnicity, disability_status,
  veteran_status, gender, work_auth, visa_type, phone, email, address_line1/2, zip, full_name, …
  → code PII_EXCLUDED_FIELD, the same code assertOutboundFields uses
· any key passes adminSafety.isSecretColumn (services/adminSafety.js:37) — token, session_id, sid,
  *_hash, *_enc … — defence in depth: the A51 redaction REUSED as a refusal at the boundary
· any value fails its field's type / enum / pattern / length
```

### 3.2 The builder cannot see what it must not send

`client/src/lib/bugReport/` reads ONLY: `window.location` (through the route matcher and
`jobIdFromSearch`), its own ring buffers, the caught Error, `navigator`/`screen` for the WHO fields,
and a **report-context registry** — `setReportContext({ profileId, runId })`, a typed setter that
accepts integers and nothing else. ⛔ Panels push IDS; the builder never pulls state.

Enforced by a source test (house style — `adminSafety.test.js:88` pins source the same way):
the module imports nothing from `contexts/`, `panels/`, `pages/` or `components/`; contains no
`document.body`, `innerText`, `innerHTML`, `outerHTML`, `localStorage`, `JSON.stringify(state`; and
`api.js`'s failure recorder passes `new URL(path, location.origin).pathname` — never `path`.

### 3.3 Free text is scrubbed server-side, with what the server KNOWS

Two fields are free text: `error.message` and `description`. A regex cannot know every name; **the
server knows the reporter's own**. `scrubText(text, known)` at intake, in this order:

```
1 KNOWN VALUES   the reporter's own user_profile values — full_name, email, phone, address_line1/2,
                 zip, linkedin_url, github_url, work_auth, visa_type, and the three Article 9
                 columns — every case-insensitive occurrence (≥ 3 chars) → [redacted:profile]
2 EEO VOCABULARY every option text of the EEO selects (ProfilePanel.jsx:997-1031: "Hispanic or
                 Latino", "I am a protected veteran", "Yes, I have a disability", …) → [redacted:eeo],
                 whoever the reporter is. Imported from ONE list the panel also renders from (a
                 small refactor of ProfilePanel, so the two cannot drift)
3 RÉSUMÉ OVERLAP any 8-word window that also occurs in the reporter's base_resume.content
                 (scripts/migrations.js:65-71) or a profile base résumé → the WHOLE field becomes
                 "[removed: matched your résumé]"
4 PATTERNS       emails → [email]; phone-like (≥ 7 digits with separators) → [phone]; URLs → origin +
                 path; ≥ 24-char base64url runs → [token]; digit runs ≥ 6 → #
5 MESSAGE ONLY   quoted strings '…' "…" `…` → <str> (most user data in an exception is quoted)
6 CAP            200 (message) / 2000 (description)
```

Anonymous (signed-out) reports skip 1 and 3 — there is no profile — and are automatic-only (§8).

### 3.4 What the admin sees

The ticket view renders payloads as text (React escapes) and passes rows through `redactRows`
(`adminSafety.js:52`) like every other raw-row route — so the bug tables join the A51 guard rather
than being an exception to it. `bug_reports` appears in the Table Browser like any table.

### 3.5 Screenshot — ⭐ recommendation: NOT in v1

```
WHY NOT       every screen of this product that a bug would be reported from can show résumé text,
              an address or an EEO answer. A preview the user must inspect is a privacy decision
              handed to someone mid-frustration. The §2 payload answers the questions screenshots
              usually answer (which screen, which job, which width, which theme).
IF ADDED (v2) opt-in PER REPORT, OFF by default; rendered and SHOWN before sending, with a stated
              warning ("this image may contain your résumé or profile details"); never automatic,
              never on Layer 2; stored as a file deleted with the report (deleteAccount already
              returns files to remove — accountService.js:216-220 is the pattern); 30-day cap.
```

---

## 4 · BUILD — the SHA, both of them

```
server_build   stamped at intake from BUILD_INFO.commit (server.js:10446). Free, already exists,
               null-when-unsure by design (server.js:10414-10416). Not fetched by the client.
client_build   the bundle's own commit, compiled in. ⛔ Fetching /api/version from the client is
               WRONG for this: a tab opened before a deploy runs the OLD bundle while /api/version
               answers the NEW commit — the report would name a build the user never ran.
```

How `client_build` gets in: `vite.config.js` `define: { __DRAFT_BUILD__: JSON.stringify(process.env
.RAILWAY_GIT_COMMIT_SHA || "") }`, and the Dockerfile declares `ARG RAILWAY_GIT_COMMIT_SHA` before
`RUN cd client && npm run build`. ⚠ **Not verified** that Railway passes `RAILWAY_GIT_COMMIT_SHA`
as a Docker build arg — prove it on the first deploy by comparing the two fields on one report; if it
does not, `client_build` stays null (honest) and a mismatch cannot be detected.

⭐ **The mismatch is itself a signal**: `client_build ≠ server_build` = a stale tab. It is shown on
the ticket ("3 of 11 occurrences from stale tabs") and it decides regressions (§7.5).

---

## 5 · ⭐ GROUPING — the fingerprint, precisely

```
basis = [ "fp1",                      ← version: a key change is a NEW version, never a silent re-key
          kind,                       crash | rejection | request | server   (user reports: §5.2)
          error.name,
          normMessage(error.message), the SCRUBBED message, then: digits → #, hex ≥ 8 / uuid → <id>,
                                      <str> kept, whitespace collapsed, lower-cased, ≤ 120
          route,                      the PATTERN (/app/jobs), never the concrete path; never ?job=
          area,                       the boundary name, "-" if none
          frames ]                    top 5 IN-APP frames as "file:function" — NO line, NO column
fingerprint = sha256(basis.join("\n")).hex
```

```
FRAMES, CLIENT   the bundle is minified and content-hashed (client/dist/assets/index-<hash>.js), so a
                 raw frame changes on EVERY build. Build with sourcemap: "hidden" (no sourceMappingURL
                 comment), and in the Dockerfile MOVE *.map out of client/dist to /app/sourcemaps
                 BEFORE the server starts (express.static would otherwise serve them — §0 finding 3).
                 The server symbolicates at intake to "src/panels/DeckView.jsx:DeckView".
                 ⚠ Needs the `source-map` package — a new dependency; say so in the commit.
                 Maps missing → frames omitted, fingerprint version "fp1c" (coarse), shown as such.
FRAMES, SERVER   Node stacks are not minified: keep frames under /app not in node_modules or node:,
                 strip the /app prefix, drop line:col → "routes/apply.js:handler".
VENDOR FRAMES    react-dom, node_modules — dropped. They are where it surfaced, not where it is.
REQUEST KIND     basis = "fp1", "request", method, PATH PATTERN, status, code. The server's own
                 req.route.path is exact; a client-observed path is normalised (digits, uuid, hex ≥ 8,
                 ids with digits ≥ 6 → :id). 401 is never a ticket (it is a sign-in, api.js:113-127);
                 429 is counted on the ticket list but not ticketed.
```

### 5.1 ⚠ The A49 lesson, applied to tickets

A49 measured both failure directions of a fingerprint: **too exact and nothing merges** ("City, ST"
merged 35% before the fix), **too loose and distinct things collapse** (one role in several cities is
several jobs — *"Do not collapse these"*). And its fixes: **soft, never hard; log the reason; one
deduper that every writer goes through** (WORKLOG A49 row; SESSION LOG 13, 16).

```
TOO EXACT    line/col, chunk hash, concrete ids, raw message numbers  → all removed above
TOO LOOSE    the boundary area and the frames stay IN, so "TypeError in deck" and "TypeError in
             ats-report" are two tickets even with one message
SOFT         duplicate_of points at the survivor; nothing is deleted; occurrences move, are
             recounted, and can be moved back (un-duplicate). Every merge → admin_audit_log
ONE DEDUPER  fingerprint() in shared/bugReport.js; client, server middleware and intake all call it.
             A source test asserts no second sha256-of-a-stack exists
MEASURE      after a week of real reports: tickets per fingerprint, and how many the admin merged
             by hand (= the key is too exact) or split (= too loose). Change the key only as fp2.
```

### 5.2 User reports

⛔ **A human report is not auto-merged by text.** Two people describing "filters do nothing" in
different words are probably one bug and possibly two — the A49 "repost or second opening?" case. A
user report opens its OWN ticket, except: if the same tab captured an automatic error in the
preceding 60 s, the report **attaches to that error's ticket** (it is almost certainly about it) and
the ticket shows "reported by a user". Grouping user tickets is a triage action (duplicate-of).

---

## 6 · TRIAGE — the model

```
new ──► triaged ──► in_progress ──► fixed ──► closed
  │        │             │            │
  └────────┴─────────────┴──► wont_fix │   (terminal, reason required)
  └────────┴─────────────┴──► duplicate (terminal, duplicate_of required)
fixed/closed ──► new          REGRESSION (§7.5) — automatic, flagged
```

```
TRANSITION RULES (server-enforced; the UI only offers legal ones)
  → triaged       severity REQUIRED here
  → fixed         fix_commit REQUIRED: /^[0-9a-f]{7,40}$/, and it must be on origin/main (§7.4)
  → closed        deployed_at REQUIRED — or close_reason ∈ {not_a_code_fix, cannot_reproduce} with text
  → wont_fix      reason REQUIRED
  every transition, severity and title change → admin_audit_log (action "ticket.*", target "ticket:<id>",
  before/after JSON — migration 119's exact shape; no second log)

SEVERITY   set at TRIAGE by the admin. ⛔ Not in the reporter's schema — there is no field to send.
  s1  data loss, a privacy leak, apply submits wrongly, sign-in broken      today
  s2  a core path broken for some users (board, deck, ATS report, apply)    this week
  s3  wrong-but-workable, cosmetic on a core path                           next
  s4  cosmetic elsewhere                                                    when convenient
  The reporter's `category` is shown as a hint, never as severity.

LINKS (detail view)
  job       → Job Trace, GET /api/admin/db/job-trace/:jobId (routes/adminDb.js:1078)
  user      → the User Pool row (admin only)
  build     → github.com/Sri-Yellela/draft/commit/<sha>, for client_build and server_build
  run       → apply_runs id;  profile → domain_profiles id
```

---

## 7 · Data model, API, resolution

### 7.1 Tables — migration 125 (both lists: `server.js` inline AND `scripts/migrations.js`;
`test/migrationListsAgree.test.js`; ⛔ CRLF — targeted edits only, CLAUDE.md)

```sql
-- THE GROUP. Holds NO personal data: it outlives every report (§10).
CREATE TABLE IF NOT EXISTS bug_tickets (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint        TEXT UNIQUE,                 -- NULL for a user-only ticket (§5.2)
  fp_version         TEXT,                        -- 'fp1' | 'fp1c'
  kind               TEXT NOT NULL,               -- crash|rejection|request|server|user
  title              TEXT NOT NULL,               -- derived ("TypeError · deck · /app"); editable; ⛔ no user text
  route              TEXT,
  area               TEXT,
  status             TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','triaged','in_progress','fixed','closed','wont_fix','duplicate')),
  severity           TEXT CHECK (severity IS NULL OR severity IN ('s1','s2','s3','s4')),
  duplicate_of       INTEGER REFERENCES bug_tickets(id),
  occurrences        INTEGER NOT NULL DEFAULT 0,  -- ALL occurrences ever, incl. unsampled (§8) and purged
  stale_tab_count    INTEGER NOT NULL DEFAULT 0,
  user_reports       INTEGER NOT NULL DEFAULT 0,
  first_seen_at      INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
  first_build        TEXT, last_build TEXT,
  fix_commit         TEXT,  fix_recorded_at INTEGER,
  deployed_build     TEXT,  deployed_at     INTEGER,   -- the RUNNING build verified to contain fix_commit
  regressed_at       INTEGER,
  close_reason       TEXT,  notes TEXT,                -- admin's words; ⛔ rule: no user data in notes
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_bug_tickets_status ON bug_tickets(status, last_seen_at);

-- ONE OCCURRENCE (a sample). Personal data; EXPIRES.
CREATE TABLE IF NOT EXISTS bug_reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id     INTEGER NOT NULL REFERENCES bug_tickets(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,   -- NULL = signed out
  source        TEXT NOT NULL,             -- user|boundary|window|rejection|request|server
  payload_json  TEXT NOT NULL,             -- the VALIDATED, SCRUBBED §2 object, ≤ 16 KB
  description   TEXT,                      -- scrubbed; user reports only
  client_build  TEXT, server_build TEXT NOT NULL,
  contact_ok    INTEGER NOT NULL DEFAULT 0,
  notified_at   INTEGER,
  received_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bug_reports_ticket  ON bug_reports(ticket_id, received_at);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user    ON bug_reports(user_id, received_at);
CREATE INDEX IF NOT EXISTS idx_bug_reports_expires ON bug_reports(expires_at);
```

Account plumbing (all guarded today): `bug_reports` joins `MERGE_PLAN` as `"move"`
(`test/accountService.test.js:38` fails until it does) and `EXPORT_TABLES` (`accountService.js:188`) —
a user's own reports are their data. Deletion: the FK cascade does it; tickets keep only counts.

### 7.2 Endpoints

```
POST  /api/bug-reports                  intake. Own 16 KB parser, mounted before server.js:6190.
                                        auth OPTIONAL for automatic sources; source:'user' REQUIRES auth.
                                        → 202 { ok, ref: "#<ticket id>" } for user reports (shown to the
                                          user); 202 { ok } for automatic; 400 report_field_refused;
                                          413; 429. Refuses the extension (isExtensionRequest) in v1.
GET   /api/bug-reports/mine             the reporter's own reports + ticket status (v1.1; transparency)

— admin, routes/adminTickets.js, app.use("/api/admin/tickets", requireAdmin, …) —
GET   /api/admin/tickets                ?status=&kind=&severity=&q=   list with counts + last_seen
GET   /api/admin/tickets/:id            ticket + latest 20 samples (redactRows'd) + audit trail
PATCH /api/admin/tickets/:id            { status?, severity?, title?, notes?, close_reason? } — §6 rules
POST  /api/admin/tickets/:id/fix        { commit } → status fixed (+ ancestry check, §7.4)
POST  /api/admin/tickets/:id/check-deploy   re-run §7.4 now
POST  /api/admin/tickets/:id/duplicate  { of } — soft; POST …/unduplicate reverses it
POST  /api/admin/tickets/:id/notify     re-send the close-the-loop notification (idempotent per report)

— server internal, no route —
recordServerError(err, req)             called by the Express error middleware and the process
                                        'unhandledRejection' handler; same validate/scrub/fingerprint;
                                        never throws; ⛔ the handler LOGS and keeps the process up
                                        (today it dies, §0)
```

### 7.3 Client pieces

```
lib/bugReport/       build.js (buildReport), rings.js (failed[], crumbs[]), routes.js (ROUTE_PATTERNS),
                     send.js (POST; ⛔ a failure of the report call is never itself reported)
components/ReportBoundary.jsx   class boundary; root in main.jsx + named areas (deck, board, ats-report,
                     job-detail, auto-apply, profile, admin). Fallback: "Something broke — Reload ·
                     Report this" (the report pre-filled, the user adds words or not)
api.js               one hook in the existing branches (api.js:113-140): record {method, pathname,
                     status, code} into the ring. 401 excluded.
"Report a problem"   profile menu (all /app pages) + /admin; modal: what happened, category, "Tell me
                     when it's fixed", and a DISCLOSURE of exactly what is attached (the §2 field list,
                     rendered from REPORT_SCHEMA so the disclosure cannot drift from the code)
```

### 7.4 ⭐ "Deployed", not merely "merged"

The fixing commit being on `main` proves nothing about production — WORKLOG records a brake *"committed,
documented, and not deployed for a day"* (ADMIN_PANEL_REVAMP §2C). **Deployed = the RUNNING build
descends from the fix.** Production has no `.git` (`.dockerignore`), so:

```
⭐ OPTION A (recommended)  GitHub's compare API: GET /repos/Sri-Yellela/draft/compare/<fix>...<running>
                           status "ahead" | "identical" → the running build CONTAINS the fix.
                           "behind" | "diverged" → it does not. The repo is private (api.github.com
                           answered 404 unauthenticated, 2026-10-03), so it needs a fine-grained,
                           READ-ONLY token on this one repo (contents:read) → an O## row.
                           Run: on POST …/fix, on …/check-deploy, and at BOOT for every 'fixed'
                           ticket with deployed_at NULL — so the deploy that carries the fix marks it
                           deployed by itself, and deployed_build records which build.
                           ⚠ `running` must be the FULL sha (RAILWAY_GIT_COMMIT_SHA); BUILD_INFO keeps
                           7 chars (server.js:10423) — read the env value, do not change /api/version.
   OPTION B (fallback)     no token: the panel shows the exact command and the running SHA —
                           git merge-base --is-ancestor <fix> <running> && echo deployed
                           (CLAUDE.md's own check) — and an "I verified" button that records who/when
                           in admin_audit_log. Honest, manual, and labelled "verified by hand".
```

The ticket list shows three distinct states — **fixed · merged, not deployed** / **fixed · deployed
<build> <when>** / **closed** — never one green tick for all three.

### 7.5 Regression

A new occurrence on a ticket that is `fixed`/`closed` with `deployed_at` set, where
`client_build = server_build` AND the server process started after `deployed_at` → the ticket goes
back to `new` with `regressed_at` and a ⛔ badge. Stale-tab occurrences (`client_build ≠
server_build`) only increment `stale_tab_count` — an old bundle failing is not a regression.

### 7.6 ⭐ Closing the loop

```
WHEN   the ticket reaches closed-with-deployed_at, or wont_fix / duplicate (honesty: say so)
WHO    every live bug_reports row on the ticket (and on tickets marked duplicate OF it) with
       contact_ok = 1 and notified_at NULL
HOW    ⭐ insertNotification(userId, "bug_fixed", …) — server.js:6781 — the bell (TopBar.jsx:79),
       pushed live over SSE. No email dependency. Email ONLY if emailConfigured() AND the user ticked
       it — ⚠ RESEND_API_KEY is unset in production per O28/O47, so in-app is the real channel.
WHAT   "The problem you reported on 3 Oct (Jobs) is fixed and live. Thank you — it was report #123."
       ⛔ The text names the area and date only. No error text, no job title.
       wont_fix: "…we looked at it and won't be changing this, because <one line>."
THEN   notified_at set; idempotent (a re-close does not re-notify)
```

⚠ A report that EXPIRES before its ticket closes cannot be notified — §10 sets user reports to live
until close + 30 days for exactly this reason.

---

## 8 · Rate limiting and abuse

```
PARSER        own express.json({ limit: "16kb" }), before the global 4 MB one (server.js:6190)
ORIGIN        rejectCrossSiteWrites is already global (originGuard.js) — nothing to add
EXTENSION     refused in v1 (isExtensionRequest, as requireAdmin does)
CLIENT        same fingerprint from one tab: at most once per 60 s; ≤ 10 automatic per page load;
              the report call's own failure is never reported (no storms)
SAMPLING      ⭐ per (ticket, user): at most ONE stored sample per 10 min — further occurrences only
              increment bug_tickets.occurrences. Storage stays bounded; the COUNT stays true.
SIGNED IN     user reports 5 / hour, 20 / day; automatic 60 / hour → 429 { error: "report_rate" }
SIGNED OUT    automatic only; GLOBAL anonymous ceiling 500 / day checked FIRST (the
              standaloneRateLimit order, server.js:10166-10179), then 20 / hour per caller, counted IN
              MEMORY (anonKey, server.js:10152) — ⛔ the IP is never written to the database
FREE TEXT     description rendered as text, never as HTML or a link
OVER LIMIT    the 429 is not itself a report; the count of refused reports is shown on the panel
              (a flood is a signal too)
```

---

## 9 · Test plan

⛔ **Injected violations, with SYNTHETIC people** (CLAUDE.md): a fixture user whose profile carries
sentinel values — phone `+1 555 0100 777`, email `sentinel.d3@example.test`, address `742 Sentinel
Way`, zip `00042`, ethnicity `Hispanic or Latino`, veteran `I am a protected veteran`, disability `Yes,
I have a disability` — and a base résumé of sentinel sentences.

```
PRIVACY (the ones that matter)
 1  POST with extra keys ethnicity / disability_status / veteran_status / resume / profile / store /
    token, at top level AND nested in error / failed / crumbs → 400, ZERO rows, the key (not value)
    in the log
 2  POST whose error.message and description CONTAIN every sentinel (phone, email, address, zip,
    the three EEO option texts, three résumé sentences) → stored; then checkpoint the WAL and read the
    RAW DATABASE FILE BYTES and the captured server log: ⛔ no sentinel appears anywhere
 3  a failed request to /api/x?authContext=SENTINEL&jd=SENTINEL#h → stored path is "/api/x"
 4  an Error whose stack line carries a URL with ?authContext=SENTINEL → frame file has no query
 5  user_id / plan / is_admin / server_build in the BODY → refused (server-stamped fields)
 6  profile_id / run_id belonging to ANOTHER user → stored NULL
 7  source test: lib/bugReport imports no contexts/ panels/ pages/ components/; no innerText,
    innerHTML, outerHTML, document.body, localStorage; api.js records pathname, not path
 8  the client builder, run with ProfilePanel's form state and AutoApply answers populated with the
    sentinels, emits JSON containing none of them
 9  EEO vocabulary: the scrubber's list and ProfilePanel's options are ONE import (fails if a new
    option is added to the panel only)
RETENTION
10  an expired report is purged at boot and by the hourly sweep; with secure_delete the sentinel bytes
    are gone from the file, not just unlinked
11  deleteAccount cascades bug_reports; the ticket's counts survive; MERGE_PLAN includes bug_reports
GROUPING
12  same error at /app/jobs?job=1 and ?job=2 → one fingerprint; at area deck vs ats-report → two;
    line/col and chunk-hash changes (a rebuild) → one; vendor-frame differences → one; two different
    messages → two; fp1 vs fp1c never collide
13  duplicate + unduplicate restores the exact occurrence counts; both logged
TRIAGE
14  each illegal transition refused (→closed without deployed_at or reason; →triaged without
    severity; →fixed with a non-hex commit); severity absent from REPORT_SCHEMA
15  deploy check against a stubbed compare API: ahead / identical → deployed; behind / diverged → not;
    404 / no token → "unverified", never "deployed"
16  regression: an occurrence with client_build = server_build after deployed_at reopens; a stale-tab
    one does not
17  close the loop: notification inserted once per contact_ok report; none for contact_ok = 0; none
    twice; the text contains no error text and no job title
ABUSE
18  the 6th user report in an hour → 429, not stored; the global anonymous ceiling refuses BEFORE
    the per-caller check; a 17 KB body → 413; the IP appears in no table
LAYER 2 WIRING
19  a component that throws under <ReportBoundary area="deck"> renders the fallback (not a blank
    page) and posts one report; a throwing report POST does not post a second
20  an async route that rejects → 500 JSON from the middleware, one server report, and the PROCESS
    IS STILL UP (today it would exit)
```

---

## 10 · Retention and deletion

```
                         LIFETIME                                        WHY
bug_reports, automatic   30 days                                         the count lives on the ticket;
                                                                         samples are for recent debugging
bug_reports, user        until the ticket closes + 30 days, CAP 180 d    long enough to close the loop
bug_tickets              kept                                            holds no personal data (§7.1)
contact_messages         ⚠ today: forever. Proposed: 180 days            the same obligation; one-line sweep
```

```
REAL DELETION   purgeExpiredReports(db) at boot and hourly — Resume Master's pattern (artifacts.js:92,
                server.js:38-39). ⚠ draft does NOT run secure_delete (server.js:383-384 sets only WAL
                and busy_timeout). Turning it on for the whole connection would zero every page the
                job-board cleanup frees; instead the sweep sets PRAGMA secure_delete = ON around its
                own DELETE and restores it, then a PASSIVE WAL checkpoint.
BACKUPS         ⚠ a purged report survives in backups until they rotate. The policy is a BYTE budget,
                max 30 copies (packages/sqlite-backup selectRetained; A50 audit) — not a time limit.
                The privacy line must say "and up to ~30 days in encrypted-at-rest backups" — ⚠ the
                exact day count depends on backup cadence, re-derive before writing the policy.
ACCOUNT DELETE  FK cascade (accountService.js:208-226 deletes users; bug_reports cascades)
POLICY          PrivacyPage.jsx gains one paragraph: what a report carries (the §2 list), that it never
                includes résumé or profile contents, and the lifetimes above.
```

---

## 11 · ⚠ FOUR DECISIONS FOR THE OWNER

### Decision 1 — Build it, or use a service?

```
A  ALL IN-HOUSE          both layers write to draft's own database. No new processor, no policy
                         change beyond §10's paragraph. Costs: symbolication (one dependency), our own
                         grouping (§5) — Sentry does both better.
B  SPLIT (the brief's)   in-house user reports; Sentry for automatic capture.
                         ⛔ A new processor receiving error payloads from a product that holds
                         special-category data → a row in PRIVACY_RECONCILIATION.md's third-party
                         table (:101-116), a line in PrivacyPage.jsx's list (:425-450), a DPA, and
                         test/privacyReconciliation.test.js keeping them in step.
                         Sentry's defaults are not this design's: fetch breadcrumbs keep full URLs
                         (the authContext query), ui.click breadcrumbs record selectors, Session Replay
                         records the DOM. Configured safely: sendDefaultPii false, Replay OFF,
                         beforeSend = OUR validateReport (drop the event if it refuses),
                         beforeBreadcrumb drops ui.* and console and strips queries, server-side
                         "Data Scrubbing" + "Prevent storing IP addresses" on, EU data region.
                         ⚠ Vendor settings and pricing from Sentry's docs, not re-verified today.
C  SELF-HOSTED SERVICE   GlitchTip (Sentry-SDK compatible, lighter) or self-hosted Sentry on Railway:
                         no third party, but a second stateful service to run, back up and patch —
                         ⚠ self-hosted Sentry's footprint is far beyond this project's volume.
```

⭐ **Recommendation: A for v1, with B's seam built in.** At zero users the volume is tiny, Sentry's
real advantages (symbolication at scale, alert routing, release health) are not yet the bottleneck,
and the privacy cost of B is paid on day one. The seam: `validateReport` is the ONLY serialiser, so
adopting B later means pointing `beforeSend` at it — no payload redesign. **Revisit when** automatic
reports exceed ~50 / day, or grouping needs hand-fixing weekly; then B with the EU region and the
settings above, or C if a third party is unacceptable. ⚠ This differs from the brief's suggested
split on purpose: the split buys Layer 2 quality at the exact moment the privacy cost is highest
relative to the benefit.

### Decision 2 — Inside the admin panel (A50), or beside it?

```
A  A tab in AdminPanel.jsx (TOP_TABS, :987-993)    collides with A50's IA while it is mid-audit
B  BESIDE: /admin/tickets, a sibling route like /admin/db (App.jsx:765-769), inside AdminLayout,
   own router routes/adminTickets.js, own test file
```

⭐ **Recommendation: B.** It touches A50's files at exactly ONE line (a link in AdminLayout) — and
even that can wait until A50's audit closes; until then `/admin/tickets` is typed. It reuses A50's
tokens, `PanelControls` and the portalled listbox (ADMIN_PANEL_REVAMP §4) so it looks like the panel
without living in its file. Later, A50's **daily glance** (§2A) can SELECT one number from it —
"tickets: N new, M s1, K fixed-not-deployed" — the same "select, never recompute" rule the glance
already follows (server.js:7026-7028 comment). Folding it in as a tab later is a move, not a rewrite.

### Decision 3 — Retention

⭐ **Recommendation: §10 as written** — automatic 30 days; user reports close + 30 days, capped at
180; tickets kept (no personal data); real deletion by an hourly sweep with `secure_delete`; backups
stated honestly; and `contact_messages` brought under the same rule (it has none today). Options the
owner may prefer: shorter (14 days automatic — enough at this volume), or user reports a flat 90
days (simpler to state; loses close-the-loop on slow fixes).

### Decision 4 — Resume Master: one panel reading both, or one each?

```
A  ONE PANEL, BOTH      draft's panel reads Resume Master's reports (or vice versa). ⛔ Requires a
                        cross-service credential and a data flow between the products — a LINK, which
                        the owner has decided against (A57: "separate accounts, no SSO — it keeps the
                        'not linked' decision true").
B  ONE EACH, SHARED CODE each service stores its own reports in its own database and triages in its own
                        admin (Resume Master's is RM_ADMIN_EMAILS-gated, src/http/siteRoutes.js:88,193).
                        The SCHEMA, scrubber and fingerprint live in one package vendored into both —
                        the packages/sqlite-backup precedent (A65: "one package, two deployments",
                        CHECKSUMS.json pins the copy).
```

⭐ **Recommendation: B.** It keeps "not linked" true, and the owner reading two short lists is cheap
at this volume. Resume Master is ALREADY partly covered on the server: it has an Express error
middleware that logs code + status and no content (resume-master `src/http/app.js:133-135`) — its
Layer 2 server half is a writer on that, not a new path. Its site is framework-free (`public/site.js`),
so its client Layer 2 is a `window` listener, not a boundary. Build it as SLICE D, after draft's has
run for a few weeks — what draft's grouping teaches should reach Resume Master as one package update.
⚠ Its store is off without `RM_DB_PATH` (A57) — reports there need the store switched on.

---

## 12 · Effort — rough

```
SLICE A  ~2 days   schema + scrubber + fingerprint + migration + intake + boundary + handlers + server
                   middleware + button + tests 1–12, 18–20
SLICE B  ~1 day    /admin/tickets list/detail/transitions + tests 13–14
SLICE C  ~1 day    deploy check (needs the O## token for option A) + regression + notifications + 15–17
SLICE D  ~1 day    Resume Master, once the package has settled
```

---

## 13 · ⚠ Not verified

- Whether Railway passes `RAILWAY_GIT_COMMIT_SHA` as a Docker **build** arg (§4) — prove on the first deploy.
- Whether GitHub's compare API accepts the 7-char SHA reliably — design uses the full env value instead.
- `RESEND_API_KEY` in production — taken from WORKLOG O28/O47 (10-02), not re-read.
- How many async routes in `server.js` / `routes/` lack their own `try` (the crash exposure in §0).
- The backup cadence → the real "days in backups" figure (§10).
- Sentry's current settings names, EU region availability and pricing (§11 D1) — from vendor docs, not re-checked.
- That production React is not shipping source maps today: `client/dist/assets` locally has none, and
  `vite.config.js` sets no `sourcemap` (default off) — production not inspected.
