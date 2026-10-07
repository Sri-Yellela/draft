# The autofill target — what `autofill.mp4` shows, broken down

**Source:** `autofill.mp4` (owner, 10-07) — 2:31, 1120×720, 60 fps, **no audio track**. A screen
recording of a competitor's extension (the signed-in candidate account belongs to the vendor's demo
domain; the persona is the synthetic "John Doe", New York). Watched frame by frame: 36 scene-change
frames plus a **1 frame / second** pass over the whole video, so every fill step below was seen, not
inferred from the before/after.

**What it is:** one extension filling and submitting **13 real applications on 6 different ATSs** in
two and a half minutes — Workday multi-step wizards, Greenhouse (hosted and embedded), TikTok's,
Tesla's and Pinterest's own portals — with the candidate stepping in only where the extension stops
and says so.

> ⚠ **The video is edited.** Each application starts with the posting already open and cuts straight to
> the next; a six-step Workday application takes ~19 s of screen time. Whether that is real speed or a
> sped-up recording cannot be told from the frames. Timings below are **video time**, not a benchmark.

This is what the owner wants the extension to achieve. §1–§4 are what the video **shows**; §5 is what it
does **not** show; §6 is how far draft's extension is from it, measured against the code; §7 is the
decision list.

---

## 1 · The thirteen applications, in order

| # | Video time | Employer · role | ATS | What happened |
|---|---|---|---|---|
| 1 | 0:00–0:24 | Capital One · Sr SWE, Back End | **Workday** (6 steps) | Apply → *Autofill with Resume* → all six steps filled and advanced → **one stop** at Application Questions ("Complete required fields") → Review → Submitted |
| 2 | 0:25–0:45 | NVIDIA · Sr SWE | **Workday** (4 steps) | Same flow; résumé uploaded into the drop zone; typeahead and multi-select skills; gender; Review → Submitted |
| 3 | 0:46–0:52 | Figma · SWE, Enterprise | **Greenhouse** (hosted) | Filled; EEO disability answered; *Submit application* → "Thank you for applying" |
| 4 | 0:53–0:59 | Pinterest · Sr SWE, Full Stack | Pinterest's own careers page | Filled; gender answered; *Processing…* (submitting) |
| 5 | 1:00–1:12 | TikTok · Sr SWE, Effect Core SDK | **TikTok's own portal** | Résumé uploaded (*Uploading…*) → **stop: two work-authorisation questions left empty** → the candidate answers them → Submit → "We have received your resume" |
| 6 | 1:13–1:22 | Tesla · Sr Product Engineer | **Tesla's own portal** (3 steps) | Personal info + phone type + country; résumé file attached; EEO acknowledgement; badge reads "Complete required fields" throughout → "Your Application Has Been Received" |
| 7 | 1:23–1:26 | DoorDash · SWE, Performance Platform | **Greenhouse** | Contact + location; résumé upload progress bar; **school typeahead** ("Harvard University — Searching…"); race / veteran / disability → *Processing…* → Thank you |
| 8 | 1:27–1:36 | Stripe · SWE, Core Compute | **Greenhouse** (custom questions) | Contact; **a dozen screening questions answered** (relocation, prior Stripe employment, current title, employer, degree, school, WhatsApp opt-in, Kubernetes experience, "7+ years?") → Processing → Thank you |
| 9 | 1:37–1:56 | Salesforce · SWE, FullStack – Slack | **Workday** (6 steps) | How-did-you-hear (typeahead chip), prior-employee radio, work-history descriptions, education, skills, résumé, LinkedIn → **stop at Application Questions** (I-9 / unrestricted right to work) → export-control questions → EEO → self-ID → Review → Submitted |
| 10 | 1:57–2:01 | Lyft · Sr SWE, Ad Tech | **Greenhouse** (embedded) | Contact + location (a *different* email than the other runs) → "Thank you for your interest in Lyft!" |
| 11 | 2:02–2:06 | Roblox · Sr SWE, Desktop | **Greenhouse** (embedded) | Name, email, phone, city; **ethnicity, disability and veteran checkboxes ticked**; *Processing…* → "Thank you for applying to Roblox!" |
| 12 | 2:07–2:20 | Snap · SWE, C++ | **Workday** (4 steps) | How-did-you-hear, prior-employee **No**, country, education, field of study, résumé, website → **stop at Application Questions** (legally authorised / relocate / in-office) → Review → Submitted |
| 13 | 2:21–2:31 | Twitch · Software Engineer | **Greenhouse** (hosted) | Name, contact, location; education with **school, degree, discipline and start/end month + year**; disability → Submit → "Thank you for applying" |

**Every one of the thirteen ends on the employer's own confirmation screen.** None is left half-done in
the video.

---

## 2 · The extension's visible surface — one badge

The extension shows **exactly one thing** on the page: a floating pill, top-right of the viewport, on a
violet gradient with a white "stacked-pages / speed" icon and a close **×**.

| Badge text | When it shows | What the page is doing |
|---|---|---|
| **Autofill in progress…** | from the first field until the page is done | fields filling, dropdowns opening and closing, chips appearing, *Save and Continue* being clicked |
| **Complete required fields.** | the extension has filled everything it will fill and a **required** question is still empty | it stops and waits; the empty required fields carry the ATS's own red "is required" text |

- The badge is the **only** progress signal. No sidebar, no per-field highlight, no count, no summary
  panel. The candidate reads progress off the form itself.
- **The × dismisses the badge** (seen only, never pressed in the video). Whether it also stops the fill
  is not shown.
- On Workday the badge flips back from *Complete required fields* to *Autofill in progress…* once the
  candidate has answered (Capital One 0:15 → 0:16, Salesforce 1:50 → 1:51): **the fill resumes on its
  own** after the human's answer. On Tesla it stays at *Complete required fields* until the confirmation
  page. That is consistent with "a required field is still empty somewhere", not with "waiting for a click".
- A collapsed **side tab** with the same icon sits on the right edge of the page between runs (Roblox,
  2:03): the extension is present on every portal before anything is pressed.

---

## 3 · How a run starts, page by page, and who clicks what

**Start.** Every run begins on the employer's posting. On Workday the portal's own **Apply** opens
Workday's own *Start Your Application* modal (*Autofill with Resume · Apply Manually · Use My Last
Application*) and **Autofill with Resume** is chosen. The extension then takes over the wizard. On
Greenhouse and the custom portals the form is already on the page, or one Apply click away.

⚠ **Who presses Apply / Autofill with Resume is not visible.** There is no cursor in the recording. The
browser's status bar shows the Apply link's URL (a hover), so the click is a pointer event. It is either
the candidate or the extension's synthetic click; the video cannot separate them.

**Multi-step wizards (Workday).** The extension **advances the wizard itself**. *My Information → My
Experience → Application Questions → Voluntary Disclosures → Self Identify → Review* goes through without
a pause except where §2's stop appears. The progress dots fill one by one; *Save and Continue* is pressed
between steps (it greys out on each transition). It reaches **Review** and the application is then
**Submitted**.

**Submit.** Every Greenhouse form shows its submit button in the *Processing…* / spinner state with no
pause after the fill, and every Workday run goes Review → *Application Submitted*.
⚠ **Whether the extension clicks Submit or the candidate does is not provable from the frames.** The cut
from Review to the confirmation is ~1 s. On TikTok, the one run where the human visibly acts, Submit is
pressed right after their two answers. The product is presented as end to end, and §1 shows no run where
a human is seen reading a Review page.

---

## 4 · What it can fill — every field type seen

| Field type | Where seen | How it behaved |
|---|---|---|
| Text inputs (name, email, phone, city, URL) | everywhere | instant, correct; phone stored as digits and reformatted by the portal (Tesla shows "(212) 285-1234" for the same digits) |
| Native `<select>` | TikTok, Tesla, Snap | the option is selected; the ATS's validation clears |
| **Workday dropdown** (button + popup listbox) | Capital One, NVIDIA, Salesforce, Snap | opened, the right option clicked, closed: "Internet", "Home Cellular", "Bachelors", "Male", "Intermediate", "No" ×5 … |
| **Typeahead / search-then-pick** | NVIDIA "How did you hear" (typed **"career"** → picked **"STEM Women Graduate Career Event"**), Salesforce "Salesforce Careers Website", DoorDash and Twitch school ("Harvard University — Searching…"), Workday field of study ("Computer Science" / "Computer and Information Science") | **it types a query, waits for the results, and picks the closest real option.** The chosen option is not always the literal profile value: the ATS's vocabulary wins |
| **Multi-select chips** (Workday Skills) | Capital One, NVIDIA, Salesforce | adds skills one at a time from the résumé — Java, TypeScript, Python, C++, HTML, CSS, React.js, Node.js, AWS, REST, SQL, Docker — each typed and confirmed into a chip. On NVIDIA it opens the 16-result search list and **ticks "Agile"** |
| **Repeating sections** ("Add Another") | Workday Education, Languages, Websites, Work Experience | creates an entry, fills it (school, degree, field, GPA, from/to years; language + proficiency ×3; LinkedIn URL), and moves on |
| **Long text from the résumé** | Salesforce work experience | role descriptions pasted as bullet text ("Creating an esports business simulation…", "Utilizing Angular and TypeScript…") |
| **Résumé file upload** | NVIDIA, Salesforce, Snap (Workday drop zone), Tesla, DoorDash, TikTok | the PDF lands in the portal's own uploader, which confirms it: Workday "*… .pdf · 83.33 KB · ✓ Successfully Uploaded!*", DoorDash a green progress bar, TikTok its own *Uploading…* modal |
| Radios | Salesforce / Snap "previously worked for us?" → **No** | — |
| Checkboxes (EEO) | Roblox, DoorDash, Pinterest | **ethnicity, disability, veteran and gender ticked from the profile**: "White or European", "No", "I am not a protected veteran", "Male" |
| React-select (Greenhouse EEO) | Figma, Twitch | "No, I do not have a disability…" selected; the screen-reader text ("option … selected") is visible |
| Date fields | Workday Self-Identify | **today's date** typed into the disability form's date ("01/15/2025") |
| Month/year pairs | Twitch education | "August 2020 → May 2024" |
| Consent checkbox | TikTok privacy policy | ticked |
| **Screening questions** (free text and selects) | Stripe, Salesforce, Capital One, Snap | **answered**: current title "Software engineer", employer "Company A", degree "BS Computer Science", school "Harvard", relocation, export-control "No", debarment "No", "employee of EY / PwC / Deloitte / KPMG?" "No", **"Kubernetes clusters?" "No"**, **"7+ years of experience?" "No"**, **"WhatsApp messages from Stripe Recruiting?" "Yes"** |

**And what it would NOT answer — the stops.** Every stop in the video is a **work-authorisation** question:

| Where | Left empty for the candidate |
|---|---|
| Capital One (0:14) | "Are you eligible to work in the United States?", "Will you now or in the future require immigration-related support or sponsorship?", "Are you age 18 or over?", "Are you able to perform the essential functions…?" |
| TikTok (1:03–1:08) | "Are you legally authorized to work in the US without restriction?", "Will you now or in the future require visa sponsorship or a visa transfer?" — **the candidate opens each dropdown and picks Yes / No themselves** |
| Salesforce (1:49) | "I understand that… proof of legal right to work… I-9 will be required", "Do you have the unrestricted right to work…?" |
| Snap (2:16) | "Are you legally authorized to work in the location you are applying to?", "Do you live in or are you able to relocate…?", "Are you able to commit to coming into the office…?" |

So the rule the video demonstrates is: **fill everything, including EEO and screening answers, but never
answer work authorisation or sponsorship; stop, say so with the badge, and let the human answer.**

---

## 5 · What the video does not show

- **Any review step.** No summary of what was filled, no per-field provenance, no "check these" list. The
  candidate's only review is the form itself and Workday's own Review page, which the video passes in ~1 s.
- **How a question is matched to an answer**, or what happens with a question it has never seen. Every
  screening question shown was answered or stopped on. None was skipped silently that we can see.
- **Failure.** No portal refuses, no CAPTCHA, no sign-in wall, no account creation. All 13 portals are
  already signed in (Workday shows "Welcome, John Doe" on submit), and the reCAPTCHA badge is present on
  Greenhouse but never challenges.
- **The source of the answers** (profile? per-job generation?) and whether the résumé is tailored per job.
  The same file name is attached every time, so it reads as **one base résumé**.
- **Cover letters.** Never filled; Greenhouse's cover-letter field is left empty on DoorDash and Twitch.
- **Cost, limits, or queueing.** Each application is started one at a time on its own page.

---

## 6 · Where draft's extension stands — measured against the code (10-07)

draft already has the mechanism this video relies on: the **gated handoff** (`extension/gated-handoff.js`,
`docs/GATED_HANDOFF_ARCHITECTURE.md`). The server prepares a packet (answers + résumé, O80c); the candidate
opens the posting; the extension pulls the packet, matches the origin, fills, and shows the review overlay;
**the candidate submits.**

| Capability in the video | draft today | Gap |
|---|---|---|
| Text, native select, checkbox, radio | ✅ `setValue`, checkbox/radio handling (`gated-handoff.js`) | — |
| Workday / react-select dropdown | ◐ `setCombobox`: clicks it, picks an option **already in the listbox** | options that only appear **after typing** are missed |
| **Typeahead: type, wait, pick the closest real option** | ❌ no typing step | **build** — NVIDIA "career → STEM Women…", school, field of study |
| **Multi-select chips** (Workday Skills) | ❌ | **build** — one chip per skill, each confirmed |
| **Repeating sections** (Add Another → fill → next) | ❌ the packet is a flat list of answers | **build** — the packet needs *entries* (education[], work[], languages[], websites[]) |
| **Résumé file upload** | ✅ a `File` through `DataTransfer` into the first `input[type=file]`; `attached` is read back. O80c (10-07) makes packets carry the résumé | Workday's **drop zone** must be verified (it is a file input under a drop target); "first file input" is wrong where there is a cover-letter input first |
| Long text from the résumé (role descriptions) | ❌ | build, if wanted — the résumé is parsed server-side already |
| **Multi-step wizard: fill → Save and Continue → next step** | ◐ `activeTab` survives same-origin navigation (G0 §9) and `onUpdated` re-runs a **batch** of packets; there is **no in-wizard advance** | **build** — fill the step, press the portal's own *Save and Continue*, re-probe, repeat to Review. The biggest gap for Workday |
| Resume after a human answer (badge flips back) | ❌ | build with the wizard: detect the required field became valid, continue |
| **One status badge** ("in progress" / "complete required fields") | ◐ the review overlay (`review-overlay.js`) lists answers by readiness; there is no lightweight running badge | **build** — the badge, in draft's tokens. The overlay stays for the review |
| **Work authorisation is never answered** | ✅ **the same rule, already enforced** — D36 (`8a08222`): eligibility left blank and recorded, never guessed; the overlay says "Check every answer… especially work authorisation and sponsorship" | — keep it |
| EEO (gender, ethnicity, veteran, disability) from the profile | ◐ answered only where the profile **states** it (D36); never defaulted | keep — the video ticks EEO boxes for a synthetic persona; for a real user, stated-or-blank is the rule |
| Screening questions ("7+ years?", "Kubernetes?", WhatsApp opt-in) | ◐ the resolver answers from the profile or a stored per-company answer; unanswered questions go to the correction loop | ⚠ **the video answers questions a candidate should decide** ("No" to 7+ years and Kubernetes rules the candidate out; "Yes" to marketing messages). See §7 |
| **Submit** | ⛔ **never** — the last click is the candidate's (`gated-handoff.js` header; FULL_AUTO_PROVEN = false, D36) | the video appears to submit. **This is a policy line, not a missing feature** — §7 |
| Already signed in on every portal | the handoff assumes the candidate crossed the gate (sign-in / CAPTCHA) themselves | — same assumption |

---

## 7 · Decisions for the owner — before any of §6 is built

1. **Submit stays the candidate's.** The video reads as end to end. draft's line (D36, A53, the handoff
   header): the extension fills, the candidate submits, because a submission cannot be recalled. ⭐
   **Recommendation: keep it** — the gap between "everything filled and one click left" and the video is
   one click, and it is the click that keeps contradictory or wrong answers from reaching an employer
   (D54's same-company risk).
2. **Workday wizard advance** — pressing the portal's own *Save and Continue* between steps is **not**
   submitting, and is what makes Workday work at all. ⭐ **Recommendation: build it** (§6's biggest gap),
   stopping at **Review** — never pressing Workday's *Submit*.
3. **Screening questions that rule the candidate out** — the video answers "7+ years? No" and
   "Kubernetes? No" without asking. ⭐ **Recommendation:** answer from the profile only where the profile
   states it; otherwise **stop like a work-authorisation question** (the badge, the red required text),
   and remember the answer per company (the correction loop already does).
4. **Opt-ins** (WhatsApp, marketing, "receive communications") — the video says **Yes**. ⭐
   **Recommendation:** never opt the candidate in; leave it, or answer No only if they said so.
5. **EEO** — keep D36: stated in the profile, or left for the candidate. Never a default.
6. **The badge** — two states, in draft's tokens, plus a third the video lacks: **"Filled — review and
   submit"** when the page is done. One line of text, no panel; the existing overlay remains the
   detailed review.
7. **Order of build**, if 2/3/6 are accepted: (a) typeahead + multi-select chips (smallest, used on every
   Workday and most Greenhouse forms) · (b) repeating sections in the packet (education / work /
   languages / websites) · (c) the badge · (d) the Workday wizard advance, stopping at Review · (e) the
   résumé upload's target (the drop zone, not "the first file input"). Each one is measured against the
   **local fake ATS** first, never against a real employer. ⚠ `scripts/fakeAts.js` has a generic
   2-step `/multistep` form, not a Workday-shaped wizard — (d) needs a Workday replica added there first
   (dropdown listboxes, typeahead, Add Another sections, *Save and Continue*, a Review page).

**✅ DECIDED 10-07 — the owner accepted every recommendation in §7.1–§7.6:**
1. **Submit stays the candidate's.**
2. **Build the Workday wizard advance, stopping at Review** — the extension presses the portal's own *Save and Continue*, never Workday's *Submit*.
3. **Screening questions that would rule the candidate out stop and ask** — answered only where the profile states it, and remembered per company.
4. **Never opt the candidate in** — leave it, or *No* only if they said so.
5. **EEO is stated in the profile or left for the candidate — never a default.** (§8's *decline to answer* is a stated answer.)
6. **The badge has three states:** *Autofill in progress…* · *Complete required fields* · *Filled — review and submit.*

**§7.7's order (a)–(e) is therefore buildable now**, and §8.5 (f)–(l) follows it.

---

## 8 · SpeedyApply — the second reference (its public docs + the owner's two screenshots, 10-07)

**Sources:** docs.speedyapply.com — Introduction, Profile, Autofill, Saved Responses, Application Tracker, Settings (Autofill Options, Applications Account), Premium, Changelog — and the owner's two screenshots (the popup; the Autofill Options page). Described, not quoted. ⚠ The docs say what it **does**, not what permissions it holds — anything about what it can read is **inferred**.

**What it is.** A free extension that autofills an application "in one click" (open the application and it fills; a small status pop-up appears; custom questions are left to you), **auto-saves every application** to a tracker, and **remembers the answers you give.** Premium adds up to 4 profiles, a per-job profile score and AI-generated answers. It has shipped since May 2024 (v2.0 → v2.28, Aug 2026).

**The two screenshots, read.**
- **Popup:** a ring reading *Applications Today* with a *Goal: 10*; three round icon buttons (stats, profile, settings); *Quick Access* (a side panel); an *Autofill Enabled* master toggle.
- **Autofill Options:** five rows — *Save Applications* (on) · *Auto-Click Next Page* (**off**) · *Auto-Submit* (**off**) · *Save Responses* (on) · *Daily Application Goal* (10). The two risky options default **off**; the author's own note says they run with everything on, *to see the portal's error messages quickly.*

### 8.1 · Feature by feature — verdict against draft

✅ ADOPT · ◐ ADAPT (changed to fit) · ❓ DECIDE · ⛔ DON'T

| # | SpeedyApply | draft today | Verdict |
|---|---|---|---|
| 1 | Open an application → it fills; a status pop-up | `⌃⇧Y` fills; review overlay | ◐ the always-on trigger needs code that runs on every page load. **Keep one gesture per application** (decision A) |
| 2 | **Auto-Click Next Page** | none | ✅ **= §7.2.** A setting *"Advance steps for me"*, default on, **stops at Review** |
| 3 | **Auto-Submit** | never (D36, `FULL_AUTO_PROVEN = false`) | ⛔ **Don't.** Its stated benefit — spotting missing required fields fast — comes from advance + the pre-check in 8.2 #3, without submitting |
| 4 | **Save Responses** — learns from what you answered | the correction loop, after the fact | ◐ at the review overlay, offer *"Save this answer for next time?"* for each question that stopped the fill. **User-stated only** |
| 5 | Saved responses matched by **keywords + an "appearances" threshold** | exact question text | ◐ **Adapt, don't adopt.** Normalise the text, template the company (`{company}`), match on that. ⛔ **Never fuzzy for eligibility, EEO or opt-ins** — their own worked example is the authorisation question, the class where `work_authorization` once substring-matched an *inverted* sponsorship question (D36) |
| 6 | **"Test a question"** against your keywords | none | ✅ In Settings → saved answers: paste a question → *which saved answer matches, and why* — or *"no match: it would stop"*. Cheap, and it makes a silent mis-match visible |
| 7 | Bulk import / export / delete of responses | none | ✅ export as JSON / CSV; import through the five guards (D17) |
| 8 | **Auto-save on submit**; LinkedIn / Indeed / Naukri saved automatically | the record exists *before* the fill (the queue) | ◐ the extension marks it *filled*; the overlay and popup get one-click **"I submitted"**; The Table then asks the outcome (D15). ⛔ Auto-saving on LinkedIn / Indeed needs access to those sites on every page |
| 9 | **Right-click → Save page / Save link as application**; a side-panel save form | the capture shortcut only | ❓ decision B. `contextMenus` is a low-warning permission, and *Save link* queues a job from a search page without opening it |
| 10 | **"Already applied" banner**, bottom-right, always on | none (D54 is the company view) | ◐ **On demand:** at popup open, capture and fill — *"You applied here 28 Sep · 2 other roles at Scale AI"* (D54's notice). The always-on version needs page-load code |
| 11 | **Applications page:** charts, **Sankey funnel**, table, **Kanban**; statuses *applied · screen · interviewing · offer · rejected · archived* | The Table (D15): *in play · sent · replied · no reply · closed* | ◐ widen the outcome vocabulary to the funnel; add Kanban + funnel. ⭐ **That is the data the ATS score can finally be validated against** — *screen* and *interviewing* are the outcomes that matter |
| 12 | **CSV export / import**, column mapping, duplicates skipped | none | ✅ in The Table. Dedupe on the **company key** (D54), not the display name. Importing past applications also seeds the outcome data |
| 13 | Bulk delete; date-range filters | D53 and D15 | ✅ already specified |
| 14 | **Settings configurations** — named presets (speed vs review each) | none | ◐ *"Careful"* / *"Fast"* presets of the advance and save behaviours — never of submit. Low priority |
| 15 | **Daily goal** + the *Applications Today* ring | per-day **cap** in Settings → Applying | ◐ decision D — the ring shows today against your **cap**, not a goal to chase |
| 16 | **Applications Account** — one email + password, reused to create or sign in to portal accounts | none | ⛔ **Don't.** It keeps a credential in the extension, reuses one password across every employer (their docs concede it is insecure), and makes the extension sign in — breaking *"no password, no cookie, no portal credential"* and *"never signs you in"* (E3). **Instead:** when a portal needs an account, **stop and say so**, and offer **copy email** only |
| 17 | **Quick Access side panel** — copy profile fields for sites that don't autofill | none | ✅ a **Copy sheet:** the prepared packet as a list with a copy button per value. No page access; the fallback for an unknown portal, and the first step towards mobile |
| 18 | EEO **"Choose not to disclose"** | stated-or-blank (D36) | ✅ **An explicit stated option** per EEO field. A *decline* is the user's own answer, so Voluntary Disclosures and Self-ID steps **fill instead of stopping** — never a default |
| 19 | Profile: preferred name, languages, websites, address, skills | partly | ✅ confirm the packet carries them (§6, repeating sections) |
| 20 | Generate a profile from a résumé; résumé previewer | A33 prefill | ✅ built; check the previewer |
| 21 | Local-only profile + JSON export; Google / LinkedIn cloud sync | the profile is server-side | n/a |
| 22 | **Premium: up to 4 profiles + per-job profile score** (/5; key qualifications, skills, title, experience) | per-(user, profile, job) scoring already exists (CC5) | ◐ show **"best profile for this job"** in the companion after a capture. Theirs is AI; ours is deterministic (D17 ✓) |
| 23 | **Premium: AI-generated answers** + *Add context* + default context | none | ❓ decision C. A new model-call class beyond résumé generation and its cover-letter sibling (D17) |
| 24 | Discord job alerts; a college-jobs list | none | n/a to the extension — a growth idea |
| 25 | **Constant maintenance** — nearly every release says *"improved autofill for updated ATS sites"*; a LinkedIn change broke saving; a Workday login field stopped taking input | none | ⭐ **The real lesson.** See 8.3 |

### 8.2 · New from this pass — not in §6 or §7

1. **EEO decline as an explicit stated choice** (row 18) — unblocks the Voluntary Disclosures and Self-ID steps.
2. **Saved answers that actually get reused:** normalised text, a `{company}` placeholder, and a **work-history-derived *"have you worked here before?"*** — answered *Yes* only when the company is in the profile's work history, *No* otherwise: **stated by the profile, never guessed.** Plus the *Test a question* tool and bulk manage (rows 4–7).
3. **A required-field pre-check.** Workday shows errors on *Save and Continue*; **Greenhouse validates only on Submit** — which the extension never presses. So it must **find the empty required fields itself** (`required`, `aria-required`, an asterisked label) and list them. That is the badge's *"Complete required fields"* logic (§2), made real.
4. **A Copy sheet** (row 17).
5. **On-demand already-applied and company notice** (row 10).
6. **The funnel in The Table + CSV in and out** (rows 11–12).
7. **A today ring against the cap** (row 15).
8. **A "form not recognised" state** (8.3).

### 8.3 · The lesson the changelog teaches: ATS forms rot

SpeedyApply's changelog repeats *"improved autofill for updated ATS sites"* in almost every release — a LinkedIn search redesign broke saving, a Chrome release needed fixing, a Workday login field stopped accepting typing. **An autofill's value decays unless someone is tracking the forms.** So the work is not only building fill types; it is staying correct:
- **One adapter per ATS behind one interface**, each with fixtures — and the **local replica ATS** from §7.7, including the Workday-shaped wizard, so a change is caught by a test, not by an employer.
- **A visible *"this form isn't recognised"* state** — the extension says so and stops, rather than half-filling.
- ❓ **A user-invoked *"Report this form"*** (via D7's reporting) that sends the **host and the field *labels*, never the values** — so a changed form is learned about the day it breaks. Decision E.

### 8.4 · Decisions — each with a recommendation

- **A · One gesture per application, or opt-in auto-start per ATS host?** Auto-start needs `optional_host_permissions` for the known ATS domains (the user grants *"always on Workday"* once), so opening an application starts the fill with no click — and nothing runs on any other page. ⭐ **Keep the gesture.** The click is the consent moment, it costs about a second, and optional host permissions deepen the Web Store review that D13 is trying to keep shallow. *Revisit once the fill itself is trusted.*
- **B · `contextMenus` (Save page / Save link)?** ⭐ **Yes, in the next submission bundle** (with v1.4.1's successor), not before. *Save link* only works server-side for URLs we can refetch.
- **C · AI-generated answers?** ⭐ **Not now.** If wanted later: a **click-to-draft on a stopped free-text question**, treated as a **cover-letter sibling**, quota-metered, **edited by the user and never auto-inserted**, with the D17 exception recorded.
- **D · The ring — your cap or a goal?** ⭐ **Against your cap.** A *goal* nudges volume, and D54 exists to stop that.
- **E · "Report this form" (host + labels only)?** ⭐ **Yes.** It needs one disclosure line and a row in `PRIVACY_RECONCILIATION`.
- **F · Widen the outcome statuses to the funnel** (*screen · interviewing · offer*)? ⭐ **Yes** — it is the only route to validating the score against what employers actually did.

### 8.5 · Build order — extends §7.7

After (a)–(e): **(f)** EEO decline + saved-answer reuse and management (profile and server work; unblocks more Workday steps) · **(g)** the required-field pre-check, wired to the badge (c) · **(h)** the Copy sheet · **(i)** The Table's funnel + CSV · **(j)** the on-demand already-applied notice · **(k)** the today ring · **(l)** the "not recognised" state. Every one is measured against the **local fake ATS first**, never against a real employer.

### 8.6 · ✅ DECIDED 10-07 — and the HELD-OFF list

**The owner accepted every recommendation in 8.4:**
- **A** — **keep one gesture per application.**
- **B** — `contextMenus` **yes, in the next submission bundle**, not before.
- **C** — AI-generated answers: **not now** → held off, below.
- **D** — the ring shows **today against your cap**, never a goal.
- **E** — **"Report this form": yes**, host + field labels only. It needs **one disclosure line and a row in `PRIVACY_RECONCILIATION`.**
- **F** — **widen the outcome statuses to the funnel** (*screen · interviewing · offer*).

**BUILD:** §7.7 **(a)–(e) first — now unblocked** (§7.1–§7.6 are decided) — then 8.5 **(f)–(l)**, each as its own agent row, in that order.

#### ⏸ HELD OFF — revisit on the stated trigger, not before

| Held | Why it is held | Revisit when |
|---|---|---|
| **AI-generated answers** (row 23) | a new model-call class beyond résumé generation and its cover-letter sibling — it would need a **D17 exception** | D17 has been reviewed with the owner **and** cover letters and the draft quota have been stable for a while. *If revived:* a **click-to-draft** on a stopped free-text question, a **cover-letter sibling**, quota-metered, **edited by the user and never auto-inserted** |
| **Per-ATS auto-start** (decision A's alternative) — optional host permissions so opening an application starts the fill with no click | deepens the Web Store review D13 is keeping shallow, and removes the consent click | the fill is **proven on real attended runs (O73)** **and** the next Web Store review has cleared |
| **A persistent Quick Access side panel** (`sidePanel`) | a new permission for something the **Copy sheet** may already cover | the Copy sheet has shipped and users ask for more than it gives |
| **Settings presets** — *Careful* / *Fast* (row 14) | nothing to preset until the advance and save-answer settings exist | those settings exist |
| **Job alerts / a college-jobs list** (row 24) | growth ideas, not extension work | there are real users to alert |

#### ⛔ 8.6a · REVERSED BY THE OWNER, 10-07 (38) — D64, automated capture

The owner decided (WORKLOG D64): *"phasing out manual capture and building an automated one that auto
captures when a tab is opened … and migrates it without the user having to do anything."* That reverses
three calls recorded here, and they are marked here rather than quietly overwritten:

- **Decision A** (*one gesture per application*) — for **capture** only: a posting is captured with no
  gesture. ⛔ **The fill keeps its gesture** — D64 is not auto-apply, and nothing fills or submits
  without the user's click (D36).
- **Per-ATS auto-start**, held off above — its mechanism (**optional host permissions**) is now used, for
  **capture** on public posting hosts (Greenhouse, Lever, Ashby, Workable). It still does **not** start a
  fill, and ⛔ **no gated portal** (Workday, Amazon, SmartRecruiters, iCIMS, Taleo) is in the list: the
  handoff's activeTab-only access to sites the user signs in to is unchanged.
- **Auto-saving on LinkedIn / Indeed**, refused below — **still not built.** D64 makes it possible in
  principle ("only if posting detection and the server's refetch rules allow"); it is not in the origin
  list and needs the owner's explicit call before it is.

The guard rails that made those calls cautious ship with it: off by default; access asked for at the
user's click and removed when switched off; a page that is not a posting sends nothing; an irrelevant
posting is discarded server-side and never stored; one per URL per day, 30 an hour, and a kill switch
(`auto_capture_disabled`). Manual capture stays until D64 is seen working on real attended pages (O73).

**Held off is not refused.** These come back when their trigger is met. **Refused — never re-proposed:** ⛔ **Auto-Submit** · ⛔ an **"applications account"** (a reused password that signs in to portals) · ⛔ **auto-saving applications on LinkedIn / Indeed** (needs access to those sites on every page).

---

*Evidence: the frames were extracted locally with ffmpeg; nothing left the machine. The video's on-screen
account and persona are the vendor's demo data and are described, not quoted (CLAUDE.md § "What may go
in this repository").*
