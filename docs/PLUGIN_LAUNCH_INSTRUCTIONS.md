# Claude plugin + connector — finishing instructions

**Org:** `github.com/drafthq` (personal-account type, free plan) · **Repo:** `drafthq/draft-plugin` (public) · **Submitter:** the owner's personal Claude account (Free → Pro).
**Rules that govern all of it:** `CLAUDE_CONNECTOR_COMPLIANCE.md` (DR-1 … DR-14), `BYO_MODEL_EXPANSION.md`, and the log's D86. **Nothing is submitted until the A/B passes (D86 Phase 2).**

---

## PART A — THE AGENT

⛔ **Do not push `draft` without the owner's go. Do not submit anything to any directory. Do not create accounts.**

**A0 · Preconditions.** The owner has placed the four spec documents (and `D86_UI_ADDENDUM.md`) in `docs/`. If any is missing, stop and say so — *do not rebuild from memory.*

**A1 · The plugin repository — `drafthq/draft-plugin`.**
1. Add the remote: `https://github.com/drafthq/draft-plugin.git` to the local `draft-plugin` folder (HEAD `29ebf14`). **Push needs the owner's GitHub sign-in — ask for it, do not store a token.**
2. The repo is **public from the first push.** It holds **only**: `.claude-plugin/plugin.json` · `.mcp.json` (the **same URL** as the connector: `https://jobsviadraft.com/mcp`) · `skills/tailor-resume/SKILL.md` · `README.md` · `LICENSE`. **No other file, no secret, no private-repo content, no draft source.**
3. **`LICENSE`:** add **MIT** *unless the owner names another* — the directory validates a licence file. Copyright line: the owner's chosen holder (ask; default the owner's name).
4. **`plugin.json`:** `name` and `description` **neutral and truthful** — ⛔ **the plugin name and the connector slug become public and the slug is PERMANENT: ask the owner to confirm both before the first submission** *(a competing product is also called "Draft" — recommend a distinctive name such as `draft-jobs`; the owner decides).* `version` **raised on every release.** No plan names, prices, "free", "premium", superlatives or endorsement claims.
5. **`README.md`:** what it does (find jobs, score a résumé against a job, tailor and verify a résumé, save it); **every tool, and whether it reads or writes**; what is stored and for how long (**1 day for a brief's résumé copy, 12 months for the audit row** — as built); that **the user's own Claude processes the content under their own account**; that **draft calls no model and does not train on connector content**; the **AI-assistance notice**; how to disconnect; contacts. **No promotion.**
6. Run **`claude plugin validate ./draft-plugin`** — it must pass — and **re-run it after every edit.** Report the output.
7. **Branch protection is not needed.** Turn **auto-publish OFF** until the owner says (a reviewer publishes each version by default).

**A2 · The connector (the remote MCP server) — submission readiness.**
1. **Re-confirm the compliance tests are green** (`d86ConnectorCompliance`) and add the **policy lint suite from the compliance document §8 G3** if not complete: descriptions lint (no imperatives to Claude, no links, no plan or price words) · every tool has `title` + the three hints (`readOnlyHint`, `destructiveHint`, `openWorldHint`) · names ≤ 64 chars and prefixed · **no instruction text in any tool result** · a brief ≤ ~2,500 tokens · `401` carries `WWW-Authenticate` with `resource_metadata` · the authorization-server metadata advertises CIMD (`client_id_metadata_document_supported: true`, `none` among the token-endpoint auth methods) and DCR · callback `https://claude.ai/api/mcp/auth_callback` accepted · **no content in any log row** · no free-text context parameter on any tool.
2. **Build v1's read-only tools** (now that the spec is present): `draft_search_jobs`, `draft_get_job`, `draft_score_resume_for_job` — **per Appendix A of the compliance document** (structured fields; a ≤ 600-character summary, not the posting's prose; `include_description` false by default).
3. **The reviewer account.** A fully populated demo account (fictional candidate, a base résumé with bullet ids, three claims, the plugin switch and every tool enabled, a cap of 100, ≥ 12 clearly labelled sample postings with **stable ids**), **no 2FA, no email verification step, no real data.** A **"Reset demo account"** action in Admin → People (D88). **Write the four example prompts and their expected results** (compliance §6) and **verify each on the demo account.**
4. **Public pages, live and returning 200:** the connector documentation page (`/docs/claude`: what it is, who it is for, setup in four steps, the tool list with reads and writes, what is stored and for how long, the daily limit, troubleshooting, the AI notice, how to disconnect, contacts) · the **privacy policy's connector section** · the **Terms of Service** (18+, applicant-side use only, no fabrication, no employer-side use).
5. **`security@jobsviadraft.com` + `/.well-known/security.txt`** and a one-paragraph vulnerability-disclosure statement. *(The owner creates the Cloudflare alias; you publish the file.)*
6. **The data-handling answers** the portal asks, written down for the owner to paste: reads or stores personal data (yes — résumé bullets and claims, with retention), sends data to services other than its declared connectors (no), how long it keeps data, intended for people under 18 (no).
7. **A paste-ready listing pack** (`docs/DIRECTORY_LISTING.md`): name · one-liner **≤ 55 characters** · description ≤ 2,000 · 1–5 categories · docs URL · privacy URL · support contact · icon · the slug **(awaiting the owner)** · company name and website · primary contact · the seven compliance acknowledgements with **the evidence line for each.**

**A3 · Report.** A pass/fail table for A1–A2, the `claude plugin validate` output, the lint suite's result, and **a "BLOCKS SUBMISSION" list.** Write it into the WORKLOG session log.

---

## PART B — THE OWNER (in order)

**Before anything**
1. **Place the four spec documents and `D86_UI_ADDENDUM.md`** into `draft/docs/` (they are in the outputs folder).
2. **Review and give the go to push** `58f4a09` + the docs commit (no migration).
3. **GitHub, `drafthq` org:** turn on **required two-factor authentication** (Settings → Authentication security) — *enable 2FA on your own account first.* **Add `yellela.s@jobsviadraft.com` as a verified secondary email** on your personal GitHub account.
4. **Create the repo:** `drafthq/draft-plugin`, **Public**, no README/licence/gitignore (the agent pushes the first commit). Tell the agent the push is ready; approve the sign-in prompt.
5. **Decide three things** and tell the agent: **the plugin name and the connector slug** (recommend a distinctive one, e.g. `draft-jobs`) · **the licence** (MIT recommended) · **the copyright holder** (your name or the company).

**Claude account**
6. **Create the Free account** with your real name and `yellela.s@jobsviadraft.com`. **Open `claude.ai/directory/manage`** and read what it says. **Publish nothing.**
7. **Email `directory@anthropic.com`** from that address: *does a listing stay manageable if the owning account later drops to Free? Can a connector slug be released on delisting?* Keep the answer.
8. **Cloudflare:** add **`security@jobsviadraft.com`** → your Gmail.

**Test (Free is enough)**
9. **Admin → System → Plugin:** turn the feature on; set **your account's** entitlement on; leave everyone else off.
10. **Settings → Connectors → Add custom connector** with the production URL `https://jobsviadraft.com/mcp`; sign in on draft's consent screen. *(Claude connects from Anthropic's cloud — the URL must be public.)*
11. Run the **four example prompts**; note any refusal, wording or limit that surprised you. *(Free's five-hour window is tight — that is information.)*
12. **Ask the developer to run MCP Inspector / Claude Code** against the server for the protocol checks.

**A/B and submission**
13. **Upgrade to Pro** when you start the **5-job A/B** (tailored-vs-base ATS lift, first-try guard pass, your blind pick vs today's generation) — or when you are ready to submit.
14. **If the A/B passes:** in the portal, **connect your GitHub account** (Claude → the portal's *Connect GitHub* link). **Submit the CONNECTOR first** (*Submit new → MCP connector*: the URL, the listing pack, the data-handling answers, the reviewer credentials, the seven acknowledgements — **you** sign them). **Then the PLUGIN BUNDLE** (*Submit new → Plugin bundle*: `drafthq/draft-plugin`, branch default; **Validate**; listing details; data handling; compliance; **Submit for review**). **Pair the two listings.**
15. **After submission:** watch the status in the portal; answer reviewer questions the same day; set up the **GitHub push webhook** from the plugin's Settings tab (you have admin on the repo); raise `version` with every release.

**Counsel (in parallel)** — Q1–Q8 in `CLAUDE_CONNECTOR_COMPLIANCE.md`, **plus a trademark clearance for "Draft"** (a competing résumé product uses the name) **before the slug becomes permanent.**

---

## IF SOMETHING GOES WRONG
- **Validate fails:** the agent fixes the repo and re-runs `claude plugin validate`; then **Validate** again in the portal (a result applies to one commit).
- **"Already submitted by another organization":** you are the first — email `directory@anthropic.com` (the portal's own instruction).
- **A rename is wanted:** **before** submitting, rename the org freely; **after** submitting, the repository address is fixed in the portal — do not rename.
