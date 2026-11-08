# Decks v10 — ML and AI engineering, Foundations and Building blocks (for your review)

Drafted by the agent, in the approved pathway order (D155 Part C), in decks-v1's format. 8 five-slide decks, each with one new question. **APPROVED by the owner 2026-11-08** — served in the Library; the questions are live in the bank.

## ml-f-01 · The maths you need
*Skills:* probability, linear algebra, gradients · *Check yourself:* ml-f-01-q1

**1. What it is — Three ideas carry most of ML**
- Probability describes uncertainty; linear algebra describes data as vectors and matrices; gradients describe how to improve a model step by step.
- You need working intuition for each, not a maths degree.

**2. Core ideas — Vectors, distributions, slopes**
- A data point is a vector of numbers; a dataset is a matrix; a layer of a neural network multiplies by a matrix.
- A dot product measures how aligned two vectors are; it's behind similarity search and attention.
- Probability distributions describe likely values; a model's output is often a probability.
- A gradient points in the direction that increases the error fastest; gradient descent steps the other way to reduce it.

**3. The trade-offs — Intuition before formulas**
- Skipping the maths leaves you unable to debug a model that won't train.
- Going deep before building anything stalls progress; learn the idea, then use it.
- Libraries compute gradients for you (automatic differentiation), but you still choose the learning rate.

**4. In practice — What you'll see at work**
- Loss curves: if the loss explodes, the learning rate is usually too high; if it barely moves, too low.
- Embeddings compared by cosine similarity.
- Numbers kept on similar scales (normalisation) so training is stable.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-f-01-q1).** During training, the loss jumps around wildly and then becomes NaN. What's the most likely first fix?
- ✅ Lower the learning rate (and check for unscaled inputs) — *Steps that are too large overshoot and diverge.*
- Add more layers — *More capacity doesn't fix divergence.*
- Train for longer — *It'll keep diverging.*
- Use a bigger batch of the same data — *It can help a little, but the step size is the usual cause.*

## ml-f-02 · Training, validation and test sets
*Skills:* model evaluation, data splits · *Check yourself:* ml-f-02-q1

**1. What it is — Measuring on data the model hasn't seen**
- A model is trained on one part of the data, tuned on a second, and judged once on a third.
- Only the untouched test set tells you how it will do on new data.

**2. Core ideas — Three sets, three jobs**
- Training set: the model learns from it.
- Validation set: you compare models and choose settings (hyperparameters) with it.
- Test set: used once at the end, for an honest estimate.
- Cross-validation rotates the validation set through the data when data is scarce.

**3. The trade-offs — Splitting the right way**
- Random splits leak when rows are related: the same user in train and test, or future data in train.
- Split by time for anything that predicts the future, and by group for repeated entities.
- Looking at the test set repeatedly turns it into a validation set.

**4. In practice — What you'll see at work**
- A fixed, versioned test set so results compare across months.
- Splits done before any feature engineering that uses statistics of the data.
- Results reported on the test set once, with the validation history kept.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-f-02-q1).** A model predicting next month's sales was evaluated with a random split of 3 years of data, and scored far better than it does in production. Why?
- ✅ Random splitting put future months in training, so the model saw information it won't have; split by time — *Training on the future leaks; a time split mirrors real use.*
- Production data is always worse — *Not inevitably; the split caused it.*
- The model is too small — *Size isn't the issue.*
- The test set was too large — *Size of the test set doesn't inflate scores.*

## ml-f-03 · Overfitting and leakage
*Skills:* overfitting, leakage, regularisation · *Check yourself:* ml-f-03-q1

**1. What it is — Two ways models fool you**
- Overfitting: the model memorises training data, noise included, and does worse on new data.
- Leakage: information that won't exist at prediction time sneaks into training, making results look too good.

**2. Core ideas — Spot and prevent**
- Overfitting shows as training error far below validation error.
- Fixes: more data, a simpler model, regularisation (penalising large weights), dropout, early stopping.
- Leakage comes from features computed after the outcome, duplicates across splits, or preprocessing fitted on all data.
- Ask of each feature: would I know this at the moment I predict?

**3. The trade-offs — Too simple or too clever**
- A model that's too simple underfits: poor on training and validation alike.
- Aggressive regularisation trades some accuracy for reliability.
- Suspiciously good results deserve suspicion first.

**4. In practice — What you'll see at work**
- Learning curves plotted for training and validation together.
- Preprocessing fitted only on training data, inside a pipeline.
- A review of features against the prediction timeline.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-f-03-q1).** Scaling (mean and standard deviation) was computed on the whole dataset before splitting. What's the problem?
- ✅ Leakage: statistics from the test set shaped training; fit the scaler on training data only — *Test information slipped into training, flattering results.*
- None; scaling is harmless — *It's a classic leak.*
- The model will underfit — *It doesn't cause underfitting.*
- The data will be too small — *Size doesn't change.*

## ml-f-04 · Metrics
*Skills:* evaluation metrics, precision, recall · *Check yourself:* ml-f-04-q1

**1. What it is — Choosing what 'good' means**
- A metric turns predictions into a score; the right one reflects the cost of the mistakes in the real decision.
- Training uses a loss function; evaluation uses metrics people understand.

**2. Core ideas — Match the metric to the task**
- Classification: precision, recall, F1, ROC AUC, PR AUC (better when positives are rare).
- Regression: MAE, RMSE, and error by segment.
- Ranking: precision at k, NDCG.
- Calibration: do predicted probabilities match observed frequencies?

**3. The trade-offs — One number hides a lot**
- Averages across groups can hide a model that fails one group.
- Offline gains don't always become online gains.
- Optimising a proxy metric too hard drifts from the real goal.

**4. In practice — What you'll see at work**
- A primary metric plus guardrails, agreed before modelling.
- Slices: performance by region, device, new versus returning users.
- Offline evaluation followed by an online A/B test.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-f-04-q1).** A model screening for a rare disease must miss as few cases as possible; follow-up tests are cheap. Which metric matters most?
- ✅ Recall on the disease class — *Missing a case is the costly mistake; recall measures how many cases are caught.*
- Accuracy — *Accuracy is dominated by the many healthy cases.*
- Precision — *False alarms are cheap here.*
- Training loss — *Not an evaluation metric.*

## ml-b-01 · Feature pipelines
*Skills:* feature engineering, feature store · *Check yourself:* ml-b-01-q1

**1. What it is — Inputs computed the same way, every time**
- A feature pipeline turns raw data into the model's inputs, for training and for live predictions.
- If the two paths compute a feature differently, the model sees something new in production.

**2. Core ideas — One definition, two uses**
- Training-serving skew: a feature computed one way in a batch job and another in the live service.
- Point-in-time correctness: training features must use only data available at that past moment.
- A feature store keeps feature definitions, an offline store for training and an online store for fast lookups.
- Features are versioned so models know exactly what they were trained on.

**3. The trade-offs — Infrastructure against speed**
- A feature store is a lot of machinery for one model; it pays off when many models share features.
- Real-time features are powerful and expensive to keep fresh.
- Simple shared code for both paths can be enough at first.

**4. In practice — What you'll see at work**
- The same function used in training and serving.
- Monitoring of feature values in production against training.
- Backfills of a new feature with point-in-time joins.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-b-01-q1).** A model works well offline but poorly live. You find 'average order value' is computed over 90 days in training and 30 days in the live service. What is this?
- ✅ Training-serving skew; compute the feature from one shared definition — *The model is fed a different feature than it learned.*
- Overfitting — *It isn't about the model's fit.*
- A bad random seed — *A seed wouldn't cause this.*
- Normal variation — *It's a bug.*

## ml-b-02 · Training at scale
*Skills:* distributed training, gpus · *Check yourself:* ml-b-02-q1

**1. What it is — When one machine isn't enough**
- Large models and datasets need several GPUs or machines, for memory and for time.
- The work is splitting data and model sensibly and keeping the hardware busy.

**2. Core ideas — Data and model parallelism**
- Data parallelism: each GPU holds the whole model and trains on a different slice of the batch; gradients are averaged.
- Model parallelism: the model itself is split across GPUs when it doesn't fit on one.
- Mixed precision (16-bit numbers) cuts memory and time with little loss of accuracy.
- Checkpoints save progress, so a failure doesn't lose days.

**3. The trade-offs — Speed against cost and complexity**
- Communication between GPUs can become the bottleneck.
- Bigger batches change training dynamics; learning rates need adjusting.
- Cloud GPUs are expensive; a smaller model trained well often beats a bigger one trained badly.

**4. In practice — What you'll see at work**
- PyTorch DDP or FSDP, or a managed training service.
- Experiments tracked (MLflow, Weights & Biases) with code, data and settings.
- GPU use monitored: idle GPUs usually mean slow data loading.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-b-02-q1).** Training on 8 GPUs shows each GPU busy only 30 % of the time. What's the usual cause to check first?
- ✅ The input pipeline: data loading and preprocessing can't keep up; add workers, cache, or preprocess ahead — *GPUs wait for data when loading is the bottleneck.*
- Too many GPUs — *It may be wasteful, but loading is the usual culprit.*
- The model is too accurate — *Not related.*
- The learning rate — *It affects learning, not utilisation.*

## ml-b-03 · Model serving
*Skills:* model serving, inference, latency · *Check yourself:* ml-b-03-q1

**1. What it is — Predictions in production**
- Serving puts a trained model behind an API or into a batch job, so products can use its predictions.
- It's ordinary software engineering with extra concerns: latency, cost and versions.

**2. Core ideas — Online, batch, versions**
- Online serving answers one request in milliseconds; batch scoring precomputes predictions for everyone on a schedule.
- Batching requests together uses the hardware better, at a small latency cost.
- Models are versioned and deployed like code, with canaries or shadow traffic before full rollout.
- Smaller or quantised models cut latency and cost.

**3. The trade-offs — Fresh, fast, cheap: pick carefully**
- Batch predictions are cheap and can be stale; online ones are fresh and costly.
- Bigger models are often more accurate and slower; measure whether the gain is worth it.
- A fallback is needed when the model service is down.

**4. In practice — What you'll see at work**
- Shadow deployments: the new model runs alongside the old, its answers logged but not used.
- p95 and p99 latency budgets per endpoint.
- Inputs and outputs logged (without personal data) for monitoring and retraining.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-b-03-q1).** You want to check a new model on real traffic without risking users. What's the safest approach?
- ✅ Shadow deployment: run it alongside the current model, log its predictions, and compare before switching — *Real inputs, no effect on users, and a direct comparison.*
- Replace the current model overnight — *Risky with no comparison.*
- Test it only on last year's data — *Offline tests miss today's traffic.*
- Let users opt in — *Self-selected users aren't representative.*

## ml-b-04 · Monitoring and drift
*Skills:* model monitoring, drift · *Check yourself:* ml-b-04-q1

**1. What it is — Models decay quietly**
- The world changes after a model is trained; its inputs and the relationships it learned drift.
- Monitoring catches the decline before users or the business feel it.

**2. Core ideas — What to watch**
- Data drift: input distributions change (new devices, new markets).
- Concept drift: the relationship between inputs and outcome changes (fraud tactics evolve).
- Watch inputs, prediction distributions, and real outcomes when labels arrive.
- Retrain on a schedule or when drift crosses a threshold, then evaluate before deploying.

**3. The trade-offs — Alerts that matter**
- Labels often arrive late (did the loan default?), so quality is seen only after a delay.
- Drift alerts on every feature are noisy; focus on important features and outcomes.
- Automatic retraining can learn from bad data; keep a check before deploying.

**4. In practice — What you'll see at work**
- Dashboards of key feature distributions against training.
- A delayed-label quality report each week.
- A rollback path to the previous model version.

**5. Check yourself — One question**
- Answer it, then read the why.

**The question (ml-b-04-q1).** A fraud model's precision has fallen steadily over three months, with no code changes. What's the likely cause and response?
- ✅ Concept drift as fraud patterns changed; investigate recent cases, retrain on fresh labelled data, and evaluate before deploying — *Adversaries adapt; models trained on old patterns decay.*
- A bug introduced three months ago — *Nothing changed in the code.*
- Too much training data — *More data doesn't cause gradual decline.*
- The model ran out of memory — *That would cause errors, not a slow drift.*
