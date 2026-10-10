# Bring-your-own-model beyond résumés — what fits, where, and what it costs

**Written 2026-10-09 · companion to `CLAUDE_CONNECTOR_COMPLIANCE.md` · D86 / D88.**
Same rules as the compliance document apply to anything in the **public** connector (DR-1 to DR-14). This document decides **what goes where.**

---

## 1 · The organising principle: two connectors, two trust levels

| | **Public connector `draft`** | **Private connector `draft-admin`** |
|---|---|---|
| **Who** | job applicants, each on their own Claude plan | **the owner only** (later: a support role) |
| **Data** | the signed-in user's **own** data | the **board's** data and **internal** state |
| **Listed in the directory?** | **yes** — reviewed, policy-bound | **never** — a private custom connector on the owner's own account |
| **Auth** | OAuth, scopes `resume:read` / `resume:write` … | **separate OAuth audience**, scope `admin:*`, **admin role required at consent** |
| **Policy burden** | the full Directory Policy and the Usage Policy | the Usage Policy and the Anthropic terms for the account used |

⛔ **Never mix them.** *An admin tool inside the public connector would be visible to reviewers and users, and role-gating a tool that is listed is not the same as not shipping it.* **Different URL path, different token audience, different consent screen.**
**Everything else stays out of both:** apply and auto-apply, portal sessions (D79), the crawler (D75), billing.

---

## 2 · Candidate by candidate

### A · Résumé tailoring — **public, v1** *(the compliance document)*

### B · Cover letters — **public, v2 (same connector, a second Skill)**
**Fit: strong.** The same mechanics as résumés, the same user pays for the model, and cover letters are a natural next ask in the same conversation.
- **Tools:** `draft_get_cover_letter_brief(job_id)` — **data only:** job basics, the company name, the top bullets of the user's tailored résumé, their claims; **no contact details**. `draft_submit_cover_letter(brief_id, paragraphs[])` — **a write:** appends a version.
- **The guard (deterministic):** every employer, title, date, skill and number must exist in the base résumé or claims · **no salary figure, no visa or eligibility statement** · **no template placeholders** (`[Company]`) · a length cap (~350 words) · **no contact details in the body** (the server writes the header).
- **A second Skill** `write-cover-letter` holds the style guidance (static). **DR-1 holds.**
- **Policy notes:** DR-5 (fabrication) and DR-13 (the AI-assistance notice) matter *more* here — **cover letters are where an employer is most likely to object to AI.**
- **Entitlement (D88):** `byo_cover_letter`.
- **Effort:** small once résumés exist (the same brief/submit/guard shape).

### C · Job search and fit explanation — **public, v1 (read-only)**
**Fit: strongest value, lowest risk.** *"Find CS roles in Boston posted this week that match my résumé"* is what chat is good at.
- **Tools:** `draft_search_jobs`, `draft_get_job`, `draft_score_resume_for_job` — **already in Appendix A.**
- **Care:** **DR-10** (job text is untrusted — return structured fields and a short summary, not the prose) · **DR-6** (frugal) · **DR-14** (show what a posting *states* about visas; never conclude about the user).
- **It is a recommendation to a person about jobs**, not a decision about a person — **outside** the High-risk *Employment* area (DR-9).

### D · ATS gap analysis — **public, v1 (read-only)**
`draft_score_resume_for_job` already returns matched and missing terms. **Deterministic, cheap, and it lets the user's Claude explain the gap in plain language.** No new tool.

### E · Application tracking — **public, v2**
- `draft_list_my_applications` (read) and `draft_record_application` (write: *the user reports that they applied*).
- ⛔ **It records what the user did; it does not apply.** The description says exactly that (**DR-2**), and **no tool contacts an employer (DR-8).**
- **Entitlement:** `byo_tracking`. **Effort:** small.

### F · Open-ended screening answers — **public, v3, after the cover-letter pilot**
*"Why do you want to work here?"* is the same shape as a cover-letter paragraph.
- ⚠ **This reverses a standing decision (D55: AI-generated answers held off).** The new fact is that **the model is the user's own and the user reviews every answer in the chat** — but the failure mode is still *a wrong answer pasted into a real application.*
- **If built:** brief/submit with the **same guard** · **eligibility questions are NEVER drafted** (work authorisation, sponsorship, clearance, EEO — exact-or-blank, D36) · saved answers are **stored as drafts and marked "unreviewed"**; the extension **fills one only after the user approves it in draft.**
- **Decision needed**; do not build before the owner reverses D55 explicitly.

### G · Enrichment — **private admin connector** ⭐
**This is the highest-leverage use for the owner personally.** It removes the manual download / paste / upload loop.
- **Tools (all in `draft-admin`):**
  - `admin_get_enrichment_piece(batch, n)` — **read-only:** one piece of cleaned posting text with its ids.
  - `admin_stage_enrichment_reply(batch, n, rows[], notes[])` — **stages** the reply: **runs the importer's own rules** (the shared module from D84 — *one source of rules*), returns **per-row problems**, and records the notes (the `#NOTE` codes become a structured `notes` field).
  - `admin_get_enrichment_status(batch)` — read-only: pieces staged, problems, the notes tally.
- ⛔ **The connector cannot APPLY.** *Dry run and Apply stay in the Admin page, behind the owner's click.* The connector writes only to the **staging** area.
- **Controls:** a separate token audience and scope · admin role at consent · a kill switch `ADMIN_MCP_ENABLED` (off by default) · an audit row per call (ids only) · rate limits · **no secrets in any result.**
- **Who does the work:** the owner's own Claude — **a Project or a personal Skill** holds the enrichment instructions (no directory constraints on a private connector).
- **The honest cost.** One piece of 20 postings is roughly 25–40k tokens. **~2,850 postings ≈ 140 pieces ≈ 4M tokens.** On a Pro plan's rolling limits that is **weeks of steady use**, not an afternoon. **Compare the owner-run Batch-API script (D84): about $2 on a small model or about $11 on a Sonnet-class one, and it finishes in hours.**
  → **Use the connector for the *tail* — exceptions, re-runs, the notes review — and for the first batches that build the labelled set (F9).** For the bulk, **the deterministic extractor (F9) and, if wanted, the Batch-API script are cheaper.**
- ⚠ **Do not loop it with a script on a consumer subscription** (`claude -p` in a loop) **until Anthropic's terms are checked** — the Usage Policy prohibits *"services that route requests through consumer subscriptions"*; **personal, attended use is the intent**, but **verify before automating.**

### H · Support-ticket drafting — **private admin connector, only after D88 tickets exist**
- `admin_list_tickets`, `admin_get_ticket` (read) and `admin_stage_reply` (**stages a draft; never sends**). **The owner reads, edits and sends from the Admin page.**
- ⚠ **Ticket text is a user's personal data, and it would pass to Anthropic under the owner's account.** **The privacy policy must say so** (*"support messages may be processed by AI providers acting for us"*), and **eligibility fields are never shown in tickets** (D88). **Hold until that sentence is live.**

### I · Candidate review assistant — **private admin connector, optional**
`admin_list_candidates`, `admin_get_candidate_evidence` (read-only) so the owner can ask *"which of this week's candidates look weakest, and why?"* **Public data, low risk, small.** Approval still happens in Admin.

### J · Considered and rejected
| Idea | Why not |
|---|---|
| **Apply / auto-apply through a connector** | DR-8; it circumvents other platforms' terms; the apply worker (D79) is a different trust zone |
| **Portal sessions through a connector** | secrets must never pass through a chat |
| **Interview prep, salary negotiation, company research** | generic — the user's own Claude does it without our data; no value added, only policy exposure |
| **Scheduled digests and alerts** | connectors are *pull*; email (D73) is the right channel |
| **Employer-side screening or ranking people** | the Usage Policy's High-risk *Employment* area; out of scope for the product |

---

## 3 · Placement summary

| Feature | Public `draft` | Private `draft-admin` | Phase | Entitlement (D88) |
|---|:-:|:-:|:-:|---|
| Résumé tailoring | ✅ | | **v1** | `byo_resume` |
| Job search, fit, ATS gap | ✅ read-only | | **v1** | *(none — read-only)* |
| Cover letters | ✅ | | v2 | `byo_cover_letter` |
| Application tracking | ✅ | | v2 | `byo_tracking` |
| Screening answers | ✅ (if D55 is reversed) | | v3 | `byo_answers` |
| **Enrichment** | | ✅ | **after D84 is proven** | `admin:enrichment` |
| Ticket drafting | | ✅ | after D88 + privacy sentence | `admin:support` |
| Candidate review | | ✅ | optional | `admin:candidates` |

**Tool count.** The public connector stays **≲ 12 tools** — every tool description costs the user context on every turn, and a larger surface draws more reviewer scrutiny. **Ship v1 with six** (Appendix A of the compliance document).
**Reviewer note.** `tools/list` may vary by entitlement for ordinary users, but **the reviewer account must have every tool enabled** so the review sees the whole surface.

---

## 4 · Cross-cutting compliance notes
- **The same guard, one implementation:** a shared `claimGuard` used by the web generation path, the résumé patch and the cover-letter patch. *Three call sites, one set of tests.*
- **One shared importer module** for the web page, the CLI and `draft-admin` (D84's rule).
- **No new data leaves draft** for cover letters beyond what résumés already send — **minimise further:** the cover-letter brief omits the full résumé and sends only the highlights.
- **Retention:** cover letters, tracked applications and tickets each need **a retention period in the privacy policy** (D88's list).
- **Per-feature switches:** each feature is off by default and visible in **Settings → Connected apps**; each can be disabled per user by an admin (D88's resolver) and **globally by a kill switch.**
- **Quotas:** the user's Claude plan limits all of it — **say so in the docs**, and offer **"Write it with draft"** as the fallback where the web feature exists.

## 5 · Suggested order
1. **v1 public:** résumé + read-only tools → **G0–G7** of the compliance plan. *Submit this.*
2. **In parallel, private:** `draft-admin` enrichment tools (**no review needed**, owner-only) — **after D84's first real batches** show the loop is worth wiring.
3. **v2 public:** cover letters + tracking, as **an update to the live connector** (*deploy the tools; edit the listing's tool names; a reviewer approves the listing edit*).
4. **Later:** ticket drafting (after the privacy sentence), screening answers (only if D55 is reversed).

## 6 · Decisions for the owner
1. **Confirm the two-connector split** (public applicants / private admin).
2. **Reverse D55 or keep it** (screening answers) — *recommendation: keep it for now.*
3. **Enrichment: connector, Batch-API script, or the deterministic extractor first?** *Recommendation: the extractor (F9) for the bulk, the connector for exceptions.*
4. **Ticket drafting:** acceptable to process support messages through an AI provider under your own account, with the policy sentence?
5. **Which Claude plan** will the owner use for the admin connector (Pro is enough to start; heavy batches may justify Max).
