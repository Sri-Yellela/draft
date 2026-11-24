# Decks v25 — research gaps, Picking an ML algorithm, Deployment patterns compared (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 2 five-slide decks, each with one new question. **APPROVED by the owner 2026-11-23** — served in the Library; the questions are live in the bank.

## ml-f-05 · Picking an ML algorithm
*Skills:* machine learning, model selection, classification, regression · *Check yourself:* ml-f-05-q1

*D195 layers:* concept → proof → real world · *plays in* 48.6 s (concept 12 · proof 19 · real world 17.6) · *real world:* [XGBoost on Kaggle (Chen & Guestrin, 2016)](https://arxiv.org/abs/1603.02754) · *Try:* [Choosing the right estimator](https://scikit-learn.org/stable/machine_learning_map.html) (`sklearn-docs`)

**1. What it is — Pick by the question, not the fashion** *(concept)*
- Choosing a model starts with three questions: what are you predicting, how much data do you have, and must you explain it?
- A number means regression, a category means classification, no labels means clustering.

**2. Why it works — The cost of one prediction, in numbers** *(proof)*
- A linear model makes one prediction in d multiply-adds. With 100 features, that's 100 operations.
- k-nearest neighbours compares the new row with every stored row: n × d. One million rows × 100 features is 100 million operations, per prediction.
- The same answer can cost a million times more. Data size picks the model as much as accuracy does.

**3. Where it runs — What wins on tables: XGBoost on Kaggle** *(realWorld)*
- XGBoost's authors counted 29 Kaggle-winning solutions published in 2015: 17 used XGBoost.
- Gradient-boosted trees are still the default for tabular data; deep learning leads on images, audio and text.

**4. Try it — scikit-learn's estimator map** *(realWorld)*
- Open scikit-learn's map, follow your problem's branches, then fit two models on the same held-out split.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-f-05-q1).** A bank wants to flag possibly fraudulent card payments from 40 tabular features, and its risk team must be able to explain each flag. Where should the team start?
- ✅ Logistic regression as an explainable baseline, then compare a gradient-boosted model on the same held-out data — *Explainable, fast to train, and gives the bar a stronger model must clear; boosting usually wins on tabular data and can be explained with feature attributions.*
- k-means clustering on the payments — *Fraud has labels (confirmed fraud), so this is classification, not finding groups.*
- A large neural network, because fraud is complex — *Harder to explain to the risk team, and usually not better on 40 tabular features.*
- k-nearest neighbours on the raw, unscaled features — *Unscaled features let the largest-valued ones dominate the distance, and predicting is slow on many payments.*

## cl-b-06 · Deployment patterns compared
*Skills:* deployment, blue-green, canary, rolling updates · *Check yourself:* cl-b-06-q1

*D195 layers:* concept → proof → real world · *plays in* 48.9 s (concept 11.2 · proof 19.6 · real world 18.2) · *real world:* [Cloudflare's outage of 2 July 2019](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/) · *Try:* [Performing a rolling update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/) (`kubernetes-docs`)

**1. What it is — Moving users from old to new** *(concept)*
- A deployment pattern decides how users move from the old version to the new one, and how fast you can go back.
- The four: rolling, blue-green, canary and shadow.

**2. Why it works — The blast radius, in numbers** *(proof)*
- A canary at 5 % with a bug failing 10 % of requests fails 0.5 % of all requests, not 10 %.
- Rolling ten servers one at a time keeps 90 % of capacity up; blue-green needs 200 % during the switch.
- 5 % must still be enough traffic: at 1,000 requests a minute, that's 50 a minute to judge from.

**3. Where it broke — Cloudflare, 2 July 2019** *(realWorld)*
- A firewall rule went to every Cloudflare server at once; one regular expression drove CPUs to 100 %.
- About 27 minutes of errors. Cloudflare then moved such changes to staged rollouts.

**4. Try it — A rolling update on Kubernetes** *(realWorld)*
- Follow the Kubernetes tutorial: update a deployment, watch pods replace one by one, then roll back.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (cl-b-06-q1).** A payment service gets a risky change. The team wants real users to try it, but if it fails only a few should notice, and it must roll back on its own. Which pattern fits?
- ✅ A canary: a small share of traffic first, watched on error rate and latency, with automatic rollback past a threshold — *Real users, a limited blast radius, and a measured, automatic way back.*
- Shadow traffic, because nobody sees the new version — *Safe, but users never try it, and the payments it would send must be suppressed.*
- A rolling update of every instance as fast as possible — *Every user reaches the new version before anyone can judge it.*
- Blue-green with an immediate switch of all traffic — *Rollback is fast, but every user hits the risky change at once.*
