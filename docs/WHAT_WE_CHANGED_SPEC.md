# D90 — "What we changed": the base résumé against the tailored one

**Owner, 10-09:** *"A 'what we changed' view comparing the base résumé to the tailored version — the only idea worth having from the other Draft — and we already have the foundation in ATS history and the résumés generated; we just need to use them the right way."*
**One-sentence purpose (the panel's own line):** *"Every change we made to your résumé for this job — and why."*

---

## 1 · Why it earns its place
- **Trust.** The product's promise is *no invented experience* (the claim guard). This view **shows** the promise: every change next to its source.
- **It is the review step.** D36 / AF5: *every document is read before it is sent.* This is how a person reads a tailored résumé quickly — only the changes, not the whole page.
- **Accountability after apply.** The Table can show **exactly what went to the employer** against the base — immutable.
- **It costs no model call (D17) and no new data** — it is a comparison of two things already stored.

---

## 2 · What it shows (read-only in v1)

**Numbers on open (no click):**
`ATS 62 → 78 (+16)` · `9 bullets rewritten` · `2 added` · `1 removed` · `14 unchanged` · `6 terms gained` · `2 requirements still missing`.

**The body — by section, changes first, unchanged collapsed:**
- **Summary** — before / after.
- **Experience** — per role (employer · title · dates **always unchanged** — the guard forbids edits to them): each bullet as **Rewritten** (before → after, with the changed words marked), **Added**, **Removed**, or **Unchanged** *(collapsed: "14 unchanged")*.
- **Skills** — added · removed · reordered.
- **Education, certifications** — shown only if they differ (they should not).

**Each change says why, in plain words:**
- **Terms gained** — the posting's terms this edit brought in (*"now mentions Kafka"*), each with its source: **"from your résumé"**, **"from your claims"**.
- ⛔ **A change with no source is marked "Not traced to your résumé or claims"** — it should never occur (the guard refuses it), **but if it does, it is the most visible thing on the screen**, and it is counted.

**ATS history strip:** the score at each version — **Base → Tailored v1 → v2 …** — with the date, and **which terms moved at each step** (from the stored ATS reports). *The strip is the "history"; the body is the "diff".*

**One main action** (v1): **Copy the changes as text.** *(Per-bullet revert is a later phase — it writes a new version and re-scores.)*

---

## 3 · Where it appears
1. **The posting panel — beside the ATS card:** a *What we changed* link opens it (a drawer, not a new page).
2. **Draft House, the review step before Approve & send:** a one-line summary — *"9 bullets rewritten · ATS +16 · 2 requirements still missing — What we changed ↗"* — so a person reads the **changes** before they approve.
3. **The Table, an applied record:** **"What we sent"** — the **snapshot taken at apply** against the base, **immutable**, with the ATS score at apply (`ats_score_at_apply`, D43).
4. **The plugin (later, after v1):** a read-only tool `draft_get_resume_changes(job_id)` returning the same data, so the user's Claude can explain it in chat. *(Descriptions stay what-it-does only — DR-2.)*

---

## 4 · How it is built — deterministic, from what exists

**⛔ P0 first — an inventory, read-only, reported before any code:**
1. **Where the base résumé lives** and its structure (sections, roles, bullets; **are bullets identified?**).
2. **Where each tailored résumé lives** (per job; D57 / D58), and whether it carries **source ids / provenance** back to base bullets and claims.
3. **The ATS history:** the stored reports (per profile, job and résumé hash), their matched / missing terms, and **how a report is tied to a résumé version.**
4. **The apply snapshot** (`application_snapshots`, D43): what it holds, whether it is the *résumé as sent*.
5. **The plugin path's patch** (D86): it is keyed by bullet id — the easiest case.
Report which of §4's inputs **already exist** and which, if any, must be **added**.

**The comparison (P1) — one pure function, no I/O, no model:**
- **Align roles** by employer + title + dates (the guard keeps them unchanged).
- **Align bullets within a role:**
  1. **by id** when both sides carry one (the plugin's patch; any generation that records its source);
  2. else **by similarity** — token overlap (Jaccard) with a threshold, **greedy best-match, deterministic tie-break by position**;
  3. unmatched tailored bullets = **Added**; unmatched base bullets = **Removed**.
- **Word-level diff** inside a rewritten bullet (longest common subsequence).
- **Terms gained** = posting terms present in the tailored side and absent from the base (the existing scorer's term list); **source** = the first of *base résumé / claims* that contains the term; **none = untraced.**
- **ATS strip** = the stored reports in time order; **never recomputed on read** (it would drift).
- **Output shape (additive; the mobile contract bumps additively):** `scores[]`, `summary{…counts, termsGained[], requirementsMissing[]}`, `sections[]` with `status`, `before`, `after`, `wordDiff`, `termsGained`, `provenance`.
- **Endpoints:** `GET /api/jobs/:id/resume-changes` (the current tailored vs base) and `GET /api/applications/:id/resume-sent` (the snapshot vs base). **Authenticated; the user's own data only.**

---

## 5 · UI — D83's six rules, D60, both themes
Purpose sentence · **numbers on open** · one main action (*Copy the changes*) · plain words · **no pills** (changed-word marks and status marks use the rectangular mark style) · the diff must be readable at phone width (a stacked before / after, not side by side) · keyboard-operable · **"Not traced" is the loudest element when present.**
⛔ **Sketch first.** The owner approves a sketch (`what-we-changed.html`, both themes, desktop and phone, all states: *no tailored version yet · identical · many changes · an untraced change · an applied record*) **before the UI is built.**

---

## 6 · Phases — each reported before the next
**P0** inventory → **P1** the comparison + the two endpoints + the additive contract bump → **the owner approves the sketch** → **P2** the posting-panel drawer → **P3** the Draft House review line and The Table's *What we sent* → **P4** the plugin tool *(after the plugin's v1 ships)* → **P5 (later, owner's call)** per-bullet revert.

---

## 7 · Tests — each red when its rule is removed
- **Identical pair → zero changes** ("nothing was changed for this job").
- **Id-keyed patch:** each rewritten bullet maps to its source; one added, one removed.
- **No ids:** a lightly reworded bullet **aligns to its original**, not to a different bullet; a genuinely new bullet is **Added**.
- **Word diff** marks exactly the changed words.
- **Terms gained** lists only terms **absent** from the base and **present** in the tailored side, **each with its source**; an invented term is **"Not traced"** and **counted**.
- **Roles never change:** employer, title and dates identical on both sides (a violation is shown, not hidden).
- **The ATS strip** reads stored reports **in order** and **never recomputes**; a stale report is shown as stale.
- **"What we sent"** is the **snapshot at apply** and **does not change** when the tailored résumé is later regenerated.
- **No model call**; **no résumé text in any log**; **no eligibility or EEO field appears anywhere in the response.**
- **Authorisation:** another user's job or application returns **404**.
- **Contract:** additive only; the mobile client's existing parse is unaffected.
- **Performance:** a typical résumé compares in well under 100 ms.
- Both themes; phone width; no capsule shapes.

---

## 8 · Not in this row
Per-bullet revert (P5) · side-by-side whole-document view · an "AI explain this change" button (D17 — the plugin's Claude can explain it) · scoring changes · any new stored data beyond what P0 finds missing.

## 9 · The owner decides
- **Where it ships first** — recommendation: **the posting panel, then Draft House's review line.**
- **Whether unchanged bullets are collapsed by default** — recommendation: **yes.**
- **Per-bullet revert (P5)** — later, once the view has been used.
- **The sketch** — approve before P2.
