// ⭐ D196 · the plate system's line icons — the v3 boards' paths (24 × 24, 1.8 stroke, round joins), copied from the
// canvas export. Stroke is the current text colour; nothing here carries a colour of its own.
export const ICON_PATHS = Object.freeze({
  home: "M4 11l8-7 8 7v9H4z M10 20v-5h4v5",
  atlas: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18",
  interview: "M9 4h6v8a3 3 0 0 1-6 0z M6 11a6 6 0 0 0 12 0 M12 17v3",
  network: "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M16.5 11a2.5 2.5 0 1 0 0-5 M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5 M14.5 15c2.6-.4 4.6.9 5.5 3.5",
  ask: "M5 5h14v10H10l-4 4v-4H5z",
  picks: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  list: "M4 6h16 M4 12h16 M4 18h10",
  starred: "M6 4h12v16l-6-4-6 4z",
  imported: "M12 4v11 M7 10l5 5 5-5 M5 20h14",
  chevron: "M6 9l6 6 6-6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4",
  prev: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
  send: "M4 12l16-7-6 16-3-7z",
  filters: "M4 6h16 M7 12h10 M10 18h4",
  needs: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v5 M12 16v.01",
  progress: "M12 3a9 9 0 1 0 9 9 M12 7v5l3 2",
  sent: "M4 12l16-7-6 16-3-7z",
  replies: "M4 5h16v11H9l-5 4z",
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14",
  library: "M4 4h5v16H4z M10 4h4v16h-4z M15.5 5l3.8-1 2.7 15.5-3.8 1z",
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14 M12 17.5v.01",
  league: "M7 4h10v4a5 5 0 0 1-10 0z M5 5H3v1a4 4 0 0 0 4 4 M19 5h2v1a4 4 0 0 1-4 4 M12 13v4 M8 20h8",
  // D197 #1: the two places the board doesn't draw (46f's own pages, under the network switch) — today's dock drawings,
  // redrawn as paths in the plate's line set: a page of posts, an envelope
  feed: "M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4z M8 9h8 M8 12.5h8 M8 16h5",
  messages: "M6 5.5h12a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 16V8A2.5 2.5 0 0 1 6 5.5z M4 7l8 6 8-6",
});

/** A line icon. size 16 in an area nav, 20 in the dock (the report: 16–18 px, 1.7–2 stroke). */
export function Icon({ name, size = 16, stroke = 1.8 }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
  );
}
