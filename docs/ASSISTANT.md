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

## 3 · What waits on whom

- The panel's design and Admin → Atlas → Asks: **the owner's sketch** (D177: "sketch first").
- The ask log (D177-3): **one privacy-page line** and the *Don't use my questions to improve Atlas* switch, before any
  question is stored.
- The model task `assistant.chat`: **its evaluation set passes** (D162 G3 — `services/modelEvals.js`) before it serves
  anyone; it is `planned` until then.
