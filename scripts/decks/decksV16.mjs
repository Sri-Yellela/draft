#!/usr/bin/env node
// ⭐ D155 Part C · decks-v16 — security: Foundations (4) and Application security (3; authentication and sessions reuses
// sw-b-02). Drafted by the agent 2026-11-08 for the owner's review. node scripts/decks/decksV16.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

const F = (n, title, skills, pieces, slides, q) => deck(`se-f-0${n}`, "security", "foundations", title, skills, pieces, slides, q);
const A = (n, title, skills, pieces, slides, q) => deck(`se-a-0${n}`, "security", "application-security", title, skills, pieces, slides, q);
const Q = (id, role, level, skills, pieces, stem, choices, correct, why) => question(`${id}-q1`, role, level, skills, pieces, stem, choices, correct, why);

writeBatch({
  version: 16,
  title: "security, Foundations and Application security",
  note: "Drafted by the agent 2026-11-08 for the owner's review (D155 Part C, approved; D154 P4 format). Pathway 'security', stages 'foundations' (4) and 'application-security' (3; authentication and sessions reuses sw-b-02). Nothing is live until approved (status: draft).",
  decks: [
    F(1, "Networking for security", ["networking", "tcp/ip", "firewalls"], ["sec1", "w2"], [
      ["What it is", "Seeing traffic the way an attacker does", [
        "Security work starts with how data moves: addresses, ports, protocols, and what can reach what.",
        "Most attacks cross a network, so most defences sit on one."]],
      ["Core ideas", "Layers, ports, segmentation", [
        "Packets carry source and destination addresses and ports; TCP sets up a connection with a handshake, UDP doesn't.",
        "Firewalls and security groups allow or deny by address, port and protocol; default deny is the safe stance.",
        "Segmentation splits networks so a compromised machine can't reach everything.",
        "TLS encrypts traffic in transit; without it, anyone on the path can read and change it."]],
      ["The trade-offs", "Perimeters aren't enough", [
        "A strong outer firewall with a flat inside lets one breach spread everywhere.",
        "Zero trust assumes the network is hostile and checks identity on every request.",
        "More rules mean more mistakes; review and simplify them."]],
      ["In practice", "What you'll see at work", [
        "Wireshark or tcpdump to see what's actually on the wire.",
        "nmap to see which ports a host exposes (only on systems you're authorised to test).",
        "Internal services reachable only from the networks that need them."]],
    ], Q("se-f-01", "Security Analyst", "entry", ["networking", "segmentation"], ["sec1"],
      "An attacker compromises one web server and can then connect directly to the payroll database. What control was missing?",
      ["Network segmentation: the web tier shouldn't be able to reach the payroll database at all", "A stronger web server password", "A faster firewall", "More logging only"],
      0, ["Segmentation limits how far one compromise spreads.", "Helpful, but the path to payroll shouldn't exist.", "Speed isn't the issue.", "Logging records the attack; it doesn't block it."])),

    F(2, "Operating-system internals", ["operating systems", "privileges", "processes"], ["s3x"], [
      ["What it is", "Where attacks land", [
        "Attacks end up running code on a machine, so knowing how an operating system manages users, processes, memory and files explains what an attacker can do next.",
        "Privilege, isolation and persistence are the key ideas."]],
      ["Core ideas", "Users, privileges, memory", [
        "Processes run as a user; root (Linux) or SYSTEM/Administrator (Windows) can do anything.",
        "Privilege escalation turns a foothold as a normal user into admin, through misconfigurations or vulnerable software.",
        "Memory protections (ASLR, non-executable stacks) make memory-corruption exploits harder.",
        "Persistence: attackers add services, scheduled tasks, startup entries or keys to survive a reboot."]],
      ["The trade-offs", "Usability against hardening", [
        "Running everything as admin is convenient and makes every bug critical.",
        "Patching closes known holes and needs testing and restarts.",
        "Disabling features reduces attack surface and sometimes breaks workflows."]],
      ["In practice", "What you'll see at work", [
        "Services run as dedicated low-privilege users.",
        "Endpoint detection watching for new services, odd parent processes and credential dumping.",
        "Regular patching with a known schedule."]],
    ], Q("se-f-02", "Security Analyst", "entry", ["privileges"], ["s3x"],
      "A web application runs as root. An attacker finds a file-upload bug that lets them run code. Why does running as root matter?",
      ["Their code runs with full control of the machine; as a low-privilege user, the damage would be contained", "It doesn't; the bug is the problem", "Root processes run faster", "Root hides the attack from logs"],
      0, ["The process's privileges are the attacker's privileges.", "Both matter: the bug opens the door, privileges decide the room.", "Not the point.", "Not inherently, though it can alter logs."])),

    F(3, "Cryptography basics", ["cryptography", "encryption", "hashing"], ["k2"], [
      ["What it is", "Keeping data secret and genuine", [
        "Cryptography protects confidentiality (only the right people can read), integrity (nobody changed it) and authenticity (it came from who it says).",
        "You'll use well-tested libraries, never your own algorithms."]],
      ["Core ideas", "Symmetric, asymmetric, hashes, signatures", [
        "Symmetric encryption (AES) uses one shared key: fast, but the key must be shared safely.",
        "Asymmetric encryption (RSA, elliptic curves) uses a public and a private key; TLS uses it to agree a symmetric key.",
        "A hash (SHA-256) is a fixed-size fingerprint; it can't be reversed. Passwords use slow, salted hashes (bcrypt, Argon2).",
        "A digital signature proves who signed and that nothing changed since."]],
      ["The trade-offs", "The maths is rarely the weak point", [
        "Keys leak, get reused or never rotate; key management is the hard part.",
        "Old algorithms (MD5, SHA-1, DES) are broken; replace them.",
        "Encrypting data at rest doesn't help if the attacker gets the application's access too."]],
      ["In practice", "What you'll see at work", [
        "TLS everywhere, with certificates renewed automatically.",
        "Keys in a key-management service, not in code.",
        "Libraries' high-level APIs, configured with safe defaults."]],
    ], Q("se-f-03", "Security Engineer", "entry", ["hashing"], ["k2"],
      "A system stores passwords as plain SHA-256 hashes. After a breach, many are cracked within hours. Why, and what's the fix?",
      ["Fast unsalted hashes can be guessed billions of times a second and matched with precomputed tables; use a slow, salted password hash (bcrypt, scrypt, Argon2)", "SHA-256 is reversible", "The passwords were stored encrypted", "Hashes should be longer"],
      0, ["Password hashing must be deliberately slow and salted.", "It isn't reversible; it's guessable.", "They weren't encrypted.", "Length doesn't fix speed."])),

    F(4, "How the web works, for security", ["web security", "http", "browsers"], ["w2", "w4"], [
      ["What it is", "The browser's rules of trust", [
        "Web security rests on how browsers handle origins, cookies and scripts.",
        "Most web attacks trick the browser or the server into trusting the wrong thing."]],
      ["Core ideas", "Origins, cookies, requests", [
        "The same-origin policy stops a page from one origin (scheme, host, port) reading another's data.",
        "Cookies are sent automatically with requests to their site; flags (HttpOnly, Secure, SameSite) limit them.",
        "CORS lets a server allow specific other origins to read its responses.",
        "Every input from the client can be forged: headers, cookies, hidden fields, prices."]],
      ["The trade-offs", "Convenience opens doors", [
        "Loose CORS ('allow any origin with credentials') undoes the same-origin protection.",
        "Automatically sent cookies make cross-site request forgery possible unless SameSite or tokens stop it.",
        "Client-side checks help users; only server-side checks protect anything."]],
      ["In practice", "What you'll see at work", [
        "Browser developer tools and an intercepting proxy (Burp, ZAP) to see and change requests.",
        "Security headers reviewed on every app.",
        "Prices and permissions recomputed on the server, never trusted from the client."]],
    ], Q("se-f-04", "Security Analyst", "entry", ["web security"], ["w4"],
      "A checkout form sends the price in a hidden field, and the server charges whatever price arrives. What's the vulnerability?",
      ["The client controls the price; the server must look up prices itself", "Hidden fields are encrypted, so it's safe", "It's only a problem without HTTPS", "Browsers block edited hidden fields"],
      0, ["Anything from the client can be changed with a proxy or dev tools.", "They're plain text.", "HTTPS doesn't stop the user changing their own request.", "They don't."])),

    A(1, "Common vulnerabilities (OWASP)", ["owasp", "injection", "access control"], ["k2"], [
      ["What it is", "The usual ways applications break", [
        "The OWASP Top 10 lists the most common serious web application risks, updated every few years.",
        "Knowing them by example is the baseline for builders and testers."]],
      ["Core ideas", "The big ones", [
        "Broken access control: a user can see or change another user's data by changing an id (insecure direct object references).",
        "Injection: input becomes part of a query or command (SQL injection); parameterised queries prevent it.",
        "Cryptographic failures: sensitive data unencrypted, weak algorithms, exposed keys.",
        "Security misconfiguration, vulnerable components, and server-side request forgery (SSRF) round out the common list."]],
      ["The trade-offs", "Frameworks help, until bypassed", [
        "Modern frameworks prevent many classes by default; raw queries and custom auth bring them back.",
        "Automated scanners find injection better than access-control bugs; those need a person thinking about who should see what.",
        "Fixing one instance leaves the pattern elsewhere; fix the pattern."]],
      ["In practice", "What you'll see at work", [
        "Authorization checked on the server for every object, not just at login.",
        "Parameterised queries everywhere; linters flag string-built SQL.",
        "Dependency scanning in CI."]],
    ], Q("se-a-01", "Application Security Engineer", "mid", ["access control"], ["k2"],
      "Changing /api/invoices/1001 to /api/invoices/1002 shows another customer's invoice. What's the flaw and the fix?",
      ["Broken access control (an insecure direct object reference); check on the server that the invoice belongs to the signed-in user", "Invoices need longer ids", "The URL should be encrypted", "Add a captcha"],
      0, ["Every object access needs an ownership or permission check.", "Hard-to-guess ids slow attackers; they don't fix the missing check.", "Encryption doesn't add authorization.", "Unrelated."])),

    A(2, "Secure code review", ["code review", "secure coding"], ["k2"], [
      ["What it is", "Reading code for what could go wrong", [
        "Secure code review looks at changes for security flaws before they ship.",
        "It's cheaper to catch a vulnerability in review than after a breach."]],
      ["Core ideas", "Follow the data", [
        "Trace untrusted input (requests, files, headers) to where it's used: queries, commands, HTML, file paths, redirects.",
        "Check every access decision: who is allowed, and is it checked on the server?",
        "Look for secrets, unsafe defaults, disabled checks, and error messages that leak internals.",
        "Static analysis (SAST) finds patterns at scale; people find logic flaws."]],
      ["The trade-offs", "Depth against flow", [
        "Reviewing everything deeply slows delivery; focus deep review on risky areas (auth, payments, uploads, parsing).",
        "Tool findings need triage; noisy tools get ignored.",
        "A checklist helps consistency; thinking like an attacker finds what checklists miss."]],
      ["In practice", "What you'll see at work", [
        "Security champions in each team.",
        "A short secure-review checklist in the pull-request template.",
        "SAST and secret scanning in CI, with findings triaged."]],
    ], Q("se-a-02", "Application Security Engineer", "mid", ["code review"], ["k2"],
      "Reviewing a change, you see `os.system('convert ' + uploaded_filename + ' out.png')`. What's the concern?",
      ["Command injection: a crafted filename can run arbitrary commands; use a library call or pass arguments as a list without a shell", "The image might be large", "PNG is the wrong format", "os.system is slow"],
      0, ["User input reaches a shell; argument lists avoid shell parsing.", "Size isn't the security issue.", "Not the problem.", "Speed isn't the issue."])),

    A(3, "Threat modelling", ["threat modelling", "stride"], ["k2"], [
      ["What it is", "Thinking about attacks before they happen", [
        "Threat modelling asks, for a system or feature: what are we building, what can go wrong, what will we do about it, and did we do a good job?",
        "It's most useful at design time, when changes are cheap."]],
      ["Core ideas", "Draw, ask, decide", [
        "Draw the data flow: users, services, data stores, and the trust boundaries between them.",
        "At each boundary, ask what could go wrong; STRIDE is a prompt: spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege.",
        "Rank threats by likelihood and impact.",
        "Decide per threat: mitigate, accept, transfer or avoid, and record it."]],
      ["The trade-offs", "Enough, not perfect", [
        "A one-hour session on a key feature beats a perfect model nobody finishes.",
        "Models go stale as the system changes; revisit them with big changes.",
        "Involve the builders; a model written only by security rarely changes the design."]],
      ["In practice", "What you'll see at work", [
        "A threat-model section in design documents.",
        "Diagrams with trust boundaries marked.",
        "Mitigations turned into tickets with owners."]],
    ], Q("se-a-03", "Security Engineer", "mid", ["threat modelling"], ["k2"],
      "When is a threat model most useful for a new feature?",
      ["During design, before it's built, when changing the design is cheap", "After launch, during an incident", "Only once a year for the whole company", "Never; scanners are enough"],
      0, ["Design-time changes are cheapest and fix whole classes of problems.", "Too late for cheap fixes.", "Too coarse and too rare.", "Scanners miss design flaws."])),
  ],
});
