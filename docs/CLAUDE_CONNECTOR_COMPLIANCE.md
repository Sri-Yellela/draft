# draft on Claude — compliance underwriting and end-to-end plan

**Written 2026-10-09 · D86 · for the owner, the agent and counsel.**
**Status:** design. Nothing here is built. Where this document and the older D86 text disagree, **this one wins** (§2 lists what changed).

---

## 0 · Verdict, scope and what was read

**Verdict.** A bring-your-own-model résumé tool on Claude is **feasible and compliant — provided five design changes are made** (§2: DR-1 to DR-5).
The change that matters most: **a server may not make Claude pull behavioural instructions from an external source at runtime** (Directory Policy §2F).
D86's original `get_generation_brief` returned "our instructions" on every call. **That would be rejected.** The instructions move into a **Skill** inside a **plugin**; the brief tool returns **data only**.

**What was read in full:** the *Anthropic Software Directory Policy* (dated 2026-04-15), the *Software Directory Terms*, the *Connector pre-submission checklist (review criteria)*, the *Submit a connector* page and its ten portal steps, the *Usage Policy* (version "effective November 12, 2026").
**Read in excerpt only:** the authentication page, the plugin pre-submission checklist, *Manage your listing after publishing*, *Who can submit*, the verification page.
**Not read — Phase 0 reads them:** the full plugin checklist, the Verification page, MCP Apps, Anthropic's trademark guidelines, the Consumer Terms, the supported-countries page.
⚠ **Policies change.** The Directory Policy and the Usage Policy are both versioned; **snapshot each into `docs/policy-snapshots/` and diff them before submission and every quarter.**

**Who can submit.** *Any paid Claude plan* — **Pro or Max submit from their own account; Team / Enterprise: an Owner submits; Free cannot.** No listing fee; "directory inclusion is free, not pay-to-play"; no agreement to negotiate.
⛔ **The owner's Enterprise Claude is not the account to use** (§8, decision D1).

---

## 1 · What we submit

| Part | What it is | Why |
|---|---|---|
| **A · The connector** | one remote MCP server, Streamable HTTP, at a public HTTPS URL on `jobsviadraft.com`, OAuth 2.0 | tools and data; also gives the owner the server dashboard |
| **B · The plugin** | a *separate, public* GitHub repo holding `.claude-plugin/plugin.json`, `.mcp.json` (the **same** URL), `skills/<name>/SKILL.md`, `README.md`, a licence | **the Skill is where the instructions live** — static, human-readable, reviewed |
| **C · Submit both** | the portal says to *"submit the server anyway"* if a plugin points at it | the connector listing carries the server's details, authentication and dashboard |

⛔ **The plugin repo is NOT the draft repo.** `draft` is private and holds everything. **Create `draft-claude-plugin` (public), containing only the manifest, the Skill text, the README and the licence.** *The directory pulls from GitHub, and "review the plugin's source before installing" is the stated user norm.*
⚠ **Ownership is sticky.** *"The first organization to submit the repository folder holds it"* and *"handing over a repository later is not handing over the listing."* **Decide which Claude account owns it before the first submission.**
⚠ **The listing slug is permanent once published.** Choose it deliberately (e.g. `draft-resume`).

---

## 2 · Design rules forced by the policy (supersede D86's earlier text)

| # | Rule | Because | Build as |
|---|---|---|---|
| **DR-1** | **No dynamic instructions.** Tool results contain **data, never behavioural guidance.** | Policy **§2F** (*must not direct Claude to dynamically pull behavioural instructions from external sources*), **§2G** (no hidden or encoded instructions); review criteria: *"Describe what the tool does, and don't tell Claude how to behave."* | `draft_get_resume_brief` returns **structured data only**. **All "how to write" guidance is in `skills/tailor-resume/SKILL.md` — static, in the public repo, human-readable.** The old "domain module chosen per job" prompts are **dropped**: a per-job instruction is dynamic. Send `job_family: "backend"` as *data*; the Skill carries the static rules. |
| **DR-2** | **Tool descriptions state what a tool does — nothing else.** No imperatives to Claude, no promotion, no links except draft's own. | **§2A–2E**, review criteria (rejected: steering, interfering with other tools, promoting products) | A **lint test** (§7, G3) fails the build on *must · always · never · ignore · instead · you should*, on any URL not on `jobsviadraft.com`, and on any plan or price word. |
| **DR-3** | **Read and write are separate tools; every tool has `title` + `readOnlyHint` / `destructiveHint`; names ≤ 64 characters; no catch-all tool.** | **§5C, §5E**; review criteria | The catalogue in Appendix A. **A brief is a *stateless signed token*** (HMAC of user + job + base-résumé version + expiry), so the brief tool is genuinely read-only; **`submit` is the write**, and it **appends a new version** (non-destructive) rather than overwriting. |
| **DR-4** | **Collect only what a tool needs. Never conversation data, memory or chat history. Never log content.** | **§1D, §1F**; review criteria | Tool inputs are **typed, narrow fields** (a job id, a patch of `{bullet_id, text}`) — **no free-text "context", "conversation", "summary" or "history" parameter anywhere.** **Audit rows hold ids, tool, outcome and timing — never résumé text.** A test greps the logger for content fields. |
| **DR-5** | **Never fabricate credentials.** The **claim guard stays mandatory and server-side.** | Usage Policy: *"falsified documents including … employment records, or misrepresent professional credentials"* | `submit` refuses any term not in the base résumé or the user's claims, and any changed title, employer or date — **with a plain reason Claude can relay.** Tool description and Skill both say so. **Test: a refused submission stores nothing.** |
| DR-6 | **Frugal tokens.** | **§5B** | Briefs are compact (**≤ ~2,500 tokens, asserted in a test**); a `detail: "short" \| "full"` parameter; **no full posting text** in any default response. |
| DR-7 | **No advertising or promotion — in results, descriptions, errors or the listing.** | **§4C** (*serves advertisements, sponsored content … or exists primarily as a promotional vehicle*) | No plan names, prices, "upgrade" or "premium" anywhere the connector speaks. A cap reads *"Daily limit reached. It resets at 00:00 UTC."* |
| DR-8 | **First-party only.** The connector calls **only draft's own APIs.** | Review criteria *API ownership*; policy **§3F** | **No tool ever contacts an employer, an ATS, LinkedIn or any third party — so no apply, no auto-apply, no portal tool.** *(Also keeps us clear of "circumvent the guardrails or terms of other platforms".)* |
| DR-9 | **Applicant-side only; operate on the signed-in user's own data.** | Usage Policy *High-risk Employment* (*screening, ranking, advancing or rejecting candidates*) | **No tool accepts another person's résumé or returns a ranking of people.** Docs state the intended purpose. *If employer-side features are ever built, the High-risk requirements apply (a qualified human in the loop; AI-use disclosure).* |
| DR-10 | **Untrusted text is data.** Job postings can contain prompt injection. | Review criteria *prompt injection*; common attack | **Return structured fields and a ≤ 600-character summary, not the posting's prose, by default.** Where prose is returned, it is length-capped, fenced as data, and instruction-like phrases are neutralised. |
| DR-11 | **Never proxy Claude; never train on outputs.** | Usage Policy *Platform abuse* (*resell, proxy … route requests through consumer subscriptions*; *use outputs to train an AI model*) | draft **never calls Anthropic with a user's token**, and **never uses connector content to train or fine-tune** (D17 already forbids models). **The privacy policy says both.** |
| DR-12 | **Errors are specific and actionable.** | **§5A**, review criteria | A catalogue of typed errors with a reason and a next step; **never "Internal Server Error".** |
| DR-13 | **An AI-assistance notice.** | Usage Policy (*submit AI-assisted work without proper permission or attribution*) is ambiguous for applications; **many employers restrict AI-written applications** | The consent screen, the docs page and the Skill's closing message say: *"Some employers restrict AI-assisted applications — check theirs before you apply."* ⚠ **Counsel (§9, Q1).** |
| DR-14 | **No eligibility or legal advice.** | Usage Policy *High-risk — Legal* (*advising an individual on their legal rights or obligations*) | The connector **never states a visa, citizenship or work-authorisation conclusion.** It may show *what a posting states*; **the Skill forbids asserting the user's eligibility.** |

---

## 3 · Compliance matrix — Software Directory Policy (2026-04-15)

| § | Requirement (summary) | How draft complies | Evidence | Owner action | Residual |
|---|---|---|---|---|---|
| 1A | No violation of the Usage Policy; Universal Standards; High-risk requirements; supported regions | §4 below; DR-5, DR-9, DR-14 | policy lint; counsel sign-off | counsel | **M** |
| 1B | Do not evade guardrails | the Skill contains no circumvention; DR-1 | Skill review | — | L |
| 1C | Protect privacy of users and third parties | DR-4; no contact details in briefs; posting text is public data | privacy review; "no contact detail" test | privacy policy row | L |
| 1D | Collect only necessary data; **no extraneous conversation data, even for logging** | **DR-4** | typed inputs; logger test | — | **M** |
| 1E | No IP infringement | draft's own code and data; plugin licence stated | licence file | choose a licence | L |
| 1F | **No querying Claude's memory, chat history, summaries or uploaded files** | **DR-4** — no parameter can carry them | schema review | — | L |
| 2A–E | Narrow, accurate descriptions; no confusion; no coercion; no interference | **DR-2, DR-3**; `draft_` name prefix | lint test | — | L |
| **2F** | **No dynamically pulled behavioural instructions** | **DR-1** — Skill holds instructions; tools return data | "no instruction text in any tool result" test | — | **H→L after DR-1** |
| 2G | No hidden or encoded instructions | everything human-readable, in the public repo | repo review | — | L |
| 3A | Privacy policy link: collection, use, **retention**; presented as required by law | the live policy + a connector section (§6) | page returns 200 | publish the update | L |
| 3B | Verified contact and support channels (product **and security**) | `support@`, `privacy@`, **`security@` + `/.well-known/security.txt`** | addresses receive mail | **create `security@`** | L |
| 3C | Documentation: how it works, purpose, troubleshooting | a public docs page (§6) | page returns 200 | — | L |
| 3D | **Standard testing account with sample data** | the reviewer account (§6) | login works with no 2FA | create it | L |
| 3E | **≥ 3 working example prompts** | §6 | each succeeds on the demo account | — | L |
| 3F | **Own or control** every endpoint, domain and rendered resource | `jobsviadraft.com`; DR-8 | domain ownership | — | L |
| 3G | Maintain; fix issues in reasonable time | §9 operating duties | on-call note | — | **M** |
| 3H | Agree to the Terms; follow published design guidelines | owner accepts in the portal | — | **owner** | L |
| 4A–C | No money movement; no AI media generation; **no advertising or promotion** | none present; **DR-7** | lint; listing review | — | L |
| 5A–C | Helpful errors; token frugality; names ≤ 64 | DR-12, DR-6, DR-3 | tests | — | L |
| 5D | OAuth 2.0 with certificates from recognised authorities | Railway/Cloudflare TLS | probe | — | L |
| 5E | Annotations: `readOnlyHint`, `destructiveHint`, `title` | DR-3 | test over `tools/list` | — | L |
| 5F | Streamable HTTP | yes | Inspector | — | L |

### Software Directory Terms (the obligations you accept)
- **Represent and warrant:** you hold the rights; the software and its *ordinary intended use* comply with law and the Policy; **everything you tell Anthropic is accurate and current**; you have and follow a privacy policy that **accurately describes what you and third parties collect and share.**
- **Indemnify Anthropic** against claims arising from your software or its use. ⚠ **Counsel (Q3).**
- **Licence** Anthropic to display your descriptions, documentation, name, trademarks and logo to promote the listing.
- **Anthropic may review, test, or remove the listing at any time, for any reason, without liability** (security, user complaints, a policy change). **Build so removal is survivable** (§7, risk R6).
- **Maintain security and quality; receive and investigate vulnerability reports.**
- **No implied partnership or endorsement** without written approval; **follow Anthropic's trademark guidelines.** *Do not put "Claude" in the product's name.*

### Portal acknowledgements (all seven are required)
1. the directory guidelines · 2. **first-party API usage** (DR-8) · 3. **no financial transactions** · 4. **no AI media generation** · 5. **no prompt injection in tool descriptions** (DR-1, DR-2) · 6. **no collection of conversation data** (DR-4) · 7. **public documentation** (§6).
*The owner signs these. **Each must be true on the day — the evidence column above is the proof.***

---

## 4 · Usage Policy underwriting (the items that bear on a résumé product)

| Area | Text (paraphrased) | Our position | Controls |
|---|---|---|---|
| **Fraud — falsified documents** | *Do not create falsified documents … employment records, or misrepresent professional credentials.* | **Highest-risk item.** A tailoring tool can be misused to invent experience. | **DR-5** — server-side guard, plain refusals, tested; the Skill forbids invention. |
| **Fraud — AI-assisted work** | *Do not plagiarize or submit AI-assisted work without proper permission or attribution.* | Aimed at plagiarism, but a résumé is "submitted work". **Ambiguous.** | **DR-13** notice; counsel Q1. |
| **High-risk — Employment** | The requirements bite when Claude is used for *screening, ranking, advancing or rejecting candidates; hiring…* | **Applicant-side**: we help the candidate; we never decide about anyone. | **DR-9.** Intended purpose stated in docs and listing. |
| **High-risk — Legal** | *Advising an individual on their legal rights or obligations.* | We *show* a posting's stated requirement (e.g. *"requires U.S. citizenship"*); we **do not conclude** about the user. | **DR-14.** The ATS "eligibility notice" is **not** exposed as advice. |
| **Privacy** | *No sharing personal information without consent; no compiling or enriching personal data from multiple sources to build profiles.* | We hold only the user's own data, with consent. The connector exposes **no other person's data.** | DR-4; consent screen (§5). |
| **Platform abuse** | *Do not … route requests through consumer subscriptions; … use outputs to train a model.* | The user's own Claude calls our tools; **we call no model.** | **DR-11**, privacy-policy sentence, a test. |
| **Agentic use** | The deployer is responsible for actions taken through tools. | Our write tools act only inside draft. | DR-8. |
| **Chatbots / agents** | Disclose AI if communicating *directly with external users.* | We are not a chatbot. Cover letters go to employers **from the user**, not from us. | DR-13. |
| **Minors** | Products serving minors have additional duties. | **18+** only; the Terms of Service say so. | ToS page; counsel Q6. |
| **Circumventing other platforms' terms** | *Do not … circumvent the guardrails or terms of other platforms.* | Applying through employer portals is where this would bite. | **DR-8 — no apply tool, ever.** |
| **Version note** | The Usage Policy fetched is *effective 2026-11-12.* | **Re-read on that date.** | snapshot and diff (§0). |

---

## 5 · Authentication, transport and consent — the technical contract

- **Transport:** Streamable HTTP at **one** public HTTPS endpoint (`https://jobsviadraft.com/mcp`). **SSE-only is deprecated.** **Validate the `Origin` header — reject invalid origins without blocking Claude** (a stated check).
- **Discovery:** **every unauthenticated request, including the first `initialize`, returns `401` with `WWW-Authenticate: Bearer resource_metadata="…"`.** Publish **Protected Resource Metadata (RFC 9728)** and **Authorization Server Metadata (RFC 8414).** *Reported failure mode: a missing `WWW-Authenticate` makes the claude.ai connector fail instantly, while Claude Code tolerates it — so **test in claude.ai, not only the Inspector.***
- **Client registration — pick one, support the other as fallback:** **CIMD (preferred)** — advertise `client_id_metadata_document_supported: true` **and** `"none"` in `token_endpoint_auth_methods_supported` (Claude's CIMD client is a *public* client); **DCR (RFC 7591)** — a `registration_endpoint`. *D86 Phase 0 already preferred CIMD.*
- **Flow:** authorization-code + **PKCE S256 only**; **exact** redirect-URI matching, no wildcards. **Callbacks to allow:** `https://claude.ai/api/mcp/auth_callback` (covers Claude web, Desktop, mobile, Cowork) and Claude Code's **loopback** `http://localhost:<ephemeral>/callback`.
- **Tokens:** **refresh tokens; short access-token lifetime; revocation;** a token is bound to the **resource (`aud`)** and to scopes **`resume:read`**, **`resume:write`**. **A token is never reusable against `/api/admin`.**
- **The consent screen is draft's own page** (D86 UI tab 4): *what it can read, what it can save, what it never sees, who processes the content (the user's own Claude account and Anthropic's terms), the AI-assistance notice, Allow / Not now.* **It shows no plan names or prices (DR-7).**
- **Per-user controls:** the master switch OFF by default; **Settings → Connected apps → Disconnect** stops the next call at once; a global kill switch; a per-user daily cap (default **50**); every call writes an audit row (ids only).
- **Availability:** the MCP endpoint must be reachable **from Anthropic's cloud** — not localhost; a tunnel for local work.

---

## 6 · The reviewer package (assemble before the portal opens)

**Reviewer account (`DEMO`).** A real, fully populated **draft account that only reviewers see**: *a fictional candidate (Alex Rivera), a base résumé with bullet ids, three claims, the plugin switch ON, a high cap (100/day), 12 clearly-labelled sample postings with **stable ids**.* **No 2FA, no email verification step, no production secrets, no real person's data.** A **"Reset demo account"** action (a D88 admin utility) restores it after destructive tests. Credentials go **only** into the portal's *Test & launch* step.

**Three or more working prompts** (each verified on `DEMO`, expected result written down):
1. *"Find backend engineer roles posted this week and tell me which fit my résumé best."* → `draft_search_jobs`, `draft_score_resume_for_job`.
2. *"Tailor my résumé for job `demo-job-007`."* → brief → patch → saved; **score before → after.**
3. *"Tailor my résumé for `demo-job-007` and add Kafka."* → **refused with a plain reason; nothing saved** (proves DR-5).
4. *"What's missing from my résumé for `demo-job-004`?"* → matched and missing terms.

**Listing copy (limits from the portal):** name ≤ 100 · one-liner ≤ 200 *(one source says 55 — keep it ≤ 55)* · description ≤ 2,000 · 1–5 categories · docs URL · privacy URL · support contact · icon · **a permanent slug**.
*Plain, truthful, no pricing, no superlatives, no "Claude" in the name, no implied endorsement.*

**Public documentation page** (`/docs/claude` — required by publish): what it is and **who it's for (job applicants)** · setup in four steps · **the tool list with what each reads and writes** · what is stored, for how long, who processes it · the daily limit · **troubleshooting** (sign-in errors, a refused résumé, a hit limit) · **the AI-assistance notice** · how to disconnect · contacts.

**Privacy policy — a connector section covering:** what the connector reads and saves · **retention** · that **content is processed by the user's own Claude account under Anthropic's terms** · that **draft calls no model and does not train on connector content** · Resend and Cloudflare as processors for email · how to revoke · how to delete · contact (`privacy@`) · the "last updated" date. **Also update `PRIVACY_RECONCILIATION.md`.** Plus a **Terms of Service** page (18+, applicant-side use only, no fabrication, no employer-side use).

**Contacts:** `support@`, `privacy@`, **`security@`** (create it), **`/.well-known/security.txt`**, a **vulnerability-disclosure** paragraph, and the review team's escalation address **`mcp-review@anthropic.com`** noted in the runbook.

**Company step:** company name, website, a primary contact for review updates. ⚠ *If no entity exists yet, the submitter is the owner personally — counsel Q8.*

---

## 7 · Risk register

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | A user fabricates credentials with the tool | M | **H** | **DR-5**; the guard is deterministic and tested; refusal stores nothing |
| R2 | **Rejected for dynamic instructions** | H→L | **H** | **DR-1**; the "no instruction text in results" test |
| R3 | Prompt injection through job text | M | M | DR-10; structured fields; length-capped, fenced prose |
| R4 | Employers restrict AI-assisted applications | **H** | M | **DR-13** notice; counsel Q1 |
| R5 | The OAuth flow fails only in claude.ai | M | **H** | the 401 contract; **claude.ai end-to-end test (G4)** |
| **R6** | **Delisted at any time, for any reason** | L | **H** | draft **works without the directory**: the web app is the product; the connector is an add-on; keep the URL usable as a custom connector |
| R7 | **Policy drift** (the Policy and the AUP are versioned) | **H** | M | snapshot and diff quarterly; **the Usage Policy changes on 2026-11-12** |
| R8 | Free-plan limits make it unusable | M | M | measure in the A/B; say so in docs; "Write it with draft" fallback |
| R9 | Content in logs breaches §1D | M | **H** | ids-only audit rows; a test over the logger |
| R10 | **Monetisation risk on the other side** (OpenAI forbids upsells — separate doc) | — | — | keep this connector promotion-free regardless |
| R11 | Indemnity exposure | L | M | counsel Q3; insurance when an entity exists |
| R12 | The submitter is a personal account | M | M | decide the owning account first (D1); entity later |

---

## 8 · End-to-end plan — gates, owners, evidence

| Gate | What | Who | Evidence / exit |
|---|---|---|---|
| **G0 · Read and snapshot** | read the unread pages (§0); snapshot Policy, Terms, AUP, review criteria into `docs/policy-snapshots/` | agent + owner | the files; a one-page diff note |
| **G1 · Decide** | D1–D6 below; counsel Q1–Q8 asked | owner | decisions logged |
| **G2 · Build** | the connector (Appendix A), the **Skill**, OAuth + consent, the master switch and cap (D86 UI), the audit rows | agent | the code, tests green |
| **G3 · Verify mechanically** | a **policy test suite** that **fails the build** on: any tool missing `title` or a hint · a name > 64 · a mixed read/write tool · a description matching the DR-2 lint · any instruction text in a tool result (DR-1) · a brief over the token budget · `401` without `WWW-Authenticate` · metadata missing the CIMD values · a log row containing content · a tool with a free-text context parameter | agent | CI green; **MCP Inspector** pass; **Claude Code** pass |
| **G4 · Verify in Claude** | add as a **private custom connector** on the owner's **personal** Claude account; **call every tool**; run the four prompts | owner | a results table; screenshots; **the portal asks you to confirm this** |
| **G5 · Quality** | the 5-job A/B (D86 Phase 2): ATS lift, guard pass on the first try, the owner's blind pick; **on Free *and* Pro** | owner + agent | the report |
| **G6 · Package** | §6 complete; the plugin repo; the docs, privacy and terms pages **live**; the reviewer account tested by a second person | agent + owner | a checklist, every line ticked |
| **G7 · Submit** | the owner submits the connector **and** the plugin from the chosen account and signs the seven acknowledgements | **owner** | the portal status; track it |
| **G8 · Operate** | the dashboard; a response routine for vulnerability reports and reviewer feedback; tool changes → deploy **and** edit the listing (a reviewer approves tool-name changes); quarterly policy diff | owner + agent | a runbook |

**Updating after listing:** *"you don't resubmit to Anthropic to change a listed MCP server's tools"* — you deploy; the **tool names shown on the listing** change through a listing edit **that a reviewer approves.** A plugin update is a push to the tracked branch; it is validated and security-scanned again, and **a version that fails or is held does not take the live listing down.**

---

## 9 · Questions for counsel
1. **Q1** — AI-assisted applications: is a notice sufficient against the AUP's *"submit AI-assisted work without … attribution"* and employers' own terms?
2. **Q2** — Our exposure if a user misrepresents credentials despite the guard; is the guard enough, and what must the ToS say?
3. **Q3** — The **indemnity** in the Directory Terms, and what a personal submitter risks.
4. **Q4** — Controller / processor roles: we are the controller of draft data; **Anthropic acts under the user's own account.** What must the policy state?
5. **Q5** — Employer-side misuse: is "applicant-side only" in the ToS enough?
6. **Q6** — Age gating (18+) and minors.
7. **Q7** — Trademarks: naming, the Anthropic trademark guidelines.
8. **Q8** — Submitter identity: personal account vs an entity; transfer of the listing.

## 10 · Decisions for the owner
- **D1 · Which Claude account owns the listing?** *Not the Enterprise one.* A personal **Pro** account (required to submit — Free cannot) — or wait for a company-owned Team org.
- **D2 · The plugin's name and slug.**
- **D3 · The plugin repo's licence** (MIT or similar — a licence file is validated).
- **D4 · Who answers reviewer feedback** and security reports (and a response-time target).
- **D5 · Daily cap default** (50 proposed).
- **D6 · Which phase-2 tools ship in the first submission** — see `BYO_MODEL_EXPANSION.md`. **Recommendation: submit v1 with résumé + read-only tools only.**

---

## Appendix A · Tool catalogue v1 (names ≤ 64; descriptions are *drafts*, to be linted)

| Tool | Hint | Description (what it does — no behaviour steering) |
|---|---|---|
| `draft_search_jobs` | read-only | "Searches the jobs on the user's draft board by keyword, location, level and posting age. Returns up to 10 jobs with id, title, company, location, level, posted date and stated pay." |
| `draft_get_job` | read-only | "Returns one job's structured details: title, company, location, level, workplace, stated pay, required skills and a short summary. Does not return the full posting text unless `include_description` is true." |
| `draft_score_resume_for_job` | read-only | "Scores the user's base résumé against one job with draft's deterministic ATS scorer. Returns the score and the matched and missing terms." |
| `draft_get_resume_brief` | read-only | "Returns the data used to tailor a résumé for one job: the user's base résumé as bullets with ids, the user's claimed skills, the terms to emphasise, and the job's basics. Contains no contact details. Returns a brief id valid for 30 minutes." |
| `draft_submit_resume_patch` | write (non-destructive) | "Saves a tailored résumé from a patch of rewritten bullets keyed by id. Refuses any skill, title, employer or date that is not in the user's base résumé or claims, and returns the reasons. On success saves a new version and returns its ATS score." |
| `draft_list_my_resumes` | read-only | "Lists the user's saved résumé versions with job, date and score." |

*(Phase 2: `draft_get_cover_letter_brief`, `draft_submit_cover_letter`, `draft_list_my_applications`, `draft_record_application` — see the expansion document.)*

## Appendix B · The Skill (`skills/tailor-resume/SKILL.md`) — outline
**Front matter:** name, a one-sentence description of *when* to use it. **Body (plain, static):**
1. Identify the job (ask the user, or search).
2. Get the brief. 3. Rewrite only the bullets that matter, **using only facts in the brief**.
4. **Never** add a skill, tool, title, employer, date, metric or certification that is not in the brief. 5. Keep contact details out.
6. Submit the patch. If refused, read the reasons, remove the offending text and resubmit — **at most three attempts.**
7. Report the score and say **what was saved**; if nothing was saved, say so.
8. Never state or imply the user's visa, citizenship or work-authorisation eligibility.
9. Close with the AI-assistance notice (DR-13).
**No hidden text, no encoded content, no URLs except `jobsviadraft.com`, no promotion.**

## Appendix C · Sources
Anthropic Software Directory Policy (support.claude.com/en/articles/13145358, 2026-04-15) · Software Directory Terms (…/13145338) · Connector pre-submission checklist and Submit a connector (claude.com/docs/connectors/building/review-criteria, …/submission) · Plugin pre-submission checklist and Submit a plugin (claude.com/docs/plugins/pre-submission-checklist, …/submit) · Manage your listing after publishing (…/after-publishing) · Authentication for connectors (…/authentication) · Connectors Directory partnership FAQ (…/partnership-faq) · Usage Policy (anthropic.com/legal/aup, effective 2026-11-12). *Third-party commentary (sunpeak, Tallyfy, mcpjam, omidsaffari) was used only to cross-check, never as authority.*
