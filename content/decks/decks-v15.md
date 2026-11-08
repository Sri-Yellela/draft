# Decks v15 — cloud, DevOps and SRE, Case studies and Interview (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 6 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v15" (or name the decks to change).

## cl-c-01 · Deploys without downtime
*Skills:* zero-downtime deploys, rolling updates · *Check yourself:* cl-c-01-q1

**1. What it is — Shipping while users keep working**
- A zero-downtime deploy replaces the running version without failed requests or a maintenance page.
- It needs cooperation from the load balancer, the app and the database.

**2. Core ideas — Drain, roll, migrate safely**
- Rolling update: replace instances a few at a time; each new one takes traffic only when its readiness check passes.
- Graceful shutdown: an old instance stops taking new requests, finishes the ones in flight, then exits.
- Database changes use expand and contract, so old and new code both work during the rollout.
- Blue-green or canary for risky releases, with a fast rollback.

**3. The trade-offs — More steps, no outages**
- Running two versions side by side means the API and schema must be compatible both ways.
- Long-lived connections (WebSockets) need draining time and client reconnects.
- Volume-backed services that can't run two copies at once can't overlap deploys; their start-up time is downtime, so make it short.

**4. In practice — What it looks like**
- Health endpoints that report ready only after warm-up.
- SIGTERM handled: stop accepting, finish, exit within the grace period.
- Deploy dashboards showing error rate by version during the rollout.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-c-01-q1).** Every deploy causes a burst of 502 errors as old instances shut down. What's usually missing?
- ✅ Graceful shutdown: on SIGTERM, stop taking new requests, finish in-flight ones, and let the load balancer deregister the instance first — *Requests are cut off mid-flight when an instance exits abruptly.*
- More memory — *Memory isn't the cause.*
- A longer health-check interval — *That makes detection slower.*
- Deploying less often — *That makes each deploy bigger and riskier.*

## cl-c-02 · Surviving a region outage
*Skills:* multi-region, failover · *Check yourself:* cl-c-02-q1

**1. What it is — When a whole cloud region goes dark**
- Cloud regions occasionally fail for hours. Surviving that means running, or being able to run quickly, somewhere else.
- The design depends on how long the business can be down and how much data it can lose.

**2. Core ideas — Standby to active-active**
- Backup and restore: data copied to another region; rebuild there when needed (hours).
- Warm standby: a scaled-down copy running in a second region, data replicated, scaled up on failover (minutes).
- Active-active: both regions serve traffic; routing moves users away from the failed one (seconds), with data-consistency work.
- DNS or global load balancers steer traffic between regions using health checks.

**3. The trade-offs — Cost and complexity**
- Each step up roughly doubles the infrastructure and the testing.
- Cross-region replication adds latency; synchronous replication slows every write.
- Hidden single-region dependencies (an identity provider, a queue) break the plan.

**4. In practice — What it looks like**
- A dependency map checked for single-region pieces.
- Failover drills at least yearly, with the clock running.
- A decision rule for when to fail over, so nobody hesitates during an incident.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-c-02-q1).** During a failover drill, the second region's app servers start, but every sign-in fails. What's the likely cause?
- ✅ A hidden single-region dependency, such as the sign-in service or its secrets living only in the failed region — *Drills exist to find dependencies like this before a real outage.*
- The servers are too small — *Size wouldn't fail every sign-in.*
- DNS is too fast — *Not a cause of failed sign-ins.*
- Users forgot their passwords — *All at once? No.*

## cl-c-03 · Cutting the cloud bill
*Skills:* finops, cost optimisation · *Check yourself:* cl-c-03-q1

**1. What it is — Paying for what you use**
- Cloud bills grow quietly: oversized machines, idle environments, forgotten storage, data transfer.
- Cutting them is ongoing engineering work, not a one-off.

**2. Core ideas — See, shrink, commit**
- See: tag every resource with team and service; report cost per team weekly.
- Shrink: right-size instances, delete idle resources, turn off non-production at night, set storage lifecycle rules.
- Commit: savings plans or reserved capacity for steady load; spot for interruptible work.
- Architect: cache to cut repeated work, keep data and compute in the same region to avoid transfer charges.

**3. The trade-offs — Savings against speed and safety**
- Commitments save money and lock you in for a year or three.
- Spot instances save a lot and can vanish with two minutes' notice.
- Cuts that remove reliability headroom cost more in the next incident.

**4. In practice — What it looks like**
- Budgets and anomaly alerts per account.
- Cost shown next to performance in service reviews.
- A quarterly clean-up of snapshots, logs and unused environments.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-c-03-q1).** The bill shows a large charge for data transfer between regions. What's the usual fix?
- ✅ Keep services and the data they read in the same region (or cache close to them), and move cross-region traffic only where needed — *Cross-region transfer is billed per gigabyte; co-locating removes it.*
- Buy reserved instances — *Commitments don't cover transfer.*
- Compress logs — *Small effect on transfer between services.*
- Use bigger instances — *Unrelated.*

## cl-iv-01 · Troubleshooting rounds
*Skills:* troubleshooting interview, linux · *Check yourself:* cl-iv-01-q1

**1. What it is — Something's broken; find it, out loud**
- You're given a scenario ('the website is slow', 'a server is unreachable') and asked how you'd investigate, often on a live machine.
- They're scoring method: hypotheses, the cheapest checks first, and narrowing down.

**2. Core ideas — A method**
- Clarify: what changed, since when, who's affected, how bad?
- Work the layers: DNS, network, load balancer, host (CPU, memory, disk), process, application logs, dependencies.
- Use measurements, not guesses: top, df, free, ss, curl -v, logs.
- Mitigate first if users are hurting; root-cause after.

**3. The trade-offs — Methodical, not random**
- Jumping to a favourite cause wastes time when it's wrong.
- Saying 'I'd check X because Y' scores better than silently typing.
- Knowing when to escalate or roll back is part of the answer.

**4. In practice — How to prepare**
- Practise on a VM: break things on purpose and fix them.
- Learn the ten commands you'd reach for first, and what each tells you.
- Prepare a real incident story with your role in it.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-iv-01-q1).** Asked 'users say the site is slow', what's the strongest first move?
- ✅ Clarify scope and timing (all users? since when? any recent change?), then check user-facing metrics before diving into a server — *Scope and recent changes narrow the search fastest.*
- SSH into a random server and run top — *A random host may not be involved.*
- Restart everything — *That destroys evidence and may not help.*
- Say it's probably the database — *A guess without evidence.*

## cl-iv-02 · Infrastructure design rounds
*Skills:* infrastructure design interview · *Check yourself:* cl-iv-02-q1

**1. What it is — Design the platform for a service**
- You're asked to design infrastructure for something specific: a web app expecting rapid growth, a data pipeline, a multi-tenant SaaS.
- They're scoring reliability, security, cost and operability, not cloud trivia.

**2. Core ideas — Cover the layers**
- Requirements: traffic, data size, availability target, compliance.
- Compute, networking, data stores, caching, and how traffic flows between them.
- Deploys, observability, secrets, access, backups and DR.
- Cost at the expected scale, and what changes at ten times that.

**3. The trade-offs — Justify every box**
- Kubernetes for a single small app is hard to justify; say why or why not.
- Managed services save effort; mention the lock-in honestly.
- Over-designing for a scale that isn't coming costs money and time.

**4. In practice — How to prepare**
- Practise three designs end to end, with a rough cost.
- Draw network boundaries (public, private) clearly.
- End with what you'd monitor and how you'd fail over.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-iv-02-q1).** In an infrastructure design round, the interviewer asks why you chose Kubernetes for a single small web app. What's a strong answer?
- ✅ Weigh it honestly: a managed container service or platform may be simpler at this size; choose Kubernetes only if there's a reason (many services coming, team skills) — *They want trade-off reasoning, including when not to use a tool.*
- Kubernetes is always best — *Not true.*
- Because it's popular — *Not a reason.*
- Refuse to justify it — *Justifying choices is the round.*

## cl-iv-03 · On-call scenarios
*Skills:* on-call, incident response · *Check yourself:* cl-iv-03-q1

**1. What it is — 'You're paged at 3 a.m.; what do you do?'**
- On-call interviews walk through a simulated incident to see how you act under pressure.
- They're scoring calm prioritisation, communication and safe actions.

**2. Core ideas — Acknowledge, assess, mitigate, communicate**
- Acknowledge the page and check the alert's dashboard and runbook.
- Assess impact: who's affected and how badly; declare an incident if needed.
- Mitigate with the safest effective action (roll back, fail over, scale up).
- Communicate early and regularly; hand over cleanly; write up afterwards.

**3. The trade-offs — Act, but carefully**
- Risky fixes at 3 a.m. can make things worse; prefer reversible actions.
- Calling for help early is a strength, not a weakness.
- Silence during an incident worries everyone; short updates help.

**4. In practice — How to prepare**
- Walk through a past incident: your timeline and decisions.
- Know what a good runbook contains.
- Practise saying what you'd communicate, and to whom.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-iv-03-q1).** You're paged: error rates are high and a deploy went out 20 minutes ago. You're not sure the deploy is the cause. What's a sound first action?
- ✅ Acknowledge, check the dashboards, and, if errors began at the deploy, roll it back as a reversible first step while you keep investigating — *A reversible rollback limits harm while evidence is gathered.*
- Wait an hour to be sure — *Users suffer meanwhile.*
- Start rewriting the code — *Not at 3 a.m. in an incident.*
- Turn off monitoring to stop the pages — *That hides the problem.*
