// shared/modelTasks.js — ⛔⛔ D162 G1 · TASKS, NOT MODELS: the ONE registry of what draft asks a model to do.
//
// Every model call names a TASK from this file; no feature names a model. The task's default route (provider · model
// · parameters · fallback · budget) lives HERE, beside the task, and the gateway (services/modelGateway.js) lays the
// environment's configuration (MODEL_ROUTES) and the admin's runtime switch (app_settings) over it. Moving a task to
// another model is therefore a configuration change — never an edit to the feature that asks for it.
//
// ⛔ test/d162NoFeatureNamesAModel.test.js fails if a model id (a literal like "claude-…", "gpt-…", "llama-…", or the
// MODEL_HAIKU / MODEL_SONNET constants) appears in shipped code outside this file and shared/anthropicModels.js.
//
// TWO KINDS OF TASK:
//   runsIn "draft"          draft makes the call itself, through callTask (services/modelGateway.js) → callModel. The
//                           gateway routes it.
//   runsIn "tools-service"  the call is made by the résumé tools service (resume-master); draft only NAMES the task where
//                           it asks for one (services/toolsService.js TOOLS_SERVICE_TASKS) and tags the usage records the
//                           service hands back. Its model is chosen in the tools service (RM_TAILOR_PROVIDER, D123 P3) and
//                           by the admin's per-request choice (services/leanTailoring.js modelFor) — not routed here.
//
// status "live" = something calls it today · "planned" = the spec's task (T3 / T5 / T6), registered so its route, budget
// and evaluation exist before its first call (G3: no model takes a task without an evaluation).
//
// ⛔ BEHAVIOUR IS UNCHANGED BY DEFAULT: each live draft task's default route is exactly the model and max_tokens its call
// site sent before D162, with no fallback (a fallback is a configuration choice, not a silent new retry).
import { MODEL_HAIKU, MODEL_SONNET, ANTHROPIC_PRICING, RETIRED_MODELS } from "./anthropicModels.js";

/**
 * Which providers a route may name. Only `callableInDraft` providers can serve a draft task: A87 / D17 keep draft on one
 * transport (test/a87AnthropicOnly.test.js), and open models are reached through the tools service's provider-neutral
 * client (D123 P3), not from draft. `claude` marks a provider whose outputs may NEVER enter a training set (D160 rule 1).
 */
export const PROVIDERS = Object.freeze({
  anthropic:           Object.freeze({ callableInDraft: true,  claude: true }),
  "openai-compatible": Object.freeze({ callableInDraft: false, claude: false,
    why: "draft has one transport (A87 / D17); hosted open models run through the tools service (D123 P3 / P5)" }),
  "self-hosted":       Object.freeze({ callableInDraft: false, claude: false, why: "G5 later: vLLM / SGLang serving is not built" }),
  own:                 Object.freeze({ callableInDraft: false, claude: false, why: "D160: our own fine-tuned model is not built" }),
});

/** Budgets are per call: cost in USD and latency in ms (p50 / p95). Read by the pass rule (G3) and the telemetry (G4). */
const budget = (costPerCallUsd, p50Ms, p95Ms) => Object.freeze({ costPerCallUsd, p50Ms, p95Ms });
const route = (model, params, { fallback = null, b } = {}) => Object.freeze({
  provider: "anthropic", model, params: Object.freeze({ ...params }),
  fallback: fallback ? Object.freeze({ provider: "anthropic", model: fallback, params: Object.freeze({ ...params }) }) : null,
  budget: b,
});

const task = (t) => Object.freeze({ ...t, purposes: Object.freeze([...(t.purposes || [])]) });

// ⛔ D173 (1) tail (45n) · `untrusted` — the kinds of text the task reads that draft did not write and the person did
// not type as an instruction (a posting, an email, a retrieved page, an uploaded file). services/modelGateway.js callTask
// REFUSES such a task unless its messages carry each kind inside services/untrustedText.js's fence (<untrusted_KIND>) —
// so the assistant, an inbox reader or any later reader cannot ship unfenced. A task that reads none says [].
// `purposes` are the usage_events.purpose names the task is recorded under. They are KEPT as they were before D162:
// limitEnforcer, the admin cost panel and ~14 readers of 'resume_generate' key on them, so a task maps onto them rather
// than renaming them. The first purpose is the task's default; a call site may pick another from the same list.
export const TASKS = Object.freeze({
  // ── résumé (T1 / D123) — made by the tools service ──
  "resume.generate":  task({ runsIn: "tools-service", status: "live", evalSet: "resume.d123-harness",
    purposes: ["resume_generate", "standalone_generate", "a_plus_resume", "resume_repair"],
    what: "a tailored résumé from a base résumé and a posting (the full call, and the repair after a guard failure)" }),
  "resume.bullets":   task({ runsIn: "tools-service", status: "live", evalSet: "resume.d123-harness",
    purposes: ["resume_tailor"], what: "the lean bullet / JSON edits (D123 P2 / P6)" }),
  "resume.gist":      task({ runsIn: "tools-service", status: "live", evalSet: "resume.d123-harness",
    purposes: ["resume_gist"], what: "the per-employer gists of a base résumé (D123 P6g)" }),
  "resume.summary":   task({ runsIn: "tools-service", status: "planned", evalSet: "resume.d123-harness",
    purposes: ["resume_summary"], what: "the résumé's summary line" }),
  "resume.enhance":   task({ runsIn: "tools-service", status: "live", evalSet: "resume.d123-harness",
    purposes: ["resume_enhance"], what: "the base-résumé enhancement" }),
  "resume.parse_pdf": task({ runsIn: "tools-service", status: "live", evalSet: "structured.owner-check",
    purposes: ["parse_pdf"], what: "a PDF to résumé text by model (the client stays; /api/parse-pdf reads locally, D17 V1)" }),

  // ── made by draft itself ──
  "cover_letter.write": task({ runsIn: "draft", status: "live", evalSet: "writing.owner-blind-check",
    purposes: ["cover_letter", "cover_letter_apply"], dataClass: "candidate", untrusted: ["posting"],
    what: "a cover letter from the résumé and the posting (/api/cover-letter/generate, the apply path)",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 800 }, { b: budget(0.01, 8_000, 20_000) }) }),
  "profile.domain_chips": task({ runsIn: "draft", status: "live", evalSet: "structured.owner-check",
    purposes: ["domain_chips"], dataClass: "candidate",
    what: "suggested keyword / verb / tool chips for a domain profile (A80 V3, still a known D17 violation)",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 600 }, { b: budget(0.005, 5_000, 15_000) }) }),
  "answers.routine": task({ runsIn: "draft", status: "planned", evalSet: "writing.owner-blind-check",
    purposes: ["answers_routine"], dataClass: "candidate", untrusted: ["posting"], what: "routine application answers (D123 P7)",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 600 }, { b: budget(0.005, 6_000, 15_000) }) }),

  // ── the assistant (T5) ──
  "assistant.chat": task({ runsIn: "draft", status: "live", evalSet: "assistant.retrieval-and-safety",
    purposes: ["assistant_chat"], dataClass: "candidate", untrusted: ["question", "retrieved"], what: "the in-platform assistant's answer, from retrieval",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 1000 }, { fallback: MODEL_SONNET, b: budget(0.01, 4_000, 12_000) }) }),
  "assistant.plan_action": task({ runsIn: "draft", status: "planned", evalSet: "assistant.retrieval-and-safety",
    purposes: ["assistant_plan_action"], dataClass: "candidate", untrusted: ["question"],
    what: "the action the assistant proposes (always confirmed by the user before it runs)",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 600 }, { fallback: MODEL_SONNET, b: budget(0.01, 4_000, 12_000) }) }),

  // ── interview (T6) ──
  "interview.mock": task({ runsIn: "draft", status: "planned", evalSet: "interview.owner-rubric",
    purposes: ["interview_mock"], dataClass: "candidate", what: "the interviewer's next turn in a mock interview",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 500 }, { b: budget(0.005, 2_500, 6_000) }) }),
  "interview.feedback": task({ runsIn: "draft", status: "planned", evalSet: "interview.owner-rubric",
    purposes: ["interview_feedback"], dataClass: "candidate", what: "the written feedback report after a session",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 1500 }, { b: budget(0.02, 10_000, 25_000) }) }),
  "interview.example_answer": task({ runsIn: "draft", status: "planned", evalSet: "interview.owner-rubric",
    purposes: ["interview_example_answer"], dataClass: "candidate",
    what: "a labelled example answer, built from the user's own résumé (D161 reverse mode)",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 800 }, { b: budget(0.01, 6_000, 15_000) }) }),

  // ── Learn (T3) and content ──
  "learn.explain": task({ runsIn: "draft", status: "planned", evalSet: "writing.owner-blind-check",
    purposes: ["learn_explain"], dataClass: "candidate", what: "an explanation of a Learn question or deck",
    defaultRoute: route(MODEL_HAIKU, { max_tokens: 800 }, { b: budget(0.005, 5_000, 12_000) }) }),
  "content.draft_for_review": task({ runsIn: "draft", status: "planned", evalSet: "writing.owner-blind-check",
    purposes: ["content_draft"], dataClass: "candidate",
    what: "decks / questions / Atlas text drafted for the owner to approve — never published unreviewed",
    defaultRoute: route(MODEL_SONNET, { max_tokens: 4000 }, { b: budget(0.1, 60_000, 120_000) }) }),
});

export const TASK_IDS = Object.freeze(Object.keys(TASKS));

/** The registry entry, or throws — an unknown task is a code error, never a silent default. */
export function taskOf(id) {
  const t = Object.prototype.hasOwnProperty.call(TASKS, id) ? TASKS[id] : null;
  if (!t) throw new Error(`D162: unknown model task "${id}". Known: ${TASK_IDS.join(", ")}`);
  return t;
}

/** The task a usage_events.purpose belongs to, or null (a purpose no task claims — shown as "unregistered"). */
export function taskForPurpose(purpose) {
  if (!purpose) return null;
  for (const [id, t] of Object.entries(TASKS)) if (t.purposes.includes(purpose)) return id;
  return null;
}

/** True when `provider` / `model` can be routed at all: a known provider, and for Anthropic a priced, unretired model. */
export function routableModel(provider, model) {
  if (!PROVIDERS[provider] || typeof model !== "string" || !model.trim()) return false;
  if (provider === "anthropic") return Object.prototype.hasOwnProperty.call(ANTHROPIC_PRICING, model) && !RETIRED_MODELS.includes(model);
  return true;
}

/** True when the provider is Anthropic's — its outputs never enter a training set (D160 rule 1, G6). Unknown = true. */
export function isClaudeProvider(provider) {
  return PROVIDERS[provider]?.claude ?? true;
}

/** True when `provider` / `model` is the registry's own default for the task — the incumbent, proven by today's use. */
export function isIncumbent(taskId, provider, model) {
  const d = TASKS[taskId]?.defaultRoute;
  return !!d && d.provider === provider && d.model === model;
}

/** Every Anthropic model the registry pins (defaults and fallbacks) — what the boot catalogue check asks about. */
export function pinnedModelIds() {
  const ids = [];
  for (const t of Object.values(TASKS)) {
    for (const r of [t.defaultRoute, t.defaultRoute?.fallback]) {
      if (r?.provider === "anthropic" && !ids.includes(r.model)) ids.push(r.model);
    }
  }
  return ids;
}
