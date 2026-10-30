// services/modelKeyCheck.js
// ⭐ T19 hardening (G1, 10-30) · IS THE MODEL KEY ACCEPTED — asked at boot and once a day, said in one line.
//
// 10-15: the keys that replaced the shared one were created OUTSIDE a workspace, and Anthropic refused every request
// made with them ("This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id
// header…"). Nothing said so until a user's generation failed and the owner pasted the logs. Two things follow:
//
//   · ANTHROPIC_WORKSPACE_ID (optional): when set, every request carries the `anthropic-workspace-id` header, so a key
//     that is not workspace-scoped can still be used. The boot line says whether the header is on.
//   · the KEY CHECK: the cheapest authenticated call (GET /v1/models, one row — no tokens, nothing billed), printed as
//     `model key: OK | FAILED (<Anthropic's reason>)`, re-run daily. A failure raises the admin's banner (server.js);
//     the user's sentence stays generic.
//
// ⛔ Nothing here prints a key or a workspace id: the reason is Anthropic's own message with anything key-shaped masked.

const WORKSPACE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** The SDK's `defaultHeaders` for this environment — {} unless ANTHROPIC_WORKSPACE_ID is set (and well-formed). */
export function workspaceHeaders(env = process.env) {
  const id = String(env?.ANTHROPIC_WORKSPACE_ID || "").trim();
  return WORKSPACE_ID.test(id) ? { "anthropic-workspace-id": id } : {};
}

/** Anthropic's reason, one line, ≤ 200 chars, with anything that looks like a key or an id masked. */
export function safeReason(e) {
  const raw = String(e?.error?.error?.message || e?.error?.message || e?.message || e || "unknown").replace(/\s+/g, " ").trim();
  return raw.replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-…").replace(/\bwrkspc_[A-Za-z0-9_-]+/g, "wrkspc_…").slice(0, 200);
}

/**
 * Ask once. → { state: 'ok' | 'failed' | 'unreachable' | 'unconfigured', reason, status }
 *   failed       Anthropic ANSWERED and refused the key (400 / 401 / 403) — a configuration fault; a retry cannot fix it
 *   unreachable  a timeout, a network error or a 5xx — evidence about the network, not the key (no banner)
 */
export async function checkModelKey(client, { timeoutMs = 10_000 } = {}) {
  if (!client) return { state: "unconfigured", reason: "no key", status: null };
  let timer;
  try {
    await Promise.race([
      client.models.list({ limit: 1 }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs); }),
    ]);
    return { state: "ok", reason: null, status: 200 };
  } catch (e) {
    const status = e?.status ?? null;
    if (status === 400 || status === 401 || status === 403) return { state: "failed", reason: safeReason(e), status };
    return { state: "unreachable", reason: safeReason(e), status };
  } finally { clearTimeout(timer); }
}

/** The boot / daily line: "model key: OK" · "model key: FAILED (<reason>)" · "model key: UNREACHABLE (<reason>)". */
export function keyCheckLine(r) {
  const s = String(r?.state || "unconfigured").toUpperCase();
  return r?.reason && r.state !== "ok" ? `model key: ${s} (${r.reason})` : `model key: ${s}`;
}

export const KEY_CHECK_EVERY_MS = 24 * 3600_000;
