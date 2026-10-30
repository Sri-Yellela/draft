// routes/byom.js — ⭐ D86 · BRING-YOUR-OWN-MODEL RÉSUMÉS: the OAuth doors, the MCP endpoint, the consent
// screen, Settings → Connected apps and Admin → System → Plugin.
//
// TWO ROUTERS, because they sit at two places in server.js's middleware order:
//   · `tokenRouter` — the doors a HOST calls server-to-server (metadata, register, token, revoke, /mcp). It is
//     mounted BEFORE the session and auth-context middleware: these requests carry an OAuth token or nothing,
//     never a draft cookie, and a draft cookie must never authenticate them.
//   · `sessionRouter` — what a PERSON uses in their browser (the consent screen, Settings, Admin), mounted
//     with the app's other routes, behind the session.
// ⛔ An OAuth token is checked only by verifyAccessToken (oauth_tokens); draft's own API never accepts one,
// and /mcp never accepts a draft session or extension token.
import { actorOf } from "../services/actor.js";
import crypto from "node:crypto";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  OAuthError, HOSTS, registerClient, validateAuthorize, issueCode, tokenGrant, revokeToken, verifyAccessToken, isAdminUser,
  listConnections, revokeConnection, protectedResourceMetadata, authorizationServerMetadata, isLoopbackCallback,
} from "../services/byom/oauthServer.js";
import { refusalFor, userEnabled, setUserEnabled, usedToday, dailyCap, globalEnabled, enabledFor, hostEnabled, callsLastHour,
  CALLS_PER_HOUR, adminSettings, writeAdminSettings } from "../services/byom/policy.js";
import { createByomTools, ToolRefusal, LEGACY_TOOL_NAMES } from "../services/byom/tools.js";
import { renderConsentPage, renderConsentMessage, renderAdminRefusal } from "../services/byom/consentPage.js";
import { seedReviewerDemo, resetReviewerDemo, DemoError, DEMO_USERNAME } from "../services/reviewerDemo.js";
import { ensureCimdClient } from "../services/byom/cimd.js";
import { writeAudit } from "../services/userAdmin.js";

// ⛔ D86 COMPLIANCE (10-09): the server sends NO `instructions` at initialize. Anthropic's Software Directory
// Policy §2F forbids a connector making Claude pull behavioural instructions from an external source at
// runtime; the "how to write it" guidance is a static Skill in the separate public plugin repository
// (draft-plugin). Tool descriptions and result lines say what happened, never what to do next —
// test/d86ConnectorCompliance.test.js lints every string the connector speaks.
export const SERVER_INFO = Object.freeze({ name: "draft", version: "1.1.0" });

// One row per call: the tool, the job it was about, the outcome and refusal CODES — never résumé text.
const audit = (db, { userId, connectionId, tool, outcome, detail = null, jobId = null }) => {
  try {
    db.prepare("INSERT INTO mcp_audit (user_id, connection_id, tool, job_id, outcome, detail) VALUES (?,?,?,?,?,?)")
      .run(userId ?? null, connectionId ?? null, String(tool).slice(0, 64), jobId == null ? null : String(jobId).slice(0, 200),
        outcome, detail ? String(detail).slice(0, 200) : null);
  } catch { /* an audit write never fails the call it records */ }
};

const toolResult = (structured, lead) => ({ content: [{ type: "text", text: `${lead}\n${JSON.stringify(structured)}` }], structuredContent: structured });
const toolRefusal = (code, message, extra = {}) => ({ isError: true, content: [{ type: "text", text: `${message}\n${JSON.stringify({ error: code, message, ...extra })}` }],
  structuredContent: { error: code, message, ...extra } });

// The text a host shows. The sketch's result is a card — score, base → tailored, Open in draft; a host
// that renders no widget shows this line: what happened, in plain words.
const LEADS = {
  draft_search_jobs: (out) => `${out?.returned ?? 0} of ${out?.total ?? 0} jobs on the candidate's board.`,
  draft_get_job: (out) => `${[out?.title, out?.company].filter(Boolean).join(" · ") || "The job"}.`,
  draft_score_resume_for_job: (out) => out?.score != null ? `Base résumé score: ${out.score}.` : "The posting carries too little signal to score.",
  draft_get_resume_brief: (out) => `Brief for ${[out?.job?.title, out?.job?.company].filter(Boolean).join(" · ") || "the job"}, valid for 30 minutes.`,
  draft_submit_resume_patch: (out) => `Résumé saved to draft — ${[out?.title, out?.company].filter(Boolean).join(" · ")}` +
    `${out?.base_ats_score != null && out?.ats_score != null ? ` · base ${out.base_ats_score} → ${out.ats_score}` : ""} · claims checked. ` +
    `In draft: ${out?.link ?? ""}${out?.warning ? ` ⚠ ${out.warning}` : ""} ${out?.notice ?? ""}`.trim(),
  draft_list_my_resumes: () => "The candidate's saved résumés.",
  draft_list_my_drafts: () => "The candidate's drafted jobs.",
  // D110 P4 (behind BYOM_INTERVIEW_TOOL): what the data is, never what to do with it.
  draft_get_interview_prep: (out) => `Interview practice data for ${[out?.job?.title, out?.job?.company].filter(Boolean).join(" · ") || "the job"}.`,
};
const SUBMIT = "draft_submit_resume_patch";
/** An audit row's tool under its current name — rows written before the v1 catalogue carry the old ones. */
const toolName = (t) => LEGACY_TOOL_NAMES[t] || t;

/**
 * @param {{ db, deps, issuerFor(req), production, requireAuth, requireAdmin, log? }} opts
 *   deps — services/byom/tools.js's dependencies (jobFor, baseFor, scoreText, storeResume, claimCheck, vocabulary, notify)
 */
export function createByomRouters({ db, deps, issuerFor, production = true, requireAuth, requireAdmin, log = console, cimdFetch = globalThis.fetch }) {
  const resourceFor = (req) => `${issuerFor(req)}/mcp`;
  const tokenRouter = express.Router();
  const sessionRouter = express.Router();
  const oauthError = (res, e) => {
    if (e instanceof OAuthError) return res.status(e.status).json(e.toJSON());
    log.error?.("[byom] oauth error:", e?.message);
    return res.status(500).json({ error: "server_error", error_description: "Something went wrong on draft's side." });
  };

  // ── METADATA (RFC 9728, RFC 8414). The protected-resource document is served at both the root form and
  // the path-inserted form for /mcp, because clients look in either place.
  const prm = (req, res) => res.json(protectedResourceMetadata({ issuer: issuerFor(req), resource: resourceFor(req) }));
  tokenRouter.get("/.well-known/oauth-protected-resource", prm);
  tokenRouter.get("/.well-known/oauth-protected-resource/mcp", prm);
  // OpenAI's plugin portal verifies the MCP host by fetching its exact token from this path. The owner sets
  // OPENAI_APPS_CHALLENGE when the portal shows the token; until then the path is 404.
  tokenRouter.get("/.well-known/openai-apps-challenge", (_req, res) => {
    const token = String(process.env.OPENAI_APPS_CHALLENGE || "").trim();
    if (!token) return res.status(404).type("text/plain").send("not configured");
    res.set("Cache-Control", "no-store").type("text/plain").send(token);
  });
  tokenRouter.get("/.well-known/oauth-authorization-server", (req, res) => res.json(authorizationServerMetadata({ issuer: issuerFor(req) })));

  tokenRouter.post("/oauth/register", express.json({ limit: "16kb" }), (req, res) => {
    try { res.status(201).json(registerClient(db, req.body, { production })); } catch (e) { oauthError(res, e); }
  });
  const formOrJson = [express.urlencoded({ extended: false, limit: "16kb" }), express.json({ limit: "16kb" })];
  tokenRouter.post("/oauth/token", formOrJson, (req, res) => {
    res.set("Cache-Control", "no-store");
    try { res.json(tokenGrant(db, req.body || {}, { resource: resourceFor(req) })); } catch (e) { oauthError(res, e); }
  });
  tokenRouter.post("/oauth/revoke", formOrJson, (req, res) => {
    try { revokeToken(db, req.body?.token); } catch { /* RFC 7009: always 200 */ }
    res.status(200).end();
  });

  // ── /mcp — stateless Streamable HTTP, one server per request (the tools service's pattern).
  const { handlers, defs, jobIdOf } = createByomTools(deps);
  const served = defs.map(({ scope, justification, ...t }) => ({ ...t, securitySchemes: [{ type: "oauth2", scopes: [scope] }] }));
  const scopeOf = Object.fromEntries(defs.map(d => [d.name, d.scope]));

  function unauthorized(req, res, description = "A draft access token is required.") {
    res.set("WWW-Authenticate", `Bearer resource_metadata="${issuerFor(req)}/.well-known/oauth-protected-resource/mcp", error="invalid_token", error_description="${description}"`);
    return res.status(401).json({ error: "invalid_token", error_description: description });
  }

  // ⛔ D86 §5 / the MCP transport rule: validate Origin (DNS-rebinding defence). A host's server-to-server call
  // carries none and passes; a browser page may call only from draft itself or a known host's origin.
  const allowedOrigins = (req) => new Set([new URL(issuerFor(req)).origin, ...Object.values(HOSTS).flatMap(h => h.origins)]);
  tokenRouter.post("/mcp", (req, res, next) => {
    const origin = req.get("origin");
    if (origin && !allowedOrigins(req).has(origin)) return res.status(403).json({ error: "forbidden_origin", error_description: "Requests from this origin are not accepted." });
    next();
  }, express.json({ limit: "512kb" }), async (req, res, next) => {
    const bearer = (req.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
    const auth = verifyAccessToken(db, bearer, { resource: resourceFor(req) });
    if (!auth) return unauthorized(req, res);

    const server = new Server({ ...SERVER_INFO }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: served }));
    server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      const name = String(params?.name ?? "");
      if (!Object.hasOwn(handlers, name)) throw new McpError(ErrorCode.InvalidParams, `unknown tool: ${name.slice(0, 64)}`);
      const args = params.arguments ?? {};
      // The job the call is about, for the activity list: named directly, or inside the signed brief.
      let jobId = null;
      try { jobId = jobIdOf(args); } catch { jobId = null; }
      const who = { userId: auth.userId, connectionId: auth.connectionId, jobId };
      // Every switch, every call: Disconnect, the master switch and the global switch stop the NEXT call.
      const off = refusalFor(db, { userId: auth.userId, host: auth.host });
      if (off) { audit(db, { ...who, tool: name, outcome: "denied", detail: off.code }); return toolRefusal(off.code, off.message); }
      if (!auth.scopes.includes(scopeOf[name])) {
        audit(db, { ...who, tool: name, outcome: "denied", detail: "insufficient_scope" });
        return toolRefusal("insufficient_scope", "This connection was not allowed to save résumés. Reconnect draft and allow \"Save résumés\".");
      }
      if (callsLastHour(db, auth.userId) >= CALLS_PER_HOUR) {
        audit(db, { ...who, tool: name, outcome: "denied", detail: "rate_limited" });
        return toolRefusal("rate_limited", `Too many calls in the last hour (limit ${CALLS_PER_HOUR}). Try again later.`);
      }
      try {
        const out = await handlers[name](who, args);
        audit(db, { ...who, tool: name, outcome: "ok",
          detail: name === SUBMIT ? `${out?.base_ats_score ?? "–"}→${out?.ats_score ?? "–"}` : null });
        return toolResult(out, LEADS[name](out));
      } catch (e) {
        if (e instanceof ToolRefusal) {
          audit(db, { ...who, tool: name, outcome: "refused", detail: [e.code, ...(e.extra?.reasons || []).map(r => r.code)].join(",") });
          return toolRefusal(e.code, e.message, e.extra);
        }
        audit(db, { ...who, tool: name, outcome: "error", detail: e?.code || e?.name });
        log.error?.("[byom] tool failed:", name, e?.message);
        return toolRefusal("internal_error", "draft failed on its side. Nothing was saved.");
      }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) { next(e); }
  });
  tokenRouter.all("/mcp", (_req, res) => res.status(405).set("Allow", "POST").json({ error: "method_not_allowed" }));

  // ── THE CONSENT SCREEN — draft's own page, on draft's own session. No password goes to the host.
  const consentHeaders = (res, redirectUri) => {
    let target = "";
    try { target = redirectUri ? ` ${new URL(redirectUri).origin}` : ""; } catch { target = ""; }
    res.set({ "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'${target}; frame-ancestors 'none'; base-uri 'none'`,
      "X-Frame-Options": "DENY", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  };
  const redirectWith = (res, redirectUri, params) => {
    const u = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    return res.redirect(302, u.toString());
  };

  sessionRouter.get("/oauth/authorize", async (req, res) => {
    let a;
    try {
      await ensureCimdClient(db, req.query?.client_id, { fetchImpl: cimdFetch, production });
      a = validateAuthorize(db, req.query, { resource: resourceFor(req) });
    }
    catch (e) {
      if (e instanceof OAuthError && e.redirectUri) return redirectWith(res, e.redirectUri, { error: e.error, error_description: e.message, state: e.state, iss: issuerFor(req) });
      consentHeaders(res, null);
      return res.status(400).type("html").send(renderConsentMessage({ title: "This connection link is not valid", body: e.message }));
    }
    // A draft cookie session only — an extension's or the phone app's token cannot grant a connection.
    if (!req.isAuthenticated?.()) {
      return res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    // ⛔ D95 (owner 10-12: the Claude connection bound to the admin, because the browser held an admin session):
    // an administrator account is REFUSED here, plainly, with one way on — a personal account, back to this screen.
    if (req.user?.isAdmin || isAdminUser(db, req.user?.id)) {
      req.session.byomConsent = { nonce: crypto.randomUUID(), query: { ...req.query }, at: Date.now(), refused: "admin" };
      consentHeaders(res, null);
      let adminWho = null;
      try { adminWho = db.prepare("SELECT email FROM user_profile WHERE user_id = ?").pluck().get(req.user.id) || null; } catch { adminWho = null; }
      return res.status(403).type("html").send(renderAdminRefusal({ who: adminWho || req.user?.username || "" }));
    }
    const host = a.client.host;
    const unavailable = !globalEnabled(db) ? "Writing résumés with your own model is switched off on draft right now."
      : !enabledFor(db, req.user.id) ? "Writing résumés with your own model is switched off for this draft account. draft support can say why."
      : !hostEnabled(db, host) ? `draft is not accepting connections from ${HOSTS[host]?.label ?? "this app"} right now.` : null;
    const nonce = crypto.randomUUID();
    req.session.byomConsent = { nonce, query: { ...req.query }, at: Date.now() };
    consentHeaders(res, a.redirectUri);
    let email = null;
    try { email = db.prepare("SELECT email FROM user_profile WHERE user_id = ?").pluck().get(req.user.id) || null; } catch { email = null; }
    res.type("html").send(renderConsentPage({
      host, hostLabel: isLoopbackCallback(a.redirectUri) ? "Claude Code on this computer" : HOSTS[host]?.label ?? "A local test client", who: email, username: req.user?.username ?? "",
      scopes: a.scope.split(" "), userOn: userEnabled(db, req.user.id), unavailable, nonce,
      // The MCP authorization spec: show the redirect URI's host clearly, and warn when it is a loopback address.
      returnHost: (() => { try { return new URL(a.redirectUri).host; } catch { return ""; } })(), loopback: isLoopbackCallback(a.redirectUri),
    }));
  });

  sessionRouter.post("/oauth/authorize", express.urlencoded({ extended: false, limit: "8kb" }), (req, res) => {
    const pending = req.session?.byomConsent;
    consentHeaders(res, null);
    if (!req.isAuthenticated?.() || !pending || pending.nonce !== req.body?.nonce || Date.now() - pending.at > 10 * 60 * 1000) {
      return res.status(400).type("html").send(renderConsentMessage({ title: "This consent screen has expired", body: "Go back to the app and connect draft again." }));
    }
    if (pending.refused === "admin" || req.user?.isAdmin || isAdminUser(db, req.user?.id)) {
      return res.status(403).type("html").send(renderAdminRefusal({ who: req.user?.username || "" }));
    }
    delete req.session.byomConsent;
    let a;
    try { a = validateAuthorize(db, pending.query, { resource: resourceFor(req) }); }
    catch (e) { return res.status(400).type("html").send(renderConsentMessage({ title: "This connection link is not valid", body: e.message })); }
    const iss = issuerFor(req);
    if (req.body.decision !== "allow") return redirectWith(res, a.redirectUri, { error: "access_denied", error_description: "The user chose Not now.", state: a.state, iss });
    if (["feature_off", "account_off"].includes(refusalFor(db, { userId: req.user.id, host: a.client.host })?.code) || !hostEnabled(db, a.client.host)) {
      return redirectWith(res, a.redirectUri, { error: "access_denied", error_description: "This is switched off on draft.", state: a.state, iss });
    }
    if (!userEnabled(db, req.user.id)) {
      if (req.body.turn_on !== "1") return redirectWith(res, a.redirectUri, { error: "access_denied", error_description: "Writing résumés with your own model is off in draft's settings.", state: a.state, iss });
      setUserEnabled(db, req.user.id, true);
    }
    // Saving is the user's choice on the screen; reading is required (the brief is the whole point).
    const granted = a.scope.split(" ").filter(s => s === "resume:read" || (s === "resume:write" && req.body.allow_write === "1"));
    if (!granted.includes("resume:read")) granted.push("resume:read");
    const { code } = issueCode(db, { userId: req.user.id, client: a.client, redirectUri: a.redirectUri, scope: granted.sort().join(" "),
      codeChallenge: a.codeChallenge, resource: a.resource });
    audit(db, { userId: req.user.id, tool: "connect", outcome: "ok", detail: a.client.host });
    return redirectWith(res, a.redirectUri, { code, state: a.state, iss });
  });

  // "Not you?" — sign out and come back to the same consent screen after signing in.
  sessionRouter.post("/oauth/switch-account", express.urlencoded({ extended: false, limit: "8kb" }), (req, res) => {
    const back = req.session?.byomConsent?.query;
    const next = back ? `/oauth/authorize?${new URLSearchParams(back).toString()}` : "/app";
    req.logout?.(() => req.session?.destroy?.(() => res.redirect(302, `/login?next=${encodeURIComponent(next)}`)));
  });

  // ── SETTINGS → CONNECTED APPS (the person's own).
  // The sketch's activity table: When · App · What (the job's title and company — never résumé text) ·
  // Result. A refused submit that a later submit for the same job saved reads "Fixed and resent".
  const activityFor = (userId) => db.prepare(`SELECT a.tool, a.outcome, a.at, a.detail, cl.host, sj.title, sj.company,
        (a.tool IN ('submit_resume', '${SUBMIT}') AND a.outcome = 'refused' AND EXISTS (SELECT 1 FROM mcp_audit b WHERE b.user_id = a.user_id
          AND b.job_id = a.job_id AND b.tool IN ('submit_resume', '${SUBMIT}') AND b.outcome = 'ok' AND b.id > a.id)) AS fixed
      FROM mcp_audit a
      LEFT JOIN oauth_connections oc ON oc.id = a.connection_id LEFT JOIN oauth_clients cl ON cl.client_id = oc.client_id
      LEFT JOIN scraped_jobs sj ON sj.job_id = a.job_id
      WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 20`).all(userId)
    .map(r => ({ ...r, tool: toolName(r.tool) }))
    .map(r => ({ ...r, fixed: !!r.fixed, detail: r.tool === SUBMIT && r.outcome === "ok" ? r.detail : (r.detail || "").split(",")[1] || r.detail || null }));

  sessionRouter.get("/api/byom", requireAuth, (req, res) => {
    const userId = req.user.id;
    res.json({
      available: globalEnabled(db),
      hosts: Object.fromEntries(Object.entries(HOSTS).map(([h, v]) => [h, { label: v.label, enabled: hostEnabled(db, h) }])),
      enabled: userEnabled(db, userId),
      usedToday: usedToday(db, userId), dailyCap: dailyCap(db, userId), accountEnabled: enabledFor(db, userId),
      connections: listConnections(db, userId),
      activity: activityFor(userId),
      connectorUrl: resourceFor(req),
      privateTesting: true,
    });
  });
  sessionRouter.put("/api/byom", requireAuth, express.json(), (req, res) => {
    if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ error: "enabled must be true or false" });
    setUserEnabled(db, req.user.id, req.body.enabled);
    res.json({ ok: true, enabled: req.body.enabled });
  });
  sessionRouter.delete("/api/byom/connections/:id", requireAuth, (req, res) => {
    const ok = revokeConnection(db, req.user.id, Number(req.params.id));
    if (ok) audit(db, { userId: req.user.id, connectionId: Number(req.params.id), tool: "disconnect", outcome: "ok" });
    res.status(ok ? 200 : 404).json({ ok });
  });
  // The résumé button's status line: the newest brief for this job, in four steps.
  // `since` (unix seconds): only a brief made after the user pressed "Write it in …" — an older finished
  // one must not read as this attempt's "Done".
  sessionRouter.get("/api/byom/status/:jobId", requireAuth, (req, res) => {
    const since = Number.isFinite(Number(req.query.since)) ? Number(req.query.since) : 0;
    const b = db.prepare("SELECT * FROM byom_briefs WHERE user_id = ? AND job_id = ? AND created_at >= ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
      .get(req.user.id, String(req.params.jobId), since);
    if (!b) return res.json({ status: "none" });
    const expired = b.status === "open" && b.expires_at <= Math.floor(Date.now() / 1000);
    const status = b.status === "used" ? "done" : b.status === "exhausted" ? "closed" : expired ? "expired" : b.last_refusal ? "refused" : "waiting";
    const row = b.status === "used" ? db.prepare("SELECT ats_score FROM resume_versions WHERE user_id = ? AND job_id = ? AND version = ?").get(req.user.id, b.job_id, b.resume_version) : null;
    const refusal = b.last_refusal ? JSON.parse(b.last_refusal) : [];
    res.json({ status, attempts: b.attempts, reasons: refusal.map(r => r.message), terms: refusal.filter(r => r.term).map(r => r.term),
      atsScore: row?.ats_score ?? null, baseAtsScore: b.base_ats_score });
  });

  // ── ADMIN → SYSTEM → PLUGIN (the operator). Numbers and recent calls — never résumé content.
  sessionRouter.get("/api/admin/byom", requireAdmin, (_req, res) => {
    const week = Math.floor(Date.now() / 1000) - 7 * 86400;
    const used = db.prepare("SELECT attempts FROM byom_briefs WHERE status = 'used' AND used_at >= ?").pluck().all(week);
    res.json({
      settings: adminSettings(db),
      numbers: {
        usersConnected: db.prepare("SELECT COUNT(DISTINCT user_id) FROM oauth_connections WHERE revoked_at IS NULL").pluck().get(),
        usersOn: db.prepare("SELECT COUNT(*) FROM users WHERE byom_enabled = 1").pluck().get(),
        resumesThisWeek: used.length,
        firstTimePass: used.length ? Math.round(100 * used.filter(a => a === 1).length / used.length) : null,
        refusedThenFixed: used.filter(a => a > 1).length,
        closedAfterThree: db.prepare("SELECT COUNT(*) FROM byom_briefs WHERE status = 'exhausted' AND created_at >= ?").pluck().get(week),
      },
      // ⭐ D86/D88 follow-up (owner 10-12): each live connection by the ACCOUNT'S EMAIL, with the host and when it was
      // last used — not a bare user id. An admin row is marked, so a connection that should never exist is plain to see.
      connections: (() => { try { return db.prepare(`SELECT oc.id, oc.user_id AS userId, u.username, COALESCE(u.is_admin, 0) AS isAdmin, p.email, cl.host,
          oc.created_at AS connectedAt, oc.last_used_at AS lastUsedAt
        FROM oauth_connections oc JOIN users u ON u.id = oc.user_id LEFT JOIN user_profile p ON p.user_id = oc.user_id
        LEFT JOIN oauth_clients cl ON cl.client_id = oc.client_id
        WHERE oc.revoked_at IS NULL ORDER BY COALESCE(oc.last_used_at, oc.created_at) DESC LIMIT 200`).all()
        .map(r => ({ ...r, isAdmin: !!r.isAdmin, hostLabel: HOSTS[r.host]?.label ?? r.host ?? "unknown" })); } catch { return []; } })(),   // a schema without profiles
      recent: db.prepare(`SELECT a.at, u.username, a.tool, a.outcome, a.detail FROM mcp_audit a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.id DESC LIMIT 50`).all().map(r => ({ ...r, tool: toolName(r.tool) })),
    });
  });
  // ⭐ D86 §6 · the reviewer account: create it (a password is needed the first time) or reset it after a review's
  // destructive tests. Synthetic data only (services/reviewerDemo.js); every use is in the admin audit log.
  sessionRouter.post("/api/admin/byom/reviewer", requireAdmin, express.json({ limit: "4kb" }), (req, res) => {
    const action = req.body?.action;
    if (!["seed", "reset"].includes(action)) return res.status(400).json({ error: "action must be seed or reset" });
    try {
      const out = action === "reset" ? resetReviewerDemo(db, { actorId: actorOf(req) })
        : seedReviewerDemo(db, { password: req.body?.password || null, actorId: actorOf(req) });
      try { writeAudit(db, { actorId: actorOf(req), action: `reviewer.${action}`, target: `user:${out.userId}`, reason: "reviewer account (D86 §6)" }); } catch { /* audit table absent in a bare test db */ }
      res.json({ ok: true, ...out, username: DEMO_USERNAME });
    } catch (e) {
      if (e instanceof DemoError) return res.status(409).json({ error: e.message });
      log.error?.("[byom] reviewer account:", e?.message);
      res.status(500).json({ error: "The reviewer account could not be prepared." });
    }
  });
  sessionRouter.put("/api/admin/byom", requireAdmin, express.json(), (req, res) => {
    try { res.json({ ok: true, settings: writeAdminSettings(db, req.body || {}) }); }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });

  return { tokenRouter, sessionRouter };
}
