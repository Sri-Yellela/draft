#!/usr/bin/env node
// ⭐ D155 Part C · decks-v14 — cloud, DevOps, SRE: Reliability (4; observability reuses sw-p-05) and Security for
// operations (3). Drafted by the agent 2026-11-08 for the owner's review. node scripts/decks/decksV14.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const R = (n, title, skills, pieces, slides, q) => deck(`cl-r-0${n}`, "cloud", "reliability", title, skills, pieces, slides, q);
const S = (n, title, skills, pieces, slides, q) => deck(`cl-s-0${n}`, "cloud", "security-for-operations", title, skills, pieces, slides, q);
const Q = (id, role, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, role, "mid", skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 14,
  title: "cloud, DevOps and SRE, Reliability and Security for operations",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'cloud', stages 'reliability' (SLOs, incidents, capacity and cost, disaster recovery; observability reuses sw-p-05) and 'security-for-operations' (secrets, least privilege, supply chain). Nothing is live until approved (status: draft).",
  decks: [
    R(1, "SLOs and alerting", ["slo", "sre", "alerting"], ["x1"], [
      ["What it is", "Deciding how reliable is reliable enough", [
        "A service-level objective (SLO) is a target for what users experience: '99.9 % of checkout requests succeed in under 500 ms, over 30 days'.",
        "It turns 'is it up?' into a number the team agrees to defend."]],
      ["Core ideas", "SLIs, SLOs, error budgets", [
        "A service-level indicator (SLI) is the measurement: the share of good requests.",
        "The error budget is what the SLO allows to fail: 99.9 % over 30 days is about 43 minutes of bad time.",
        "Spending the budget slowly is fine; burning it fast pages someone.",
        "When the budget is gone, reliability work takes priority over new features."]],
      ["The trade-offs", "Not 100 %", [
        "Every extra nine costs much more and users rarely notice it.",
        "Alerting on causes (CPU high) pages people for things users don't feel; alert on symptoms (the SLI).",
        "Too many alerts and people stop responding."]],
      ["In practice", "What you'll see at work", [
        "Burn-rate alerts: page when the budget would run out in hours, ticket when in days.",
        "Every page actionable, with a runbook link.",
        "SLOs reviewed with product, not set by operations alone."]],
    ], Q("cl-r-01", "Site Reliability Engineer", ["slo", "alerting"], ["x1"],
      "The on-call engineer is paged at night whenever CPU passes 80 %, though users see no problems. What's the better approach?",
      ["Alert on user-facing symptoms (SLO burn rate on errors and latency), and keep CPU as a dashboard signal", "Raise the CPU threshold to 95 %", "Add more on-call engineers", "Turn off alerting at night"],
      0, ["Pages should mean users are affected, or soon will be.", "Still a cause-based page, just later.", "More people woken for nothing.", "Real incidents would be missed."])),

    R(3, "Incident response and postmortems", ["incident response", "postmortems"], ["l2"], [
      ["What it is", "When things break, and after", [
        "Incident response is how a team restores service quickly when something goes wrong.",
        "A postmortem afterwards finds why it happened and how to stop it recurring."]],
      ["Core ideas", "Roles, mitigation, learning", [
        "Clear roles: an incident commander coordinates, others investigate, one person communicates.",
        "Mitigate first (roll back, fail over, turn off a feature); find the root cause later.",
        "A timeline is written as it happens.",
        "Blameless postmortems ask how the system allowed the mistake, and produce owned action items."]],
      ["The trade-offs", "Speed against understanding", [
        "Debugging the root cause while users are down extends the outage.",
        "Blame makes people hide mistakes, so the same failure returns.",
        "Postmortem actions that never get done waste the lesson; track them."]],
      ["In practice", "What you'll see at work", [
        "Severity levels that decide who's paged and how often status is updated.",
        "A status page updated in plain language.",
        "Rollback as the first move when an incident follows a deploy."]],
    ], Q("cl-r-03", "Site Reliability Engineer", ["incident response"], ["l2"],
      "Errors spike five minutes after a deploy. The team starts reading code to find the bug while users keep failing. What should happen first?",
      ["Roll back the deploy to restore service, then investigate", "Keep debugging until the root cause is found", "Wait to see if it recovers", "Write the postmortem"],
      0, ["Mitigation first; the bug can be found once users are safe.", "Users stay broken meanwhile.", "Hoping isn't a plan.", "That comes after the incident."])),

    R(4, "Capacity and cost", ["capacity planning", "finops", "autoscaling"], ["o4"], [
      ["What it is", "Enough to serve, not more than needed", [
        "Capacity planning makes sure systems can handle the load, including peaks and growth.",
        "In the cloud, every unit of spare capacity is money, so capacity and cost are one conversation."]],
      ["Core ideas", "Measure, scale, right-size", [
        "Know the limits: load-test to find where latency rises and errors start.",
        "Autoscaling adds and removes capacity with demand, based on a metric (CPU, queue depth, requests).",
        "Right-size: most servers run far below their size; smaller instances or fewer replicas save money.",
        "Commitments (reserved instances, savings plans) cut prices for steady load; spot instances are cheap and can be taken away."]],
      ["The trade-offs", "Headroom against waste", [
        "Too little headroom fails at a peak; too much burns money every hour.",
        "Autoscaling reacts with a delay; sudden spikes need some spare capacity.",
        "Cost cutting that hurts reliability is a false saving."]],
      ["In practice", "What you'll see at work", [
        "Cost per team and per service from resource tags.",
        "Alerts on unusual spend, like any other incident.",
        "Idle resources (unattached disks, old snapshots, empty clusters) cleaned up regularly."]],
    ], Q("cl-r-04", "Cloud Engineer", ["capacity planning", "cost"], ["o4"],
      "A service runs 20 large instances around the clock, but traffic is high only 9 a.m.–6 p.m. on weekdays. What's the usual saving?",
      ["Autoscale on load (with a sensible minimum), and right-size the instances after measuring", "Turn the service off at night", "Buy three-year commitments for all 20", "Move to bigger instances"],
      0, ["Capacity follows demand, with headroom kept for spikes.", "Users at night would get nothing.", "That locks in paying for idle capacity.", "That raises the cost."])),

    R(5, "Disaster recovery and multi-region", ["disaster recovery", "multi-region", "backups"], ["x1"], [
      ["What it is", "Surviving the big failures", [
        "Disaster recovery (DR) is the plan for losing a database, a data centre or a whole region.",
        "Two numbers define it: RPO (how much data you can lose) and RTO (how long you can be down)."]],
      ["Core ideas", "Backups, replicas, regions", [
        "Backups protect against deletion and corruption; replicas protect against a machine failing. You need both.",
        "Backups count only if restoring them is tested regularly.",
        "Multi-region options range from backups copied to another region (cheap, slow) to active-active (expensive, fast).",
        "Failover must be practised, or it fails when it matters."]],
      ["The trade-offs", "Cost against recovery time", [
        "Lower RPO and RTO cost more: continuous replication, warm standby, duplicate infrastructure.",
        "Active-active across regions brings data-consistency problems.",
        "A replica faithfully copies a mistaken delete; only backups undo it."]],
      ["In practice", "What you'll see at work", [
        "Restore drills on a schedule, timed against the RTO.",
        "Backups in another account, so one compromised account can't delete both.",
        "Game days: a failure simulated on purpose."]],
    ], Q("cl-r-05", "Site Reliability Engineer", ["disaster recovery"], ["x1"],
      "Someone accidentally deletes a production table. The database has a live replica in another zone. Does the replica help?",
      ["No: the delete replicated too; you need point-in-time backups (restore tested) to recover", "Yes, promote the replica", "Yes, the replica keeps deleted rows", "Only if it's in another region"],
      0, ["Replicas copy every change, mistakes included; backups let you go back in time.", "The table is gone there as well.", "It doesn't.", "Distance doesn't change replication."])),

    S(1, "Secrets", ["secrets management", "security"], ["k2"], [
      ["What it is", "Keys, passwords and tokens kept safe", [
        "Secrets are credentials: database passwords, API keys, signing keys, tokens.",
        "Leaked secrets are one of the most common causes of breaches."]],
      ["Core ideas", "Store, deliver, rotate", [
        "Keep secrets in a secrets manager (Vault, AWS Secrets Manager, Azure Key Vault), not in code, config files or images.",
        "Deliver them at run time to the service that needs them, with access logged.",
        "Rotate regularly and immediately after any suspected leak.",
        "Scan repositories and CI logs for secrets that slipped in."]],
      ["The trade-offs", "Convenience is the enemy", [
        "Environment variables are simple and can leak through logs and crash dumps.",
        "Long-lived keys are easy and dangerous; short-lived credentials are safer and need tooling.",
        "A secret removed from the latest commit is still in git history; rotate it."]],
      ["In practice", "What you'll see at work", [
        "Pre-commit hooks and CI scanners that block commits containing keys.",
        "Separate secrets per environment.",
        "Workload identity so services get credentials without stored keys."]],
    ], Q("cl-s-01", "DevOps Engineer", ["secrets management"], ["k2"],
      "An API key was committed to a public repository an hour ago and removed in the next commit. What must you do?",
      ["Revoke and rotate the key now, and check its usage logs; removing it from the latest commit doesn't remove it from history", "Nothing; it's been removed", "Make the repository private", "Rewrite history and keep the key"],
      0, ["Public keys are scraped within minutes; only revocation makes it useless.", "It's still in the history and may already be copied.", "It may already be copied.", "The key is already exposed."])),

    S(2, "Least privilege", ["iam", "least privilege", "access control"], ["k2"], [
      ["What it is", "Only the access you need", [
        "Least privilege gives each person and service the minimum permissions for its job.",
        "It limits the damage of mistakes, leaked credentials and compromised services."]],
      ["Core ideas", "Narrow, temporary, reviewed", [
        "Grant specific actions on specific resources, not wildcards ('*').",
        "Roles for services and people, assumed as needed; no shared accounts.",
        "Just-in-time elevation: admin rights for an hour, approved and logged, instead of permanently.",
        "Review access regularly and remove what's unused."]],
      ["The trade-offs", "Safety against friction", [
        "Tight permissions slow people down when they hit a wall; make requesting access quick.",
        "Broad permissions are convenient until a credential leaks.",
        "Permissions drift upward over time unless someone prunes them."]],
      ["In practice", "What you'll see at work", [
        "Production access through single sign-on with multi-factor authentication.",
        "Policies as code, reviewed like any change.",
        "Access analysers that flag unused or overly broad permissions."]],
    ], Q("cl-s-02", "Cloud Engineer", ["least privilege"], ["k2"],
      "A reporting service only reads one database, but its role has full administrator rights 'to avoid permission errors'. What's the risk?",
      ["If the service is compromised, the attacker gets administrator access to everything; scope the role to read that database only", "None, it's internal", "It runs slower", "It costs more"],
      0, ["The blast radius of a compromise equals the permissions granted.", "Internal services get compromised too.", "Permissions don't affect speed.", "Not a cost issue."])),

    S(3, "The software supply chain", ["supply chain security", "dependencies", "sbom"], ["k2"], [
      ["What it is", "Everything your software is built from", [
        "Your software includes open-source packages, base images, build tools and CI systems.",
        "An attack on any of them reaches you: a poisoned package, a compromised build step."]],
      ["Core ideas", "Know, pin, verify", [
        "Keep an inventory of dependencies (a software bill of materials, SBOM).",
        "Pin versions with lock files; update deliberately, with automated pull requests and tests.",
        "Scan dependencies and images for known vulnerabilities.",
        "Sign build artifacts and verify signatures before deploying; protect the CI system like production."]],
      ["The trade-offs", "Up to date against stable", [
        "Updating often fixes vulnerabilities and occasionally brings breakage.",
        "Every new dependency adds attack surface; prefer fewer, well-maintained ones.",
        "Scanners report many low-risk findings; triage by whether the vulnerable code is actually used."]],
      ["In practice", "What you'll see at work", [
        "Dependabot or Renovate opening update pull requests.",
        "Base images rebuilt regularly from trusted sources.",
        "Typosquatting checks: a package name one letter off from a popular one."]],
    ], Q("cl-s-03", "DevOps Engineer", ["supply chain security"], ["k2"],
      "A popular package your app depends on publishes a new version containing malicious code. Your builds install 'latest' each time. What would have protected you?",
      ["Pinned versions in a lock file, with updates reviewed and tested before merging", "Faster builds", "More unit tests of your own code", "Running builds at night"],
      0, ["The malicious version would only arrive through a reviewed update.", "Speed doesn't matter.", "Your tests may never touch the malicious code.", "Timing doesn't matter."])),
  ],
});
