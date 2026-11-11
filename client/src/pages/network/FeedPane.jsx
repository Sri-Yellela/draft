// ⭐ D180 P3 (45r) · THE FEED — my posts and my connections', newest first (never ranked); a composer (text, a link);
// Helpful and comments; ⋯ = report (someone else's) or delete (your own). "What you share" lists every proof-moment kind,
// each OFF until the person turns it on. Links are drawn as plain words (never fetched, never a preview).
// ⛔ D60: no capsules. Colours from tokens only (NetworkPage.css).
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import DepthButton from "../../components/DepthButton.jsx";

const when = (s) => new Date(s * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const REASONS = [["spam", "Spam"], ["harassment", "Harassment"], ["scam", "A scam"], ["inappropriate", "Inappropriate"], ["other", "Something else"]];

function FeedJob({ job }) {   // (not JobCard — A93)
  if (!job) return <div className="msg-job msg-job--gone">This job is no longer open.</div>;
  return (
    <a className="msg-job" href={job.path} data-feed-job={job.id}>
      <b>{job.title}</b><span>{[job.company, job.location].filter(Boolean).join(" · ")}</span>
      <span className="msg-job__go">Open the job →</span>
    </a>
  );
}

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
    <div className="feed-comments" data-feed-comments={postId}>
      {said && <p className="net__quiet" role="status">{said}</p>}
      {(list || []).map(c => (
        <p key={c.id} className="feed-comment">
          <a href={c.by.handle ? `/in/${encodeURIComponent(c.by.handle)}` : undefined}>{c.by.name}</a> {c.text}
          <span className="msg__meta">{when(c.at)} · {c.yours
            ? <button type="button" className="msg__act" onClick={() => remove(c.id)}>Delete</button>
            : <button type="button" className="msg__act" onClick={() => report(c.id)}>Report</button>}</span>
        </p>
      ))}
      <div className="msg-compose">
        <textarea rows={1} maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder="Write a comment" aria-label="Write a comment" />
        <DepthButton onClick={add}>Comment</DepthButton>
      </div>
    </div>
  );
}

function Post({ p, onChanged }) {
  const [post, setPost] = useState(p);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
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
  return (
    <li className="feed-post" data-feed-post={post.id} data-feed-kind={post.kind}>
      <div className="msg-thread__head">
        <span className="net-person__tile" aria-hidden="true">{String(post.by.name || "?").charAt(0).toUpperCase()}</span>
        <span className="net-person__main">
          <a className="net-person__name" href={post.by.handle ? `/in/${encodeURIComponent(post.by.handle)}` : undefined}>{post.by.name}</a>
          <span className="net-person__sub">{when(post.at)}</span>
        </span>
        <span className="msg-thread__menu">
          <button type="button" className="msg__act" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)} aria-label="More">⋯</button>
          {menu && (
            <span className="msg-menu" role="menu">
              {post.yours
                ? <button type="button" role="menuitem" onClick={() => { setMenu(false); remove(); }}>Delete this post</button>
                : <button type="button" role="menuitem" onClick={() => { setMenu(false); setReporting(true); }}>Report this post</button>}
            </span>
          )}
        </span>
      </div>
      {post.proof && <p className="feed-proof" data-feed-proof={post.proof.kind}>{post.proof.kind === "check" ? `Passed the ${post.proof.label} check on Atlas` : post.proof.label}</p>}
      {post.text && <p className="msg__text">{post.text}</p>}
      {post.link && <p className="net__quiet feed-link">{post.link}</p>}
      {post.kind === "job" && <FeedJob job={post.job} />}
      {reporting && (
        <div className="msg-report">
          <label>Why are you reporting it?{" "}
            <select value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(([k, w]) => <option key={k} value={k}>{w}</option>)}</select>
          </label>
          <div className="net__row"><DepthButton primary onClick={report}>Report</DepthButton><DepthButton onClick={() => setReporting(false)}>Cancel</DepthButton></div>
        </div>
      )}
      {said && <p className="net__quiet" role="status">{said}</p>}
      <div className="net__row feed-acts">
        {!post.yours && <DepthButton onClick={helpful} aria-pressed={post.helpfulByMe}>{post.helpfulByMe ? "Helpful ✓" : "Helpful"}{post.helpful ? ` · ${post.helpful}` : ""}</DepthButton>}
        {post.yours && post.helpful > 0 && <span className="net__quiet">{post.helpful} found this helpful</span>}
        <DepthButton onClick={() => setOpen(o => !o)}>Comment{post.comments ? ` · ${post.comments}` : ""}</DepthButton>
      </div>
      {open && <Comments postId={post.id} onCount={(n) => setPost(x => ({ ...x, comments: n }))} />}
    </li>
  );
}

export function WhatYouShare() {
  const [prefs, setPrefs] = useState(null);
  useEffect(() => { api("/api/network/share").then(setPrefs).catch(() => {}); }, []);
  const set = async (key, on) => { try { setPrefs(await api("/api/network/share", { method: "PUT", body: JSON.stringify({ key, on }) })); } catch { /* unchanged */ } };
  if (!prefs) return null;
  return (
    <section className="net__sec" data-feed-share="">
      <h2>What you share</h2>
      <p className="net__quiet">Only what you turn on here is posted to your connections for you. Everything starts off.</p>
      {prefs.kinds.map(k => (
        <label key={k.key} className="feed-share__row">
          <input type="checkbox" checked={k.on} onChange={e => set(k.key, e.target.checked)} /> {k.label}
        </label>
      ))}
    </section>
  );
}

export default function FeedPane({ share = true }) {   // 46f: the Feed page draws What you share in its side column
  const [feed, setFeed] = useState(null);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [said, setSaid] = useState("");
  const load = useCallback(() => api("/api/network/feed").then(setFeed).catch(e => setSaid(e.message || "The feed couldn't load.")), []);
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
    <div data-feed-pane="">
      <section className="net__sec" data-feed-composer="">
        <h2>Share with your connections</h2>
        <textarea className="net__note" rows={3} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Something worth knowing — a tip, a win, a question" aria-label="Write a post" />
        <input className="net__note" value={link} maxLength={500} onChange={e => setLink(e.target.value)} placeholder="A link (optional)" aria-label="A link" />
        <div className="net__row"><DepthButton primary onClick={post}>Post</DepthButton></div>
        <p className="net__quiet">Only your connections see it, newest first. No AI reads it.</p>
      </section>
      {said && <p className="net__said" role="status">{said}</p>}
      {!feed ? <p className="net__quiet" role="status">Opening your feed…</p> : feed.posts.length === 0
        ? <p className="net__quiet">Nothing yet. Posts from your connections show up here, newest first.</p>
        : <ul className="net__list feed-list">{feed.posts.map(p => <Post key={p.id} p={p} onChanged={load} />)}</ul>}
      {feed?.more && <div className="net__row"><DepthButton onClick={more}>Older posts</DepthButton></div>}
      {share && <WhatYouShare />}
    </div>
  );
}
