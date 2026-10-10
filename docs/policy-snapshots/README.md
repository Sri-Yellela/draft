# Policy snapshots — D86 G0 (2026-10-09)

**Why this folder exists:** the connector directory's policy and the Usage Policy are versioned and change
(`docs/CLAUDE_CONNECTOR_COMPLIANCE.md` §0, risk R7). These are the pages as fetched on 2026-10-09. **Before a
submission, and every quarter: re-fetch each, diff it against the file here, and note what moved below.**
Each file names its source URL in its first line. The live page is always the copy of record.

| File | Source | Form |
|---|---|---|
| `anthropic-software-directory-policy.md` | support.claude.com/en/articles/13145358 | text from the HTML |
| `anthropic-software-directory-terms.md` | support.claude.com/en/articles/13145338 | text from the HTML |
| `anthropic-usage-policy.md` | anthropic.com/legal/aup | text from the HTML |
| `claude-connector-review-criteria.md` | claude.com/docs/connectors/building/review-criteria | the site's Markdown |
| `claude-connector-submission.md` | claude.com/docs/connectors/building/submission | the site's Markdown |
| `claude-connector-authentication.md` | claude.com/docs/connectors/building/authentication | the site's Markdown |
| `claude-plugin-pre-submission-checklist.md` | claude.com/docs/plugins/pre-submission-checklist | the site's Markdown |
| `openai-submit-claude-plugin.md` | developers.openai.com/plugins/guides/submit-claude-plugin | the site's Markdown |

## What reading them changed (2026-10-09)

**Confirmed as the compliance document states it:** Directory Policy §2F word for word (*"must not direct Claude
to dynamically pull behavioral instructions from external sources"*) · separate read and write tools · a `title`
and the hints on every tool · names ≤ 64 · descriptions that do not steer · specific errors, never a bare
"Internal Server Error" · test credentials for a fully populated account · public documentation by the publish
date · test through the MCP Inspector and as a custom connector in Claude before submitting.

**New — built 10-09:**
- **`offline_access`.** Claude appends it to the scope when the server advertises it, and OpenAI's help advises
  it; draft refused unknown scopes, so it would have failed the connection. Accepted now as a no-op (draft
  always issues a refresh token).
- **The consent screen must show the redirect URI's host,** and warn when it is a loopback address (the MCP
  authorization spec, via Claude's authentication page). Built: "After you choose, you go back to claude.ai",
  and a warning for Claude Code's `localhost` return.
- **Claude's hosted callback is exactly `https://claude.ai/api/mcp/auth_callback`; Claude Code uses
  `http://localhost:<port>/callback` and `http://127.0.0.1:<port>/callback`, port ignored.** Built.
- **OpenAI domain verification** serves the portal's token from `/.well-known/openai-apps-challenge`. Built
  behind `OPENAI_APPS_CHALLENGE` (404 until set).

**New — the owner decides (WORKLOG O93):**
- **The plugin needs a LICENSE file** — a missing one *blocks* submission.
- **The plugin's name.** A name *"made only of generic words"* is held for a reviewer, and the name may not be a
  reserved word or look like another brand. `draft` is an ordinary English word; the compliance document's
  `draft-resume` (or the domain's `jobsviadraft`) avoids the hold.
- **OpenAI requires, for OAuth, a UserInfo endpoint returning `email` with `email_verified: true`, and the
  `openid` and `email` scopes.** draft can answer it truthfully (`users.email_verified_at`), but it means the
  connected app learns the user's email — and the consent screen and the privacy policy promise today that
  it never receives contact details. Not built: it changes a privacy promise.
- **DCR at directory scale:** Claude registers a new client on every fresh connection under DCR, and the
  authentication page recommends CIMD (or Anthropic-held credentials) for high-traffic listings — A96.
- **One package can go to both directories,** but OpenAI asks skills to say "the model", not "Claude", and
  needs a verified OpenAI organisation with Apps Management access. The Skill already avoids naming Claude.

**Still not read** (the compliance document's §0 list): the Verification page, MCP Apps, Anthropic's
trademark guidelines, the Consumer Terms, the supported-countries page; OpenAI's full Sign in with ChatGPT
Terms, its review requirements for remote MCP servers, and its UI/UX page. ⚠ The Usage Policy as fetched
carries no effective date in its text; the compliance document cites one of 2026-11-12 — re-read on that date.
