# D67 (c) · A Workday origin family — keyed on the TENANT, not the host

**Status: DESIGN ONLY (10-07, 38g). Nothing built.** The board links to no Workday posting today
(production: greenhouse · ashby · lever · workable · recruitee · import). Build this when Workday
postings arrive. One part did not wait: **§5, the learned-pair guard**, closed a gap that existed then. It is
**A95**, now built.

---

## 1. The problem

`services/applyOrigins.js` decides **where a packet may be filled**. A packet holds a home address and
work-authorisation answers, so the family table is the only thing that may widen that list, and each
row is an observed redirect.

A family today is a **list of origins**. That works when an origin belongs to one ATS *and the ATS keeps
employers apart by origin*, or, as with Lever, Ashby and Workable, when the job id in the path tells
two jobs apart on a shared origin.

**Workday breaks the first assumption.** One Workday shard serves every employer on it at one origin:

```
https://wd5.myworkdaysite.com/recruiting/<tenant>/<site>/job/…
```

An origin-only family for `wd5.myworkdaysite.com` would release Employer A's packet on **any employer's
form on wd5**. The job-id check does not save it: a page with no id in its URL (a wizard step, a sign-in
page) is matched on the origin alone (`pageMatchesPacket`, "a page that names no job").

## 2. What was observed (10-07, unauthenticated GETs, nothing submitted)

| | URL shape | Observed |
|---|---|---|
| posting, tenant host | `https://<tenant>.wd<N>.myworkdayjobs.com/[<locale>/]<site>/job/<place>/<slug>_<REQ>` | `nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/…_JR2024711` → 200, the `externalUrl` Workday's own jobs API returns |
| apply, tenant host | the posting + `/apply` | `…_JR2024711/apply` → 200, **same origin** |
| posting, shared host | `https://wd<N>.myworkdaysite.com/[<locale>/]recruiting/<tenant>/<site>/job/<place>/<slug>_<REQ>` | the same posting → 200 |
| apply, shared host | the above + `/apply` | → 200 |
| wrong shard | `wd1.myworkdaysite.com/recruiting/salesforce/…` (tenant is on wd12) | → 500: a tenant lives on ONE shard |
| job id | the slug's trailing `_<REQ>`, sometimes `-<n>` after it (`_JR2017744-1`) | `jobReqId: "JR2024711"` in the jobs API |

⚠ **Not observable without a browser.** These pages are a JavaScript app, and a 200 is the shell. What
the **Apply** button does was **not** observed: whether it stays on the tenant host, moves to the
shared host, or passes through a sign-in page. Nor do we know whether the wizard steps
(`/apply/autofillWithResume`, `/apply/applyManually`, `/login`) keep the `_<REQ>` in their URL. **§6 step
1 observes these, attended, before any code is written.** Per D67's rule, no family row is written from
an assumption.

## 3. The design: a family keyed on (shard, tenant)

### 3.1 The key

```
workdayKey(url) → { shard: "wd5", tenant: "nvidia", site: "NVIDIAExternalCareerSite", req: "JR2024711" } | null
```

- **Tenant host** `<tenant>.wd<N>.myworkdayjobs.com`: tenant = the first label, shard = `wd<N>`.
- **Shared host** `wd<N>.myworkdaysite.com`: shard from the host; tenant = the path segment after
  `recruiting/` (an optional leading locale segment, `en-US/`, is skipped).
- `req` = the slug's trailing `_<REQ>` with any `-<n>` variant suffix removed, or null.
- Anything else, including an unrecognised path on the shared host, gives **null**, which means **no
  Workday family**. ⛔ It never falls back to the origin alone.

### 3.2 What a packet may be filled on

The packet's job is known by a Workday URL, so its key is `(shard, tenant)`. A page matches when **all**
of these hold:

1. `workdayKey(page)` is not null, and its `shard` and `tenant` equal the packet's. The page may be on
   either host form, which is what lets one family cover both shapes.
2. When both the page and the packet carry a `req`, they are equal. This is the existing `other_job`
   rule, unchanged.
3. When the page carries no `req` (a wizard or sign-in step), rule 1 still has to hold. **The tenant in
   the path replaces the origin as the thing that must match.**

`site` is recorded but not required to match: a tenant can run several career sites, and one
application can pass through more than one. ⚠ Confirm in §6 step 1. If it is never seen to change, make
it required, which is stricter.

### 3.3 Where it goes in the code

- `APPLY_ORIGIN_FAMILIES` gains one row whose shape differs: `{ ats: "workday", keyOf: workdayKey }`
  instead of a fixed `origins` list. `familyOf`, `packetOrigins`, `jobIdOf` and `pageMatchesPacket` treat a
  `keyOf` row as **matching by key**; every other row stays exactly as it is. One parser, on the server,
  as today.
- **The extension's defence-in-depth check.** Today the extension re-checks only the page's ORIGIN
  against the packet's list (it does not parse ATS URLs, and `test/d23ExtensionLook.test.js` holds it to
  that). On a shared host that check passes for every tenant. So the server answers a Workday packet with
  **scopes**, `[{ origin, pathPrefix }]`:
  - `{ "https://nvidia.wd5.myworkdayjobs.com", "/" }`
  - `{ "https://wd5.myworkdaysite.com", "/recruiting/nvidia/" }`
  - the same with a locale prefix

  The extension checks `origin === scope.origin && pathname.startsWith(pathPrefix)`. That is a generic
  string prefix, not ATS parsing, so the d23 rule still holds. Every other family's scopes have
  `pathPrefix: "/"`, so their behaviour is byte-for-byte the same.
- The packet stores nothing new. Its key is derived from the URLs it already has (`apply_url`, the
  posting's `url`).

## 4. What is NOT covered

- **Custom domains** (`careers.<employer>.com` framing or fronting Workday). There the tenant is not in
  the URL at all. Leave them to the learned table on exact hostnames, under §5's guard. The tenant is
  never guessed from a page's content.
- **Workday's own sign-in and account pages** on a host outside the two shapes. If §6 observes one, it
  gets its own row from that observation. It is never matched by pattern.
- **Crawling Workday.** The jobs API used above (`/wday/cxs/<tenant>/<site>/jobs`) is public and returns
  `externalUrl` and `jobReqId`, but adding Workday as a board source is a separate decision. The earlier
  note stands: site discovery plus a ~300-posting page cap.

## 5. ⛔ The learned-pair guard — a gap that exists today (A95)

`services/learnedOrigins.js` learns `(posting host → apply host)` from a user's own "I submitted" on a
host outside the job's family. It refuses IPs, localhost and our own host, but **not a multi-tenant
host**.

Suppose three users apply to Employer A's Workday job and submit on `wd5.myworkdaysite.com`. The pair
`a.wd5.myworkdayjobs.com → wd5.myworkdaysite.com` is promoted, and from then on **every** user's
Employer A packet may fill **any** employer's form on wd5. Below three users, the same holds for the user
who saw it. This is the §1 problem, reached through learning instead of the table.

✅ **BUILT 10-07 (38g) as A95.** The fix only narrows. A pair is refused when **either** host is on the shared list, because a shared POSTING host crosses employers too: `jobs.lever.co → careers.x.com` would let every Lever job's packet fill on X's domain. The shared list is:

- Workday's shared shards: `wdN.myworkdaysite.com`, and a bare `wdN.myworkdayjobs.com`. ⚠ Not `<tenant>.wdN.myworkdayjobs.com`; that host is one employer's and stays learnable. (An earlier draft of this section listed `*.myworkdayjobs.com`, which was wrong.)
- the shared origins already in the table: `jobs.lever.co`, `jobs.ashbyhq.com`, `apply.workable.com`,
  `boards.greenhouse.io`, `job-boards.greenhouse.io`

A pair stored before the guard is filtered out when the families are served.
The sighting is then recorded as `reason: "shared_host"` and nothing is learned. Test: three users'
sightings onto `wd5.myworkdaysite.com` promote nothing, and no packet's families contain it.
**Reachability today is low.** No Workday posting is on the board, and a sighting needs a packet. But a
captured or imported Workday job would open it.

## 6. Build order, when Workday postings arrive

1. **Observe, attended** (a real browser, a real Workday posting, nothing submitted). Press Apply and
   record every URL to the first form field, on both the tenant host and the shared host: the sign-in
   step, the wizard steps, and whether `_<REQ>` survives each. Record each one with its source, as D67 (1)
   did. If anything leaves the two shapes, stop and add it to §2 before going on.
2. `workdayKey` plus a gold set of 20 real Workday URLs across at least 5 tenants and 3 shards. ⛔ The req
   pattern is checked against this set and is not trusted from two NVIDIA examples.
3. The `keyOf` family row and the matching rules in §3.2.
4. Server scopes, then the extension's prefix check. ⚠ This changes `extension/` and needs a release.
5. Tests, each red when removed:
   - tenant B's page on the shared host is refused for tenant A's packet, with an id and without one
   - tenant A's page is accepted on both host forms
   - a different `req` is `other_job`
   - the wrong shard is refused
   - a shared-host path with no `recruiting/<tenant>` is refused, never matched on origin
   - every existing family's behaviour is unchanged (the scopes are `"/"`)
   - the extension refuses a page outside its scopes
6. The privacy page needs no change: no new data, and filling still happens only on the user's click.

**§5 (A95) was independent of all of this and is built** (`services/learnedOrigins.js` `isSharedTenantHost`).
