# Decks v17 — security, Cloud and infrastructure security, Offence and defence, Governance, Interview (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 9 five-slide decks, each with one new question. **APPROVED by the owner 2026-11-08** — served in the Library; the questions are live in the bank.

## se-ci-01 · Identity and access
*Skills:* iam, mfa, zero trust · *Check yourself:* se-ci-01-q1

**1. What it is — Who can do what, everywhere**
- Identity and access management (IAM) decides which people and services can use which systems and data.
- Most breaches involve stolen or misused credentials, so this is the front door.

**2. Core ideas — Authenticate strongly, authorise narrowly**
- Single sign-on gives one strong identity per person, with multi-factor authentication (passkeys or app-based codes, not SMS where avoidable).
- Roles and groups grant access; nobody gets permissions one at a time by hand.
- Least privilege and just-in-time elevation keep standing access small.
- Joiner, mover, leaver: access changes the day someone's role changes or they leave.

**3. The trade-offs — Friction against risk**
- Strong authentication adds steps; phishing-resistant methods (passkeys) add little friction.
- Shared accounts are convenient and make every action anonymous.
- Service accounts outnumber people and are often the weakest; give them owners.

**4. In practice — What you'll see at work**
- Quarterly access reviews by each system's owner.
- Alerts on new admin grants and on sign-ins from unusual places.
- Break-glass accounts locked away, monitored and tested.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-ci-01-q1).** An employee left three months ago, and their account still signed in yesterday. What process failed?
- ✅ Leaver deprovisioning: access should be removed the day someone leaves, ideally automatically from the HR system — *Offboarding must remove access promptly and completely.*
- Password rotation — *Rotation doesn't remove the account.*
- Firewall rules — *Unrelated to identity lifecycle.*
- Backups — *Unrelated.*

## se-ci-03 · Detection and logging
*Skills:* siem, logging, detection · *Check yourself:* se-ci-03-q1

**1. What it is — Noticing an attack in progress**
- Prevention eventually fails; detection finds attackers before they finish.
- It depends on collecting the right logs and turning them into alerts people act on.

**2. Core ideas — Collect, correlate, alert**
- Collect security-relevant logs: sign-ins, admin actions, cloud API calls, network flows, endpoint events.
- Send them to a central store (a SIEM) where they're kept, searched and correlated.
- Detections are rules or models for suspicious patterns: impossible travel, mass downloads, new admin users.
- Every alert needs a response plan; unreviewed alerts are noise.

**3. The trade-offs — Coverage against noise and cost**
- Logging everything is expensive; prioritise what attackers touch.
- Too many low-quality alerts bury the real one; tune continuously.
- Attackers delete local logs, so ship them off the machine quickly.

**4. In practice — What you'll see at work**
- Detections mapped to MITRE ATT&CK techniques to find gaps.
- Log retention long enough to investigate an intrusion found months later.
- Regular tests: simulate an attack and check it's detected.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-ci-03-q1).** Investigating a breach, you find the attacker was inside for four months, but logs are only kept for 30 days. What should change?
- ✅ Keep security logs centrally for long enough to investigate slow intrusions (often a year), off the affected machines — *Long-dwell attacks need long retention to reconstruct.*
- Delete logs faster to save money — *Makes it worse.*
- Log less — *Fewer logs means less to investigate with.*
- Rely on memory of the team — *Not a record.*

## se-o-01 · Penetration-testing basics
*Skills:* penetration testing, ethical hacking · *Check yourself:* se-o-01-q1

**1. What it is — Attacking your own systems, with permission**
- A penetration test is an authorised, scoped attempt to break into systems, to find weaknesses before real attackers do.
- Written permission and a clear scope come before any testing.

**2. Core ideas — Recon, exploit, report**
- Reconnaissance: map what's exposed (hosts, ports, apps, people).
- Find and confirm vulnerabilities; exploit carefully to show real impact without damage.
- Pivot: from one foothold, see what else is reachable.
- Report: each finding with evidence, risk, and a fix, written for the people who must fix it.

**3. The trade-offs — Snapshot, not guarantee**
- A test covers a scope at a moment; new code brings new bugs.
- Automated scanners are broad and shallow; manual testing is narrow and deep.
- Testing production finds real issues and risks real disruption; agree the rules first.

**4. In practice — What you'll see at work**
- Rules of engagement signed before starting.
- Burp Suite, nmap and common tools, used only within scope.
- Retests to confirm fixes.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-o-01-q1).** You find a system outside the agreed scope that looks vulnerable during a test. What do you do?
- ✅ Stop, don't test it, and report it to the client to decide whether to add it to scope — *Testing outside written scope is unauthorised access.*
- Test it quickly since it's vulnerable — *Being vulnerable doesn't make it authorised.*
- Ignore it entirely — *Reporting it helps the client.*
- Post about it publicly — *Never.*

## se-o-02 · Red and blue teams
*Skills:* red team, blue team, purple team · *Check yourself:* se-o-02-q1

**1. What it is — Practising attack and defence together**
- A red team simulates a real adversary against the organisation; a blue team defends and detects.
- Purple teaming puts them side by side to improve detection quickly.

**2. Core ideas — Goals, not just bugs**
- Red teams pursue an objective (reach the customer database) by any realistic path, often quietly over weeks.
- Blue teams monitor, detect, respond and harden.
- Exercises are measured by detection and response: how fast was it spotted, and contained?
- Findings feed new detections and fixes.

**3. The trade-offs — Realism against cost**
- Full red-team exercises are expensive and need mature defences to be worth it.
- Secret exercises test real response but can cause alarm; leadership must know.
- Purple exercises improve faster and test less realistically.

**4. In practice — What you'll see at work**
- Attack paths described with MITRE ATT&CK.
- Tabletop exercises for leadership.
- Detection gaps tracked to closure.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-o-02-q1).** After a red-team exercise, what's the most valuable output for the blue team?
- ✅ A timeline of the attack steps with what was and wasn't detected, turned into new detections and fixes — *Detection gaps mapped to steps are directly actionable.*
- A score out of ten — *A score says little about what to fix.*
- A list of tools the red team used — *Useful context, but not the main value.*
- A certificate — *Not useful.*

## se-o-03 · Incident response and forensics
*Skills:* incident response, forensics · *Check yourself:* se-o-03-q1

**1. What it is — Handling a breach**
- Security incident response contains an attack, removes the attacker, recovers systems and learns from it.
- Forensics gathers evidence of what happened, carefully enough to rely on.

**2. Core ideas — Prepare, contain, eradicate, recover**
- Prepare: plans, contacts, logging and tools in place before anything happens.
- Contain: isolate affected systems and disable compromised accounts, without destroying evidence.
- Eradicate the attacker's access everywhere, then recover from known-good state.
- Preserve evidence (disk and memory images, logs) with a record of who handled it.

**3. The trade-offs — Speed against evidence**
- Wiping a machine stops the attacker there and destroys evidence of how far they got.
- Acting before you know the full scope can tip off the attacker.
- Legal and notification duties start early; involve legal and communications.

**4. In practice — What you'll see at work**
- An incident retainer with outside responders.
- Playbooks for common cases: ransomware, account takeover, data leak.
- Credentials reset broadly after a confirmed intrusion.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-o-03-q1).** A server shows signs of compromise. A teammate wants to reinstall it immediately. What should happen first?
- ✅ Isolate it from the network and capture evidence (memory and disk image, logs) before rebuilding — *Isolation stops spread; evidence shows how they got in and what else they reached.*
- Reinstall it right away — *Destroys evidence of scope.*
- Leave it running normally to watch — *The attacker keeps working.*
- Turn it off and throw it away — *Loses evidence and doesn't find other compromised systems.*

## se-g-01 · Risk and compliance basics
*Skills:* risk management, compliance, soc 2 · *Check yourself:* se-g-01-q1

**1. What it is — Security as a managed business risk**
- Governance decides which risks matter, who owns them and what's done about them.
- Compliance frameworks (SOC 2, ISO 27001, PCI DSS, GDPR) set requirements customers and laws expect.

**2. Core ideas — Risks, controls, evidence**
- A risk register lists risks with likelihood, impact, owner and treatment.
- Controls are the measures that reduce risk: access reviews, encryption, backups, training.
- Audits check that controls exist and work, using evidence.
- Policies say what must happen; procedures say how.

**3. The trade-offs — Compliant isn't the same as secure**
- Passing an audit shows controls on paper; attackers test them in practice.
- Too much process slows teams and pushes work around controls.
- Automating evidence (from systems, not screenshots) makes audits cheaper and more honest.

**4. In practice — What you'll see at work**
- Security questionnaires from customers before they buy.
- Annual audits with continuous evidence collection.
- Data protection duties: knowing what personal data you hold and why.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-g-01-q1).** A company passed its SOC 2 audit, then suffered a breach through an unpatched server. What does this show?
- ✅ Compliance shows controls exist on paper at audit time; security needs them to work continuously (patching, monitoring) — *Audits sample controls; they don't guarantee them.*
- The audit was fake — *Not necessarily.*
- SOC 2 prevents breaches — *It doesn't guarantee that.*
- Servers can't be patched — *They can.*

## se-iv-01 · Threat-modelling rounds
*Skills:* threat modelling interview · *Check yourself:* se-iv-01-q1

**1. What it is — Find the risks in a design, live**
- You're shown a system (a file-sharing app, a payments flow) and asked what could go wrong and what you'd do about it.
- They're scoring structure and prioritisation.

**2. Core ideas — A method out loud**
- Clarify the system and draw the data flow with trust boundaries.
- Walk the boundaries with STRIDE or similar prompts.
- Rank threats by impact and likelihood; don't list 40 equally.
- Propose practical mitigations and say what you'd accept.

**3. The trade-offs — Breadth against depth**
- Listing every possible threat runs out the clock; go deep on the top few.
- Mitigations that break the product won't be adopted; balance them.
- Say your assumptions; the interviewer may change them.

**4. In practice — How to prepare**
- Practise on three common systems with a timer.
- Know the usual mitigations for each STRIDE category.
- Bring a real example from your own work.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-iv-01-q1).** In a threat-modelling round you've listed 25 threats in 10 minutes. What's the better next move?
- ✅ Rank them and go deep on the top few: why they matter, how likely, and specific mitigations — *Prioritising shows judgement, which is what's being scored.*
- List 25 more — *Volume isn't insight.*
- Stop and wait for questions — *Lead the discussion.*
- Pick one at random — *Not a method.*

## se-iv-02 · Incident scenarios
*Skills:* incident response interview · *Check yourself:* se-iv-02-q1

**1. What it is — 'An alert fires; walk us through it'**
- Interviewers describe an incident (a suspicious login, ransomware on a laptop) and ask what you'd do step by step.
- They're scoring calm, order, and knowing when to escalate.

**2. Core ideas — Triage to recovery**
- Triage: is it real, how severe, what's affected?
- Contain with minimal evidence loss; escalate and involve the right people.
- Investigate scope: other accounts, other machines, data accessed.
- Recover, then improve detections and controls.

**3. The trade-offs — Act fast, but in order**
- Overreacting (shutting down everything) has costs; underreacting lets it spread.
- Communicating clearly to non-technical people is part of the job.
- Say what evidence you'd look at and why.

**4. In practice — How to prepare**
- Practise with common scenarios: phishing, credential theft, ransomware, data exfiltration.
- Know a framework (NIST or SANS phases) to structure answers.
- Have one real incident story ready.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-iv-02-q1).** Scenario: a user reports they entered their password on a fake login page an hour ago. What are your first steps?
- ✅ Reset their password and sessions, check sign-in logs for use of the account, and look for the same phishing email sent to others — *Contain the credential, check for misuse, and find other victims.*
- Tell them to be more careful next time — *Doesn't contain anything.*
- Wait for suspicious activity — *The attacker may already be in.*
- Wipe their laptop immediately — *The laptop may not be involved at all.*

## se-iv-03 · Code-review exercises
*Skills:* secure code review interview · *Check yourself:* se-iv-03-q1

**1. What it is — Find the bugs in a snippet**
- You're given code (often a small web endpoint) and asked to find security issues and propose fixes.
- They're checking that you can spot real vulnerabilities and explain them.

**2. Core ideas — Trace input to sinks**
- Identify untrusted inputs: parameters, headers, cookies, uploaded files.
- Follow them to dangerous sinks: queries, shell commands, HTML output, file paths, redirects, deserialisation.
- Check authentication and authorisation on every action.
- Propose a specific fix and explain why it works.

**3. The trade-offs — Real issues over style**
- Commenting on naming wastes time; focus on exploitable flaws.
- Rank findings by severity.
- Explain impact in plain words: what an attacker could actually do.

**4. In practice — How to prepare**
- Practise on deliberately vulnerable apps (OWASP Juice Shop, WebGoat).
- Know the fix for each common class.
- Read real security advisories for familiar libraries.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (se-iv-03-q1).** A snippet builds a SQL query with f"SELECT * FROM users WHERE name = '{name}'". What do you say?
- ✅ SQL injection: user input becomes SQL; use a parameterised query with the name as a bound parameter — *Parameters keep data separate from code.*
- It's fine if the name is short — *Length doesn't stop injection.*
- Escape quotes by hand — *Hand-escaping is easy to get wrong.*
- Use SELECT name instead of SELECT * — *Changing columns doesn't fix injection.*
