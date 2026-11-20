#!/usr/bin/env node
// ⭐ D193-6 (46z) · decks-v25 — two decks from the owner's research gaps (content/atlas/research-gaps-v1.json) where one
// deck is enough: "Picking an ML algorithm" (gap 6, the comparison grid) and "Deployment patterns compared" (gap 2 — the
// existing decks teach rolling (cl-c-01), canary + flags (sw-p-04) and pipelines (cl-b-04) one at a time; none puts the
// four side by side). General knowledge, in our own words — no source copied or adapted. Drafted by the agent 2026-11-20
// for the owner's review. Nothing is live until approved: the batch is written to docs/review/ (outside the served
// content/decks/) because each deck must also take a topic in PLAYBOOK.md Part C, the owner-approved plan. ON APPROVAL:
// add the two topics to Part C (ML / AI Foundations: "picking an algorithm"; Cloud Building blocks: "deployment patterns"),
// set dir back to content/decks, record the approval in content/decks/approvals.json, and run node scripts/pathwaysFromPlaybook.mjs.
// node scripts/decks/decksV25.mjs
import { deck, question, writeBatch } from "./deckKit.mjs";

writeBatch({
  version: 25,
  dir: "docs/review",
  title: "research gaps, Picking an ML algorithm, Deployment patterns compared",
  note: "Drafted by the agent 2026-11-20 for the owner's review (D193-6, from the owner's 11-14 research gaps; D154 P4 format). ml-f-05 (pathway ml-ai, stage foundations) and cl-b-06 (pathway cloud, stage building-blocks). General knowledge in our own words. Nothing is live until approved (status: draft).",
  decks: [
    deck("ml-f-05", "ml-ai", "foundations", "Picking an ML algorithm", ["machine learning", "model selection", "classification", "regression"], ["s9"], [
      ["What it is", "Which tool for which job", [
        "Most problems start with a small set of algorithms: linear and logistic regression, k-nearest neighbours, decision trees, random forests, gradient boosting, support vector machines, and k-means.",
        "The first question isn't which is best. It's what you're predicting, how much data you have, and whether you must explain the answer."]],
      ["Core ideas", "The grid in four rows", [
        "A number to predict (price, demand): start with linear regression; move to gradient-boosted trees when the relationships aren't straight lines.",
        "A category to predict (fraud or not): start with logistic regression; random forests and gradient boosting usually win on tabular data.",
        "No labels at all, just groups to find: k-means, after scaling the features.",
        "Few rows, many features, a clear margin between classes: a support vector machine. Similar items near each other: k-nearest neighbours, on small data."]],
      ["The trade-offs", "Accuracy, explanation, cost", [
        "Linear models are fast and easy to explain, but miss interactions unless you add them.",
        "Tree ensembles handle mixed features and missing values well, but are harder to explain and can overfit without limits on depth.",
        "k-nearest neighbours has no training step but is slow to predict on large data, and every feature must be scaled.",
        "A simple baseline you can explain often beats a complex model nobody trusts."]],
      ["In practice", "What you'll see at work", [
        "A baseline first (logistic or linear regression), then one stronger model, compared on the same held-out data.",
        "Gradient boosting as the default for tabular data; deep learning for images, audio and text.",
        "The choice written down with the metric that decided it."]],
    ], question("ml-f-05-q1", "ML Engineer", "entry", ["model selection", "classification"], ["s9"],
      "A bank wants to flag possibly fraudulent card payments from 40 tabular features, and its risk team must be able to explain each flag. Where should the team start?",
      ["Logistic regression as an explainable baseline, then compare a gradient-boosted model on the same held-out data",
        "k-means clustering on the payments",
        "A large neural network, because fraud is complex",
        "k-nearest neighbours on the raw, unscaled features"], 0,
      ["Explainable, fast to train, and gives the bar a stronger model must clear; boosting usually wins on tabular data and can be explained with feature attributions.",
        "Fraud has labels (confirmed fraud), so this is classification, not finding groups.",
        "Harder to explain to the risk team, and usually not better on 40 tabular features.",
        "Unscaled features let the largest-valued ones dominate the distance, and predicting is slow on many payments."])),
    deck("cl-b-06", "cloud", "building-blocks", "Deployment patterns compared", ["deployment", "blue-green", "canary", "rolling updates"], ["o4"], [
      ["What it is", "Four ways to put a new version out", [
        "A deployment pattern decides how traffic moves from the old version to the new one, and how fast you can go back.",
        "The four you'll meet: rolling, blue-green, canary, and shadow. Feature flags sit beside all of them."]],
      ["Core ideas", "How each one moves traffic", [
        "Rolling: replace instances a few at a time until all run the new version. No extra machines, but old and new run side by side for a while.",
        "Blue-green: run a full copy (green) beside the live one (blue), then switch all traffic at once. Going back is one switch.",
        "Canary: send a small share of users (say 5 %) to the new version, watch error rates and latency, then widen.",
        "Shadow: copy real traffic to the new version and throw its answers away. Nothing a user sees changes."]],
      ["The trade-offs", "Speed, cost, risk", [
        "Blue-green doubles the machines during the switch, and a database change must work for both versions.",
        "A canary finds problems with real users but needs good metrics to decide; with too little traffic, 5 % tells you nothing.",
        "Shadow traffic tests load and correctness safely, but can't test anything that writes (emails, payments) without care.",
        "Rolling is the cheapest and the slowest to undo."]],
      ["In practice", "What you'll see at work", [
        "Rolling as the platform default (Kubernetes deployments), canary for risky services, blue-green where instant rollback matters.",
        "Automatic rollback when the canary's error rate passes a threshold.",
        "Feature flags to separate shipping code from turning it on."]],
    ], question("cl-b-06-q1", "DevOps Engineer", "entry", ["deployment", "canary"], ["o4"],
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
