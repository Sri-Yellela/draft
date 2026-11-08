#!/usr/bin/env node
// ⭐ D155 Part C · decks-v3 — software engineering, Patterns (7 decks), drafted by the agent 2026-11-08 for the owner's
// review. node scripts/decks/decksV3.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const D = (n, title, skills, pieces, slides, q) => deck(`sw-p-0${n}`, "software", "patterns", title, skills, pieces, slides, q);
const Q = (n, skills, pieces, stem, choices, correct, why) => question(`sw-p-0${n}-q1`, "Software Engineer", "mid", skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 3,
  title: "software engineering, Patterns",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'software', stage 'patterns': 7 five-slide decks in Part C's order. Nothing is live until approved (status: draft).",
  decks: [
    D(1, "Idempotency and retries", ["idempotency", "retries"], ["x1"], [
      ["What it is", "Safe to do twice", [
        "An operation is idempotent when doing it twice has the same effect as doing it once: setting a value is, adding to a balance isn't.",
        "Networks fail in the middle, so callers retry. Idempotency is what makes a retry safe."]],
      ["Core ideas", "Keys, backoff, and limits", [
        "An idempotency key is a unique id the caller sends with a request; the server stores the result under that key and returns the same result for a repeat.",
        "Retry only what can fail temporarily (timeouts, 503s), never a request the server rejected as invalid (a 400).",
        "Exponential backoff with jitter (waiting 1 s, 2 s, 4 s … plus a random part) stops many clients retrying in lockstep.",
        "Cap the attempts, and give up with a clear error."]],
      ["The trade-offs", "Storage and time for safety", [
        "Storing keys and results costs space; keep them for as long as a retry could plausibly arrive (often a day).",
        "Retries add load exactly when a system is struggling, so too many retries can turn a slowdown into an outage.",
        "Some side effects can't be undone (an email sent), so record them before or with the action."]],
      ["In practice", "What you'll see at work", [
        "Payment APIs take an Idempotency-Key header on every charge.",
        "Message consumers check 'have I processed this message id?' before acting.",
        "Database writes use upserts or unique constraints so a repeated insert doesn't create a second row."]],
    ], Q(1, ["idempotency", "retries"], ["x1"],
      "A client's 'create payment' request times out, so it retries, and the customer is charged twice. What should the API do?",
      ["Make timeouts longer", "Accept an idempotency key with each request, and return the first result when the same key arrives again",
        "Tell clients never to retry", "Refund any second charge automatically the next day"],
      1, ["A longer timeout makes the double charge rarer, not impossible.", "The repeat is recognised and does nothing new; the client gets the original answer.",
        "Then a real network failure leaves the payment unknown.", "The customer was still charged twice; fixing it later isn't prevention."])),

    D(2, "Rate limiting", ["rate limiting", "throttling"], ["x2"], [
      ["What it is", "Only so many, so fast", [
        "A rate limit caps how many requests a caller may make in a period, protecting the service from overload, abuse and runaway clients.",
        "It also keeps one heavy user from slowing everyone else down."]],
      ["Core ideas", "Buckets and windows", [
        "Token bucket: each caller has a bucket that refills at a steady rate; each request takes a token; an empty bucket means wait. It allows short bursts.",
        "Fixed window counts requests per minute and resets; it's simple but allows double bursts at the boundary. Sliding windows smooth that out.",
        "Limits are keyed by something: an API key, a user, an IP address.",
        "A refused request gets 429 Too Many Requests, ideally with a Retry-After header."]],
      ["The trade-offs", "Fairness against friction", [
        "Too strict and real users hit the limit; too loose and it protects nothing.",
        "Across many servers, counts need a shared store (often Redis), which adds a network call per request.",
        "Limiting by IP address punishes everyone behind one office or mobile network."]],
      ["In practice", "What you'll see at work", [
        "Separate, stricter limits on expensive or sensitive endpoints: sign-in, password reset, search.",
        "Clients honour 429s and Retry-After with backoff instead of hammering.",
        "Limits are documented, so partners can plan for them."]],
    ], Q(2, ["rate limiting"], ["x2"],
      "Your sign-in endpoint is being hit with thousands of password guesses per minute against many accounts. Which limit helps most?",
      ["One global limit for the whole API", "Limits per account and per source on sign-in attempts, with a 429 and a growing wait",
        "No limit; strong passwords are enough", "Block every request without a cookie"],
      1, ["A global limit lets the attack crowd out real users without stopping it.", "Per-account limits stop guessing on one account; per-source limits slow one attacker across many.",
        "Many people reuse weak passwords; guessing works at scale.", "Attackers can get cookies; real first visits have none."])),

    D(3, "Pagination", ["pagination", "api design"], ["x2"], [
      ["What it is", "One page at a time", [
        "Pagination returns a long list in pieces, so no response is unbounded and no query reads everything.",
        "Every endpoint that returns a list needs it, even if today's list is short."]],
      ["Core ideas", "Offset or cursor", [
        "Offset pagination asks for 'items 41–60' (LIMIT 20 OFFSET 40). It's simple and allows jumping to page 3.",
        "The database still walks past every skipped row, so deep pages get slow, and items shift between pages when rows are added.",
        "Cursor (keyset) pagination asks for 'the 20 after this one', using the last item's sort key: WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC.",
        "A cursor is stable as data changes and stays fast at any depth, given an index on the sort key."]],
      ["The trade-offs", "Jumping against stability", [
        "Cursors can't jump to page 50; offsets can, but slowly and inconsistently.",
        "The sort needs a unique tie-breaker (usually the id), or items with equal sort values can repeat or vanish.",
        "Exact total counts can be expensive on big tables; 'more than 1,000' is often enough."]],
      ["In practice", "What you'll see at work", [
        "APIs return the items plus an opaque next cursor; the client sends it back for the next page.",
        "Infinite scroll uses cursors; numbered pages in admin screens often use offsets on small, filtered sets.",
        "A page size has a maximum, enforced by the server."]],
    ], Q(3, ["pagination"], ["x2"],
      "A feed uses OFFSET pagination. While someone scrolls, new posts arrive, and they see some posts twice. Why, and what fixes it?",
      ["The cache is stale; clear it", "New rows shift every offset down; use a cursor based on the last item's sort key and id",
        "The page size is too small; make it 100", "The client is buggy; fetch every page again"],
      1, ["It's the query's design, not a cache.", "A cursor says 'after this item', which new rows above it don't change.",
        "Bigger pages make it rarer, not impossible.", "Re-fetching repeats the same shifting problem."])),

    D(4, "Feature flags and safe releases", ["feature flags", "releases", "canary"], ["l2"], [
      ["What it is", "Deploying isn't releasing", [
        "A feature flag is a switch, checked at run time, that turns a code path on or off without a new deploy.",
        "It separates shipping code from turning it on, so a release can be gradual and reversible."]],
      ["Core ideas", "Gradual and reversible", [
        "Flags can target: everyone, nobody, a percentage, staff only, a list of accounts.",
        "A canary release sends a small share of traffic to the new version first and watches its errors and latency.",
        "Blue-green keeps the old version running beside the new one, so switching back is instant.",
        "A kill switch is a flag that turns a risky feature off in seconds when something goes wrong."]],
      ["The trade-offs", "Control against clutter", [
        "Every flag doubles the paths through the code; old flags left in place become confusing and risky.",
        "Testing has to cover both sides of each flag that's live.",
        "Flags read from a remote service need a safe default for when that service is down."]],
      ["In practice", "What you'll see at work", [
        "A flag has an owner and a removal date; removing it is part of finishing the feature.",
        "Roll out 1 % → 10 % → 50 % → 100 %, watching the same dashboards at each step.",
        "Database changes behind a flag still have to work for both sides (see schema migrations)."]],
    ], Q(4, ["feature flags", "releases"], ["l2"],
      "A new checkout flow ships to 100 % of users at once, and errors spike. Rolling back takes a 20-minute deploy. What would have limited the damage?",
      ["More unit tests", "Shipping it behind a flag, turning it on for a small share first while watching errors, with an instant off switch",
        "Deploying at night", "Asking users to report problems"],
      1, ["Tests help, but production finds what tests don't.", "A small share sees the problem first, and turning the flag off is seconds, not a deploy.",
        "Fewer users at night means slower discovery, not a faster fix.", "By then many orders have already failed."])),

    D(5, "Observability", ["observability", "logging", "metrics", "tracing"], ["x1"], [
      ["What it is", "Seeing inside a running system", [
        "Observability is being able to answer new questions about a live system from what it emits, without shipping new code.",
        "The three common signals are logs, metrics and traces."]],
      ["Core ideas", "Logs, metrics, traces", [
        "Logs record events; structured logs (JSON fields) can be searched and counted.",
        "Metrics are numbers over time: request rate, error rate, latency percentiles (p50, p95, p99), queue depth.",
        "A trace follows one request across services as a tree of timed spans, showing where the time went.",
        "A request id passed along every hop ties a request's logs and spans together."]],
      ["The trade-offs", "Insight against cost and noise", [
        "Everything you emit costs storage and money; sample high-volume traces and drop chatty logs.",
        "Averages hide pain: a fine mean latency can sit on top of a terrible p99.",
        "Too many alerts train people to ignore them; alert on what users feel."]],
      ["In practice", "What you'll see at work", [
        "OpenTelemetry to emit; a dashboard per service with its rate, errors and duration (the RED method).",
        "Never log secrets or personal data; mask them at the source.",
        "Alerts tied to service-level objectives: 'p95 checkout latency under 500 ms for 99 % of the hour'."]],
    ], Q(5, ["observability", "tracing"], ["x1"],
      "Users say checkout is sometimes slow, but the average latency dashboard looks fine. What do you look at first?",
      ["The average again, over a longer period", "The p95 and p99 latency, then traces of slow requests to see which span takes the time",
        "CPU usage of every server", "The number of deploys this week"],
      1, ["Averages hide the slow tail that users notice.", "Percentiles show the tail; a trace shows exactly where a slow request spent its time.",
        "CPU may be fine while one dependency is slow.", "Useful context, but it doesn't locate the delay."])),

    D(6, "Timeouts and circuit breakers", ["timeouts", "circuit breakers", "resilience"], ["x1"], [
      ["What it is", "Don't wait forever, don't keep knocking", [
        "Every call to another service can hang. A timeout bounds how long you wait.",
        "A circuit breaker stops calling a dependency that keeps failing, giving it time to recover and failing fast meanwhile."]],
      ["Core ideas", "Closed, open, half-open", [
        "Set a timeout on every network call, shorter than the caller's own deadline, so time is left to respond.",
        "A breaker is closed (calls pass) until failures cross a threshold, then open (calls fail immediately), then half-open (a few test calls decide whether to close again).",
        "A fallback answers when the call can't: cached data, a default, a simpler result.",
        "Bulkheads give each dependency its own limited pool, so one slow service can't take every thread."]],
      ["The trade-offs", "Fast failure against completeness", [
        "Timeouts too short cut off calls that would have succeeded; too long and requests pile up behind a slow dependency.",
        "A fallback must be honest: showing stale data as fresh can mislead.",
        "Breakers need tuning; flapping open and closed is its own problem."]],
      ["In practice", "What you'll see at work", [
        "Default HTTP clients often have no timeout at all; set one explicitly.",
        "Deadlines propagate: if the user's request has 2 s left, downstream calls get less.",
        "Dashboards show each breaker's state, so an open breaker is noticed."]],
    ], Q(6, ["timeouts", "circuit breakers"], ["x1"],
      "A recommendations service becomes slow, and soon your whole product page times out, though it only needs recommendations for one small panel. What prevents this?",
      ["Give the page more servers", "A short timeout and a circuit breaker on the recommendations call, with the panel hidden or a cached list as fallback",
        "Retry the recommendations call three times", "Make the product page wait for the slowest service"],
      1, ["More servers fill up with the same waiting requests.", "The page stops waiting on a non-essential part and renders without it.",
        "Retrying a slow service multiplies the load on it.", "That's what's causing the outage."])),

    D(7, "Schema migrations: expand and contract", ["database migrations", "zero downtime"], ["b2"], [
      ["What it is", "Changing the database under a running app", [
        "During a deploy, old and new versions of the app run at the same time against one database.",
        "Expand and contract changes the schema in steps so both versions keep working at every moment."]],
      ["Core ideas", "Add, migrate, switch, remove", [
        "Expand: add the new column or table, without removing anything; old code ignores it.",
        "Write to both old and new, then backfill existing rows in small batches.",
        "Switch reads to the new structure once it's complete.",
        "Contract: when no running code uses the old column, remove it in a later release."]],
      ["The trade-offs", "Several deploys for one change", [
        "A rename becomes four releases instead of one, but none of them breaks the app.",
        "Backfilling millions of rows in one transaction locks the table; do it in batches, off the request path.",
        "Some operations rewrite a whole table (changing a column's type in many databases); plan them as new columns instead."]],
      ["In practice", "What you'll see at work", [
        "Migrations are versioned files that run in order, the same in every environment.",
        "Never rename or drop a column in the same release that stops using it.",
        "Test a migration on a copy of production-sized data and time it."]],
    ], Q(7, ["database migrations"], ["b2"],
      "You need to rename a column `fullname` to `full_name` with no downtime. Which plan is safe?",
      ["Rename it in one migration in the same deploy as the code change", "Add `full_name`, write to both, backfill in batches, switch reads, and drop `fullname` in a later release",
        "Take the site down for a minute", "Keep both forever"],
      1, ["During the deploy, old code still reads `fullname`, which no longer exists.", "Each step works for both the old and the new code; the old column goes only when nothing reads it.",
        "It works, but the point is not needing downtime.", "Two sources of truth drift apart."])),
  ],
});
