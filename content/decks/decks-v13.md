# Decks v13 — cloud, DevOps and SRE, Foundations and Building blocks (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 7 five-slide decks, each with one new question. **APPROVED by the owner 2026-11-08** — served in the Library; the questions are live in the bank.

## cl-f-01 · Linux
*Skills:* linux, shell · *Check yourself:* cl-f-01-q1

**1. What it is — The operating system most servers run**
- Almost every cloud server and container runs Linux. Working comfortably in its shell is the base skill for operations work.
- Everything is a file or a process, and small tools combine through pipes.

**2. Core ideas — Processes, files, permissions, services**
- Processes: ps, top, kill; each has a PID, an owner and limits.
- Files and permissions: owner, group, others; read, write, execute; root can do anything, so avoid working as root.
- Services run under systemd (systemctl status, journalctl -u for logs).
- Pipes chain tools: grep, awk, sort, uniq, tail -f turn logs into answers.

**3. The trade-offs — Power and sharp edges**
- A single command can delete everything; check paths, especially with rm -rf and variables.
- Changes made by hand on a server are lost or forgotten; write them as code (see infrastructure as code).
- Distributions differ (Debian/Ubuntu apt, Red Hat dnf), in package names and paths.

**4. In practice — What you'll see at work**
- Disk full: df -h, then du to find what grew (often logs).
- High load: top, then which process, then why.
- SSH keys, not passwords, and sudo for the few commands that need root.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-f-01-q1).** A server's application stops writing logs and errors say 'No space left on device'. What do you check first?
- ✅ df -h to see which filesystem is full, then du to find what grew (often old logs), and set up log rotation — *Find what filled the disk, free it, and stop it recurring.*
- Restart the server — *It may come back up full.*
- Add more RAM — *Memory isn't disk.*
- Reinstall the application — *The disk is still full.*

## cl-f-02 · Networking for operations
*Skills:* networking, dns, load balancers · *Check yourself:* cl-f-02-q1

**1. What it is — How requests find your servers**
- Every request crosses DNS, IP routing, ports, TLS and usually a load balancer before reaching your code.
- Most 'the site is down' incidents are a broken link in that chain.

**2. Core ideas — IP, ports, DNS, balancers**
- IP addresses identify machines; ports identify services on them (443 for HTTPS); private networks (10.x, 192.168.x) aren't reachable from the internet.
- TCP gives reliable ordered connections; UDP is lighter and unordered.
- DNS maps names to addresses; records are cached for their TTL, so changes take time to spread.
- Load balancers spread traffic across healthy servers and remove ones failing health checks.

**3. The trade-offs — Layers to debug**
- Firewalls and security groups block by default; a missing rule looks like a timeout.
- Long DNS TTLs reduce lookups and slow down emergency changes.
- Layer 4 balancers are fast and simple; layer 7 balancers can route by path and header.

**4. In practice — What you'll see at work**
- dig or nslookup for DNS; curl -v for the whole request; nc or telnet to test a port.
- A timeout usually means something blocked or nothing listening; 'connection refused' means the host answered and nothing listens on that port.
- Lower the DNS TTL a day before planned changes.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-f-02-q1).** A new service is unreachable: curl to its port hangs until it times out, but the process is running and listening. What's the likeliest cause?
- ✅ A firewall or security group isn't allowing traffic to that port — *A silent drop (hang then timeout) points at a firewall; a wrong port usually gives 'connection refused'.*
- DNS is cached — *DNS would give the wrong address or fail to resolve.*
- The service is listening on the wrong port number — *That usually gives an immediate refusal.*
- TLS certificates expired — *TLS errors appear after connecting.*

## cl-f-03 · Scripting
*Skills:* bash, python, automation · *Check yourself:* cl-f-03-q1

**1. What it is — Automating the boring parts**
- Scripts in Bash or Python automate repeated tasks: deployments, backups, clean-ups, checks.
- A task done by hand twice is a candidate for a script.

**2. Core ideas — Safe scripts**
- In Bash, start with set -euo pipefail so errors stop the script instead of continuing silently.
- Quote variables ("$file") so spaces don't split them.
- Python is better once there's logic, data parsing or an API to call.
- Make scripts idempotent: running twice does no harm.

**3. The trade-offs — Quick script or real tool**
- Bash is everywhere and fast to write, and gets unreadable past a page.
- A script that only one person understands is a risk; keep it in version control with a short usage note.
- Hard-coded secrets in scripts leak; read them from the environment or a secrets manager.

**4. In practice — What you'll see at work**
- A --dry-run flag that shows what would change.
- Logs of what the script did, with timestamps.
- shellcheck run on every Bash script.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-f-03-q1).** A Bash clean-up script runs `rm -rf $DIR/*`. One day DIR is empty because an earlier command failed. What happens, and what prevents it?
- ✅ It deletes from / (the root); use set -euo pipefail, quote variables, and check DIR is set (for example ${DIR:?}) — *An empty $DIR turns the path into /*; failing fast and guarding the variable stop it.*
- Nothing; an empty variable is skipped — *Bash expands it to an empty string.*
- It deletes only DIR — *DIR is empty, so there's no DIR in the path.*
- It asks for confirmation — *rm -rf never asks.*

## cl-b-02 · Kubernetes
*Skills:* kubernetes, orchestration · *Check yourself:* cl-b-02-q1

**1. What it is — Running containers at scale**
- Kubernetes runs containers across a cluster of machines, keeping the number you asked for running and replacing ones that fail.
- You describe the desired state; Kubernetes works to make reality match.

**2. Core ideas — Pods, deployments, services**
- A pod is one or more containers scheduled together on a node.
- A deployment keeps N replicas of a pod running and rolls out new versions gradually.
- A service gives pods a stable address and load-balances between them; an ingress routes outside traffic in.
- Liveness and readiness probes tell Kubernetes when to restart a container and when to send it traffic.

**3. The trade-offs — Powerful and heavy**
- Kubernetes is a lot to run and learn; a managed service (EKS, GKE, AKS) or a simpler platform may be enough.
- Resource requests and limits must be set, or pods get evicted or starve neighbours.
- YAML grows fast; templates (Helm, Kustomize) help and add their own complexity.

**4. In practice — What you'll see at work**
- kubectl get pods, describe, logs: the first three commands in any incident.
- CrashLoopBackOff: the container keeps exiting; read its logs and recent changes.
- Rolling updates with readiness probes, so traffic only reaches pods that are ready.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-b-02-q1).** During a rolling update, users get errors for a few seconds as each new pod starts. What's usually missing?
- ✅ A readiness probe, so traffic goes to a pod only once it can serve — *Without readiness, Kubernetes sends traffic as soon as the container starts.*
- More replicas of the old version — *It doesn't stop traffic reaching unready pods.*
- A bigger node — *Size isn't the issue.*
- A longer liveness timeout — *Liveness decides restarts, not traffic.*

## cl-b-03 · Infrastructure as code
*Skills:* infrastructure as code, terraform · *Check yourself:* cl-b-03-q1

**1. What it is — Servers and networks written as code**
- Infrastructure as code (IaC) describes cloud resources in files (Terraform, Pulumi, CloudFormation) that a tool applies.
- The same review, history and repeatability you have for application code, applied to infrastructure.

**2. Core ideas — Declare, plan, apply**
- You declare what should exist; the tool compares it with what does and plans the changes.
- Always read the plan before applying: it shows what will be created, changed or destroyed.
- State records what the tool manages; keep it remote, locked and backed up.
- Modules package repeated patterns (a standard service, a network).

**3. The trade-offs — Discipline pays, drift hurts**
- Changes made by hand in the console drift from the code and get overwritten or cause surprises.
- Some changes replace a resource (destroy and recreate); the plan says so, so read it.
- Very large single configurations get slow and risky; split by area.

**4. In practice — What you'll see at work**
- Plans posted on pull requests; applies run from CI, not laptops.
- Separate environments (staging, production) with the same modules.
- Prevent-destroy protection on databases and storage.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-b-03-q1).** A Terraform plan for a small change shows the production database will be 'destroyed and recreated'. What do you do?
- ✅ Stop: find which attribute forces replacement, change the approach (or protect the resource), and never apply a plan that destroys data unexpectedly — *Replacement of a database loses its data; the plan is warning you.*
- Apply it; Terraform knows best — *The tool does what the code says, not what you meant.*
- Apply it at night — *Timing doesn't save the data.*
- Delete the state file — *That makes Terraform forget what it manages, which is worse.*

## cl-b-04 · CI/CD
*Skills:* ci/cd, pipelines, deployment · *Check yourself:* cl-b-04-q1

**1. What it is — From commit to production, automatically**
- Continuous integration builds and tests every change; continuous delivery makes every passing change ready to deploy, and continuous deployment ships it.
- The goal is small, frequent, boring releases.

**2. Core ideas — Build once, promote**
- Every push runs the pipeline: build, test, scan, package.
- Build one artifact (an image) and promote that same artifact through staging to production.
- Deploy gradually (canary, blue-green) with automatic rollback on bad health.
- Pipelines are code, kept with the application.

**3. The trade-offs — Speed against safety**
- Long pipelines slow everyone down; cache dependencies and run tests in parallel.
- Flaky tests erode trust in the pipeline; fix or quarantine them.
- Secrets in pipelines are a favourite target; scope and rotate them.

**4. In practice — What you'll see at work**
- GitHub Actions, GitLab CI, Jenkins or a cloud service.
- Main always deployable; changes merged small and often.
- Deployment frequency and change failure rate tracked (DORA metrics).

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-b-04-q1).** Staging passes, but production behaves differently because the image was rebuilt for production with newer dependencies. What principle fixes this?
- ✅ Build once and promote the same artifact through every environment — *The thing tested is the thing shipped.*
- Test more in production — *That moves the risk to users.*
- Rebuild for staging too — *Two rebuilds can differ in the same way.*
- Pin nothing and hope — *That's the cause.*

## cl-b-05 · Cloud building blocks
*Skills:* aws, cloud, iam · *Check yourself:* cl-b-05-q1

**1. What it is — The services every cloud offers**
- AWS, Azure and Google Cloud offer the same core pieces under different names: compute, storage, networking, databases and identity.
- Knowing the categories transfers between providers.

**2. Core ideas — Compute, storage, identity**
- Compute: virtual machines (EC2), containers (ECS, GKE), functions (Lambda) — less to manage as you go right, and less control.
- Storage: object storage (S3) for files, block storage for disks, managed databases for data.
- Networking: virtual private clouds, subnets, security groups, load balancers.
- Identity (IAM): who or what may do which action on which resource; roles for services, not long-lived keys.

**3. The trade-offs — Managed or self-run**
- Managed services save operations work and cost more per unit, and tie you to the provider.
- Serverless scales to zero and has cold starts and limits.
- Everything is billed by use; forgotten resources cost money forever.

**4. In practice — What you'll see at work**
- Accounts or projects separated by environment.
- Tags on every resource for cost and ownership.
- No access keys on laptops; short-lived credentials through single sign-on.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-b-05-q1).** An application on a cloud VM needs to read one storage bucket. How should it get access?
- ✅ Attach a role to the VM that allows reading only that bucket — *Short-lived role credentials with least privilege; no keys to leak.*
- Put an administrator's access key in the app's config file — *A leaked admin key compromises everything.*
- Make the bucket public — *Anyone could read the data.*
- Share a team password — *Not how cloud access works, and unsafe.*
