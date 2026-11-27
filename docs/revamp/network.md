Status: M1–M3 done (47j, lane w2-public) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 · #14 — NETWORK → **Correspondence** · M1 inventory + M2 brief

Read from the code on 2026-11-26 (47j, lane *w2-public*, from local `main` `a393442e`). Paths under `client/src/`.
**D180 is BUILT and OFF until counsel** (A169: `app_settings.network_enabled`, `GET /api/network/status` —
`routes/network.js:40`). With the switch off every `/api/network/*` answers 404 `not_available` and the three pages send
the reader to `/app/jobs` (A222). **Nothing live changes in this lane** — M1–M3 only. Mock: **`/dev/plate?page=network`**
(`&w=390`).

Three places in the dock today (46f): **Network** = People (`/app/network`, `pages/network/NetworkPage.jsx`), **Feed**
(`/app/feed`, `FeedPage.jsx` + `FeedPane.jsx` + `FeedDeck.jsx`), **Messages** (`/app/messages`, `MessagesPage.jsx` +
`MessagesPane.jsx`), mounted at `App.jsx:842-844`. Plus the network's reach into other pages: Send a job
(`components/SendJobPicker.jsx`), *N works here → Ask for a referral* (`components/WorksHere.jsx`), the dock's badges
(`components/AppNav.jsx:108-129`, `docs/revamp/shell.md` row *Network · Feed · Messages*), Connect / Message on a public
profile (`/in/<handle>`, server-rendered — Wave 2 #9 *Your passport* owns it).

⛔ **D180's promises hold on every row:** no AI reads messages or posts ("No AI reads your conversations unless you ask" —
and nothing asks); a stranger's link is plain words (never clickable, never fetched); a request stays a request until
accepted; block / report everywhere; proof moments are opt-in, each OFF until turned on; the feed is newest first, never
ranked; suggestions only from public pages that share a workplace or school, never an address book.

---

## 1 · The switch (all three pages)

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | `useNetworkOn()` — null while asking, any failure = off | | networkSwitch.js:6-13 | unchanged (logic, not look) |
| ☐ | Asking: *Opening your network… / feed… / messages…* (`role=status`) | | NetworkPage.jsx:87; FeedPage.jsx:13; MessagesPage.jsx:101 | `plateState` loading (paper skeleton of the letters / the gazetteer) |
| ☐ | Off → `Navigate /app/jobs` (`data-network-off`) | the page is not a place | NetworkPage.jsx:58, 86; FeedPage.jsx:15; MessagesPage.jsx:103 | unchanged — Correspondence isn't drawn at all while off (no "coming soon") |

## 2 · People (`/app/network`, NetworkPage.jsx)

APIs: `GET /api/network` (incoming · connections · outgoing · blocked), `GET /api/network/suggestions`,
`GET /api/network/relation/:handle`, `POST /api/network/request {handle, note}`, `POST /api/network/:handle/<accept|decline|block|remove|withdraw|unblock>`,
`POST /api/network/messages {to, text}`.

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | Header *Network* + *People you know on draft. A request stays a request…* | | :91-94 | the one-line header *Your correspondence* + kicker *CORRESPONDENCE · PEOPLE*; the sentence kept |
| ☐ | Status line (`role=status`) after every action: *Connected. / Declined — they aren't told. / Blocked. / Removed. / Withdrawn. / Unblocked. / Request sent.* | | :73-74, 79, 95 | one `aria-live` line under the header (the plate's caption line) — words verbatim |
| ☐ | Old addresses `?tab=feed` → `/app/feed`, `?tab=messages[&thread=]` → `/app/messages[?thread=]` | notifications, bookmarks | :39-44 | unchanged (the area nav's *Dispatches* / *Letters* are the same addresses) |
| ☐ | `?connect=<handle>` → *Connect with <handle>?* + note (300) + Send request / Not now; or the relation sentence (self / connected / requested / incoming / blocked) | never a silent request | :66-70, 97-111 | a **Ticket**-shaped ask card at the top: kicker *A REQUEST · TO <HANDLE>*, the note field (`pl-textarea`), *Send request* (the page's clay point while it shows) / *Not now* |
| ☐ | `?message=<handle>` → the composer for that person (a request if not connected) | D183 P4 | :64-65, 155-164 | the **Send ticket** composer (below) |
| ☐ | **Requests · N** — name (→ `/in/<handle>`), headline · label · why, the note; Accept / Decline / Block | | :113-123 | **Gazetteer** *Requests* (NAME · WHO · THEIR NOTE · ACT); Accept = ink primary, Decline, Block — `StatusTag` *WAITING ON YOU* |
| ☐ | **Connections · N** — Message / Remove / Block; empty: *No connections yet…* | | :125-135 | **Gazetteer** *Your people* (the gazetteer of people, D197 #14's idea); empty = the dashed drawer with the same sentence |
| ☐ | **Sent · N** — Withdraw | | :137-143 | Gazetteer *Asked, waiting* — Withdraw |
| ☐ | **People you may know** — why line / empty (*only people whose page is public*) / Connect; the footnote *never from an address book* | | :145-154 | Gazetteer *Maybe you know* + the footnote verbatim (a promise, kept on screen) |
| ☐ | Composer *Message <handle>* — *You aren't connected — this arrives as a message request*, 4000 chars, Send / Cancel; on send → the conversation | | :45-52, 155-164 | the **Send ticket**: a perforated card (`pl-card` + the tear) *A LETTER TO <NAME>*, the textarea, *Send* (clay) / *Cancel*; the request sentence kept |
| ☐ | **Blocked · N** — Unblock | | :166-172 | Gazetteer *Blocked* — Unblock |
| ☐ | Person tile (initial), name → `/in/<handle>` | | :12-24 | `LetterTile` + the name link in the gazetteer's NAME column |

## 3 · Feed (`/app/feed`) → **Dispatches**

APIs: `GET /api/network/feed[?before=<id>]`, `POST /api/network/feed {text, link}`, `POST /api/network/feed/:id/helpful {on}`,
`POST /api/network/feed/post/:id/remove`, `GET|POST /api/network/feed/:id/comments`, `POST /api/network/feed/comment/:id/remove`,
`POST /api/network/report {kind, id, reason}`, `GET|PUT /api/network/share`, `GET /api/learn/deck/:id`.

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | Header *Feed* + *never ranked, and no AI reads it* | | FeedPage.jsx:18-21 | area nav view *Dispatches*; the line kept under the header |
| ☐ | Composer *Share with your connections*: text (2000), link (500), Post; *Only your connections see it…* | | FeedPane.jsx:144-156 | a **Send ticket** *A DISPATCH · TO YOUR CONNECTIONS* (text, link, Post) |
| ☐ | Error / status line | | :137, 146, 157 | `aria-live` line; a failed load = `ErrorLine` + Try again |
| ☐ | Empty *Nothing yet. Posts from your connections show up here, newest first.* | | :159 | the dashed drawer, same words |
| ☐ | Post: author tile + name (→ `/in/`) + time | | FeedPane.jsx:73-78 | **CorrespondenceLetter** `kind="dispatch"` — strip *DISPATCH · <NAME>* + the date |
| ☐ | ⋯ menu: *Delete this post* (yours) / *Report this post* (others') | | :79-88 | the card's foot actions *Delete* / *Report* (a `pl-menu` drop on a phone) |
| ☐ | Report form: reason select (Spam · Harassment · A scam · Inappropriate · Something else), Report / Cancel; *Reported — a person on draft's team will look at it…* | | :11, 67-70, 95-102 | an inline register-style block under the card: the five reasons as `pl-answer` tickets, *Send the report*; the sentence kept |
| ☐ | Proof moment *Passed the <label> check on Atlas* | opt-in | :90 | a **Stamp** `tone="lit"` (*PASSED · WEBHOOKS*) — the one green on the page (proven) |
| ☐ | Text; **link as plain words** (never fetched) | | :91-92 | the letter's body; the link line `data-letter-link` as text ⛔ |
| ☐ | A shared Library deck plays inline (Read mode, captions, no sound; *Check yourself in the Library*) | D194 P4 | FeedDeck.jsx:41-69; FeedPane.jsx:93 | inside the dispatch: the **FieldNoteCard** poster that opens DeckPlay (Atlas's player, a decided reuse) |
| ☐ | A shared job → card (*Open the job →*) / *This job is no longer open.* | | :13-21, 94 | the letter's job **Ticket** / `NoData` *THIS JOB IS NO LONGER OPEN* |
| ☐ | Helpful (✓, count, `aria-pressed`) on others'; *N found this helpful* on yours | | :62-65, 105-106 | foot action *Helpful · N* (`aria-pressed`) / the mono count |
| ☐ | Comment · N → comments: name link, text, time, Delete (yours) / Report (others'), *Write a comment* (1000) + Comment | | :23-53, 107-109 | under the dispatch, a ruled list (the register's ledger lines) + a small composer |
| ☐ | *Older posts* | paging | :139-143, 161 | a *Older dispatches* button at the end (MarketPager is page-numbered; this stays a "more" button) |
| ☐ | **What you share** — every proof kind, each a checkbox, all OFF to start | opt-in | :114-130; FeedPage.jsx:25 | side column card *WHAT YOU SHARE · ALL OFF TO START* — each kind a `pl-check` row |
| ☐ | Side *Your people* — links to Network and Messages | | FeedPage.jsx:26-29 | the area nav (People · Dispatches · Letters) makes it redundant; ⚠ the owner strikes or keeps the sentence |

## 4 · Messages (`/app/messages`) → **Letters**

APIs: `GET /api/network/messages`, `GET /api/network/messages/:id`, `POST /api/network/messages {to, text | jobId}`,
`POST /api/network/messages/:id/<accept|decline|mute|unmute>`, `POST /api/network/message/:mid/hide`, `POST /api/network/:handle/block`,
`POST /api/network/report`. Live on the sync stream (`network_message`), polled every 15 s as the fallback; opening a
thread fires `rm:network-read` (the dock's count follows).

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | Header *Messages* + *No AI reads your conversations unless you ask. Messages are kept sealed…* | | MessagesPage.jsx:105-109 | area nav view *Letters*; the line kept |
| ☐ | Two columns (list + open thread), phone = one or the other (`?thread=<id>`) | | MessagesPage.jsx:81-97 | the same: the letter list left (a gazetteer of correspondents), the open correspondence right; one at a time below 980 px |
| ☐ | List sections: **Messages** / **Requests · N** / **Waiting for them · N**; row = tile, name, preview, time, unread count (`aria-label`), *muted*; `aria-current` on the open one | | MessagesPane.jsx:141-165 | Gazetteer rows (NAME · LAST LINE · WHEN · UNREAD as `.mark-count`), three groups with the same names |
| ☐ | Empty list *No conversations yet — Send a job from the deck, or write from a connection's page.* | | :159 | dashed drawer, same words |
| ☐ | Nothing open *Pick a conversation, or write to a connection from Network.* | | MessagesPage.jsx:93 | the right column's drawer, same words + link |
| ☐ | Thread head: *‹ All messages*, the name → `/in/`, ⋯ menu: Mute / Unmute · Report the conversation · Block <name> (confirm) | | MessagesPane.jsx:69-82, 58-63 | the correspondence's strip: *‹ ALL LETTERS*, the name, a `pl-menu` with the same three |
| ☐ | *No AI reads this conversation unless you ask.* (`data-no-ai`) | | :83 | kept, mono, under the strip ⛔ |
| ☐ | From a stranger: *<name> isn't a connection. Reply only if you accept — links here aren't clickable.* Accept / Decline / Report | | :84-93 | a **Ticket**-shaped request card at the top of the thread (the clay point while it shows: Accept) |
| ☐ | Messages: text, job card / *no longer open*, *This message was removed.*, time, *Delete for me*, Report (others') | | :94-107 | **CorrespondenceLetter** `kind="letter"` (`mine` on the region tint), `removed` → *THIS MESSAGE WAS REMOVED*; foot: *Delete for me* · *Report* |
| ☐ | Report block: reason + *Send the report*; *Reported — thank you. They aren't told who reported.* | | :109-116, 54-57 | the same inline reasons block as the feed's |
| ☐ | Composer (4000, Ctrl/⌘+Enter sends) or *They haven't accepted yet — one message until they do.* / *Accept the request to reply.* | | :65, 118-124 | the **Send ticket** at the foot of the correspondence; the two sentences kept |
| ☐ | Scrolls to the newest | | :42 | unchanged |

## 5 · The network elsewhere (homes stay where they are; listed so nothing is lost)

| ☐ | Element | file:line | Home |
| --- | --- | --- | --- |
| ☐ | **Send a job** — pick connections + a note → a job card in their messages; for anyone off draft, the public posting link | SendJobPicker.jsx:1-40 | the market's *Send* (D199) and the survey sheet's `sendPicker` slot — drawn as a **Send ticket** (perforated) |
| ☐ | **N works here → Ask for a referral** (edit the message, the job goes with it) | WorksHere.jsx:1-45 | the survey sheet's `worksHere` slot (Wave 1 #4) and the opening sheet |
| ☐ | Dock items + unread badge (polled 60 s) | AppNav.jsx:108-129, 606-615 | the shell (Wave 1 #1) — **proposed:** one dock item *Correspondence* with the unread count, the three as its area nav's views (⚠ owner: the dock's items are D167's and "stay exactly as they are") |
| ☐ | Connect / Message on `/in/<handle>` | server-rendered | Wave 2 #9 *Your passport* |

---

## 6 · M2 — THE BRIEF

**Atlas name:** **Correspondence** — the network as an expedition's letters. Parts: **People** = *the gazetteer of
people* (who you know, where they are, how to reach them) · **Dispatches** = the feed (short reports sent back from the
field) · **Letters** = messages (one correspondence per person) · **the Send ticket** = every composer (a perforated
ticket: write, tear, send) · **a request** = a ticket waiting on the other person.

**Area nav:** `AreaNav area="Correspondence"`, no pill (nothing to open), views *People · Dispatches · Letters* (the three
addresses kept), search *A name or a company…*, the chip = **unread letters** (count) — ⚠ `NavChip` has only *drafts* and *run* kinds;
an *unread* kind is a library addition for M5 (the mock leaves the chip out rather than misuse *drafts*). Profile stays
in the dock.

**Palette:** **Region VI** (*Languages & media*, teal `#2F6B7A`) — the region of language and messages. Clay = the one
action that's yours to take now (Accept on a request; else *Send*). Green = only a proof moment's stamp.

**The single clay point:** the top of the page's queue — a request waiting on you (*Accept*); with none, the open Send
ticket's *Send*.

**Hero plate:** **drawing needed** — *a dispatch rider's route between camps* (your connections as camps on a small inset
map, letters travelling the trail; one live detail: a letter marching along the route) → `UnchartedPlate` in the mock.

**Sections, each one drawing:** 01 *Waiting on you* (requests) — **drawing needed** (*a sealed letter on a doorstep*) ·
02 *Your people* — **drawing needed** (*a gazetteer of camps*; `SurveyTeamDiorama` was considered and is a company's
team, not yours) · 03 *Dispatches* — **drawing needed** (*a notice board of field reports*) · 04 *Letters* — none
beyond the letters themselves (each letter is drawn). All marked as placeholders in the mock; the owner says which to
draw at M4.

**The one operable model:** the **Send ticket** — compose, choose who (a connection or a request), *Send*; it tears along
the perforation into *Sent* (the motion rule: one live detail, it explains). Under reduced motion it simply moves.

**Squares:** none (correspondence isn't proof). The proof moments are stamps on dispatches, not squares.

**Onward tickets:** *Send a job from the market* (`/app/jobs`) · *Who works where you're applying* (the survey sheet) ·
*What you share* (the opt-ins).

**Library pieces:** `CorrespondenceLetter` (new, `plate/Correspondence.jsx`, in the registry: letter · mine · dispatch ·
removed · closed job · extremes) · Gazetteer, Ticket, StatusTag, LetterTile, Stamp, AreaNav, `UnchartedPlate` (all
existing / this lane's).

**Rows whose home is unclear:** the dock — one *Correspondence* item vs today's three (D167 says the dock's items stay) ·
Feed's *Your people* side sentence · whether *Older posts* becomes a pager.

## M5 · What was built (47m, lane public — the 47n record)

- **Network → Correspondence** (D197 #14) from the approved mock: the shared frame (`pages/network/CorrespondenceFrame.jsx`,
  Region VI, the dispatch rider's route); People as gazetteers + Send tickets; Dispatches as `CorrespondenceLetter` cards +
  ReportBlock + the notice board; Letters as gazetteers + the open correspondence + the post rack
  (`plate/Correspondence.jsx`); the shell's Correspondence area nav. `NetworkPage.css` deleted. The Home link says Home (D6).

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).
