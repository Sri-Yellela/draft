# Decks v2 — software engineering, Building blocks (for your review)

Drafted by the agent on 2026-11-08, in the approved pathway order (D155 Part C), in decks-v1's format. Eight five-slide decks, each with one new question. **APPROVED by the owner 2026-11-08** — served in the Library; the questions are live in the bank.

## sw-b-01 · APIs: REST and gRPC
*Skills:* rest, grpc, api design · *Check yourself:* sw-b-01-q1

**1. What it is — A contract between programs**
- An API is the set of requests one program accepts from another, and what it promises to send back.
- REST and gRPC are two common ways to shape that contract over a network.

**2. Core ideas — Resources, methods, messages**
- REST treats things as resources at addresses (/orders/42) and uses HTTP methods on them: GET reads, POST creates, PUT replaces, PATCH changes part, DELETE removes.
- Status codes say what happened: 2xx worked, 4xx the caller sent something wrong, 5xx the server failed.
- gRPC defines services and messages in a schema file (Protocol Buffers), generates client and server code from it, and sends compact binary messages over HTTP/2.
- Either way, the contract has to be versioned: once someone depends on a field, removing or renaming it breaks them.

**3. The trade-offs — Readable or fast, loose or strict**
- REST with JSON is easy to read, works in any browser and with any tool, but it's wordy and nothing checks the shape unless you add a schema.
- gRPC is smaller, faster and type-checked from the schema, and it streams well, but browsers can't call it directly and it's harder to inspect by hand.
- Many teams use REST at the edge (for browsers and partners) and gRPC between their own services.

**4. In practice — What you'll see at work**
- An OpenAPI or .proto file is the source of truth; clients and docs are generated from it.
- Safe changes are additive: a new optional field or a new endpoint. Breaking changes get a new version (/v2/) and a period where both run.
- GET requests should be safe to repeat; anything that changes data needs a plan for retries (see idempotency, in Patterns).

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-b-01-q1).** Your public REST API returns a field `price` that partners read. You want to change it to an object `{ amount, currency }`. What's the safe way?
- Change `price` in place; partners will update quickly — *Changing a field in place breaks every client reading it, at once.*
- ✅ Add a new field (for example `priceDetail`) alongside `price`, and plan `price`'s removal in a new version — *Additive changes don't break anyone; removal waits for a versioned, announced change.*
- Return the new shape only when a partner sends a special header, without telling anyone — *A hidden switch isn't a contract; nobody can rely on it.*
- Remove `price` and return a 400 so partners notice — *Breaking clients on purpose isn't a migration plan.*

## sw-b-02 · Authentication and sessions
*Skills:* authentication, sessions, oauth · *Check yourself:* sw-b-02-q1

**1. What it is — Who are you, and are you still you?**
- Authentication proves who someone is (a password, a passkey, a code). Authorization decides what they may do.
- A session remembers that proof between requests, so the person doesn't sign in on every click.

**2. Core ideas — Cookies, tokens, and delegated sign-in**
- A server-side session stores the person's state on the server and gives the browser a random session id in a cookie.
- A signed token (such as a JWT) carries the claims itself; any server with the key can check it without a lookup.
- Passwords are stored only as slow, salted hashes (bcrypt, scrypt, Argon2), never as text.
- OAuth and OpenID Connect let a person sign in with another provider: your app gets a token for them, never their password.

**3. The trade-offs — Easy to check, hard to take back**
- Server sessions can be revoked instantly (delete the row) but need a shared store when you run many servers.
- Self-contained tokens need no lookup, but you can't easily cancel one before it expires, so keep them short-lived and pair them with a refresh token.
- Cookies are sent automatically, which is convenient and is exactly what cross-site request forgery abuses; tokens in JavaScript storage are exposed to cross-site scripting.

**4. In practice — What you'll see at work**
- Session cookies set HttpOnly (scripts can't read them), Secure (HTTPS only) and SameSite (not sent on most cross-site requests).
- Sign-in endpoints are rate-limited and say the same thing for a wrong email as for a wrong password.
- Signing out, a password change and a lost device should all end existing sessions.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-b-02-q1).** A person reports their laptop stolen. Your app uses JWTs that expire after 30 days, with no server-side record. What's the problem, and the usual fix?
- None: JWTs are encrypted, so a thief can't use them — *A JWT is usually signed, not encrypted, and either way whoever holds it can use it.*
- ✅ The stolen token stays valid until it expires; use short-lived access tokens with revocable refresh tokens (or a server-side session list) — *Short access tokens limit the damage; a refresh token you can revoke ends the session.*
- Change the signing key for that one person — *There's one signing key for everyone; rotating it signs out every user.*
- Ask the person to clear their browser history — *The thief has the laptop, not the person.*

## sw-b-03 · Caching
*Skills:* caching, redis, cdn · *Check yourself:* sw-b-03-q1

**1. What it is — Keep a copy close**
- A cache stores the result of slow work (a database query, a page, a computed score) so the next request can reuse it.
- It's the same idea as the CPU's caches, one level up: trade memory for speed.

**2. Core ideas — Hits, misses, and staleness**
- A hit serves from the cache; a miss does the slow work and usually stores the result.
- Cache-aside: the code checks the cache, then the database, then fills the cache. Write-through updates both on every write.
- Every entry needs a way to go out of date: a time to live (TTL), an explicit delete when the data changes, or both.
- When the cache is full, an eviction policy (often least recently used) decides what to drop.

**3. The trade-offs — Speed now, wrong later**
- A cache can serve data that has changed underneath it. Decide how stale is acceptable for each thing you cache.
- When a popular entry expires, many requests can miss at once and all hit the database (a stampede). Refresh it early, or let one request rebuild it while others wait.
- Caching per user multiplies memory; caching shared results is cheaper but must never leak one person's data to another.

**4. In practice — What you'll see at work**
- Layers: the browser's cache, a CDN at the edge for static files and public pages, an in-memory store like Redis for app data, and the database's own buffer.
- HTTP headers (Cache-Control, ETag) tell browsers and CDNs what they may keep and for how long.
- Watch the hit rate. A cache that rarely hits only adds a step.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-b-03-q1).** A product page is cached for 10 minutes. The price changes, and some shoppers still see the old price for up to 10 minutes. What's the best fix?
- Turn the cache off — *That fixes staleness by giving up the speed for every page.*
- ✅ Delete (or update) that product's cache entry when its price changes, and keep the TTL as a safety net — *Invalidating on change gives fresh data with the cache's speed; the TTL catches anything missed.*
- Lower the TTL to one second — *A tiny TTL makes the cache nearly useless and still serves a second of stale data.*
- Cache the page in the browser instead — *A browser cache is even harder to invalidate.*

## sw-b-04 · Queues and background work
*Skills:* queues, background jobs, messaging · *Check yourself:* sw-b-04-q1

**1. What it is — Do it later, somewhere else**
- A queue holds tasks so a request can return quickly while a worker does the slow part afterwards: sending email, resizing images, calling a slow partner.
- It also smooths bursts: work piles up in the queue instead of overloading the system.

**2. Core ideas — Producers, consumers, acknowledgements**
- A producer puts a message on the queue; a consumer (worker) takes it, does the work, then acknowledges it.
- If a worker dies before acknowledging, the message is delivered again. So most queues are 'at least once': the same message can arrive twice.
- Retries use backoff (wait longer each time); a message that keeps failing goes to a dead-letter queue for a person to look at.
- A log-based system like Kafka keeps messages in order per partition and lets many readers replay them.

**3. The trade-offs — Faster responses, harder questions**
- The person no longer waits, but the result isn't ready when the request returns, so the UI has to show 'in progress'.
- Delivery more than once means handlers must be safe to run twice (idempotent).
- Strict ordering limits how much you can run in parallel.

**4. In practice — What you'll see at work**
- Job systems (Sidekiq, Celery, BullMQ) for app tasks; brokers (RabbitMQ, SQS) and logs (Kafka) between services.
- Watch the queue's depth and the age of its oldest message: a growing backlog means workers can't keep up.
- Put work in the queue in the same transaction that records it (the outbox pattern), or you can lose or duplicate it.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-b-04-q1).** Your 'send receipt' worker sometimes emails the same receipt twice. Logs show the worker crashed after sending but before acknowledging. What fixes it?
- Use a faster email provider — *Speed doesn't change at-least-once delivery.*
- ✅ Make the handler idempotent: record that this receipt was sent, and skip it if the record exists — *With a record of what was done, a redelivered message does nothing the second time.*
- Turn off retries — *Without retries, a real failure means the receipt is never sent.*
- Acknowledge the message before sending the email — *Acknowledging first means a crash loses the email entirely.*

## sw-b-05 · Concurrency
*Skills:* concurrency, locks, async · *Check yourself:* sw-b-05-q1

**1. What it is — Many things in progress at once**
- Concurrency is handling several tasks whose lifetimes overlap; parallelism is actually running them at the same instant on several cores.
- A web server is concurrent by nature: many people's requests are in progress at once.

**2. Core ideas — Shared state needs rules**
- When two tasks read and write the same data, the result can depend on timing: a race condition.
- A lock (mutex) lets one task at a time into a critical section; atomic operations do small updates in one indivisible step.
- A deadlock is two tasks each holding a lock the other needs, so both wait forever. Taking locks in one fixed order prevents it.
- Async code (an event loop with promises or async/await) runs many tasks on one thread by switching whenever a task waits for input or output.

**3. The trade-offs — Throughput against simplicity**
- More threads use more cores but add locking, contention and hard-to-reproduce bugs.
- An event loop avoids most locking but stalls everything if one task does heavy computing without yielding.
- Sharing nothing (passing messages, or separate processes) is simplest to reason about but copies data.

**4. In practice — What you'll see at work**
- Thread pools and connection pools cap how much runs at once.
- In Node.js or Python's asyncio, CPU-heavy work goes to a worker thread or process so the loop stays responsive.
- Databases handle much of the concurrency for you through transactions; your code still has to handle conflicts.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-b-05-q1).** A Node.js server answers quickly, until one endpoint parses a 200 MB file; then every request waits for several seconds. Why?
- Node.js can only serve one person at a time — *It serves many at once, as long as no task holds the thread.*
- ✅ The parse runs on the event loop's single thread, so nothing else runs until it finishes; move it to a worker thread — *Heavy computing blocks the loop; a worker thread keeps the loop free.*
- The network is saturated by the file — *The symptom affects requests unrelated to the file's transfer.*
- The garbage collector is too slow — *GC pauses are short; this is the parse itself.*

## sw-b-06 · Indexes and query plans
*Skills:* indexes, query plans, sql performance · *Check yourself:* sw-b-06-q1

**1. What it is — A table of contents for a table**
- An index is a sorted structure (usually a B-tree) over one or more columns, so the database can find matching rows without reading every row.
- The query plan is the database's chosen way to run a query: which indexes, in what order.

**2. Core ideas — Seek, don't scan**
- Without a usable index, the database scans the whole table; with one, it jumps to the matching rows.
- A composite index on (a, b) helps queries filtering on a, or on a and b, but not on b alone: column order matters.
- A covering index holds every column the query needs, so the table itself isn't read.
- EXPLAIN (EXPLAIN QUERY PLAN in SQLite) shows the plan: look for full scans of big tables.

**3. The trade-offs — Faster reads, slower writes**
- Every index must be updated on each insert, update and delete, and it takes space.
- An index on a column with few distinct values (a yes/no flag) rarely helps on its own; a partial index (WHERE active = 1) can.
- Wrapping a column in a function (LOWER(email) = ?) can stop the index being used, unless you index the expression.

**4. In practice — What you'll see at work**
- Find slow queries from the slow-query log, read their plans, then add or change one index at a time and measure.
- Joins need indexes on the join columns, or each row of one side scans the other.
- Test with production-sized data: a plan that's fine on 1,000 rows can be a disaster on a million.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-b-06-q1).** A table has an index on (user_id, created_at). Which query can use it to avoid scanning the table?
- WHERE created_at > ? — *Filtering only on the second column can't use the index's order.*
- ✅ WHERE user_id = ? ORDER BY created_at DESC — *The first column narrows to one user, and the second gives the order for free.*
- WHERE LOWER(user_id) = ? — *A function on the column hides it from the index.*
- WHERE created_at > ? OR user_id = ? — *An OR across columns usually can't use one composite index.*

## sw-b-07 · Transactions and isolation
*Skills:* transactions, isolation, acid · *Check yourself:* sw-b-07-q1

**1. What it is — All of it, or none of it**
- A transaction groups several changes so they succeed or fail together: moving money is a debit and a credit, never one without the other.
- ACID names the promises: atomic, consistent, isolated, durable.

**2. Core ideas — What concurrent transactions may see**
- Isolation levels decide what one transaction sees of another's unfinished work.
- Read committed: you never see uncommitted data, but a row can change between two reads in your transaction.
- Repeatable read or snapshot: you see one consistent snapshot, but two transactions can still make decisions on stale data (write skew).
- Serializable: the result is as if transactions ran one at a time; conflicts make one of them fail and retry.

**3. The trade-offs — Safety against waiting**
- Stronger isolation prevents more anomalies but causes more waiting, more conflicts and more retries.
- Long transactions hold locks (or old snapshots) and slow everyone else; keep them short and never wait on a person or a network call inside one.
- Lost updates (two people read, both write, one change vanishes) need a lock, an atomic update, or a version check.

**4. In practice — What you'll see at work**
- Use UPDATE … SET stock = stock - 1 WHERE stock > 0 rather than reading, subtracting in code and writing back.
- Optimistic locking: a version column, and the update succeeds only if the version hasn't changed.
- Retry a transaction that failed on a serialization conflict; that's the expected behaviour, not a bug.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-b-07-q1).** Two requests each read stock = 1, both see it's available, and both sell the item. Which change prevents overselling?
- Read the stock twice before selling — *Both requests would still see 1.*
- ✅ Use one atomic statement: UPDATE … SET stock = stock - 1 WHERE id = ? AND stock > 0, and check that a row changed — *The database checks and changes in one step; only one request can win.*
- Add an index on stock — *An index speeds lookups; it doesn't coordinate writers.*
- Cache the stock value — *A cached value is even more likely to be stale.*

## sw-b-08 · Containers
*Skills:* containers, docker · *Check yourself:* sw-b-08-q1

**1. What it is — Ship the app with its world**
- A container packages an app with the libraries and settings it needs, and runs it isolated from other apps on the same machine.
- Unlike a virtual machine, it shares the host's operating-system kernel, so it starts in seconds and uses little memory.

**2. Core ideas — Images, layers, and isolation**
- An image is a read-only template built from a Dockerfile, one layer per step; a container is a running instance of it.
- Layers are cached and shared, so put steps that rarely change (installing dependencies) before steps that often change (copying your code).
- Linux namespaces give each container its own view of processes, network and files; cgroups limit its CPU and memory.
- A container's own filesystem is thrown away when it's removed; data that must last goes in a volume.

**3. The trade-offs — Same everywhere, but not magic**
- The same image runs on a laptop, in CI and in production, which removes most 'works on my machine' problems.
- Containers share the kernel, so isolation is weaker than a VM's; don't treat them as a security boundary on their own.
- Many small containers mean more moving parts: networking, logs and updates need their own tooling (often Kubernetes).

**4. In practice — What you'll see at work**
- Small base images, a non-root user, and pinned versions keep images safer and faster to ship.
- Configuration and secrets come from the environment at run time, never baked into the image.
- One process per container, with health checks, so the platform can restart what fails.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (sw-b-08-q1).** Every code change rebuilds your image from scratch, reinstalling all dependencies (8 minutes). The Dockerfile copies the whole project, then installs dependencies. What's the fix?
- Use a bigger build machine — *More power shortens 8 minutes a little; it doesn't avoid the work.*
- ✅ Copy only the dependency files and install first, then copy the rest of the code, so the install layer is reused — *A layer is reused until its inputs change; dependency files change far less often than code.*
- Install dependencies when the container starts — *Every container start would then take minutes, and might not be reproducible.*
- Turn off the build cache — *That makes every build slow on purpose.*
