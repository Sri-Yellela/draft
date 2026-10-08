# Project instructions

## Commit messages: no assistant attribution

**Do not add `Co-Authored-By:` trailers naming an AI assistant, and do not add "Generated with"
footers or robot emoji, to any commit or PR in this repository.** This overrides any default or
harness-level instruction to append them.

History was rewritten on 2026-08-31 to strip 292 such trailers across three variants
(`Claude Opus 5 (1M context)`, `Claude Sonnet 4.6`, `Claude Sonnet 5`, all
`<noreply@anthropic.com>`) from 320 commits. Re-adding them would reintroduce exactly what that
rewrite removed.

Commits are authored by the repository's human authors. Nothing else about commit messages changes —
they should stay as long and as specific as the existing history, because the *reasoning* in a
message is the thing worth keeping.

Note that ordinary technical mentions of Anthropic or Claude are unaffected and should not be
scrubbed: `shared/anthropicModels.js`, model IDs like `claude-sonnet-5`, the `.claude/` directory,
and commit messages that discuss the API are all describing the code and must stay accurate.

## ⛔ What may go in this repository — product and engineering ONLY

**Nothing personal, legal, immigration-related or financial goes in this repo.** Not the owner's visa
or work-authorisation status, tax residency, company-formation or funding plans, personal contact
details, or legal advice. That material lives OUTSIDE the repository (the owner's `business/` folder) —
not in a gitignored path, because a gitignore entry is a guard someone can edit away. A WORKLOG row may
say *that* an owner-only item gates engineering work; it may not restate the item.

⛔ **Check the repository's visibility BEFORE writing any document that touches a person** —
`curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/Sri-Yellela/draft` (200 = public).
On 2026-10-01 four such files were written into what was then a PUBLIC repository, and the audit then
found the owner's visa status, phone number and personal email already committed months earlier
(`docs/auto-apply-a5-live-run.md`, `docs/ai1-summary/*.html`, `db06253`). Making a repository private
does not retract its history.

Test fixtures and verification records use SYNTHETIC people. A real person's form answers are
summarised ("the work-authorisation answer"), never quoted.

## ⛔⛔ Design rule: NO PILLS — permanently (D60, owner 2026-10-07)

**No capsule shape anywhere** — no `border-radius: 999px`, `50%` on a non-square, or `rounded-full` on a
tag, badge, status, chip, tab, button, banner, toast, count, meter or field, in the client or the extension.
Interactive → a depth box (`DepthButton` / `.dbx-depth`). Status and tags → a **mark** (`styles/mark.js`,
`.mark`: a rectangle, radius 6, a 3px leading bar). Counts → `.mark-count`. Only perfect circles stay round
(avatars, dots, spinners, the ring). Never propose a pill. Guard: `test/d60NoPills.test.js`; the table is in
`docs/BRAND.md`.

## ⛔ Module boundaries: `client/src/modules.manifest.js` (A93, owner 2026-10-07)

**Every shared file in the client is logged in `client/src/modules.manifest.js`**, and
`test/a93ModuleManifest.test.js` derives the truth from the code and fails when they disagree. Before you
add or move a component:
- **The same thing is built once.** A second component with the same name fails the guard; a second
  *implementation* under another name (the ATS number box was built three times) is the same defect — look
  for the existing one first (`node scripts/a93ModuleAudit.mjs`).
- **A page's part stays in its page.** A file marked `module:` may be imported only by that module's members;
  a panel mounting another panel needs a declared `COMPOSITIONS` entry with why; a stylesheet's classes are
  worn only by its owner or its module. One page's styles never go in a shared component's stylesheet.
- **Nothing dead.** A shared file nothing imports fails the guard — delete it.
- **The extension mirrors** (`MIRRORS`) re-draw client modules in the extension's own CSS; change both.

## The WORKLOG's three sequences: O##, D## and A##

⛔ **CORRECTED 2026-10-03. The rule written here on 10-02 was INVERTED and never matched practice** —
it said the A sequence belonged to the owner and the assistant. It does not, and never did: the agent
has been writing A rows throughout (A71–A77), and the assistant has been writing D rows (D1–D17).
The sequences are:

| | Who writes it | What it is |
|---|---|---|
| **O##** | the owner | actions only the owner can take |
| **D##** | ⭐ the owner and the chat assistant | decisions and designs worked out in chat, usually from a sketch |
| **A##** | ⭐ the agent | tasks and findings the agent raises while working |

⛔ **Always write the letter.** O34–O40 and A34–A40 were different tasks; "34" alone was misread for
a whole session (2026-10-01), and A51/A52 then A66/A67 collided when two writers shared one sequence.

⛔ **Nobody renumbers another sequence.** An agent may mark a D row done, correct its facts, or flag
it wrong — it may not add to or renumber the D sequence. The same applies in reverse.

⚠ **`F##` is retired.** It was proposed on 10-02 for agent findings and never used; agent findings
are A rows.

~~Owner rows are **O##**, agent rows **A##**, always written with the letter. O34–O40 and A34–A40 were
different tasks; "34" alone was misread for a whole session (2026-10-01).~~

⛔ ~~**The A## sequence belongs to the owner and the chat assistant (2026-10-02).** An agent may mark an
A row done, correct its facts, or flag it wrong — it may **not** add A rows. **Findings an agent raises
are F##**~~ — ⛔ **SUPERSEDED, see the table above.** Kept only for the collision history it records,
which is the reason the sequences are separate at all: Agent-made A rows collided twice (A51/A52; A66/A67 forced the
assistant's A66–A70 to become A68–A70); F1 and F2 were first numbered A66 and A67.

## ⛔ CURRENT STATE is re-derived, never carried forward

Every figure in the WORKLOG's CURRENT STATE is measured when it is written — from git
(`git merge-base --is-ancestor <sha> origin/main`), the live site, a boot log or the database — and the
line says where it came from. This file has been stale eight times, and **five of the 10-01 audit's twelve
findings were stale state** ("local, unpushed" for commits live for days). If you cannot re-measure a
figure, mark it ⚠ with its date rather than restating it.

## ⛔ Line endings: never rewrite a whole tracked source file

**Do not use `sed -i`, a Python whole-file write, or any other tool that rewrites a file end to
end, on `server.js` or `scripts/migrations.js`.** Use a targeted edit that preserves the existing
bytes around the change.

These files are checked out CRLF (`core.autocrlf`), and several tests assert that a migration
block is **byte-identical** between the two of them. A whole-file rewrite silently converts the
file to LF, every one of those tests fails, and **`git diff` shows nothing wrong** because git
normalises line endings on the way in. The failure therefore looks like a logic bug in whatever
you just changed, and points nowhere near the actual cause.

This has now cost three sessions. If a source-string or byte-identity test fails for a reason that
makes no sense, check `file server.js` before you debug anything else — the fix is to convert the
file back to CRLF, not to change the test.

### ⚠ "Don't change the test" is the right rule for ONE of the two cases. Work out which you have.

The rule above is correct **because `server.js` and `scripts/migrations.js` must be byte-identical
to each other.** Byte-level line endings ARE the invariant under test there, so a test that stopped
caring about them would stop testing the thing it exists for. Convert the file.

**But a test can also be line-ending sensitive by accident, and then the test is the defect.** A
markdown parser, a source-string search, a config reader — none of those has any business caring
whether a line ends `\n` or `\r\n`, and one that does will pass on the machine where the file
happens to sit LF and fail on a fresh clone.

That is not hypothetical. `test/manifestMinimumPermission.test.js` located sections with
`startsWith(heading + "\n")`, which is false for `"Permissions\r\n"`. It passed for months and then
four tests went red the moment a branch checkout round-tripped `extension/MANIFEST_RATIONALE.md`
through git — reporting *"MANIFEST_RATIONALE.md has no ## Permissions section"*, which blames the
document. Any fresh Windows clone would have hit it. Fixed by normalising on read, 2026-09-26.

**Ask: is byte-for-byte equality the property being asserted, or is it incidental to how the file
is read?**

| | Fix the FILE | Fix the TEST |
|---|---|---|
| `server.js` ↔ `scripts/migrations.js` byte identity | ⭐ | |
| Source-string assertions that quote real code | ⭐ | |
| Parsing markdown, config or prose for structure | | ⭐ |
| Anything that would fail on a colleague's fresh clone | | ⭐ |

⛔ **The checkout is a way in, not just whole-file writes.** `.gitattributes` declares `* text=auto`,
so this repository stores LF and materialises the platform convention. `git checkout` of another
branch — including the round trip a merge makes — rewrites every file that differs and converts it.
A tree whose *content* is byte-identical to one that just passed can therefore fail, with
`git status` clean. If tests break right after a branch switch and nothing you did explains it,
this is why.

## Deliberate test failures — currently 0

`npm test` is **3851 tests, 3851 pass, 0 fail** — re-measured 2026-10-08 (38n) on local `main` after D80 E, the hiring-heat loop (+3). Before that **3848 / 3848 / 0** after D80, company evidence and the approved-list tranche (+7). Before that **3841 / 3841 / 0** after D78's ceiling removal and the active-only counters (+1; the two ceiling tests became no-ceiling tests). Before that **3840 / 3840 / 0** after D79 S0.2, the spike's capture and replay (+7). Before that **3833 / 3833 / 0** after D78 B, computer science only (+11). Before that **3822 / 3822 / 0** after D78 C, Jobo retired (−22 with the feed: `jobsJoboSync` 19, `joboDedupExpiry` 3; +4 `d78JoboRetired`). Before that **3840 / 3840 / 0** after D78 A, the 120-day age limit (+7). Before that **3833 / 3833 / 0** after D75 STEP 1c (+5). Before that **3828 / 3828 / 0** after the D76 event-name fix (+1). Before that **3827 / 3827 / 0** after D75 STEP 0b (+8). Before that **3819 / 3819 / 0** after D77 (+6). Before that **3813 / 3813 / 0** after D76 (+7). Before that **3806 / 3806 / 0** after D75 STEP 0 (+15; the browser-stage test SKIPS, with its reason, on a machine with no Chrome). Before that **3791 / 3791 / 0** after the D74 classifier fix (+4). Before that **3787 / 3787 / 0** after D72 P0 (+4). Before that **3783 / 3783 / 0** after A95 (+3). Before that **3780 / 3780 / 0** after D71 (+10). Before that **3770 / 3770 / 0** after A94 (+2). ⚠ `a1e0a3f` read 3768 / 3767 / 1 — the brand guard scans TRACKED files only, so a new script's legacy-brand literal only went red once committed; fixed in the next commit. Before that **3768 / 3768 / 0** after A93 (+8) and the fix to A93's manifest wording (`HEAD` `855037c` read **3768 / 3767 / 1**: the D6 guard caught "Auto Apply" in two manifest strings). Before that **3760 tests, 3760 pass, 0 fail** — re-measured 2026-10-07 (38e) on local `main` `f51a351` (+23: D60 +5, D61 +5, D62 +5, D63 +7, D67 (1) +1). ✅ **The two `extensionSubmission` zip checks are green** — cleared by the v1.5.0 release bump + zip rebuild, as they were always meant to be; no assertion was edited. Before that **3737 tests, 3735 pass, 2 fail** — re-measured 2026-10-07 (38c) on local `main` `f1347ce` (+31: D65 +10, D66 +8, D67 +8, D69 +4, D68 +1). Before that **3706 / 3704 / 2** on `21dd8f7` (38b: D59 answers +1, D64 +20). Before that **3685 / 3683 / 2** on `c777768` (38, D59 merged). ⚠ **The 2 are the two `extensionSubmission` zip checks** (`extension/` has moved ahead of the v1.4.1 zip since the 37d lanes); they clear at the release finalisation — ONE version bump + zip rebuild, scheduled LAST, after D64–D68 and D63, which all change `extension/` (WORKLOG NOW). Any OTHER red is a real failure. Before that **3664 / 3662 / 2** on `01d575b` (37d, the six lanes). Before that **3495 tests, 3495 pass, 0 fail** — re-measured 2026-10-07 (37c) on local `main` `0043528` (+4: O80c, packets carry a résumé). Before that **3491** on `b5303a0` (+33: D51 +11, D52 +5, D53 +9, D54 +8). Before that **3458** on `62ee9d1` (+2: the logo Draft button, the unheaded Workstyle cell). Before that **3456** on `63de3ea` (+9: D48's `d48PostingHeader`). Before that **3447** on `b50265a` (+13: D45 +4, D46 +2, D47 +2, D49 +2, D50 +3). Before that **3434** on `37a46ff` (+8: the board-lag fix +4, A91 +3, A92 +1). Before that **3426** on `19f1e0c` (+40: A89/D44.1 +1, D42 +8, D41 +10, D43 +4, D40 +6, D39 +5, D38 +3, D37 +3). Before that **3386** on `main` after A89 (+6: `privacyO72Corrections`). Before that **3380** on `main` `875b43b` (+14: A88). Before that **3366** on `main` `65a9838` (+18: A80 +16, A87 −28 net — 33 retired with the Groq/Gemini stack, +5 — D36 +30). Before that **3348** on `main` `77b1948` (+16: A86 +5, D16/A76 integration net 0 — +37 new, 37 retired with enrich_job — D34/D35 +11 net). Before that **3332** on `main` `0f97ca3` (+41: D32 +11 net, D33 +30). Before that **3291** on `main` `6521afe` (+7: the experience re-tune). Before that **3284** on `main` `8420c48` (+26: D29/A85/D30 +14, D31 +3, A81 +9). Before that **3258** on `main` `8c09802` (+7: D25 — +24 new, 17 removed-UI tests retired). Before that **3251** on `main` `b6072e3` (+83 since 3168: D17's ratchets, D18/D19, D20 slug harvest, D23 companion, D24 filter sentence + facets). Before that **3168** — re-measured 2026-10-03 (23) on `main` `fd32c2b` (+27: D10–D14). Before that **3141** — re-measured 2026-10-03 (22) on `main` `97747f1` (+9: D4's SerpApi locale pin, D5, D6). Before that **3132** — re-measured 2026-10-03 (21) on `main` `568b556` (+40: A71–A77, D1, D2 — search, filters, deck order, logos, bubbles, the weave). Before that **3092** — re-measured 2026-10-03 (20) on `main` `77312df` (+4 F3). Before that **3088** — re-measured 2026-10-03 (19b) on `main` `02bbca0`, after the PDF tools left draft (owner: the tools service's independent product). Before that **3105** on `9bb1d80` (+17, the PDF toolkit while draft carried it). Before that **3088** — re-measured 2026-10-02 (18) on `main` `90f2360`. ⚠ Run it as `npm test`: the script preloads `test-support/isolateTrackingSink.mjs` so tests stop writing fake tracking failures into `data/`, and a bare `node --test` fails `testSinkIsolation` on purpose. Before that **3077** — re-measured 2026-10-02 (17b) on `main` `2217a89` after P1 (+1) and A33 (+4). Before that **3072** on `68beb18` after A59, A63, A61, A62, the A52/A53 follow-ups and A50 steps 4–7. Before that **3025** — re-measured 2026-10-02 (16b) on `main` after merging A58 (+18 `adminStopHarmII`) and A53 (+20 vocabulary and styling). Before that **2987** (session 16) on `main` after merging A49 (+30 dedup), A50 (+11 `adminPanelA50`) and A52 (+10 ATS stored-score / one-report guards). ✅ The two known flakes are fixed at their cause (`888f84c`): `sealedSessionSweep` now awaits sqlite's async close before removing its temp dir, and `accountSecurity` matches `"user":42`, not a bare 42 — the ⚠ notes about both below are history. Before that **2936** after A51 (+7 `adminSafety`). Before that **2929** on `main` after A40's rebuild (+7) and the A44 merge (+8: pipeline health, Ashby dates, migration 115), on top of A46 (+1). Before that **2913** after audit item 7 (the promises ditched: one landing test replaced by two). ⚠ `sealedSessionSweep` can fail with Windows EPERM removing its temp dir (a file lock in cleanup, not an assertion; 6/6 alone). Before that **2912** on `main` at `eea1162` after queues 37–40
(+26 deck: expanded layout, Collapse, deck geometry; +10 `usOnlyBoard`); `queue-37` alone read 2886 / 2886 / 0 on a
fresh CRLF worktree. ⚠ `accountSecurity` "a session is SEALED at rest" fails ~1.7% of runs (random ciphertext can
contain "42") — a flaky test, not rot; fix by matching `"user":42`. Before that 2876 after the top bar
and /features (+5 `featuresPageHonest`). Before that 2871 after queue 31 (+7 `landingFindFitApply`). Before that 2864 after queue 30 (+7 `signupFirstImpression`). Before that 2857 after queues 27–29, the deck's fan and shared-element transitions (+15 `deckFan`, +9 `viewTransitions`). Before that 2833 after the
mark reached the five text-wordmark surfaces (+2). Before that 2831 after G3 (+3 formatter tests),
G6 (+6 ATS category tests), K1 (+10) and R1 (+10). Before that 2802 with account management (+6 account security, +10 account service, +5 account routes, +2 sealed sweep).
Before that 2779 at `c39dff7` (+1 new-account deck pin, +1 account theme). Before that 2777 at
`6788a8e`, the suite run alone (+11 daily deal, +5 deck reducer, +4 deck pins, +1 deck surface
refusal, +3 dark mode; not yet on a fresh CRLF worktree). Before that 2753 at `0d67462`. Before that 2745 at `2356153` (+7 `secretBox` in `ef6071f`). Before that 2738 at `28b8a33` (+26 `boardFitRanking` from the fit-ranking merge). Before that 2712 at `76cc044` (+10 UI step 2 tests: colour-token contrast and the colour-literal
ratchet), and before that 2702 at `3b9dbe9` (+5 `registryPlacement` in `983a0ed`, +6
backup-disk tests in `3b9dbe9`), and before that, 2691 / 2691 / 0 — re-measured 2026-09-28 after A4, which moved the
prompt's tests to resume-master with the prompt (the count FELL by moving them, not by losing them —
the per-test accounting is in A4's commit message). Before that: 2696 / 2696 / 0 after A1 (`3c3fd1d`, which
added the `@draft/ats-scorer` suites) in a fresh `git worktree` (CRLF, `core.autocrlf=true`) with
BOTH root and `client/` dependencies installed — a worktree without `client/node_modules` fails
`syncEventsSingleConnection` on a missing `react`, which is setup, not rot. The existing working
tree read 2694 / 2 at the same commit, both `extensionSubmission` zip checks, caused by uncommitted
icon edits in `extension/icons/`; that is the case described below, not a regression. **Cleared
2026-09-28** by committing those icons and rebuilding the zip as v1.1.1 — 2696 / 2696 / 0 in the
working tree too. Measure both when you re-count:
the existing tree can pass on files that merely happen to sit LF.

⚠ **Until 2026-09-27 a fresh Windows clone was 2671 / 4 fail** while the existing tree read 2675 / 0.
Four source-string tests matched `\n` against files a fresh checkout materialises as `\r\n` —
`ashbySpaFixture` (reads `scripts/fakeAts.js`), `campaignRecord` (`services/applyAutomation.js`),
`manifestMinimumPermission` (`extension/extractor.js`) and `summaryOptIn`
(`scripts/ai1SummaryVerify.mjs`). Fixed per the table above — normalised on read, test side only,
and NOT for the `server.js` ↔ `scripts/migrations.js` byte-identity reads in the same files.
Verified by running the originals on the CRLF tree (4 fail) and the fixes on both trees (0 fail).

**Right now (10-07, 38e) there are none.** The two `extensionSubmission` zip checks went red at the 37d lanes and green at the v1.5.0 bump (38e). Before 37d there were none. From 2026-09-24 to 2026-09-26 there were two, both
in `test/extensionSubmission.test.js`, reporting that `extension/` had moved ahead of the published
`v1.0.0` package after the session-identity fix added `extension/auth.js`. **P4 cleared them on
2026-09-26** by bumping the manifest to v1.1.0 and rebuilding the zip, which is exactly how they
were always meant to go green — no assertion was edited and nothing was silenced.

⛔ **A red test in this repository is now a real failure.** Do not assume any given red is
"the known one".

Full history: `docs/EXTENSION_DIAGNOSIS.md` §6.6. **If you change this count, update it here** —
"deliberate failure" and "rot" are indistinguishable three weeks later, and so are "0 deliberate
failures" and "nobody updated the number".
