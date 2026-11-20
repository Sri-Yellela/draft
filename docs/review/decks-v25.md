# Decks v25 — research gaps, Picking an ML algorithm, Deployment patterns compared (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 2 five-slide decks; each ends with one new question (drafts for the bank). **Nothing is live until you approve** — say "approve decks-v25" (or name the decks to change).

## ml-f-05 · Picking an ML algorithm
*Skills:* machine learning, model selection, classification, regression · *Check yourself:* ml-f-05-q1

**1. What it is — Which tool for which job**
- Most problems start with a small set of algorithms: linear and logistic regression, k-nearest neighbours, decision trees, random forests, gradient boosting, support vector machines, and k-means.
- The first question isn't which is best. It's what you're predicting, how much data you have, and whether you must explain the answer.

**2. Core ideas — The grid in four rows**
- A number to predict (price, demand): start with linear regression; move to gradient-boosted trees when the relationships aren't straight lines.
- A category to predict (fraud or not): start with logistic regression; random forests and gradient boosting usually win on tabular data.
- No labels at all, just groups to find: k-means, after scaling the features.
- Few rows, many features, a clear margin between classes: a support vector machine. Similar items near each other: k-nearest neighbours, on small data.

**3. The trade-offs — Accuracy, explanation, cost**
- Linear models are fast and easy to explain, but miss interactions unless you add them.
- Tree ensembles handle mixed features and missing values well, but are harder to explain and can overfit without limits on depth.
- k-nearest neighbours has no training step but is slow to predict on large data, and every feature must be scaled.
- A simple baseline you can explain often beats a complex model nobody trusts.

**4. In practice — What you'll see at work**
- A baseline first (logistic or linear regression), then one stronger model, compared on the same held-out data.
- Gradient boosting as the default for tabular data; deep learning for images, audio and text.
- The choice written down with the metric that decided it.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-f-05-q1).** A bank wants to flag possibly fraudulent card payments from 40 tabular features, and its risk team must be able to explain each flag. Where should the team start?
- ✅ Logistic regression as an explainable baseline, then compare a gradient-boosted model on the same held-out data — *Explainable, fast to train, and gives the bar a stronger model must clear; boosting usually wins on tabular data and can be explained with feature attributions.*
- k-means clustering on the payments — *Fraud has labels (confirmed fraud), so this is classification, not finding groups.*
- A large neural network, because fraud is complex — *Harder to explain to the risk team, and usually not better on 40 tabular features.*
- k-nearest neighbours on the raw, unscaled features — *Unscaled features let the largest-valued ones dominate the distance, and predicting is slow on many payments.*

## cl-b-06 · Deployment patterns compared
*Skills:* deployment, blue-green, canary, rolling updates · *Check yourself:* cl-b-06-q1

**1. What it is — Four ways to put a new version out**
- A deployment pattern decides how traffic moves from the old version to the new one, and how fast you can go back.
- The four you'll meet: rolling, blue-green, canary, and shadow. Feature flags sit beside all of them.

**2. Core ideas — How each one moves traffic**
- Rolling: replace instances a few at a time until all run the new version. No extra machines, but old and new run side by side for a while.
- Blue-green: run a full copy (green) beside the live one (blue), then switch all traffic at once. Going back is one switch.
- Canary: send a small share of users (say 5 %) to the new version, watch error rates and latency, then widen.
- Shadow: copy real traffic to the new version and throw its answers away. Nothing a user sees changes.

**3. The trade-offs — Speed, cost, risk**
- Blue-green doubles the machines during the switch, and a database change must work for both versions.
- A canary finds problems with real users but needs good metrics to decide; with too little traffic, 5 % tells you nothing.
- Shadow traffic tests load and correctness safely, but can't test anything that writes (emails, payments) without care.
- Rolling is the cheapest and the slowest to undo.

**4. In practice — What you'll see at work**
- Rolling as the platform default (Kubernetes deployments), canary for risky services, blue-green where instant rollback matters.
- Automatic rollback when the canary's error rate passes a threshold.
- Feature flags to separate shipping code from turning it on.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-b-06-q1).** A payment service gets a risky change. The team wants real users to try it, but if it fails only a few should notice, and it must roll back on its own. Which pattern fits?
- ✅ A canary: a small share of traffic first, watched on error rate and latency, with automatic rollback past a threshold — *Real users, a limited blast radius, and a measured, automatic way back.*
- Shadow traffic, because nobody sees the new version — *Safe, but users never try it, and the payments it would send must be suppressed.*
- A rolling update of every instance as fast as possible — *Every user reaches the new version before anyone can judge it.*
- Blue-green with an immediate switch of all traffic — *Rollback is fast, but every user hits the risky change at once.*
