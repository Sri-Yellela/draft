# Decks v4 — software engineering, Case studies (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 6 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v4" (or name the decks to change).

## sw-c-01 · A URL shortener
*Skills:* system design, hashing, caching · *Check yourself:* sw-c-01-q1

**1. What it is — Long links in, short links out**
- Given a long URL, return a short code (sho.rt/aZ3k9); visiting the code redirects to the long URL.
- Reads vastly outnumber writes: a link is made once and followed many times.

**2. Core ideas — Codes, storage, redirects**
- Make codes from a counter encoded in base 62 (a–z, A–Z, 0–9): seven characters give over 3 trillion codes, with no collisions to check.
- Hashing the URL instead needs a collision check, but the same URL always gets the same code.
- Store code → URL in a key-value store; the lookup is a single read by key.
- Redirect with 301 (permanent, browsers cache it) or 302 (temporary, every visit reaches you, so you can count clicks).

**3. The trade-offs — Speed, counting, abuse**
- A single counter is a bottleneck across many servers; hand each server a block of numbers to use.
- Sequential codes are guessable; shuffle or salt them if links should be hard to enumerate.
- Short links hide where they lead, which attackers use; check targets against block lists.

**4. In practice — What it looks like**
- A cache in front of the store answers the popular codes; the database sees mostly misses.
- Click counts go to a queue and are aggregated later, so the redirect stays fast.
- Expired or deleted links return 404 or a clear 'removed' page, never a wrong target.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-c-01-q1).** You want to count every click on each short link. Which redirect status should you use?
- 301, because it's permanent — *Browsers cache a 301 and go straight to the target next time, so you miss clicks.*
- ✅ 302, because browsers don't cache it, so every click reaches your server — *Every visit comes back to you to be counted, then redirected.*
- 200 with the target page's HTML — *You'd be serving someone else's page from your domain.*
- 404, then a script redirects — *A 404 tells browsers and search engines the link is broken.*

## sw-c-02 · Chat and message ordering
*Skills:* system design, websockets, ordering · *Check yourself:* sw-c-02-q1

**1. What it is — Messages that arrive in the right order**
- A chat app delivers messages between people in real time and keeps the history.
- Two hard parts: keeping a connection open to every online person, and showing messages in a consistent order.

**2. Core ideas — Connections, sequence, delivery**
- WebSockets keep a two-way connection open, so the server can push a new message instantly.
- Clocks on different machines disagree, so order by a per-conversation sequence number assigned by the server, not by send time.
- Each message is stored first, then fanned out to the participants' connections; offline people get it on reconnect or by push notification.
- Clients send a client-made id with each message, so a resend after a dropped connection isn't stored twice.

**3. The trade-offs — Real time at scale**
- Millions of open connections need many connection servers and a way to find which one holds a given person (a presence registry).
- Big group chats make fan-out expensive; very large groups often pull instead of being pushed to.
- End-to-end encryption protects content but means the server can't search or moderate it.

**4. In practice — What it looks like**
- Connection servers stay thin; a message service stores and orders; a pub/sub layer routes between them.
- Read receipts and typing indicators are separate, lossy streams: missing one doesn't matter.
- History loads with cursor pagination backwards from the newest message.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-c-02-q1).** In a group chat, two people's messages sometimes appear in different orders on different phones. What's the reliable fix?
- Order messages by each phone's local send time — *Phone clocks drift and can be set wrong.*
- ✅ Have the server assign each message a sequence number per conversation, and sort by it everywhere — *One authority numbers the messages, so every device shows the same order.*
- Delay every message by one second — *Delays don't fix disagreeing clocks.*
- Order by message length — *That's not an order anyone meant.*

## sw-c-03 · A news feed
*Skills:* system design, fan-out, ranking · *Check yourself:* sw-c-03-q1

**1. What it is — The latest from everyone you follow**
- A feed shows recent posts from the accounts a person follows, usually ranked, loaded fast and endlessly scrollable.
- The core choice is when to assemble it: when a post is written, or when the feed is read.

**2. Core ideas — Fan-out on write or on read**
- Fan-out on write: when someone posts, add it to each follower's stored feed. Reads are then one fast lookup.
- Fan-out on read: when a person opens the feed, gather recent posts from everyone they follow and merge them. Writes are cheap; reads do the work.
- Most systems mix both: push posts from ordinary accounts, pull at read time from the few accounts with millions of followers.
- Ranking then reorders candidates by predicted interest, not just time.

**3. The trade-offs — Write cost against read speed**
- Pushing one celebrity's post to 50 million feeds is enormous work; pulling it at read time is cheap.
- Stored feeds use a lot of memory; keep only recent items per person and rebuild older pages on demand.
- Ranking keeps people engaged but can hide posts they wanted; give a chronological option.

**4. In practice — What it looks like**
- Feeds are lists of post ids in a fast store (like Redis); the posts themselves are fetched in a batch.
- Cursor pagination, so new posts don't shift pages.
- Deleted or blocked posts are filtered at read time, since they may already be in many stored feeds.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-c-03-q1).** Your feed pushes each new post into every follower's stored feed. An account with 40 million followers posts, and the system falls behind for an hour. What's the usual design fix?
- Add more database disks — *The work is the fan-out, not storage.*
- ✅ Don't push for very large accounts; merge their recent posts into feeds at read time — *The hybrid: push for ordinary accounts, pull for the few huge ones.*
- Limit accounts to 1 million followers — *That's a product restriction, not a design fix.*
- Show that account's posts a day later — *Followers want those posts now.*

## sw-c-04 · Notifications
*Skills:* system design, queues, push · *Check yourself:* sw-c-04-q1

**1. What it is — Telling people, without spamming them**
- A notification system decides who should hear about an event, through which channels (push, email, SMS, in-app), and when.
- Most of the work is restraint: preferences, quiet hours, and not repeating yourself.

**2. Core ideas — Events in, messages out**
- Services emit events ('order shipped'); a notification service turns each into messages per recipient and channel.
- Each channel has its own worker and provider (APNs and FCM for phones, an email provider), behind a queue with retries.
- Templates are filled per person and language; preferences decide which channels are allowed.
- A deduplication key stops the same event notifying someone twice.

**3. The trade-offs — Reach against annoyance**
- More notifications raise short-term engagement and long-term unsubscribes.
- Batching (a daily digest) is calmer but slower.
- Providers fail and rate-limit you; some messages will be late, so time-critical ones need a fallback channel.

**4. In practice — What it looks like**
- A preference centre per person; every email has an unsubscribe link (often a legal requirement).
- Quiet hours by the person's own time zone.
- Delivery is tracked (sent, delivered, opened) to spot a failing channel.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-c-04-q1).** Your email provider has an outage for 20 minutes. What should happen to the password-reset emails requested during it?
- Drop them; people can ask again — *People may not know they need to ask again.*
- ✅ They wait in the queue and are retried with backoff, or sent through a second provider, so each still arrives — *Queued retries (or a fallback provider) deliver every message once the path works.*
- Send them all again every minute — *That floods inboxes with duplicates once it recovers.*
- Show the reset link on screen to anyone who asks — *That lets anyone reset anyone's password.*

## sw-c-05 · Payments and webhooks
*Skills:* payments, webhooks, idempotency · *Check yourself:* sw-c-05-q1

**1. What it is — Money, and being told what happened**
- Apps take payments through a provider. The provider tells your app what happened later, by calling your webhook URL.
- Payments must never be lost or duplicated, so this is where idempotency and reconciliation matter most.

**2. Core ideas — Intents, states, events**
- A payment moves through states: created, requires action (such as 3-D Secure), succeeded, failed, refunded.
- Your server creates the payment with an idempotency key; the result often arrives later as a webhook event.
- Webhooks can arrive late, twice, or out of order: record each event id, and apply only changes that move a payment forward.
- Verify every webhook's signature, so a stranger can't post 'payment succeeded'.

**3. The trade-offs — Fast checkout, slow truth**
- Showing 'paid' as soon as the person returns is friendly but can be wrong; confirm from the provider's state.
- Storing card numbers yourself brings heavy compliance (PCI DSS); let the provider hold them.
- Retries are needed, and every retry must be idempotent.

**4. In practice — What it looks like**
- A ledger table records every money movement; balances are computed from it, never edited in place.
- A daily reconciliation compares your records with the provider's report and flags differences.
- Webhook handlers answer quickly (200) and do the real work from a queue.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-c-05-q1).** Your provider sends the 'payment succeeded' webhook twice, and the order ships twice. What's the fix?
- Ask the provider to stop retrying — *Providers retry by design; you can't rely on exactly once.*
- ✅ Store each webhook event's id, and ignore an event you've already processed — *Recording processed event ids makes the handler idempotent.*
- Ship only orders older than an hour — *A delay doesn't stop the duplicate.*
- Disable webhooks and check payments manually — *Manual checks don't scale and miss things.*

## sw-c-06 · Search
*Skills:* search, inverted index, ranking · *Check yourself:* sw-c-06-q1

**1. What it is — Finding the right few in millions**
- Search turns a few typed words into a ranked list of matching documents, in well under a second.
- A database LIKE '%word%' query scans everything; search engines build an index for words instead.

**2. Core ideas — Index, match, rank**
- An inverted index maps each word to the documents containing it, like the index at the back of a book.
- Text is analysed first: lower-cased, split into words, sometimes reduced to stems (running → run), with synonyms added.
- Matching documents are ranked, often by BM25: rare words that appear often in a short document score highly.
- Filters (price, location) and sorts narrow and order the results; facets count matches per filter value.

**3. The trade-offs — Fresh, relevant, fast**
- The index is a copy of your data, so it lags behind writes; decide how fresh results must be.
- Better relevance (synonyms, typo tolerance, learning from clicks) costs effort and needs measuring.
- Keyword search misses meaning; vector (semantic) search finds related ideas but can miss exact terms, so many systems combine both.

**4. In practice — What it looks like**
- Elasticsearch, OpenSearch or a database's full-text index (Postgres, SQLite FTS) for many apps.
- Writes reach the index through a queue or change-data-capture, not inside the request.
- Track searches that return nothing; they show what people want and can't find.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-c-06-q1).** Searching 5 million job descriptions with WHERE description LIKE '%kubernetes%' takes 8 seconds. What's the standard fix?
- Add a B-tree index on the description column — *A B-tree can't help a pattern that starts with a wildcard.*
- ✅ Use a full-text (inverted) index, so the engine looks the word up instead of scanning every row — *An inverted index goes straight from the word to the documents that contain it.*
- Cache every possible search — *There are too many possible searches to cache them all.*
- Shorten the descriptions — *The scan is still a scan.*
