// components/AttemptPosting.jsx — ⭐ D171 FIX 3 (owner 11-06: "I could not open the job from Home to compare the JD with
// the résumé"). An application's posting, opened IN PLACE in its Home row's "The posting" pane: the job description as
// stored when the application was made (routes/applicationPosting.js — so it still reads after the posting closes),
// drawn by the posting's own body (PostingPanel.jsx PostingText), and "Open the original" beside the row's Résumé
// (`children` — the caller's <AttemptResume>, so the JD and the tailored résumé are one press apart).
//
// Where it comes from, first found wins: runJobId (one attempt's snapshot) · jobId (the person's own application to that
// job). Read once per source and kept for the page's life: Home's panes re-mount on every refresh, and the words that
// were applied to do not change.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { postingClick } from "../lib/openPosting.js";
import { PostingText } from "./PostingPanel.jsx";

const cache = new Map();   // key → { state: "loading" | "ready" | "none", data, waiters }

function keyOf(runJobId, jobId) {
  if (runJobId != null) return `rj:${runJobId}`;
  if (jobId != null) return `job:${jobId}`;
  return null;
}

function load(runJobId, jobId) {
  const k = keyOf(runJobId, jobId);
  if (!k) return Promise.resolve(null);
  const hit = cache.get(k);
  if (hit) return hit.promise;
  const byJob = () => jobId != null ? api(`/api/apply/jobs/${encodeURIComponent(jobId)}/posting`).catch(() => null) : null;
  const promise = (runJobId != null
    ? api(`/api/apply/run-jobs/${encodeURIComponent(runJobId)}/posting`).catch(() => null).then(d => d || byJob())
    : Promise.resolve(byJob())
  ).then(d => { cache.get(k).data = d || null; return d || null; });
  cache.set(k, { promise, data: undefined });
  return promise;
}

/** The one line over the words: where they came from. Pure — exported for the test. */
export function keptLine(p) {
  if (!p?.description) return "draft has no copy of this posting's description.";
  const when = p.appliedAt ? new Date(p.appliedAt * 1000).toLocaleDateString() : null;
  if (p.source === "snapshot") {
    return `As it read when this application was made${when ? `, ${when}` : ""}${p.gone ? " — the posting has since closed" : ""}.`;
  }
  return p.gone ? "The posting has closed; this is the last copy draft read."
    : "Today's posting — this application was made before draft kept its own copy.";
}

export default function AttemptPosting({ runJobId = null, jobId = null, fallbackUrl = null, className, noteClassName,
  actsClassName, children = null }) {
  const k = keyOf(runJobId, jobId);
  const [posting, setPosting] = useState(() => (k ? cache.get(k)?.data : null));
  useEffect(() => {
    let live = true;
    if (posting === undefined) load(runJobId, jobId).then(d => { if (live) setPosting(d); });
    return () => { live = false; };
  }, [k]);   // eslint-disable-line react-hooks/exhaustive-deps

  const url = posting?.url || fallbackUrl || null;
  const target = { jobId: posting?.jobId ?? jobId, applyUrl: url };
  return (
    <div data-attempt-posting={posting === undefined ? "loading" : posting?.description ? (posting.source || "kept") : "none"}>
      <p className={noteClassName} data-attempt-posting-note="">
        {posting === undefined ? "Reading the posting…" : keptLine(posting)}
      </p>
      {posting?.description && <PostingText text={posting.description} />}
      <div className={actsClassName}>
        {url && (
          <a className={className} href={url} target="_blank" rel="noreferrer" data-attempt-posting-original=""
            onClick={(e) => { e.stopPropagation(); postingClick(target, e); }}>Open the original ↗</a>
        )}
        {children}
      </div>
    </div>
  );
}
