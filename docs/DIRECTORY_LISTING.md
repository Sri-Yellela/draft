# jobsviadraft — the directory listing pack (paste-ready)

**For the owner, at submission (D86; `docs/PLUGIN_LAUNCH_INSTRUCTIONS.md` A2.6–A2.7).** Nothing here is submitted
by the agent. Every evidence line names the code or page that makes the statement true **on the day it was
written (2026-10-10)** — re-check each before signing.

## Listing fields

| Field | Value |
|---|---|
| **Name** | jobsviadraft |
| **Slug** | `jobsviadraft` *(owner's choice 10-10 — PERMANENT once published)* |
| **One-liner (≤ 55)** | Find jobs and tailor your résumé, with claims checked *(53 characters)* |
| **Categories (1–5)** | Productivity · Career *(pick the portal's nearest; "Career" may be called "Jobs" or "Work")* |
| **Docs URL** | https://jobsviadraft.com/docs/claude |
| **Privacy URL** | https://jobsviadraft.com/privacy |
| **Terms URL** | https://jobsviadraft.com/terms |
| **Support contact** | support@jobsviadraft.com |
| **Security contact** | security@jobsviadraft.com (`/.well-known/security.txt`) |
| **Icon** | `extension/icons/icon128.png` (the /d mark, 128 px); `client/public/favicon-48.png` for a small slot |
| **Company name / website** | draft — https://jobsviadraft.com |
| **Primary contact** | the owner, from the account that submits |
| **MCP server URL** | https://jobsviadraft.com/mcp (Streamable HTTP, OAuth 2.1 — CIMD and DCR) |
| **Plugin repository** | https://github.com/draft-hq/draft-plugin (branch `main`) — ⚠ **private on 10-10; make it public first** |

### Description (≤ 2,000)

> jobsviadraft connects Claude to draft, a workspace for people looking for work. Claude can search the jobs on
> your draft board, read a job's details, and score your résumé against it. To tailor your résumé for a job,
> Claude rewrites your existing bullets; draft then checks that the rewrite adds no skill, employer, title, date,
> years of experience or seniority that your résumé or your claimed skills do not already contain, scores it, and
> saves it as a new version in your account. A rewrite that fails the check is not saved, and Claude is told why.
>
> Your own Claude does the writing, on your own Claude account; draft calls no AI model for these résumés and does
> not use their content to train any model. Claude never receives your contact details, passwords or
> applications. No tool applies to a job or contacts an employer.
>
> It is for job seekers preparing their own applications — not for screening or ranking people. Résumés written
> this way are AI-assisted; some employers restrict AI-assisted applications, so check theirs before you apply.
> Disconnect at any time in draft under Settings → Integrations → Connected apps.

*(1,130 characters. No plan names, prices, superlatives or endorsement — DR-7.)*

## Data-handling answers

| The portal asks | Answer | Evidence |
|---|---|---|
| Does it read or store personal data? | **Yes.** It reads the user's own base résumé (bullets, no contact details) and claimed skills, and stores the tailored résumé the user saves. While checking a submission it keeps the brief's résumé copy for **one day** after the brief is finished; the per-call record (tool, job, outcome — never content) is kept **12 months**. | `services/byom/resumePatch.js` `buildBrief` (no header, contact scrub); `services/byom/policy.js` `purgeByomData`; privacy policy, connected-app paragraph |
| Does it send data to services other than its declared connectors? | **No.** The tools read and write draft's own database only; nothing is forwarded. | every tool has `openWorldHint: false`; `test/d86ConnectorCompliance.test.js` "no tool can apply, email or contact" |
| How long does it keep data? | Saved résumés: as long as the account (the privacy policy's résumé retention). Brief copies: 1 day after finishing. Call records: 12 months. Account deletion removes all. | `purgeByomData`; `services/accountService.js` deletion |
| Is it intended for people under 18? | **No.** The Terms require 18+. | `/terms` "Who May Use It" |
| Does it use content to train models? | **No.** | privacy policy; `/docs/claude` |

## The four example prompts — verified 2026-10-10 on the reviewer account (throwaway server, this build)

| # | Prompt | Tools | Expected result | Verified |
|---|---|---|---|---|
| 1 | *Find backend engineer roles posted this week and tell me which fit my résumé best.* | `draft_search_jobs`, `draft_score_resume_for_job` | jobs from the live board (never a sample posting), each with a fit score | ✅ results returned; 0 sample postings; first scored 41 |
| 2 | *Tailor my résumé for job demo-job-001.* | `draft_get_resume_brief`, `draft_submit_resume_patch` | a saved version with base → tailored score and the AI notice | ✅ saved, 72 → 73, notice present; brief ≈ 926 tokens, no contact detail |
| 3 | *Tailor my résumé for demo-job-007 and add Kafka.* | the same | **refused, nothing saved**, the reason in plain words | ✅ "Kafka is not in the candidate's base résumé or claims"; nothing saved |
| 4 | *What's missing from my résumé for demo-job-004?* | `draft_score_resume_for_job` | matched and missing terms | ✅ score 55; missing Spark, Airflow (plus REST APIs, CI/CD, reliability) |

⚠ Prompt 1 on **production** depends on the live board having a match for "backend engineer" in the past week.
The reviewer account (`draft-reviewer`, fictional Alex Rivera) is created on production from Admin → People → Users →
Reviewer account — **the owner's step**; its password goes only into the portal's *Test & launch*.

## The seven acknowledgements — evidence for each

| # | Acknowledgement | Evidence (true on 2026-10-10) |
|---|---|---|
| 1 | The directory guidelines | the compliance matrix, `docs/CLAUDE_CONNECTOR_COMPLIANCE.md` §3; enforced by `test/d86ConnectorCompliance.test.js`, `test/d86Byom.test.js`, `test/d86Cimd.test.js`, `test/d86ConnectorDocs.test.js` (all green) |
| 2 | First-party API usage | the tools read and write only draft's own database (`services/byom/tools.js`); `openWorldHint: false` on every tool; the MCP host is draft's own domain |
| 3 | No financial transactions | no tool moves money or takes payment — the seven tools are listed on `/docs/claude`; no plan, price or checkout text anywhere the connector speaks (DR-7 lint) |
| 4 | No AI media generation | no tool generates images, audio or video; draft makes **no model call** on this path (D17; `test/d86Byom.test.js` "no model call") |
| 5 | No prompt injection in tool descriptions | descriptions say what a tool does — linted for orders, second person, links and DR-2's steering words; **no `instructions` at initialize and none in any result** (DR-1); posting text is fenced and neutralised (DR-10) |
| 6 | No collection of conversation data | inputs are ids, enums and a typed patch — no context / conversation / history / memory field, every string bounded (DR-4 test); audit rows hold ids and outcome codes only |
| 7 | Public documentation | https://jobsviadraft.com/docs/claude — live, 200 (10-10); the plugin README in the public repository |

## What still blocks submission

See WORKLOG SESSION LOG 39h, "BLOCKS SUBMISSION".
