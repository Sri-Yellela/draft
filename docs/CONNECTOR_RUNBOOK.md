# The draft connector — operating runbook (D86 G8)

**For:** the owner and the agent, once the connector (`https://jobsviadraft.com/mcp`) and the plugin
(`github.com/Sri-Yellela/draft-plugin`) are submitted. Companion to `docs/CLAUDE_CONNECTOR_COMPLIANCE.md` §8 G8.
Every switch named here exists in the app today.

## Stop it — the kill switches

| To stop | Where | Effect |
|---|---|---|
| everything, for everyone | Admin → System → Plugin → **Feature switch** | every tool call refused; the consent screen offers only "Not now"; Settings reads "unavailable" |
| one host (Claude or ChatGPT) | the same page → **Allow Claude / Allow ChatGPT** | that host can neither connect nor call; Claude Code's loopback is the Claude host |
| one account | Admin → People → the person → Feature access → *Write résumés in ChatGPT or Claude* off | that account's calls refused (`account_off`), its consent screen says so |
| one connection | the user's Settings → Connected apps → **Disconnect** | the connection's next call is refused (401) |
| abuse volume | the per-user daily cap (Plugin page; per account in People) | `daily_cap` refusals; resets 00:00 UTC |

Every refusal and call is in the Plugin page's *Recent tool calls* and the user's Connected-apps activity —
ids and outcomes only, never résumé text (`mcp_audit`, kept 12 months).

## Reviewer feedback

1. Read it in the developer portal (claude.ai/directory/manage). Anthropic's review team: `mcp-review@anthropic.com`.
2. Reset the reviewer account before a re-review: Admin → System → Plugin → Reviewer account → **Reset it**
   (or `node scripts/reviewerDemo.mjs --db <path> reset`).
3. A change to **what a tool does or is called** is a deploy *and* a listing edit: the listing's tool names change
   only through a listing edit a reviewer approves. Keep `/docs/claude` and the plugin README's tool tables in step —
   `test/d86ConnectorDocs.test.js` fails when the docs page and `tools/list` disagree.
4. A plugin change is a push to the branch the directory follows; it is validated and scanned again, and a held
   version does not take the live listing down. Raise `version` in `.claude-plugin/plugin.json` with each release.

## A vulnerability report

1. Reports arrive at `security@jobsviadraft.com` (`/.well-known/security.txt`, `/docs/claude#security`).
2. Acknowledge the reporter. If tokens may be exposed: switch the feature off (above); Disconnect revokes a
   connection and all its tokens at once; codes and tokens are stored only as hashes.
3. Fix, deploy, tell the reporter, and note it in the WORKLOG. The Directory Terms require investigating reports.

## Every quarter (and before any submission)

- Re-fetch every page in `docs/policy-snapshots/`, diff it, and record what moved in that folder's README.
  ⚠ The Usage Policy names 2026-11-12 as an effective date — re-read it then.
- Run `npm test` — the compliance tests (`d86ConnectorCompliance`, `d86ConnectorDocs`, `d86ReviewerDemo`,
  `d86Byom`) hold the rules the policies impose: no instructions in results, descriptions that do not steer,
  no promotion, no apply tool, narrow inputs, the token budget, untrusted posting text, the retention sweep.
- Walk the four review prompts on the reviewer account (`docs/CLAUDE_CONNECTOR_COMPLIANCE.md` §6).

## If Anthropic or OpenAI removes the listing

The directory may remove a listing at any time. draft does not depend on it: the web app is the product, and the
same URL keeps working as a custom connector that a user adds by hand (`/docs/claude`, step 2).
