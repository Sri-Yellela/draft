#!/usr/bin/env node
// ⭐ D193-6 (46z) · decks-v25 — two decks from the owner's research gaps (content/atlas/research-gaps-v1.json) where one
// deck is enough: "Picking an ML algorithm" (gap 6, the comparison grid) and "Deployment patterns compared" (gap 2 — the
// existing decks teach rolling (cl-c-01), canary + flags (sw-p-04) and pipelines (cl-b-04) one at a time; none puts the
// four side by side). General knowledge, in our own words — no source copied or adapted. Drafted by the agent 2026-11-20
// for the owner's review. Nothing is live until approved: the batch is written to docs/review/ (outside the served
// content/decks/) because each deck must also take a topic in PLAYBOOK.md Part C, the owner-approved plan. ON APPROVAL:
// add the two topics to Part C (ML / AI Foundations: "picking an algorithm"; Cloud Building blocks: "deployment patterns"),
// set dir back to content/decks, record the approval in content/decks/approvals.json, and run node scripts/pathwaysFromPlaybook.mjs.
// ⭐ 47a · RE-DRAFTED TO D195's THREE LAYERS before the owner's review (concept → the math → the real world): each deck
// shows one worked number (prediction cost n × d; a canary's blast radius), names a real case (XGBoost's 17 of 29 Kaggle
// wins, from its paper; Cloudflare's 2 July 2019 global WAF push, from its post-mortem) and ends in a Try step from an
// open register source (scikit-learn BSD-3, Kubernetes CC BY 4.0). Plays in under 90 s (deckLayers.pacing).
// node scripts/decks/decksV25.mjs
import { layeredDeck, question, writeBatch } from "./deckKit.mjs";

writeBatch({
  version: 25,
  dir: "docs/review",
  title: "research gaps, Picking an ML algorithm, Deployment patterns compared",
  note: "Drafted by the agent 2026-11-20 for the owner's review (D193-6, from the owner's 11-14 research gaps; D154 P4 format). ml-f-05 (pathway ml-ai, stage foundations) and cl-b-06 (pathway cloud, stage building-blocks). General knowledge in our own words. Re-drafted 47a to D195's three layers (concept, the math, the real world). Nothing is live until approved (status: draft).",
  decks: [
    layeredDeck("ml-f-05", "ml-ai", "foundations", "Picking an ML algorithm", ["machine learning", "model selection", "classification", "regression"], ["s9"], [
      ["concept", "What it is", "Pick by the question, not the fashion", [
        "Choosing a model starts with three questions: what are you predicting, how much data do you have, and must you explain it?",
        "A number means regression, a category means classification, no labels means clustering."]],
      ["proof", "Why it works", "The cost of one prediction, in numbers", [
        "A linear model makes one prediction in d multiply-adds. With 100 features, that's 100 operations.",
        "k-nearest neighbours compares the new row with every stored row: n × d. One million rows × 100 features is 100 million operations, per prediction.",
        "The same answer can cost a million times more. Data size picks the model as much as accuracy does."]],
      ["realWorld", "Where it runs", "What wins on tables: XGBoost on Kaggle", [
        "XGBoost's authors counted 29 Kaggle-winning solutions published in 2015: 17 used XGBoost.",
        "Gradient-boosted trees are still the default for tabular data; deep learning leads on images, audio and text."]],
      ["realWorld", "Try it", "scikit-learn's estimator map", [
        "Open scikit-learn's map, follow your problem's branches, then fit two models on the same held-out split."]],
    ], { name: "XGBoost on Kaggle (Chen & Guestrin, 2016)", url: "https://arxiv.org/abs/1603.02754" },
    { source: "sklearn-docs", url: "https://scikit-learn.org/stable/machine_learning_map.html", label: "Choosing the right estimator" },
    question("ml-f-05-q1", "ML Engineer", "entry", ["model selection", "classification"], ["s9"],
      "A bank wants to flag possibly fraudulent card payments from 40 tabular features, and its risk team must be able to explain each flag. Where should the team start?",
      ["Logistic regression as an explainable baseline, then compare a gradient-boosted model on the same held-out data",
        "k-means clustering on the payments",
        "A large neural network, because fraud is complex",
        "k-nearest neighbours on the raw, unscaled features"], 0,
      ["Explainable, fast to train, and gives the bar a stronger model must clear; boosting usually wins on tabular data and can be explained with feature attributions.",
        "Fraud has labels (confirmed fraud), so this is classification, not finding groups.",
        "Harder to explain to the risk team, and usually not better on 40 tabular features.",
        "Unscaled features let the largest-valued ones dominate the distance, and predicting is slow on many payments."])),
    layeredDeck("cl-b-06", "cloud", "building-blocks", "Deployment patterns compared", ["deployment", "blue-green", "canary", "rolling updates"], ["o4"], [
      ["concept", "What it is", "Moving users from old to new", [
        "A deployment pattern decides how users move from the old version to the new one, and how fast you can go back.",
        "The four: rolling, blue-green, canary and shadow."]],
      ["proof", "Why it works", "The blast radius, in numbers", [
        "A canary at 5 % with a bug failing 10 % of requests fails 0.5 % of all requests, not 10 %.",
        "Rolling ten servers one at a time keeps 90 % of capacity up; blue-green needs 200 % during the switch.",
        "5 % must still be enough traffic: at 1,000 requests a minute, that's 50 a minute to judge from."]],
      ["realWorld", "Where it broke", "Cloudflare, 2 July 2019", [
        "A firewall rule went to every Cloudflare server at once; one regular expression drove CPUs to 100 %.",
        "About 27 minutes of errors. Cloudflare then moved such changes to staged rollouts."]],
      ["realWorld", "Try it", "A rolling update on Kubernetes", [
        "Follow the Kubernetes tutorial: update a deployment, watch pods replace one by one, then roll back."]],
    ], { name: "Cloudflare's outage of 2 July 2019", url: "https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/" },
    { source: "kubernetes-docs", url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/", label: "Performing a rolling update" },
    question("cl-b-06-q1", "DevOps Engineer", "entry", ["deployment", "canary"], ["o4"],
      "A payment service gets a risky change. The team wants real users to try it, but if it fails only a few should notice, and it must roll back on its own. Which pattern fits?",
      ["A canary: a small share of traffic first, watched on error rate and latency, with automatic rollback past a threshold",
        "Shadow traffic, because nobody sees the new version",
        "A rolling update of every instance as fast as possible",
        "Blue-green with an immediate switch of all traffic"], 0,
      ["Real users, a limited blast radius, and a measured, automatic way back.",
        "Safe, but users never try it, and the payments it would send must be suppressed.",
        "Every user reaches the new version before anyone can judge it.",
        "Rollback is fast, but every user hits the risky change at once."])),
  ],
});
console.log("decks-v25 written");
