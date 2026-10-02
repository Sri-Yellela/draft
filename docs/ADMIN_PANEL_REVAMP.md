# Admin Panel Revamp — design

**Design document. Nothing here is built.** ⛔ Do not write any of it into `ARCHITECTURE.md`.

---

## ⛔ Why this needs doing, and the one risk that governs it

The panel was designed when this was a **single-user résumé tool**. It is now a two-sided job
platform with a second stateless service, a published Chrome extension, two mobile clients and a
recruiter side being designed. **It has never been redesigned.**

⚠ **The cost is already measurable.** One of its labels — *"Not linked"* — was read as an ATS
integration status and set off an entire strategy investigation. **An outdated panel does not just
look old; it makes people believe wrong things about their own system.**

### ⛔ But read this before touching anything

**The admin panel is the most load-bearing diagnostic surface in the project.** Almost every
significant defect in this codebase was found through it or something it exposes:

- Pipeline Health surfaced the dead Lever slugs and the three companies that died together at 542h
- The DB inspector answered "is production intact" after a 1,288-row deletion
- The usage ledger recorded enrichment failing for three days while nothing else noticed
- `[boot] registries:` in the deploy log settled whether the scorer's vocabulary reached production

⛔ **Do not break diagnosis while making it prettier.** If a redesign removes a number someone used
to find a bug, the redesign cost more than it gained. **Every surface removed must be justified in
writing, not dropped because it looked untidy.**

---

## 1 · Audit first — what is actually there, and is any of it lying?

⛔ **Inventory before design.** For each panel: what it shows · where the data comes from · when it
was last correct · **who has used it in the last month.**

Known surfaces: Pipeline Health · Schema Explorer · Table Browser · User Pool · Job Review ·
Job Trace · Query Simulator · the usage/spend ledger · enrichment controls · the export controls.

### Three kinds, and they need opposite treatment

| | |
|---|---|
| **Still true and still used** | Keep. Restyle only |
| ⚠ **Still shown but no longer true** | ⛔ The dangerous kind. Fix or remove — a panel that lies is worse than no panel |
| **Vestigial** | Built for the résumé-tool era, nobody opens it. Remove, and say what was removed |

⚠ **Specific things known to be stale or misleading today:**

- **"Not linked"** on the Account page — reads as an integration status (queue 46)
- **Pipeline Health's 48h threshold** — ten warnings, and most companies do not post every two days.
  ⛔ A panel that cries wolf trains you to ignore it, which is how the three real 542h failures sat
  unnoticed (queue 44)
- **`jobo` reporting CRITICAL permanently** — the subscription lapsed deliberately. ⛔ A permanent
  critical is noise. It needs a *retired* state, distinct from *broken*
- **`adzuna` / `serpapi` showing LIVE SEARCH ONLY, 0 active** — accurate but uninformative. After
  queue 45 they become the **discovery engine**, and the panel should show that instead

---

## 2 · What the panel is FOR — three jobs, currently mixed together

Today everything is one undifferentiated pile of tabs. ⭐ **They are three different jobs with three
different users and three different rhythms.**

### A · ⭐ "Is the system healthy right now?" — the daily glance

**The single most valuable thing the panel does.** Should answer in one screen, without clicking:

```
Ingestion    rows written last crawl, per source, and whether that is normal
Enrichment   backlog depth, coverage per column, cost today
Scoring      ⛔ band distribution — but see queue 48, do not display until explained
Apply        runs in flight, held, submitted, failed
Spend        today against the caps, and which call sites
Deploys      ⭐ the commit production is running. /api/version exists; surface it
```

⛔ **Every number states when it was measured.** This project has been wrong about its own state
eight times because a figure was carried forward rather than re-derived.

### B · "What happened to this one thing?" — the investigation

Job Trace and the DB inspector already serve this and ⭐ **they are the best things in the panel.**
Diagnosis is usually *"this specific row/user/run did something odd"*, and a tool that follows one
object end to end is worth more than any dashboard.

**Extend rather than replace:** trace a job from crawl → dedup → enrichment → scoring → draft →
apply, with every decision and its reason on one page.

### C · "Change something" — the operations surface

Enrichment triggers, exports, the retire scripts, company list management.

⛔ **Every destructive action needs a dry run that is the DEFAULT**, and a stated row count before
it runs. The enrichment trigger already works this way and it is the pattern — `cleanup_log` id 85
deleted 1,288 rows, and the brake that now prevents it was committed, documented, and **not
deployed for a day.**

---

## 3 · ⭐ What is missing entirely

The product grew; the panel did not. **None of these have any admin surface at all:**

| | |
|---|---|
| **The extension** | Published, under review. ⛔ No install count, no capture volume, no handoff success rate, no error visibility |
| **Resume Master** | A whole second service. ⛔ No health, no per-client usage, no token status |
| **The mobile clients** | Two repos, a versioned contract. No visibility |
| **The recruiter side** | Being designed with nothing to administer it |
| ⭐ **Company list management** | The single biggest lever on the product (`COMPANY_LIST_STRATEGY.md`) and it is **config files, not a surface.** Adding, validating and retiring companies should be a panel |
| ⭐ **Dedup** | Queue 49. No way to see duplicate groups or why rows merged |
| **Outcome data** | `job_applications` is the validation story for the whole model and has no view |

⭐ **Company list management is the one I would build first.** It is the product's growth lever and
it is currently invisible.

---

## 4 · Design

⛔ **The palette, tokens and contrast work are done** — cream paper, dark ink, orange as fill only
(2.96:1 on cream, so text uses `#A33200`). The panel still carries the old visual language. **Use
the existing tokens; do not introduce a colour outside the token file** — the guard fails on it.

**It is a tool, not a product surface.** Density over elegance. Tables over cards. Numbers over
charts. ⚠ **The deck's design language belongs on the board, not here** — an admin panel optimised
for delight is an admin panel you cannot read quickly at 2am.

⭐ **Reuse `PanelControls` and the portalled listbox.** They exist, they are tested, and the Database
panel already uses them — which is the only proof an extraction is not a clone.

---

## 5 · Order

```
1  ⛔ AUDIT. Inventory every panel, classify into the three kinds, and name every number that is
   no longer true. Do not design before this.
2  Fix the LYING surfaces — "Not linked", the 48h threshold, jobo's permanent CRITICAL, the
   adzuna/serpapi framing. ⭐ Cheapest, highest value, and it stops the panel misleading people.
3  THE DAILY GLANCE (§2A). One screen, every number stating when it was measured.
4  ⭐ COMPANY LIST MANAGEMENT (§3). The growth lever, currently invisible.
5  Extend the trace (§2B).
6  Restyle to the current tokens.
7  The newer surfaces — extension, Resume Master, dedup, outcomes — as those features settle.
```

⚠ **Sequence 2 before everything else.** A panel that tells you wrong things is actively harmful,
and the evidence that it already has is in this document's opening paragraph.
