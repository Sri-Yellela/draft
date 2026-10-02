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

## The WORKLOG's two queues: O## and A##

Owner rows are **O##**, agent rows **A##**, always written with the letter. O34–O40 and A34–A40 were
different tasks; "34" alone was misread for a whole session (2026-10-01).

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

`npm test` is **2913 tests, 2913 pass, 0 fail** — re-measured 2026-10-01 after audit item 7 (the promises ditched: one landing test replaced by two). ⚠ `sealedSessionSweep` can fail with Windows EPERM removing its temp dir (a file lock in cleanup, not an assertion; 6/6 alone). Before that **2912** on `main` at `eea1162` after queues 37–40
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

**There are no deliberate failures right now.** From 2026-09-24 to 2026-09-26 there were two, both
in `test/extensionSubmission.test.js`, reporting that `extension/` had moved ahead of the published
`v1.0.0` package after the session-identity fix added `extension/auth.js`. **P4 cleared them on
2026-09-26** by bumping the manifest to v1.1.0 and rebuilding the zip, which is exactly how they
were always meant to go green — no assertion was edited and nothing was silenced.

⛔ **A red test in this repository is now a real failure.** Do not assume any given red is
"the known one".

Full history: `docs/EXTENSION_DIAGNOSIS.md` §6.6. **If you change this count, update it here** —
"deliberate failure" and "rot" are indistinguishable three weeks later, and so are "0 deliberate
failures" and "nobody updated the number".
