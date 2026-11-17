# VENDORS — the third-party register (D173 (8))

Every outside service draft sends data to, or that sends data to draft: what it receives, why, and where it is
named for the people whose data it is. This is the start of any later security review (D158) — it records what the
code does, not legal advice and not contract terms.

**Source of truth for the wording people read:** the privacy policy's *Third-Party Services* section
(`client/src/pages/marketing/PrivacyPage.jsx`). This register follows the code; where the two disagree, the row says
so (⚠) and the owner decides the policy's words — the agent never rewrites legal text on its own.

**Measured 2026-11-07 (45h)** from the code at `3983e94` (`git grep` per vendor) and the policy page. Re-measure when
a vendor is added or removed; a new outside call needs a row here AND a sentence in the policy before it ships.

| Vendor | What it receives from draft | Why | Where in the code | Named in the policy | Data agreement / terms |
|---|---|---|---|---|---|
| **Railway** | everything draft stores (the SQLite volume), its logs | hosting: draft, the tools service, the crawler, the apply worker | Railway projects `resume-master` (services draft · resume-master · crawler) | ✅ | ⚠ not recorded — owner |
| **Anthropic** (via draft's own key) | cover letters: résumé text, job title / company, the job description, the tone; "Load more AI suggestions": the domain / role family and the chips already picked | the model behind those two features | `services/modelGateway.js` `callTask` (`shared/modelTasks.js`) | ✅ | ⚠ not recorded — owner (API inputs not used for training, per Anthropic's commercial terms — the policy says so) |
| **Anthropic** (via the tools service's key) | résumé text, the profile details the résumé draws on, the job description | résumé generation / enhancement | resume-master `src/generation/*` | ✅ (through *Resume Master*) | as above |
| **Resume Master** (our own tools service, resumemaster.one) | as the row above; stores nothing (token counts only) | generates, enhances, formats résumés | `services/toolsService.js` | ✅ | own service |
| **Our apply service** (own Railway project) | sealed portal sessions, opened only while applying | *Applying for You* | `services/applyWorker.js`, `docs/APPLY_WORKER.md` | ✅ | own service |
| **Resend** | an address + the account email (reset link, new-address code, notices); with the Application Inbox, the mail forwarded to the inbox address | outbound account mail; inbound inbox | `routes/email.js`, `routes/adminAuth.js`, inbound `RESEND_INBOUND_SECRET` | ✅ | ⚠ not recorded — owner |
| **SerpApi** | search queries (no personal data) | Google Jobs results; the slug harvest | `services/jobs/sources/serpapi.js`, `routes/slugHarvest.js` (`SERPAPI_KEY`) | ✅ | ⚠ not recorded — owner |
| **Adzuna** | search terms and filters (no personal data) | job listings via its publisher API | `services/jobs/sources/adzuna.js` | ✅ | ⚠ not recorded — owner |
| **Job boards' public APIs** — Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, Recruitee | search terms / company slugs (no personal data) | the board's postings | `services/jobs/sources/*.js` | ✅ | public APIs |
| **More job boards' public APIs** — BambooHR, Gem, Rippling | company slugs (no personal data) | the board's postings | `services/jobs/sources/bamboohr.js`, `gem.js`, `rippling.js` | ⚠ **not named** — the policy's list stops at Recruitee | public APIs |
| **Employer portals** | what an application sends (answers, résumé) | applying | the extension, the apply worker | ✅ | the portal's own terms |
| **Google — sign-in** (OAuth) | the person's Google identity (name, email) at sign-in | "Continue with Google" | `server.js` `OAUTH_PROVIDER_CONFIG.google`, `/api/auth/oauth/google/*` | ⚠ **not named** — the policy names Google only for Gmail, push and the favicon | Google's OAuth terms |
| **Google — Gmail** (optional) | the search for matching messages, requests for those messages (read-only) | the Application Inbox via Gmail (D112) | `services/gmail.js` | ✅ | Google API Services User Data Policy |
| **Google — favicon service** | a company's domain only | a raster logo when the site has none | `services/jobs/companyLogoStore.js` | ✅ | public endpoint |
| **DuckDuckGo Icons** | a company's domain (loaded by the person's browser) | company logos | `shared/companyLogos.js` | ✅ | public endpoint |
| **The browser's push service** (Google / Mozilla / Microsoft / Apple) | an encrypted push message | push notifications (opt-in) | `services/webPush.js` | ✅ | the browser's |
| **Cloudflare Email Routing** | mail people send to the contact / support addresses | forwarding to the inbox the team reads | DNS only — draft sends it nothing | ✅ | ⚠ not recorded — owner |
| **LinkedIn** (optional sign-in) | — (LinkedIn sends name + email) | "Sign in with LinkedIn" | `routes/account.js` | ✅ | LinkedIn's OAuth terms |
| **The person's own ChatGPT / Claude** (optional connector) | base résumé work history + skills (no contact details), job title / company / level / location / matched keywords | the connector (D86) | `routes/byom.js`, `services/byom/`, `docs/CLAUDE_CONNECTOR_COMPLIANCE.md` | ✅ | the person's own account |

**Retired — nothing is sent any more:** Clearbit Logo API (shut down by its operator; named in the policy as
retired) · Google Fonts (self-hosted since 2026-09-15; named as retired) · Groq / Gemini (A87, 10-05) · Jobo (D78 C) ·
Apify (A108) · TheirStack (no code reference at `3983e94`).

**Owner, to decide:** (1) whether the policy names Google sign-in and BambooHR / Gem / Rippling (the two ⚠ rows) ·
(2) record each ⚠ "not recorded" agreement (Railway, Anthropic, Resend, SerpApi, Adzuna, Cloudflare) — the date of
the terms accepted and whether a data-processing agreement exists — in the owner's own records; this file only
says whether one exists.
