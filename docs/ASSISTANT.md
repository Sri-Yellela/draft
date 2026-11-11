# The assistant (T5 / D177) — the rules it is built to

D173 (2) and (3), written before any assistant code exists (owner 11-06: "before T5 is built"). Every assistant
change is reviewed against this page. Where a rule is already enforced in code, the file is named.

## 1 · Security model — D173 (2)

| Rule | What it means in code |
|---|---|
| **Scoped to the one user** | Every tool takes the signed-in user's id from the **session on the server** (`req.user.id`), never from the model's arguments. A tool reads and changes only what that person can through the ordinary API. No tool takes a `userId` parameter. |
| **Least privilege** | A tool does one thing. Reading (`read.*`) and acting (`act.*`) are separate tools. There are no admin tools, no SQL, no file system, no network fetches of arbitrary URLs. |
| **Namespaced** | Tool names are `read.<area>.<thing>` / `act.<area>.<verb>` and unique (a registry refuses a duplicate). |
| **Every action confirmed** | An `act.*` tool never runs from the model's output alone: the model PROPOSES (`assistant.plan_action`, `shared/modelTasks.js`), the person presses **Confirm** in the panel, and the server runs it with the person's session (D160 P2). |
| **An audit log the person can see** | Each confirmed action is written with who, what, when and the result, and listed in Profile → Privacy. |
| **Never another user's or admin data** | Retrieval reads public Atlas material and the person's own rows only. |
| **Untrusted text is data** | The question and anything retrieved are fenced: `callTask` refuses `assistant.*` tasks whose `untrusted` kinds (`question`, `retrieved`) are not inside `<untrusted_…>` blocks (`services/modelGateway.js`, `services/untrustedText.js`, D173 (1)). |
| **Restricted sources never sent** | `callTask({ sources })` refuses register sources whose AI terms forbid it (D176-5, `services/atlas/sourceRegistry.js`). |

## 2 · Memory, three kinds — D173 (3)

| Kind | What | Kept |
|---|---|---|
| **Short-term** | the current conversation | in the browser / request only; discarded when the panel closes |
| **Structured** | the Profile, the base résumé, D165's saved answers | the source of truth, edited by the person; the assistant reads it FIRST |
| **Long-term** | past conversations and applications the assistant may recall | **opt-in**, with an **expiry** (90 days), deletable at once; off by default |

A recalled conversation is never treated as fact over the Profile: when they disagree, the Profile wins and the
assistant says so.

## 3 · What is built (v1, 11-11 46e — owner 11-10: "OK ship it")

- `services/assistant/assistant.js`: retrieval (published Atlas lessons, `content/assistant/help.json`, the person's own
  skills and application counts), ONE fenced `assistant.chat` call, the answer checked (`checkModelOutput`; lessons only
  from what was retrieved), at most one PROPOSED action from `ACT_TOOLS` (v1: `act.skills.add`) stored in
  `assistant_actions` and run only on `POST /api/assistant/actions/:id/confirm` with the session's user id.
- The ask log (`assistant_asks`, migration 271): de-identified, no user id, only while the person's *Use my questions to
  improve Atlas* is on (Ask draft's panel and Profile → Privacy). The privacy page carries a PLACEHOLDER line until counsel's.
- Admin → Atlas → Asks: coverage, the top gap terms → the content backlog, and the switch that opens Ask draft to everyone
  (admins always have it; `app_settings.assistant_enabled`, default off).
- Long-term memory (recalling past conversations): NOT built — off, as §2 requires by default.
- The eval set `content/assistant/eval-v1.json` (50 cases) and `scripts/assistantEval.mjs` (spends; `--spend`). The
  incumbent route (Haiku) needs no record to serve; the run is the evidence for opening it to everyone.

## 3b · What waits on whom (as written before v1)

- The panel's design and Admin → Atlas → Asks: **the owner's sketch** (D177: "sketch first").
- The ask log (D177-3): **one privacy-page line** and the *Don't use my questions to improve Atlas* switch, before any
  question is stored.
- The model task `assistant.chat`: **its evaluation set passes** (D162 G3 — `services/modelEvals.js`) before it serves
  anyone; it is `planned` until then.
