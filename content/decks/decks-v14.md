# Decks v14 — cloud, DevOps and SRE, Reliability and Security for operations (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 7 five-slide decks, each with one new question. **APPROVED by the owner 2026-11-08** — served in the Library; the questions are live in the bank.

## cl-r-01 · SLOs and alerting
*Skills:* slo, sre, alerting · *Check yourself:* cl-r-01-q1

**1. What it is — Deciding how reliable is reliable enough**
- A service-level objective (SLO) is a target for what users experience: '99.9 % of checkout requests succeed in under 500 ms, over 30 days'.
- It turns 'is it up?' into a number the team agrees to defend.

**2. Core ideas — SLIs, SLOs, error budgets**
- A service-level indicator (SLI) is the measurement: the share of good requests.
- The error budget is what the SLO allows to fail: 99.9 % over 30 days is about 43 minutes of bad time.
- Spending the budget slowly is fine; burning it fast pages someone.
- When the budget is gone, reliability work takes priority over new features.

**3. The trade-offs — Not 100 %**
- Every extra nine costs much more and users rarely notice it.
- Alerting on causes (CPU high) pages people for things users don't feel; alert on symptoms (the SLI).
- Too many alerts and people stop responding.

**4. In practice — What you'll see at work**
- Burn-rate alerts: page when the budget would run out in hours, ticket when in days.
- Every page actionable, with a runbook link.
- SLOs reviewed with product, not set by operations alone.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-r-01-q1).** The on-call engineer is paged at night whenever CPU passes 80 %, though users see no problems. What's the better approach?
- ✅ Alert on user-facing symptoms (SLO burn rate on errors and latency), and keep CPU as a dashboard signal — *Pages should mean users are affected, or soon will be.*
- Raise the CPU threshold to 95 % — *Still a cause-based page, just later.*
- Add more on-call engineers — *More people woken for nothing.*
- Turn off alerting at night — *Real incidents would be missed.*

## cl-r-03 · Incident response and postmortems
*Skills:* incident response, postmortems · *Check yourself:* cl-r-03-q1

**1. What it is — When things break, and after**
- Incident response is how a team restores service quickly when something goes wrong.
- A postmortem afterwards finds why it happened and how to stop it recurring.

**2. Core ideas — Roles, mitigation, learning**
- Clear roles: an incident commander coordinates, others investigate, one person communicates.
- Mitigate first (roll back, fail over, turn off a feature); find the root cause later.
- A timeline is written as it happens.
- Blameless postmortems ask how the system allowed the mistake, and produce owned action items.

**3. The trade-offs — Speed against understanding**
- Debugging the root cause while users are down extends the outage.
- Blame makes people hide mistakes, so the same failure returns.
- Postmortem actions that never get done waste the lesson; track them.

**4. In practice — What you'll see at work**
- Severity levels that decide who's paged and how often status is updated.
- A status page updated in plain language.
- Rollback as the first move when an incident follows a deploy.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-r-03-q1).** Errors spike five minutes after a deploy. The team starts reading code to find the bug while users keep failing. What should happen first?
- ✅ Roll back the deploy to restore service, then investigate — *Mitigation first; the bug can be found once users are safe.*
- Keep debugging until the root cause is found — *Users stay broken meanwhile.*
- Wait to see if it recovers — *Hoping isn't a plan.*
- Write the postmortem — *That comes after the incident.*

## cl-r-04 · Capacity and cost
*Skills:* capacity planning, finops, autoscaling · *Check yourself:* cl-r-04-q1

**1. What it is — Enough to serve, not more than needed**
- Capacity planning makes sure systems can handle the load, including peaks and growth.
- In the cloud, every unit of spare capacity is money, so capacity and cost are one conversation.

**2. Core ideas — Measure, scale, right-size**
- Know the limits: load-test to find where latency rises and errors start.
- Autoscaling adds and removes capacity with demand, based on a metric (CPU, queue depth, requests).
- Right-size: most servers run far below their size; smaller instances or fewer replicas save money.
- Commitments (reserved instances, savings plans) cut prices for steady load; spot instances are cheap and can be taken away.

**3. The trade-offs — Headroom against waste**
- Too little headroom fails at a peak; too much burns money every hour.
- Autoscaling reacts with a delay; sudden spikes need some spare capacity.
- Cost cutting that hurts reliability is a false saving.

**4. In practice — What you'll see at work**
- Cost per team and per service from resource tags.
- Alerts on unusual spend, like any other incident.
- Idle resources (unattached disks, old snapshots, empty clusters) cleaned up regularly.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-r-04-q1).** A service runs 20 large instances around the clock, but traffic is high only 9 a.m.–6 p.m. on weekdays. What's the usual saving?
- ✅ Autoscale on load (with a sensible minimum), and right-size the instances after measuring — *Capacity follows demand, with headroom kept for spikes.*
- Turn the service off at night — *Users at night would get nothing.*
- Buy three-year commitments for all 20 — *That locks in paying for idle capacity.*
- Move to bigger instances — *That raises the cost.*

## cl-r-05 · Disaster recovery and multi-region
*Skills:* disaster recovery, multi-region, backups · *Check yourself:* cl-r-05-q1

**1. What it is — Surviving the big failures**
- Disaster recovery (DR) is the plan for losing a database, a data centre or a whole region.
- Two numbers define it: RPO (how much data you can lose) and RTO (how long you can be down).

**2. Core ideas — Backups, replicas, regions**
- Backups protect against deletion and corruption; replicas protect against a machine failing. You need both.
- Backups count only if restoring them is tested regularly.
- Multi-region options range from backups copied to another region (cheap, slow) to active-active (expensive, fast).
- Failover must be practised, or it fails when it matters.

**3. The trade-offs — Cost against recovery time**
- Lower RPO and RTO cost more: continuous replication, warm standby, duplicate infrastructure.
- Active-active across regions brings data-consistency problems.
- A replica faithfully copies a mistaken delete; only backups undo it.

**4. In practice — What you'll see at work**
- Restore drills on a schedule, timed against the RTO.
- Backups in another account, so one compromised account can't delete both.
- Game days: a failure simulated on purpose.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-r-05-q1).** Someone accidentally deletes a production table. The database has a live replica in another zone. Does the replica help?
- ✅ No: the delete replicated too; you need point-in-time backups (restore tested) to recover — *Replicas copy every change, mistakes included; backups let you go back in time.*
- Yes, promote the replica — *The table is gone there as well.*
- Yes, the replica keeps deleted rows — *It doesn't.*
- Only if it's in another region — *Distance doesn't change replication.*

## cl-s-01 · Secrets
*Skills:* secrets management, security · *Check yourself:* cl-s-01-q1

**1. What it is — Keys, passwords and tokens kept safe**
- Secrets are credentials: database passwords, API keys, signing keys, tokens.
- Leaked secrets are one of the most common causes of breaches.

**2. Core ideas — Store, deliver, rotate**
- Keep secrets in a secrets manager (Vault, AWS Secrets Manager, Azure Key Vault), not in code, config files or images.
- Deliver them at run time to the service that needs them, with access logged.
- Rotate regularly and immediately after any suspected leak.
- Scan repositories and CI logs for secrets that slipped in.

**3. The trade-offs — Convenience is the enemy**
- Environment variables are simple and can leak through logs and crash dumps.
- Long-lived keys are easy and dangerous; short-lived credentials are safer and need tooling.
- A secret removed from the latest commit is still in git history; rotate it.

**4. In practice — What you'll see at work**
- Pre-commit hooks and CI scanners that block commits containing keys.
- Separate secrets per environment.
- Workload identity so services get credentials without stored keys.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-s-01-q1).** An API key was committed to a public repository an hour ago and removed in the next commit. What must you do?
- ✅ Revoke and rotate the key now, and check its usage logs; removing it from the latest commit doesn't remove it from history — *Public keys are scraped within minutes; only revocation makes it useless.*
- Nothing; it's been removed — *It's still in the history and may already be copied.*
- Make the repository private — *It may already be copied.*
- Rewrite history and keep the key — *The key is already exposed.*

## cl-s-02 · Least privilege
*Skills:* iam, least privilege, access control · *Check yourself:* cl-s-02-q1

**1. What it is — Only the access you need**
- Least privilege gives each person and service the minimum permissions for its job.
- It limits the damage of mistakes, leaked credentials and compromised services.

**2. Core ideas — Narrow, temporary, reviewed**
- Grant specific actions on specific resources, not wildcards ('*').
- Roles for services and people, assumed as needed; no shared accounts.
- Just-in-time elevation: admin rights for an hour, approved and logged, instead of permanently.
- Review access regularly and remove what's unused.

**3. The trade-offs — Safety against friction**
- Tight permissions slow people down when they hit a wall; make requesting access quick.
- Broad permissions are convenient until a credential leaks.
- Permissions drift upward over time unless someone prunes them.

**4. In practice — What you'll see at work**
- Production access through single sign-on with multi-factor authentication.
- Policies as code, reviewed like any change.
- Access analysers that flag unused or overly broad permissions.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-s-02-q1).** A reporting service only reads one database, but its role has full administrator rights 'to avoid permission errors'. What's the risk?
- ✅ If the service is compromised, the attacker gets administrator access to everything; scope the role to read that database only — *The blast radius of a compromise equals the permissions granted.*
- None, it's internal — *Internal services get compromised too.*
- It runs slower — *Permissions don't affect speed.*
- It costs more — *Not a cost issue.*

## cl-s-03 · The software supply chain
*Skills:* supply chain security, dependencies, sbom · *Check yourself:* cl-s-03-q1

**1. What it is — Everything your software is built from**
- Your software includes open-source packages, base images, build tools and CI systems.
- An attack on any of them reaches you: a poisoned package, a compromised build step.

**2. Core ideas — Know, pin, verify**
- Keep an inventory of dependencies (a software bill of materials, SBOM).
- Pin versions with lock files; update deliberately, with automated pull requests and tests.
- Scan dependencies and images for known vulnerabilities.
- Sign build artifacts and verify signatures before deploying; protect the CI system like production.

**3. The trade-offs — Up to date against stable**
- Updating often fixes vulnerabilities and occasionally brings breakage.
- Every new dependency adds attack surface; prefer fewer, well-maintained ones.
- Scanners report many low-risk findings; triage by whether the vulnerable code is actually used.

**4. In practice — What you'll see at work**
- Dependabot or Renovate opening update pull requests.
- Base images rebuilt regularly from trusted sources.
- Typosquatting checks: a package name one letter off from a popular one.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-s-03-q1).** A popular package your app depends on publishes a new version containing malicious code. Your builds install 'latest' each time. What would have protected you?
- ✅ Pinned versions in a lock file, with updates reviewed and tested before merging — *The malicious version would only arrive through a reviewed update.*
- Faster builds — *Speed doesn't matter.*
- More unit tests of your own code — *Your tests may never touch the malicious code.*
- Running builds at night — *Timing doesn't matter.*
