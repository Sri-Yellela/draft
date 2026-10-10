# D86 addendum — the plugin's UI switches (paste into docs/WORKLOG.md, inside D86, **before "PHASE 2 · TEST"**)

**UI — WHERE THE SWITCHES GO** *(owner, 10-09: "add UI-side switches for the plugin and sign-in to OpenAI — show me how and where"; sketch `plugin-ui.html` — ⛔ build to the file, not this prose).*

⛔ **THE DIRECTION OF SIGN-IN IS THE REVERSE OF WHAT WAS ASKED, AND THE UI SAYS SO.** **There is NO "Sign in with OpenAI" button in draft.** The user **adds draft's plugin INSIDE ChatGPT**; **ChatGPT sends them to draft's own consent screen** (OAuth 2.1). draft cannot sign in to a user's OpenAI account to use their subscription. **Phase 0 must confirm that OpenAI offers no "sign in with ChatGPT to use my plan" route for third-party apps** (one exists for OpenAI's own tools; assume none for us). So draft's UI **controls and shows** the connection, and **meets the user where they are.**

## Five placements

1. **SETTINGS → CONNECTED APPS — the one persistent home.**
   - A one-sentence purpose.
   - **ONE master switch, OFF by default** — *"Write my résumés in ChatGPT or Claude"*. **Nothing connects until it is on.**
   - **Number boxes:** résumés written this way today (x / 50) · apps connected.
   - **ONE plain sentence on the screen:** *what an app can do* (read the base résumé and claims; save a résumé) · *what it never sees* (contact details, passwords, applications, other jobs) · *what leaves draft* (the résumé content and the job description, **under the user's own account and the provider's terms**).
   - **A plain card per host** (ChatGPT, Claude):
     - **Not connected** → *"How to connect — you do this in ChatGPT, not here"*, three steps, **Open ChatGPT to connect** and **Copy the plugin link**. While in private testing, a **"private testing" notice that must vanish when the plugin is published.**
     - **Connected** → last used, how many résumés, **Disconnect** (*stops its next call at once*).
   - **A Recent-activity list** — the per-call audit, in plain words, **no résumé content.**

2. **THE RÉSUMÉ BUTTON — the point of use.** In the posting panel's sticky action bar (D48 / D49) the **Résumé control becomes a SPLIT BUTTON** — one click is the default; the caret chooses:
   - **Write it with draft** (*uses a draft credit*) · **Write it in ChatGPT** (*free to you — your own ChatGPT*) · **Write it in Claude** · a link to Settings if the apps are off.
   - **A four-step status that updates ITSELF while the user is in the chat:** *Open ChatGPT → Waiting for your résumé… → Checks → Done.*
   - A guard refusal shows **in plain words and says "Nothing was saved"**.
   - The result: ***Résumé ready · base 62 → 78 · claims checked***, with View and Download.
   - ⚠ *"Open ChatGPT" with the request pre-filled depends on ChatGPT accepting a prefilled prompt link — Phase 0 confirms; otherwise the button COPIES the request.* In the narrow (icon) layout the choice sits in a menu.

3. **INSIDE CHATGPT / CLAUDE — what the plugin looks like.** Tool calls as labelled boxes with a read-only / write mark; a guard refusal the model explains; the result as a **card** — score, base → tailored, **Open in draft**, **Download PDF**. ⛔ **The tool descriptions and the refusal text are written so ANY model explains them plainly.**

4. **THE CONSENT SCREEN — draft's own page, where "sign in" really happens** (draft's session; **no password goes to ChatGPT**):
   - *"ChatGPT wants to connect to your draft account"* · **signed in as … · Not you?**
   - **Explicit scopes** (read the base résumé and claims — *required*; save résumés) **and an on-screen *Never* list**, **the privacy sentence**, **Allow / Not now.**
   - ⛔ **If the Connected-apps switch is OFF, the consent screen says so and offers to turn it on — it never fails silently.**

5. **ADMIN → SYSTEM → PLUGIN — the operator (D83's six rules).**
   - A purpose sentence · **numbers:** users connected · résumés this week · **the share that passed the claim check first time** · refused-and-fixed.
   - **A GLOBAL FEATURE SWITCH — the kill switch — that states what happens when it is off.**
   - **A HOST ALLOW-LIST** (ChatGPT, Claude separately) · **a per-user daily cap setting**.
   - **Recent tool calls** (time, user, tool, result — **never content**).

## Tests (each red when removed)
- **The master switch is OFF by default, and no connection works while it is off.**
- **The global switch refuses every tool call, and the Settings card reads "unavailable".**
- **A disabled host cannot connect.**
- **Disconnect stops the very next call.**
- **The consent screen shows the *Never* list and the privacy sentence.**
- **The résumé button's default is unchanged for a user who never enables the feature.**
- **No résumé content appears in the activity list or the admin log.**
