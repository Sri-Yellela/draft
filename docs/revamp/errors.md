Status: M1–M3 done (47j, lane w2-public) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 · #22 — ERRORS, 404, EMPTY APP STATES → **Off the map** · M1 inventory + M2 brief

Read from the code on 2026-11-26 (47j, lane *w2-public*, from local `main` `a393442e`). Client paths under `client/src/`.
**Nothing live changes in this lane** — M1–M3 only. Mock: **`/dev/plate?page=off-the-map`** (`&w=390`).

The rule this page keeps (D197 #22): **every recovery link** — wherever the reader can't go on, they are shown one way back,
and it still works.

---

## 1 · The 404 page (`pages/NotFoundPage.jsx`, 39 lines) and where it is mounted

| ☐ | Element / mount | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | `<h1>` *404 — Page Not Found* | | NotFoundPage.jsx:10-19 | **Off the map**: the serif title *Off the map.* (clay stop) + a mono kicker *404 · NO PAGE AT <PATH>* (the status kept in words) |
| ☐ | *The page you're looking for doesn't exist.* | | :20-26 | the lead: *There's no page at this address — it may have moved, or the link was mistyped.* (⚠ wording for the owner) |
| ☐ | **← Back to home** → `/` | the one way back | :27-36 | the **one way back** as the page's clay point: *Back to the front door* → `/` signed out (+ two quiet tickets: *Open jobs* `/jobs`, *Atlas* `/atlas`) |
| ☐ | Mount: the catch-all `*`, signed out, under the classic `NavBar` | | App.jsx:1206-1210 | the plate **public nav** above (`PublicNav`, mock `public-chrome`) |
| ☐ | Mount: `/pricing` while monetisation is off ("off means absent") | answers as any unknown path | App.jsx:1078 | the same Off-the-map page (no "coming soon") |
| ☐ | Mount: `/<company>` with a bad / reserved slug | | App.jsx:909-915 | the same |
| ☐ | Mount: `/<company>/<id>` with a non-numeric id | | App.jsx:926-931 | the same |
| ☐ | Signed in, any unknown path → `Navigate /app`; an admin → `/admin` | never a 404 for a signed-in person | App.jsx:1207-1208 | unchanged (⚠ the owner may want Off the map inside the shell instead of a silent bounce — the bounce hides a dead link) |
| ☐ | Signed in, unknown `/app/<tab>` → the console (`/app/jobs`); unknown profile / interview panel → that place's first panel | | App.jsx:704-718 | unchanged (same question as above) |
| ☐ | `/app/*` signed out → `/login?returnTo=<path>`; an admin → `/admin` | | App.jsx:117-123 | unchanged (sign-in is #17's) |
| ☐ | `/admin*` without an admin session → `/admin/login` | | App.jsx:127-132 | unchanged (#21) |
| ☐ | Auth still unknown: a centred spinner + *Loading…* | | App.jsx:1021-1030 | ⚠ the plate rule is *no spinner* — a paper skeleton of the page frame (`Skeleton`, PlateState.jsx:11) |
| ☐ | Legacy `/resume`, `/ats-score` → the tools, query kept | dead links of the installed extension | App.jsx:1067-1068, 945-948 | unchanged ⛔ (comment explains: keep forever) |
| ☐ | `/try` → `/` (client + server) | the removed trial's link | App.jsx:1130; server.js:11169-11180 | unchanged |
| ☐ | `/draft/resume/<job>` signed out → `/` | | App.jsx:878-883 | unchanged |
| ☐ | `/jobs/<slug>` reached by the client router → reloaded from the server | | App.jsx:894-898 | unchanged |

## 2 · Server-side "not found" (real status codes — SEO keeps them)

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | Missing / held posting: **404** `noindex`, *This posting isn't here* + *See how draft finds, tailors and applies* (→ `/try` → `/`) | | services/jobs/publicJobPage.js:220-227 | Off the map in server HTML (the plate classes, `UnchartedPlate`'s SVG inlined), **404 + noindex kept**; the link → `/jobs` *Browse open jobs* (closer to what they wanted) and `/` |
| ☐ | Thin / unknown landing page: **404** `noindex`, *Not enough open jobs here yet. Browse every open job* | no thin pages | services/jobs/landingPages.js:103-105 | Off the map (server HTML), 404 + noindex kept, way back *Browse every open job* |
| ☐ | Unknown `/api/*` → **404 JSON** `{error:"not_found"}` | never the app shell's 200 | server.js:17786-17791 | unchanged (not a page) |
| ☐ | Unknown sitemap part → 404 *No such sitemap.* | | server.js:11277 | unchanged |
| ☐ | Offload busy → **503** + `Retry-After: 120`, *Busy — try again shortly.* (sitemaps, landing pages) | A158 | server.js:11258 | ⚠ plain text today; proposed: an Off-the-map *"The map is being redrawn — try again in a minute"* HTML for the landing pages (crawlers still get 503 + Retry-After) |
| ☐ | Everything else → the SPA `index.html` (200) | | server.js:17792-17794 | unchanged (the client's catch-all draws the 404) — ⚠ a client-drawn 404 is a soft 404 for crawlers; not this lane's to change |

## 3 · Errors

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | **No React error boundary anywhere** — a render error in any page blanks the whole app (a white screen) | ⚠ found | grep `componentDidCatch` / `getDerivedStateFromError`: none; main.jsx renders `<App/>` bare | **proposed (M5, owner ok):** one error boundary per area (around the shell's outlet and around each public page) drawing **Off the map · something broke**: *This page hit a fault — the rest of draft still works.* + *Reload this page* + *Back to the market* (signed in) / *Back to the front door* (signed out). Nothing is sent anywhere without the existing error reporting |
| ☐ | A lazy chunk that fails to load (a deploy mid-session) | no handler (`vite:preloadError` not listened for) | — | proposed: the same boundary catches it and offers *Reload* (a new deploy) |
| ☐ | The plate library's error state: one sentence + *Try again* (`role=alert`) | every plate component | plate/PlateState.jsx:34-41 | **this IS the plate's error** — kept; every classic error line below moves to it as its page is rebuilt |
| ☐ | The plate library's empty state: the dashed *NOT YET* drawer + one next step | | PlateState.jsx:22-32 | kept — Off the map's small cousin for an empty list |
| ☐ | Partial: *NO DATA YET* | | PlateState.jsx:44-48 | kept |
| ☐ | Board paging: *You are past the end of the list* (+ *There are N jobs…*) vs *Something went wrong loading this page* (count ≠ list — a server defect), *Go to the first page* | | panels/JobsPanel.jsx:4862-4888 | the market (Wave 1 #2) — the two words stay distinct; *past the end* = the drawer, *went wrong* = `ErrorLine` |
| ☐ | Network off → the page goes to `/app/jobs` | | NetworkPage.jsx:86 etc. | `network.md` §1 |
| ☐ | Résumé editor: *isn't available right now* / *didn't load* | | components/ResumeEditorHost.jsx:88, 131 | #20 |
| ☐ | Session ended in another tab: on visibility, `/api/auth/me` false → sign out | | App.jsx:720-731 | unchanged (behaviour) |

## 4 · Empty app states — the shared one and every page's own

The shared empty state is `components/EmptyState.jsx` (A93: one, shared — a display-serif title + a sentence). Callers:
`panels/JobsPanel.jsx:4841-4847` (*No jobs on the board yet* — *Add any job with the extension; it lands under +*) and
`panels/DatabasePanel.jsx:1147-1155` (*No rows match your filter* / *No applications tracked yet* / *No resumes generated
yet*). **M2:** `EmptyState` retires into the plate's `Drawer` (the dashed NOT YET drawer with one next step) as each page
moves — the same words, a next step added where there is one (*No jobs on the board yet* → *Add a job with the extension*).

Every page's OWN empty / error / unavailable line is listed in the appendix (135 lines, from the code) with the page whose
M1 owns it — **this doc owns the vocabulary, not the rows**; a row's home is its page's rebuild. Eight have no clear home
(⚠ in the appendix): `panels/JobProfilesPanel.jsx` (Job profiles is in no Wave 2 row) and `panels/JobWorkspacePanel.jsx`
(`/app/job/<id>`, the job workspace, is in no Wave 2 row).

---

## 5 · M2 — THE BRIEF

**Atlas name:** **Off the map** — the reader has walked past the edge of the known map. Parts: **the edge** (a small plate:
contours that stop at a dashed border, the reader's marker just beyond it) · **the one way back** (a clay ticket to the
nearest known place) · **the other roads** (two quiet tickets) · **its small cousins**: *Not yet* (the empty drawer),
*Something broke* (a fault), *Being redrawn* (busy / 503).

**Palette:** paper + ink; **no region** (the reader is outside every region) — `PlateRoot region="I"` only for the clay;
clay = the one way back. No green.

**The single clay point:** the one way back.

**Hero plate:** **drawing needed** — *the edge of the known map* (contours ending at a dashed edge, *HERE THE SURVEY
ENDS* in italic serif map print, a clay marker beyond the edge with one live detail: the beacon). The mock uses
`UnchartedPlate` (its own placeholder look happens to be that idea, but it is labelled *drawing to come*).

**Sections:** one — a 404 is a single plate + its way back. The *Something broke* and *Being redrawn* variants are the same
page with different words; the empty drawer is the in-page form.

**The one operable model:** none needed beyond the way back (the recipe's "one model" is waived for an error page — ⚠
owner); proposed light option: a search box *Make sense of… / Company, role, tech* that sends the mistyped path's words
to the market search (e.g. `/kestrel-payments-jobs` → *kestrel payments*).

**Squares:** none. **Onward tickets:** *Open jobs* (`/jobs`) · *Atlas* (`/atlas`) signed out; *The market* · *The ledger*
signed in.

**Library pieces:** `UnchartedPlate` (new, this lane, `plate/PublicPages.jsx`) · `Drawer` / `ErrorLine` / `Skeleton`
(existing, PlateState.jsx) · `Ticket` · `PageTitle` · `Kickers` · `PublicNav`.

**Rows whose home is unclear:** signed-in unknown paths (silent bounce vs Off the map in the shell) · the error boundary
(new behaviour, needs the owner's yes) · the busy page (503) as HTML · Job profiles' and the job workspace's empty /
error lines (no Wave 2 row).

---

## Appendix · every empty / error / unavailable line in the client today (from the code)

Found by `grep -rnE "(couldn.t load|didn.t load|could not load|isn.t available|not available yet|No [a-z ]+ yet|Nothing
(yet|here)|[Tt]ry again)"` over `pages/ panels/ components/ plate/` (not `dev/`, not comments) on `a393442e`. A line not
caught by these words (a custom empty sentence) belongs to its page's M1 — this list is the floor, not the ceiling.

| file:line | The words today | Home (its page's M1 owns the row) |
| --- | --- | --- |
| `pages/AdminLoginPage.jsx:123` | setNote("No admin account exists yet. Sign in with your current admin login, then add your admin account (its … | #21 Admin |
| `pages/atlas/AtlasPage.jsx:487` | {panel === "league" && (compete?.league ? <LeaguePanel base={base} /> : <p className="atl__quiet" role="status… | #5–#8 / #11 Atlas |
| `pages/atlas/AtlasPage.jsx:488` | {panel === "challenges" && (compete?.challenges ? <ChallengesPanel base={base} /> : <p className="atl__quiet" … | #5–#8 / #11 Atlas |
| `pages/atlas/AtlasPanels.jsx:236` | useEffect(() => { api('/api/learn/today?day=${day}').then(setT).catch(e => setErr(e?.status === 401 ? "Sign in… | #5–#8 / #11 Atlas |
| `pages/atlas/AtlasPanels.jsx:251` | {t && !q && <NotYet>No question to ask yet — there's nothing new for you today.</NotYet>} | #5–#8 / #11 Atlas |
| `pages/atlas/AtlasPanels.jsx:341` | ? <NotYet>No role can be audited yet: a role needs reviewed questions and at least 30 open jobs.</NotYet> | #5–#8 / #11 Atlas |
| `pages/atlas/AtlasPanels.jsx:518` | {ideas && shown.length === 0 && <p className="atl__quiet" data-hiw-none="">{ideas.length ? 'Nothing matches “$… | #5–#8 / #11 Atlas |
| `pages/atlas/AtlasVolume.jsx:87` | <p className="pl-at-msg" role="alert">The regions didn’t load. <button type="button" className="pl-btn" onClic… | #5–#8 / #11 Atlas |
| `pages/atlas/AtlasVolume.jsx:161` | if (v.status === "error") return <PlateRoot className="pl-at-page"><p className="pl-at-msg" role="alert">This … | #5–#8 / #11 Atlas |
| `pages/atlas/Navigator.jsx:25` | catch (e) { setError(e.message // "Not saved — try again."); } | #5–#8 / #11 Atlas |
| `pages/atlas/YourMap.jsx:89` | {t.nodes.length ? <AtlasTree tree={t} base={base} /> : <p className="atl__quiet" data-atlas-family-empty="">No… | #5–#8 / #11 Atlas |
| `pages/atlas/YourSkillsPanel.jsx:62` | {!list.skills.length && <p className="ysk__quiet">No skills yet. Add one below, or upload a résumé on your Pro… | #5–#8 / #11 Atlas |
| `pages/audit/AuditPage.jsx:64` | } catch (e) { setMsg(e.message // "That answer didn't save — try again."); } | marketing.md (proposed) |
| `pages/audit/AuditPage.jsx:157` | {roles === null ? <p className="au__quiet">Opening…</p> : !roles.length ? <p className="au__quiet">No role can… | marketing.md (proposed) |
| `pages/companies/CompanyPage.jsx:88` | if (error) return <main className="co co--empty" role="alert"><p>This page couldn't load just now — try again … | #4 the survey sheet (Wave 1) |
| `pages/interview/InterviewPage.jsx:56` | <h3 className="iv__h4">No interview invites yet</h3> | #13 Proving ground |
| `pages/interview/InterviewPage.jsx:115` | <span>{n == null ? "No question bank for this round yet" | #13 Proving ground |
| `pages/interview/InterviewPage.jsx:116` | : n ? '${n} question${n === 1 ? "" : "s"} from your debriefs' : "No questions yet — add them in a debrief"} | #13 Proving ground |
| `pages/interview/InterviewPage.jsx:127` | <p className="iv__p">No stories yet. Start them from your experience — each becomes a story in situation, task… | #13 Proving ground |
| `pages/interview/InterviewPage.jsx:283` | {d.status === "ready" && !list.length && <Quiet data-debriefs-empty="">No debriefs yet.</Quiet>} | #13 Proving ground |
| `pages/interview/InterviewPage.jsx:331` | <Coming id="past" eyebrow="Past sessions" title="No practice sessions yet" lead="Each mock interview will leav… | #13 Proving ground |
| `pages/jobs/PublicBoardPage.jsx:203` | {error && <p className="pb__msg" role="alert">{error === "busy" ? "A lot of searches at once — try again in a … | #16 public |
| `pages/marketing/ContactPage.jsx:49` | {status === "error" && <p className="mk-error" role="alert">Something went wrong — please try again.</p>} | marketing.md (proposed) |
| `pages/network/FeedPane.jsx:137` | const load = useCallback(() => api("/api/network/feed").then(setFeed).catch(e => setSaid(e.message // "The fee… | #14 Correspondence |
| `pages/network/FeedPane.jsx:159` | ? <p className="net__quiet">Nothing yet. Posts from your connections show up here, newest first.</p> | #14 Correspondence |
| `pages/network/MessagesPane.jsx:159` | {box.threads.length === 0 ? <p className="net__quiet">No conversations yet — Send a job from the deck, or writ… | #14 Correspondence |
| `pages/network/NetworkPage.jsx:58` | } catch (e) { if (e?.status === 404 // /not_available/.test(String(e?.message))) setOff(true); else setSaid(e.… | #14 Correspondence |
| `pages/network/NetworkPage.jsx:127` | {net.connections.length === 0 ? <p className="net__quiet">No connections yet. People you may know are below, a… | #14 Correspondence |
| `pages/network/NetworkPage.jsx:148` | {sugg && !sugg.why && sugg.people.length === 0 && <p className="net__quiet">No one yet — only people whose pag… | #14 Correspondence |
| `pages/profile/ProfilePage.jsx:151` | {log?.length === 0 && <p data-assistant-log-empty="">Nothing yet.</p>} | #9 Your passport |
| `pages/profile/YourProfile.jsx:273` | ) : <p className="yp__headline">{h.headline // <span className="yp__muted">No headline yet — Edit to add one.<… | #9 Your passport |
| `pages/SurveyPublicPage.jsx:27` | api("/api/survey/form").then(j => setQuestions(j.survey // [])).catch(() => setErr("The survey did not load. R… | marketing.md (proposed) |
| `pages/SurveyPublicPage.jsx:50` | intro="About two minutes. Your answers shape what we build. Nothing here is shared with employers." | marketing.md (proposed) |
| `panels/AccountPanel.jsx:196` | if (!r.ok) throw new Error("The export could not be made. Try again."); | #17 Settings |
| `panels/AccountPanel.jsx:445` | <div style={{ fontSize: ts(13), color: "var(--color-text)" }}>{account.email // "No email yet"} | #17 Settings |
| `panels/adminAdmins.jsx:71` | No admin account exists yet. The first one you add is an <b>owner</b>. Use an email that no user account uses … | #21 Admin |
| `panels/adminAdmins.jsx:89` | {d.admins.length === 0 ? <p style={quiet}>No admin accounts yet.</p> : ( | #21 Admin |
| `panels/adminAtlas.jsx:264` | {!sum ? <p style={quiet}>No answers yet.</p> : ( | #21 Admin |
| `panels/adminCalibrate.jsx:80` | <div style={quiet}>Nothing here counts until you accept it.</div> | #21 Admin |
| `panels/adminCalibrate.jsx:244` | : "No baseline yet. Record one once enough postings are reviewed; scripts/d125GoldGate.mjs then fails any chan… | #21 Admin |
| `panels/adminCalibrate.jsx:277` | : "No set yet. Make one: 20 computing and 20 other-field postings, entry to senior, each frozen with draft's r… | #21 Admin |
| `panels/adminDiagnostics.jsx:38` | {d.slowest.lastHour.length === 0 ? <div style={quiet}>No requests timed yet.</div> | #21 Admin |
| `panels/adminDiagnostics.jsx:70` | {kinds && (kinds.length === 0 ? <div style={quiet}>No jobs have run yet.</div> | #21 Admin |
| `panels/adminDiagnostics.jsx:140` | {s.runs.length === 0 ? <div style={{ ...quiet, marginTop: 8 }}>No runs yet.</div> | #21 Admin |
| `panels/adminEnrichment.jsx:556` | {!batches.length ? <p style={quiet}>No imports yet.</p> : batches.map((b) => ( | #21 Admin |
| `panels/adminOps.jsx:171` | : <div style={quiet}>No event received yet — the webhook is set in Railway → Project Settings → Webhooks, with… | #21 Admin |
| `panels/adminOps.jsx:231` | <Table theme={theme} rows={backups // []} empty="No backups yet — Back up now makes the first one." cols={[ | #21 Admin |
| `panels/adminOps.jsx:504` | <Table theme={theme} rows={d.tasks} empty="No tasks yet." cols={[ | #21 Admin |
| `panels/adminOps.jsx:786` | {s && <Table theme={theme} empty="No alerts sent yet." | #21 Admin |
| `panels/adminOps.jsx:1354` | <Table theme={theme} rows={d?.candidates // []} empty="No candidates yet — the discovery job runs weekly." col… | #21 Admin |
| `panels/adminOps.jsx:1523` | <Table theme={theme} rows={d?.sweeps // []} empty="No sweep yet." cols={[ | #21 Admin |
| `panels/adminOps.jsx:1846` | <Table theme={theme} rows={d.recent} empty="No calls yet." cols={[ | #21 Admin |
| `panels/adminOps.jsx:1974` | <Table theme={theme} rows={d.log} empty="No notices sent yet." cols={[ | #21 Admin |
| `panels/AdminPanel.jsx:410` | No messages yet. | #21 Admin |
| `panels/adminPeople.jsx:351` | <Table theme={theme} rows={d?.rows // []} empty={d ? "Nothing here." : "Loading…"} cols={[ | #21 Admin |
| `panels/adminPhase1.jsx:34` | {m.bank.surfaces.length === 0 ? <div style={quiet}>No answers yet.</div> | #21 Admin |
| `panels/adminTesters.jsx:207` | {d.funnel.locked.length ? <Bars bars={d.funnel.locked.map(x => ({ ...x, label: 'Pressed: ${x.label} (locked)' … | #21 Admin |
| `panels/adminTesters.jsx:238` | )) : <span style={muted}>{d.quotes.length ? "Nothing matches that search." : "No written answers yet."}</span>… | #21 Admin |
| `panels/AutoApplyPanel.jsx:999` | if (id == null) return <p className="dh-fold__quiet">No form was filled for this one yet.</p>; | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:1202` | : mail.length === 0 ? <NoteCard id="no-email" title="No emails yet" data-no-email="">Replies you forward to yo… | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:1220` | catch (e) { setRowMsg('Not saved — ${e.message // "try again"}.'); } | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:1434` | } catch (e) { setRunNowState({ busy: false, msg: e.message // "Couldn't start — try again." }); } | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:1516` | <button type="button" className="dht-step__link" onClick={() => { rerunHeld(heldRerunnableFrom(nodes)); setBan… | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:1592` | empty={!view.some(v => !v.run.future) ? <p className="dht-empty">No runs yet. Each run's picks show here as th… | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:1691` | label: "What draft filled for you", foot: "From your résumé and profile. Nothing here is guessed.", | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:1775` | {rows.length > 0 && !shownRows.length ? <p className="pl-q-note">Nothing here with this filter.</p> : null} | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:1929` | <p className="dht-empty">{rows.length ? "Nothing here with this filter." | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:2081` | No resume has been written for this application yet — approving is what | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:2228` | Nothing here was guessed on your behalf — these are the fields we would not fill without you. | #3 the ledger (Wave 1) |
| `panels/AutoApplyPanel.jsx:2375` | {applyRunDetail ? "No jobs in this run yet." | #3 the ledger (Wave 1) |
| `panels/DatabasePanel.jsx:1072` | <div style={{ fontWeight:700, color:theme.textMuted, fontSize:ts(14) }}>No saved jobs yet</div> | #21 Admin |
| `panels/DatabasePanel.jsx:1153` | title={hasFilter ? "No rows match your filter" : sheet === "applications" ? "No applications tracked yet" : "N… | #21 Admin |
| `panels/DeckView.jsx:1353` | <button type="button" onClick={fetchDeck} style={{ ...glass({ radius: 12 }), padding: "10px 18px", fontWeight:… | #2 the market (Wave 1) |
| `panels/DeckView.jsx:1364` | <button type="button" onClick={fetchDeck} style={{ background: "none", border: 0, padding: 0, fontWeight: 800,… | #2 the market (Wave 1) |
| `panels/DeckView.jsx:1381` | no_jobs: ["No jobs to pick from yet.", | #2 the market (Wave 1) |
| `panels/IntegrationsPanel.jsx:220` | ) : <div style={{ fontSize:ts(12), color:"var(--color-text-muted)", marginTop:6 }}>Nothing yet.</div>} | #17 Settings |
| `panels/IntegrationsPanel.jsx:357` | : "No job source is switched on yet — that's on our side, not yours."} | #17 Settings |
| `panels/JobProfilesPanel.jsx:204` | body={(profile.target_titles // []).slice(0, 3).join(", ") // profile.role_family // "No target titles yet"} | ⚠ unclear — Job profiles has no Wave 2 row (#9 or #10?) |
| `panels/JobProfilesPanel.jsx:308` | We couldn't load your job profiles — draft didn't answer in time. Nothing is lost.{" "} | ⚠ unclear — Job profiles has no Wave 2 row (#9 or #10?) |
| `panels/JobProfilesPanel.jsx:312` | Try again | ⚠ unclear — Job profiles has no Wave 2 row (#9 or #10?) |
| `panels/JobProfilesPanel.jsx:326` | No job profiles yet. Add your first one and draft starts finding jobs that fit it. | ⚠ unclear — Job profiles has no Wave 2 row (#9 or #10?) |
| `panels/JobProfilesPanel.jsx:434` | {state === "error" && <div style={muted}>Your trackers could not be loaded. <button type="button" className="r… | ⚠ unclear — Job profiles has no Wave 2 row (#9 or #10?) |
| `panels/JobsPanel.jsx:3244` | setScrapeError("Could not fetch new jobs. Try again in a minute."); | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:3598` | : resumeState === "loading" ? "Your résumé is still loading — try again in a moment." | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:3667` | failGen(key, e.message);   // D164: the posting's Résumé control says "Failed — Try again", never "no résumé" | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:4058` | title: "We couldn't load your job profiles", | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:4059` | body: "draft didn't answer in time — nothing is lost, your résumé and profiles are where you left them. Try ag… | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:4060` | actionLabel: "Try again", | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:4652` | <p style={{ margin:"0 0 8px", color:theme.text, fontWeight:700 }}>No imported jobs yet.</p> | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:4844` | <EmptyState theme={theme // t} title="No jobs on the board yet" | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:4911` | <span>We couldn't load this profile's résumé — draft didn't answer in time. Sorting by fit waits for it.</span… | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:4916` | Try again | #2 the market (Wave 1) |
| `panels/JobsPanel.jsx:4982` | <NoteCard id="board-no-jobs" title="No jobs collected yet" | #2 the market (Wave 1) |
| `panels/JobWorkspacePanel.jsx:151` | {filled.length === 0 ? <p style={{ ...muted, margin: 0 }}>No values filled yet.</p> : ( | ⚠ unclear — the job workspace /app/job/<id> has no Wave 2 row |
| `panels/JobWorkspacePanel.jsx:187` | {(d.emails // []).length === 0 ? <p style={{ ...muted, margin: 0 }}>No email linked to this application yet. R… | ⚠ unclear — the job workspace /app/job/<id> has no Wave 2 row |
| `panels/JobWorkspacePanel.jsx:238` | ) : <p style={{ ...muted, margin: "0 0 8px" }}>No date yet. The email did not state one plainly — enter it and… | ⚠ unclear — the job workspace /app/job/<id> has no Wave 2 row |
| `panels/ProfilePanel.jsx:1170` | : <>No job profile yet — upload your résumé on Your profile and one is made for you. Or <button type="button" … | #9 Your passport |
| `components/ApplicationHistory.jsx:99` | setMsg({ kind: "error", text: 'Not imported — ${e.message // "try again"}.' }); | #3 the ledger (Wave 1) |
| `components/ApplicationHistory.jsx:248` | setError('The history could not be loaded — ${e.message // "try again"}.'); | #3 the ledger (Wave 1) |
| `components/ApplicationHistory.jsx:275` | note(row.jobId, 'Not saved — ${e.message // "try again"}.', "error"); | #3 the ledger (Wave 1) |
| `components/ApplicationHistory.jsx:294` | if (failed) setError('${failed} of ${unanswered.length} were not saved — try again.'); | #3 the ledger (Wave 1) |
| `components/ApplicationHistory.jsx:479` | : "No applications yet. Draft a job, or open a posting on /draft, and it appears here."} | #3 the ledger (Wave 1) |
| `components/ApplicationInbox.jsx:35` | expired: "That took too long — press Connect Gmail again.", error: "Gmail could not be connected. Try again." … | #3 the ledger (Wave 1) |
| `components/ApplicationInbox.jsx:153` | <p className="dht-empty">{needle ? "No message matches." : category ? 'No ${LABEL[category] // category} messa… | #3 the ledger (Wave 1) |
| `components/AppNav.jsx:268` | ? <p className="appnav-peek__none">No notifications yet.</p> | #1 the shell (Wave 1) |
| `components/AskDraftThread.jsx:68` | } catch (e) { setSaved({ ok: false, text: e?.message // "Your answers couldn't be saved — try again." }); } | #12 Ask draft |
| `components/BoardBar.jsx:101` | setNote({ kind: "error", text: err?.message // "Could not import this job. Please try again." }); | #2 the market (Wave 1) |
| `components/JobDetailPanel.jsx:225` | {generateLoading ? "Generating…" : genError ? "Try again" : "Résumé for this job"} | #2 the market / opening sheet (Wave 1) |
| `components/JobDetailPanel.jsx:255` | {/* ⭐ D57: the state, in words — "Résumé ready · 2h ago". ⭐ D164: and Generating… / Failed — Try again, said u… | #2 the market / opening sheet (Wave 1) |
| `components/JobDetailPanel.jsx:263` | <button type="button" className="pp__retry" onClick={retry} disabled={!!st // noSlots} data-resume-retry="">Tr… | #2 the market / opening sheet (Wave 1) |
| `components/LiveCheck.jsx:118` | catch (e) { setSaid(e.message // "That didn't start — try again in a moment."); } | #2 the market (Wave 1) |
| `components/LiveCheck.jsx:124` | catch (e) { setSaid(e.message // "That didn't start — try again in a moment."); } | #2 the market (Wave 1) |
| `components/NotificationSettings.jsx:60` | if (perm !== "granted") { say?.("error", "Your browser is blocking notifications for draft. Allow them in the … | #17 Settings |
| `components/PlanSettings.jsx:29` | catch (e) { say?.("error", e.message // "That didn't work — try again."); } | #17 Settings |
| `components/ProfileSections.jsx:203` | {items.length === 0 && <span style={{ fontSize: ts(12), color: theme.textMuted }}>Nothing here yet.</span>} | #9 Your passport |
| `components/ProfileSections.jsx:443` | <span style={{ fontSize: ts(13), color: theme.text, whiteSpace: "pre-wrap" }}>{s.summary // <span style={muted… | #9 Your passport |
| `components/ResumeEditorHost.jsx:88` | if (!c?.available) return fail("The résumé editor isn't available right now."); | #20 Resume Master |
| `components/ResumeEditorHost.jsx:131` | const t = setTimeout(() => fail("The résumé editor didn't load."), READY_TIMEOUT_MS); | #20 Resume Master |
| `components/ResumeEditorHost.jsx:262` | onLoad={() => { const r = reqRef.current; setTimeout(() => { if (reqRef.current === r && !saidReady.current) f… | #20 Resume Master |
| `components/SendJobPicker.jsx:42` | {jobId && people?.length === 0 && <p className="sjp__quiet">No connections yet — copy the link instead, or con… | #14 Correspondence |
| `components/SkillCheck.jsx:146` | {!summary.passed && <div className="skc__row"><button type="button" className="skc__btn dbx-depth" onClick={st… | #10 Your survey / #11 |
| `components/SurveyForm.jsx:96` | catch (e) { setErr(e.message // "That did not send. Try again."); if (Array.isArray(e.body?.missing)) setMissi… | marketing.md (proposed, /survey) |
| `components/TopBar.jsx:141` | No notifications yet | #1 the shell (Wave 1) |
| `components/WarmPathsSettings.jsx:40` | } catch (e) { say("error", e.message // "Not deleted — try again."); } | #17 Settings |
| `plate/AtlasLibrary.jsx:131` | if (status === "error") return <main className="pl-at-lmain"><p className="pl-at-msg" role="alert">The Library… | the library (already plate — PlateState) |
| `plate/FitCard.jsx:142` | )) : <p className="pl-fit__small">No stack on record for this company yet: it comes from their own postings, a… | the library (already plate — PlateState) |
| `plate/FitCard.jsx:236` | setNote(e?.message // "That claim didn’t save. Try again."); | the library (already plate — PlateState) |
| `plate/Ledger.jsx:47` | const label = stops.length ? 'One application as a route: ${stops.map((s) => '${s.word.toLowerCase()} — ${s.su… | the library (already plate — PlateState) |
| `plate/MarketMap.jsx:189` | ? (sec.subs?.length ? sec.subs.map((x) => '${x.label} ${fmt(x.n)}').join(" · ") : "No roles counted inside it … | the library (already plate — PlateState) |
| `plate/MarketOpenings.jsx:39` | const [nonce, setNonce] = useState(0);   // Try again | the library (already plate — PlateState) |
| `plate/MarkPopover.jsx:54` | if (status === "none") return <p className="pl-markpop__line">No survey sheet for this company yet.</p>; | the library (already plate — PlateState) |
| `plate/PlateState.jsx:34` | export function ErrorLine({ text = "This didn't load.", onRetry }) { | the library (already plate — PlateState) |
| `plate/PlateState.jsx:38` | {onRetry ? <button type="button" className="pl-btn" onClick={onRetry}>Try again</button> : null} | the library (already plate — PlateState) |
| `plate/PlateState.jsx:55` | if (state === "empty") return <Drawer text={s.emptyText // frame.emptyText // "Nothing here yet."} action={s.e… | the library (already plate — PlateState) |
| `plate/sheetFixtures.jsx:130` | filled={{ kicker: "FILLED FOR YOU · 22 OF 24", label: "What draft filled for you", foot: "From your résumé and… | the library (already plate — PlateState) |

## M5 · What was built (47m, lane public — the 47n record)

- **#22 Off the map** — `plate/PublicPages.jsx` `OffTheMap` draws the 404 page (`pages/NotFoundPage.jsx`) and, through
  `services/publicChrome.js`, the server's not-found pages (a 404 stays a 404 with `noindex`).
- The per-area error boundary (`plate/AreaErrorBoundary.jsx`, 47k) is unchanged.

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).
