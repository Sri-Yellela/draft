#!/usr/bin/env node
// ⭐ D155 Part C · decks-v13 — cloud, DevOps, SRE, platform: Foundations (3; Git reuses sw-f-04) and Building blocks (4;
// containers reuses sw-b-08). Drafted by the agent 2026-11-08 for the owner's review. node scripts/decks/decksV13.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const F = (n, title, skills, pieces, slides, q) => deck(`cl-f-0${n}`, "cloud", "foundations", title, skills, pieces, slides, q);
const B = (n, title, skills, pieces, slides, q) => deck(`cl-b-0${n}`, "cloud", "building-blocks", title, skills, pieces, slides, q);
const Q = (id, role, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, role, "entry", skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 13,
  title: "cloud, DevOps and SRE, Foundations and Building blocks",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'cloud', stages 'foundations' (Linux, networking, scripting; Git reuses sw-f-04) and 'building-blocks' (Kubernetes, IaC, CI/CD, cloud building blocks; containers reuses sw-b-08). Nothing is live until approved (status: draft).",
  decks: [
    F(1, "Linux", ["linux", "shell"], ["o4", "s3x"], [
      ["What it is", "The operating system most servers run", [
        "Almost every cloud server and container runs Linux. Working comfortably in its shell is the base skill for operations work.",
        "Everything is a file or a process, and small tools combine through pipes."]],
      ["Core ideas", "Processes, files, permissions, services", [
        "Processes: ps, top, kill; each has a PID, an owner and limits.",
        "Files and permissions: owner, group, others; read, write, execute; root can do anything, so avoid working as root.",
        "Services run under systemd (systemctl status, journalctl -u for logs).",
        "Pipes chain tools: grep, awk, sort, uniq, tail -f turn logs into answers."]],
      ["The trade-offs", "Power and sharp edges", [
        "A single command can delete everything; check paths, especially with rm -rf and variables.",
        "Changes made by hand on a server are lost or forgotten; write them as code (see infrastructure as code).",
        "Distributions differ (Debian/Ubuntu apt, Red Hat dnf), in package names and paths."]],
      ["In practice", "What you'll see at work", [
        "Disk full: df -h, then du to find what grew (often logs).",
        "High load: top, then which process, then why.",
        "SSH keys, not passwords, and sudo for the few commands that need root."]],
    ], Q("cl-f-01", "DevOps Engineer", ["linux"], ["o4"],
      "A server's application stops writing logs and errors say 'No space left on device'. What do you check first?",
      ["df -h to see which filesystem is full, then du to find what grew (often old logs), and set up log rotation", "Restart the server", "Add more RAM", "Reinstall the application"],
      0, ["Find what filled the disk, free it, and stop it recurring.", "It may come back up full.", "Memory isn't disk.", "The disk is still full."])),

    F(2, "Networking for operations", ["networking", "dns", "load balancers"], ["w2", "sec1"], [
      ["What it is", "How requests find your servers", [
        "Every request crosses DNS, IP routing, ports, TLS and usually a load balancer before reaching your code.",
        "Most 'the site is down' incidents are a broken link in that chain."]],
      ["Core ideas", "IP, ports, DNS, balancers", [
        "IP addresses identify machines; ports identify services on them (443 for HTTPS); private networks (10.x, 192.168.x) aren't reachable from the internet.",
        "TCP gives reliable ordered connections; UDP is lighter and unordered.",
        "DNS maps names to addresses; records are cached for their TTL, so changes take time to spread.",
        "Load balancers spread traffic across healthy servers and remove ones failing health checks."]],
      ["The trade-offs", "Layers to debug", [
        "Firewalls and security groups block by default; a missing rule looks like a timeout.",
        "Long DNS TTLs reduce lookups and slow down emergency changes.",
        "Layer 4 balancers are fast and simple; layer 7 balancers can route by path and header."]],
      ["In practice", "What you'll see at work", [
        "dig or nslookup for DNS; curl -v for the whole request; nc or telnet to test a port.",
        "A timeout usually means something blocked or nothing listening; 'connection refused' means the host answered and nothing listens on that port.",
        "Lower the DNS TTL a day before planned changes."]],
    ], Q("cl-f-02", "DevOps Engineer", ["networking"], ["w2"],
      "A new service is unreachable: curl to its port hangs until it times out, but the process is running and listening. What's the likeliest cause?",
      ["A firewall or security group isn't allowing traffic to that port", "DNS is cached", "The service is listening on the wrong port number", "TLS certificates expired"],
      0, ["A silent drop (hang then timeout) points at a firewall; a wrong port usually gives 'connection refused'.", "DNS would give the wrong address or fail to resolve.", "That usually gives an immediate refusal.", "TLS errors appear after connecting."])),

    F(3, "Scripting", ["bash", "python", "automation"], ["l2"], [
      ["What it is", "Automating the boring parts", [
        "Scripts in Bash or Python automate repeated tasks: deployments, backups, clean-ups, checks.",
        "A task done by hand twice is a candidate for a script."]],
      ["Core ideas", "Safe scripts", [
        "In Bash, start with set -euo pipefail so errors stop the script instead of continuing silently.",
        "Quote variables (\"$file\") so spaces don't split them.",
        "Python is better once there's logic, data parsing or an API to call.",
        "Make scripts idempotent: running twice does no harm."]],
      ["The trade-offs", "Quick script or real tool", [
        "Bash is everywhere and fast to write, and gets unreadable past a page.",
        "A script that only one person understands is a risk; keep it in version control with a short usage note.",
        "Hard-coded secrets in scripts leak; read them from the environment or a secrets manager."]],
      ["In practice", "What you'll see at work", [
        "A --dry-run flag that shows what would change.",
        "Logs of what the script did, with timestamps.",
        "shellcheck run on every Bash script."]],
    ], Q("cl-f-03", "DevOps Engineer", ["bash"], ["l2"],
      "A Bash clean-up script runs `rm -rf $DIR/*`. One day DIR is empty because an earlier command failed. What happens, and what prevents it?",
      ["It deletes from / (the root); use set -euo pipefail, quote variables, and check DIR is set (for example ${DIR:?})", "Nothing; an empty variable is skipped", "It deletes only DIR", "It asks for confirmation"],
      0, ["An empty $DIR turns the path into /*; failing fast and guarding the variable stop it.", "Bash expands it to an empty string.", "DIR is empty, so there's no DIR in the path.", "rm -rf never asks."])),

    B(2, "Kubernetes", ["kubernetes", "orchestration"], ["o4"], [
      ["What it is", "Running containers at scale", [
        "Kubernetes runs containers across a cluster of machines, keeping the number you asked for running and replacing ones that fail.",
        "You describe the desired state; Kubernetes works to make reality match."]],
      ["Core ideas", "Pods, deployments, services", [
        "A pod is one or more containers scheduled together on a node.",
        "A deployment keeps N replicas of a pod running and rolls out new versions gradually.",
        "A service gives pods a stable address and load-balances between them; an ingress routes outside traffic in.",
        "Liveness and readiness probes tell Kubernetes when to restart a container and when to send it traffic."]],
      ["The trade-offs", "Powerful and heavy", [
        "Kubernetes is a lot to run and learn; a managed service (EKS, GKE, AKS) or a simpler platform may be enough.",
        "Resource requests and limits must be set, or pods get evicted or starve neighbours.",
        "YAML grows fast; templates (Helm, Kustomize) help and add their own complexity."]],
      ["In practice", "What you'll see at work", [
        "kubectl get pods, describe, logs: the first three commands in any incident.",
        "CrashLoopBackOff: the container keeps exiting; read its logs and recent changes.",
        "Rolling updates with readiness probes, so traffic only reaches pods that are ready."]],
    ], Q("cl-b-02", "Platform Engineer", ["kubernetes"], ["o4"],
      "During a rolling update, users get errors for a few seconds as each new pod starts. What's usually missing?",
      ["A readiness probe, so traffic goes to a pod only once it can serve", "More replicas of the old version", "A bigger node", "A longer liveness timeout"],
      0, ["Without readiness, Kubernetes sends traffic as soon as the container starts.", "It doesn't stop traffic reaching unready pods.", "Size isn't the issue.", "Liveness decides restarts, not traffic."])),

    B(3, "Infrastructure as code", ["infrastructure as code", "terraform"], ["l2"], [
      ["What it is", "Servers and networks written as code", [
        "Infrastructure as code (IaC) describes cloud resources in files (Terraform, Pulumi, CloudFormation) that a tool applies.",
        "The same review, history and repeatability you have for application code, applied to infrastructure."]],
      ["Core ideas", "Declare, plan, apply", [
        "You declare what should exist; the tool compares it with what does and plans the changes.",
        "Always read the plan before applying: it shows what will be created, changed or destroyed.",
        "State records what the tool manages; keep it remote, locked and backed up.",
        "Modules package repeated patterns (a standard service, a network)."]],
      ["The trade-offs", "Discipline pays, drift hurts", [
        "Changes made by hand in the console drift from the code and get overwritten or cause surprises.",
        "Some changes replace a resource (destroy and recreate); the plan says so, so read it.",
        "Very large single configurations get slow and risky; split by area."]],
      ["In practice", "What you'll see at work", [
        "Plans posted on pull requests; applies run from CI, not laptops.",
        "Separate environments (staging, production) with the same modules.",
        "Prevent-destroy protection on databases and storage."]],
    ], Q("cl-b-03", "DevOps Engineer", ["terraform"], ["l2"],
      "A Terraform plan for a small change shows the production database will be 'destroyed and recreated'. What do you do?",
      ["Stop: find which attribute forces replacement, change the approach (or protect the resource), and never apply a plan that destroys data unexpectedly", "Apply it; Terraform knows best", "Apply it at night", "Delete the state file"],
      0, ["Replacement of a database loses its data; the plan is warning you.", "The tool does what the code says, not what you meant.", "Timing doesn't save the data.", "That makes Terraform forget what it manages, which is worse."])),

    B(4, "CI/CD", ["ci/cd", "pipelines", "deployment"], ["l2"], [
      ["What it is", "From commit to production, automatically", [
        "Continuous integration builds and tests every change; continuous delivery makes every passing change ready to deploy, and continuous deployment ships it.",
        "The goal is small, frequent, boring releases."]],
      ["Core ideas", "Build once, promote", [
        "Every push runs the pipeline: build, test, scan, package.",
        "Build one artifact (an image) and promote that same artifact through staging to production.",
        "Deploy gradually (canary, blue-green) with automatic rollback on bad health.",
        "Pipelines are code, kept with the application."]],
      ["The trade-offs", "Speed against safety", [
        "Long pipelines slow everyone down; cache dependencies and run tests in parallel.",
        "Flaky tests erode trust in the pipeline; fix or quarantine them.",
        "Secrets in pipelines are a favourite target; scope and rotate them."]],
      ["In practice", "What you'll see at work", [
        "GitHub Actions, GitLab CI, Jenkins or a cloud service.",
        "Main always deployable; changes merged small and often.",
        "Deployment frequency and change failure rate tracked (DORA metrics)."]],
    ], Q("cl-b-04", "DevOps Engineer", ["ci/cd"], ["l2"],
      "Staging passes, but production behaves differently because the image was rebuilt for production with newer dependencies. What principle fixes this?",
      ["Build once and promote the same artifact through every environment", "Test more in production", "Rebuild for staging too", "Pin nothing and hope"],
      0, ["The thing tested is the thing shipped.", "That moves the risk to users.", "Two rebuilds can differ in the same way.", "That's the cause."])),

    B(5, "Cloud building blocks", ["aws", "cloud", "iam"], ["o4"], [
      ["What it is", "The services every cloud offers", [
        "AWS, Azure and Google Cloud offer the same core pieces under different names: compute, storage, networking, databases and identity.",
        "Knowing the categories transfers between providers."]],
      ["Core ideas", "Compute, storage, identity", [
        "Compute: virtual machines (EC2), containers (ECS, GKE), functions (Lambda) — less to manage as you go right, and less control.",
        "Storage: object storage (S3) for files, block storage for disks, managed databases for data.",
        "Networking: virtual private clouds, subnets, security groups, load balancers.",
        "Identity (IAM): who or what may do which action on which resource; roles for services, not long-lived keys."]],
      ["The trade-offs", "Managed or self-run", [
        "Managed services save operations work and cost more per unit, and tie you to the provider.",
        "Serverless scales to zero and has cold starts and limits.",
        "Everything is billed by use; forgotten resources cost money forever."]],
      ["In practice", "What you'll see at work", [
        "Accounts or projects separated by environment.",
        "Tags on every resource for cost and ownership.",
        "No access keys on laptops; short-lived credentials through single sign-on."]],
    ], Q("cl-b-05", "Cloud Engineer", ["iam"], ["o4"],
      "An application on a cloud VM needs to read one storage bucket. How should it get access?",
      ["Attach a role to the VM that allows reading only that bucket", "Put an administrator's access key in the app's config file", "Make the bucket public", "Share a team password"],
      0, ["Short-lived role credentials with least privilege; no keys to leak.", "A leaked admin key compromises everything.", "Anyone could read the data.", "Not how cloud access works, and unsafe."])),
  ],
});
