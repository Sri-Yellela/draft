# Post-migration — MCP connectors and remote browser profiles

**Design document. Nothing here is built.** ⛔ Do not write any of it into `ARCHITECTURE.md`.
Both depend on Phase B completing.

Two separate projects that arrive after the split:

| | | Depends on |
|---|---|---|
| **E1 · MCP connectors** | Resume Master's deterministic tools, exposed as LLM tools | Phase B |
| **E3 · Remote browser profiles** | Unattended apply on gated portals, and on mobile at all | ⛔ AF5, full-auto proven, and a security design |

---

# E1 — MCP connectors

## ⛔ Which tools, and which not

**The candidates are the DETERMINISTIC ones.** They do something an assistant genuinely cannot do
itself, and they are cheap, fast and reproducible.

| Tool | Why it fits |
|---|---|
| ⭐ **ATS scoring** | Deterministic, local, free, **zero model calls** — pinned by a test asserting the scrape block contains no `messages.create`. "Paste a job description, get a fit band plus matched and missing terms" is a real tool an LLM cannot approximate |
| **Résumé parsing** | Structured extraction from a PDF. Deterministic output, and the assistant has the file already |
| **PDF / print-ready formatting** | Deterministic rendering. ⛔ Note A2 found there is **no server-side PDF** — `/api/export-pdf` returns 503 by design and the artifact is print-ready HTML the browser prints. So the tool returns HTML, not a PDF |

⛔ **Generation is the weakest candidate and should probably not ship first.** An LLM calling an API
to call an LLM is a strange shape: the caller can already write prose, and what it lacks is the
*constraints* — the base résumé, the profile, AF2's assertion. If generation ships as a tool, the
value is the integrity layer, not the writing, and the tool description must say so.

## ⛔ The integrity rules become promises to strangers

They are internal protections today. As MCP tools they are commitments to callers you will never
meet, in contexts you cannot see.

- **AF2's hard assertion** — output may not claim more experience than the profile states
- **Flag, don't fabricate** — the scorer declines rather than guessing; "Not enough signal" is a
  correctness state and must survive into the tool's output as its own thing, never as a low score
- **§7** — companies and roles only, never individual dossiers

⚠ **An MCP client may present a tool's output as its own conclusion.** If the scorer declines and
the assistant renders that as "your fit is low", the refusal has been converted into a fabrication
by a layer you do not control. **Say plainly in the tool's own description and in its response shape
what a declined score means.**

## Auth and metering

**Same service-token model as draft.** `rmk_<client>.<secret>`, hash-only storage in
`RESUME_MASTER_CLIENT_TOKENS`, rejected before the body is read, 503 with no clients configured
rather than open, rotate by adding the new hash beside the old.

⛔ **Per-client accounting already exists from A2 and is the reason it was built before it was
needed.** Limits are off; MCP is the first case where they matter, because an assistant in a loop
can call a tool far more often than a human would.

| Tool | Cost | Gate |
|---|---|---|
| ATS scoring | **zero** — no model call | Free tier is honest here |
| Parsing | small | Free or cheap |
| Generation | ~$0.04 | ⛔ Must be metered, and a loop can run it repeatedly |

⚠ **The free ATS connector is the interesting acquisition play.** It costs nothing to serve, it does
something assistants are bad at, and it puts the brand in front of people mid-task. Treat it as
distribution rather than revenue.

## Shape

- **One MCP server, in Resume Master.** Not a second service — these are the same tools the HTTP API
  exposes, in a different envelope
- ⛔ **Generated from the same source as the HTTP contract**, not hand-written. `contract/` is
  produced by *executing* the mapper rather than parsing it; an MCP schema written by hand is a
  second declaration that will drift, and drift is this codebase's most-repeated defect
- **Stateless.** No session, no stored input. Same rule as the API — input in, output back, nothing
  retained. Logging records tokens and cost, never content
- Tool descriptions matter more than usual: the model chooses tools from them. Say what each does,
  what it refuses, and what a refusal means

---

# E3 — Remote browser profiles

⛔ **Not a VM per user.** An **encrypted browser profile** per user — cookies and localStorage, tens
of megabytes — mounted into an ephemeral container per run. A worker pool, not idle machines.

## What it buys

**The gated tier.** `automation_tier` `gated`/`account` — Workday, Meta, Amazon — disproportionately
the employers people most want. Roughly 95% of the board is `direct` and needs none of this.

⭐ **And it is the ONLY thing that makes mobile auto-apply possible.** The gated handoff works
because the user's own desktop browser holds the authenticated portal session and the extension
borrows it for one gesture under `activeTab`. **There is no extension on a phone.** A remote profile
removes that constraint entirely.

## ⛔ The security design is the first task, not a follow-up

**The sign-in flow is the whole design.** The user signs into the portal **themselves**, through a
streamed remote view. **You never see the password.**

That is categorically different from storing credentials:

| | Breach yields |
|---|---|
| Stored credentials | Passwords — permanent, reusable, frequently reused elsewhere |
| ⭐ Stored session cookies | **Time-limited, revocable by the portal, scoped to one site** |

Much closer to the gated handoff's property than "a VM with the user's logins" suggests.

**What the design must state before any code:**

1. What is stored, exactly. Cookies and localStorage only — never form values, never keystrokes
2. Encrypted at rest, keyed how, decrypted where, and for how long it exists in memory
3. Revocation: the user ends it, and what that deletes
4. **What a breach exposes**, written down plainly. If that sentence is uncomfortable, the design is
   not finished
5. Whether the streamed sign-in view can be intercepted, and by whom

## ⛔ Three costs, all real

**Detection.** Datacenter IPs are the flagged shape for automated submission, and the gated portals
are precisely the ones that check. Residential proxies are the usual answer and they are murky.

**ATS terms.** Some prohibit automated submission regardless of who authorised it. ⛔ **Per-platform
fact — check which, before building for them.**

**`/api/apply/session/*` returns 410**, with the replacement named. It was retired for exactly this
reason. Reversing that is legitimate, but it must be a **recorded deliberate reversal with its
reasoning**, not a feature that quietly arrives.

## ⛔ Prerequisites, in order

This is last for a reason. Every one of these is unproven today:

1. **AF5** — 30 supervised applications. The pipeline has completed **one**
2. **Full-auto proven on the direct tier**, which needs no new infrastructure. ⛔ Semi mode runs
   *neither* the completeness nor the low-confidence gate — the human is the only check — so the
   gates that would protect unattended running have never fired against a real employer
3. **The kill switch verified mid-batch**, not only at admission
4. **The security design above**, reviewed
5. Then, and only then, remote profiles

⚠ **A VM does not unblock unattended apply. Validation does.** `applyAutomation.js` already drives
Puppeteer server-side; full-auto already runs headless and unattended. "The user must be at the
machine" is a property of **semi mode**, which is deliberately human-in-the-loop — not an
infrastructure limitation.

## Sequencing note

E3 is the largest thing on any list and it sits behind the most unproven ones. ⛔ **Do not let its
ambition pull it forward.** The honest order is: prove the pipeline works at all → prove it works
unattended on easy portals → then build the hard infrastructure for the difficult ones.
