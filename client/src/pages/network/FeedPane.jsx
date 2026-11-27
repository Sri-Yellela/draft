// ⭐ D180 P3 (45r) · THE FEED — my posts and my connections', newest first (never ranked); a composer (text, a link);
// Helpful and comments; report (someone else's) or delete (your own). "What you share" lists every proof-moment kind,
// each OFF until the person turns it on. Links are drawn as plain words (never fetched, never a preview).
// ⭐ D197 Wave 2 #14 · M5 (47m, lane public — the approved mock `network`, Dispatches): each post is a plate
// CorrespondenceLetter kind="dispatch" (its strip DISPATCH · [the name] + the date; a proof moment as the lit stamp — the one
// green on the page; the link as words; a shared job as its ticket / THIS JOB IS NO LONGER OPEN); the ⋯ menu's Delete /
// Report are the card's foot actions; the report is the plate ReportBlock (the five reasons); comments are a ruled list
// with a small composer; the composer is the Send ticket; What you share is a plate card of checks, all off to start.
// The hooks the tests read stay (data-feed-post, data-feed-kind, data-feed-proof, data-feed-comments, data-feed-share …).
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { CorrespondenceLetter, SendTicket, ReportBlock } from "../../plate/Correspondence.jsx";
import { Drawer, ErrorLine, Skeleton } from "../../plate/PlateState.jsx";
import FeedDeck, { deckIdFromLink } from "./FeedDeck.jsx";   // ⭐ D194 P4: a shared deck plays inline

const when = (s) => new Date(s * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toUpperCase();
const profile = (by) => (by?.handle ? `/in/${encodeURIComponent(by.handle)}` : undefined);
const pbtn = (label, onClick, extra = {}) => <button type="button" className="pl-btn pl-btn--paper" onClick={onClick} {...extra}>{label}</button>;

function Comments({ postId, onCount }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [said, setSaid] = useState("");
  const load = useCallback(() => api(`/api/network/feed/${postId}/comments`).then(r => { setList(r.comments); onCount?.(r.comments.length); }).catch(e => setSaid(e.message)), [postId, onCount]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!text.trim()) return;
    try { const r = await api(`/api/network/feed/${postId}/comments`, { method: "POST", body: JSON.stringify({ text }) }); setList(r.comments); onCount?.(r.comments.length); setText(""); }
    catch (e) { setSaid(e.message); }
  };
  const remove = async (id) => { try { await api(`/api/network/feed/comment/${id}/remove`, { method: "POST", body: "{}" }); load(); } catch (e) { setSaid(e.message); } };
  const report = async (id) => { try { await api("/api/network/report", { method: "POST", body: JSON.stringify({ kind: "comment", id, reason: "inappropriate" }) }); setSaid("Reported — a person on draft's team will look at it."); } catch (e) { setSaid(e.message); } };
  return (
    <div data-feed-comments={postId} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
      {said && <p className="pl-label pl-muted" role="status">{said}</p>}
      {(list || []).length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "var(--pl-border-rule)" }}>
          {list.map(c => (
            <li key={c.id} className="pl-body" style={{ padding: "8px 0", borderBottom: "var(--pl-border-rule)", display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "baseline" }}>
              <a href={profile(c.by)} style={{ fontWeight: 700, color: "var(--pl-ink)" }}>{c.by.name}</a>
              <span style={{ overflowWrap: "anywhere" }}>{c.text}</span>
              <span className="pl-label pl-muted">{when(c.at)}</span>
              {c.yours ? pbtn("Delete", () => remove(c.id)) : pbtn("Report", () => report(c.id))}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <textarea className="pl-textarea" rows={1} maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder="Write a comment" aria-label="Write a comment" style={{ flex: 1 }}/>
        <button type="button" className="pl-btn pl-btn--ink" onClick={add}>Comment</button>
      </div>
    </div>
  );
}

function Post({ p, onChanged }) {
  const [post, setPost] = useState(p);
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("spam");
  const [said, setSaid] = useState("");
  const helpful = async () => {
    try { setPost(await api(`/api/network/feed/${post.id}/helpful`, { method: "POST", body: JSON.stringify({ on: !post.helpfulByMe }) })); }
    catch (e) { setSaid(e.message); }
  };
  const remove = async () => { try { await api(`/api/network/feed/post/${post.id}/remove`, { method: "POST", body: "{}" }); onChanged?.(); } catch (e) { setSaid(e.message); } };
  const report = async () => {
    try { await api("/api/network/report", { method: "POST", body: JSON.stringify({ kind: "post", id: post.id, reason }) }); setReporting(false); setSaid("Reported — a person on draft's team will look at it. They aren't told who reported it."); }
    catch (e) { setSaid(e.message); }
  };
  const proof = post.proof ? { label: post.proof.kind === "check" ? `Passed the ${post.proof.label} check on Atlas` : post.proof.label } : null;
  const job = post.kind === "job" ? (post.job ? { title: post.job.title, company: post.job.company, place: post.job.location, href: post.job.path } : false) : null;
  return (
    <li data-feed-post={post.id} data-feed-kind={post.kind} style={{ listStyle: "none" }}>
      <CorrespondenceLetter kind="dispatch" from={{ name: post.by.name, href: profile(post.by) }} when={when(post.at)}
        proof={proof} text={post.text} link={post.link} job={job}
        actions={<>
          {!post.yours && pbtn(`${post.helpfulByMe ? "Helpful ✓" : "Helpful"}${post.helpful ? ` · ${post.helpful}` : ""}`, helpful, { "aria-pressed": !!post.helpfulByMe })}
          {post.yours && post.helpful > 0 && <span className="pl-label pl-muted">{post.helpful} found this helpful</span>}
          {pbtn(`Comment${post.comments ? ` · ${post.comments}` : ""}`, () => setOpen(o => !o), { "aria-expanded": open })}
          {post.yours ? pbtn("Delete", remove, { "data-feed-delete": "" }) : pbtn("Report", () => setReporting(true), { "data-feed-report": "" })}
        </>}>
        {post.proof ? <span data-feed-proof={post.proof.kind} hidden/> : null}
        {deckIdFromLink(post.link) && <FeedDeck id={deckIdFromLink(post.link)} />}
        {reporting && <ReportBlock question="Why are you reporting it?" reason={reason} onReason={setReason} onSend={report} send="Report" onCancel={() => setReporting(false)}/>}
        {said && <p className="pl-label pl-muted" role="status">{said}</p>}
        {open && <Comments postId={post.id} onCount={(n) => setPost(x => ({ ...x, comments: n }))} />}
      </CorrespondenceLetter>
    </li>
  );
}

export function WhatYouShare() {
  const [prefs, setPrefs] = useState(null);
  useEffect(() => { api("/api/network/share").then(setPrefs).catch(() => {}); }, []);
  const set = async (key, on) => { try { setPrefs(await api("/api/network/share", { method: "PUT", body: JSON.stringify({ key, on }) })); } catch { /* unchanged */ } };
  if (!prefs) return null;
  return (
    <section className="pl-card" data-feed-share="" aria-label="What you share">
      <div className="pl-card__strip"><span className="pl-label">WHAT YOU SHARE</span><span className="pl-label pl-muted">ALL OFF TO START</span></div>
      <div className="pl-card__body">
        {prefs.kinds.map(k => (
          <label key={k.key} className="pl-card__item">
            <input type="checkbox" className="pl-check" checked={k.on} onChange={e => set(k.key, e.target.checked)} /> {k.label}
          </label>
        ))}
        <span className="pl-body pl-muted">Only what you turn on here is posted to your connections for you. Everything starts off.</span>
      </div>
    </section>
  );
}

export default function FeedPane({ share = true }) {   // 46f: the Feed page draws What you share in its side column
  const [feed, setFeed] = useState(null);
  const [failed, setFailed] = useState("");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [said, setSaid] = useState("");
  const load = useCallback(() => api("/api/network/feed").then((f) => { setFeed(f); setFailed(""); }).catch(e => setFailed(e.message || "The feed couldn't load.")), []);
  useEffect(() => { load(); }, [load]);
  const more = async () => {
    const last = feed?.posts?.[feed.posts.length - 1]?.id;
    if (!last) return;
    try { const r = await api(`/api/network/feed?before=${last}`); setFeed(f => ({ ...r, posts: [...f.posts, ...r.posts] })); } catch (e) { setSaid(e.message); }
  };
  const post = async () => {
    try { await api("/api/network/feed", { method: "POST", body: JSON.stringify({ text: text || null, link: link || null }) }); setText(""); setLink(""); setSaid(""); load(); }
    catch (e) { setSaid(e.message || "That didn't post."); }
  };
  return (
    <div data-feed-pane="" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div data-feed-composer="">
        <SendTicket kicker="A DISPATCH · TO YOUR CONNECTIONS" to="Share with your connections" placeholder="Something worth knowing — a tip, a win, a question"
          maxLength={2000} value={text} onChange={setText} send="Post" onSend={post}
          note="Only your connections see it, newest first. No AI reads it.">
          <input className="pl-textarea" style={{ resize: "none" }} value={link} maxLength={500} onChange={e => setLink(e.target.value)} placeholder="A link (optional)" aria-label="A link" />
        </SendTicket>
      </div>
      {said && <p className="pl-label pl-muted" role="status">{said}</p>}
      {failed && !feed ? <ErrorLine text={failed} onRetry={load}/>
        : !feed ? <Skeleton label="Opening your feed…" lines={4}/>
        : feed.posts.length === 0
          ? <Drawer kicker="NOT YET" text="Nothing yet. Posts from your connections show up here, newest first."/>
          : <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>{feed.posts.map(p => <Post key={p.id} p={p} onChanged={load} />)}</ul>}
      {feed?.more && <button type="button" className="pl-btn pl-btn--dashed" style={{ alignSelf: "flex-start" }} onClick={more}>Older dispatches</button>}
      {share && <WhatYouShare />}
    </div>
  );
}
