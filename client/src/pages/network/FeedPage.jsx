// ⭐ 46f (owner 11-11: "build a page for feed and messaging into the menu with their own pages and interface fully built") ·
// THE FEED's own place, /app/feed: the posts column (FeedPane — the composer, my posts and my connections', newest first,
// Helpful, comments, report / delete) beside a side column (What you share; where your people and conversations are).
// Behind the network switch, like D180's Network: off → "This isn't available yet." (data-network-off).
// ⛔ D60: no capsules. Colours from tokens only (NetworkPage.css).
import { Link } from "react-router-dom";
import FeedPane, { WhatYouShare } from "./FeedPane.jsx";
import { useNetworkOn } from "./networkSwitch.js";
import "./NetworkPage.css";

export default function FeedPage() {
  const on = useNetworkOn();
  if (on === null) return <main className="net net--wide"><p className="net__quiet" role="status">Opening your feed…</p></main>;
  if (!on) return (
    <main className="net" data-network-off="" data-feed-page="">
      <h1 className="net__title">Feed</h1>
      <p className="net__quiet">This isn't available yet.</p>
    </main>
  );
  return (
    <main className="net net--wide" data-feed-page="">
      <header className="net__head">
        <h1 className="net__title">Feed</h1>
        <p className="net__quiet">What your connections share, newest first — never ranked, and no AI reads it.</p>
      </header>
      <div className="net-cols">
        <div className="net-cols__main"><FeedPane share={false} /></div>
        <aside className="net-cols__side" aria-label="About your feed">
          <WhatYouShare />
          <section className="net__sec" data-feed-elsewhere="">
            <h2>Your people</h2>
            <p className="net__quiet">Only your connections' posts appear here. Find people, answer requests and manage blocks in <Link to="/app/network">Network</Link>; talk one to one in <Link to="/app/messages">Messages</Link>.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
