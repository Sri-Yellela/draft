# Practice questions v1 — match and order, for your review (D154 P2)

Drafted by the chat assistant. 12 items: 6 **match** (pair each item with its partner) and 6 **order** (put the steps in sequence). Shown below with the correct answer; in the app the right-hand column and the steps are shuffled.

## prac-m-01 · match · Backend Engineer · mid

Match each HTTP status code to the situation it describes.

- **201 Created** → A new order was stored  
  *Why:* 201 tells the client the resource now exists, usually with its location.
- **400 Bad Request** → The request body failed validation  
  *Why:* 400 means the request itself is wrong, so retrying it unchanged won't help.
- **401 Unauthorized** → The request has no valid credentials  
  *Why:* 401 means 'who are you?': sign in first. (403 means 'I know who you are, and no'.)
- **429 Too Many Requests** → The client has hit its rate limit  
  *Why:* 429 asks the client to slow down, ideally with a Retry-After header.

## prac-m-02 · match · Software Engineer · entry

Match each data structure to the job it does best.

- **Hash map** → Look up a user by id in constant time on average  
  *Why:* Hashing the key jumps straight to the right bucket, so lookups don't scan.
- **Queue** → Process print jobs in the order they arrived  
  *Why:* First in, first out keeps the arrival order.
- **Heap (priority queue)** → Always take the most urgent task next  
  *Why:* A heap keeps the highest-priority item on top, with cheap inserts and removals.
- **Trie** → Suggest words as someone types a prefix  
  *Why:* Each prefix is a path in the tree, so every word starting with it sits below one node.

## prac-m-03 · match · Data Engineer · mid

Match each join to the result it gives, joining orders to customers (or sizes to colours).

- **INNER JOIN** → Only orders that have a matching customer  
  *Why:* Inner keeps only rows that match on both sides.
- **LEFT JOIN** → Every order, with customer details where they exist  
  *Why:* Left keeps every row from the left table and fills the right side with nulls when there's no match.
- **FULL OUTER JOIN** → Every order and every customer, matched where possible  
  *Why:* Full outer keeps everything from both sides, matched where it can.
- **CROSS JOIN** → Every combination of size and colour  
  *Why:* Cross pairs every row with every row: useful for combinations, dangerous by accident.

## prac-m-04 · match · DevOps / SRE Engineer · mid

Match each Kubernetes object to what it's for.

- **Deployment** → Keep three copies of the app running and roll out new versions  
  *Why:* A Deployment manages the pods' desired count and rolling updates.
- **Service** → Give the pods one stable address inside the cluster  
  *Why:* Pods come and go; a Service gives them one name and spreads traffic across them.
- **Ingress** → Route outside HTTP traffic by host or path to services  
  *Why:* An Ingress is the front door for HTTP traffic from outside the cluster.
- **ConfigMap** → Hold non-secret settings the pods read at start-up  
  *Why:* Settings live outside the image, so the same build runs in every environment. Secrets go in a Secret, not here.

## prac-m-05 · match · Security Engineer · mid

Match each attack to its main defence.

- **SQL injection** → Parameterised queries  
  *Why:* Parameters keep data separate from the query, so input can't change it.
- **Cross-site scripting (XSS)** → Encoding output, plus a Content Security Policy  
  *Why:* Encoding stops injected markup running, and a CSP limits what can run at all.
- **Cross-site request forgery (CSRF)** → SameSite cookies and anti-CSRF tokens  
  *Why:* The browser won't send the session cookie from another site, and the token proves the request came from your page.
- **Credential stuffing** → Multi-factor sign-in and rate-limited logins  
  *Why:* Leaked passwords from other sites stop working on their own, and rate limits slow the guessing.

## prac-m-06 · match · ML Engineer · mid

Match each metric to the question it answers.

- **Precision** → Of the transactions we flagged, how many were really fraud?  
  *Why:* Precision is about the flags you raised: how many were right.
- **Recall** → Of all the real fraud, how much did we catch?  
  *Why:* Recall is about the cases out there: how many you found.
- **Mean absolute error** → On average, how far off are our price predictions?  
  *Why:* MAE is the average size of the error, in the target's own units.
- **p95 latency** → How slow are the slowest 5% of predictions?  
  *Why:* The 95th percentile shows the slow tail that averages hide.

## prac-o-01 · order · Software Engineer · entry

You type a web address and press Enter. Put the steps in the order they happen.

1. Look up the server's IP address (DNS)
2. Open a TCP connection to the server
3. Agree on encryption (the TLS handshake)
4. Send the HTTP request
5. Show the response in the browser

*Why:* Name to address, then a connection, then encryption on that connection, then the request, then the page. (Newer HTTP/3 merges the connection and encryption steps, but the order of ideas is the same.)

## prac-o-02 · order · DevOps / SRE Engineer · mid

Put the steps of a blue-green deployment in order.

1. Deploy the new version alongside the old one
2. Run health checks and smoke tests on the new version
3. Switch traffic to the new version
4. Watch error rates and latency
5. Retire the old version once the new one is stable

*Why:* The old version keeps serving until the new one has proved healthy; switching is instant, and keeping the old one around until things settle means a rollback is one switch back.

## prac-o-03 · order · Security Engineer · senior

Put the steps of handling a security incident in order.

1. Detect and confirm the incident
2. Contain it: isolate the affected systems
3. Remove the cause: close the attacker's way in
4. Recover: restore systems and watch them closely
5. Review: a blameless postmortem with fixes

*Why:* Confirm before acting, contain before cleaning (so it can't spread while you work), remove the cause before restoring (or it comes straight back), then learn from it.

## prac-o-04 · order · Data Engineer · mid

You need to rename a column in a live database without downtime. Put the steps in order.

1. Add the new column
2. Write to both the old and new columns
3. Copy existing values into the new column
4. Switch reads to the new column
5. Stop writing the old column, then drop it

*Why:* This is the expand-and-contract pattern: at every step, both the old and new code keep working, so you can deploy each step separately and stop or roll back at any point.

## prac-o-05 · order · Software Engineer · mid

Put the steps of shipping a feature through code review in order.

1. Create a branch from main
2. Commit your changes with their tests
3. Open a pull request
4. Address the review comments
5. Merge once CI passes

*Why:* A branch keeps main clean, tests travel with the change, review comes before merge, and the merge waits for green CI.

## prac-o-06 · order · ML Engineer · mid

Put the steps of building and shipping a model in order.

1. Choose the metric and a simple baseline
2. Split the data (by time if the data is time-based)
3. Train and tune on the training data
4. Evaluate once on the held-out test set
5. Ship behind a shadow test or A/B test, and monitor

*Why:* Decide what good means first, keep a clean test set before you train, touch the test set once at the end, and prove it in production before it replaces anything.
