// ⭐ D197 Wave 1 #7 (47h, lane atlas) · THE LIBRARY — OUTSIDE RESOURCES ONLY (D201 (4)); the approved canvas board `Library`
// (docs/sketches/final/project/Library.dc.html): the collections down the side, the region chips, then the collection —
// field notes as poster cards in a drawer per region, everything else as ruled catalogue cards; an empty collection is an
// EMPTY DRAWER that says so. The board's markup in plate classes (plate/atlasPlate.css).
import { RegionEmblem } from "./Drawings.jsx";
import "./atlasPlate.css";

const plain = (e) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
const CAT_ICONS = {
  notes: "M7 3h10v18H7z M10 9l5 3-5 3z", sources: "M6 3h9l3 3v15H6z M9 10h6 M9 14h6 M9 18h4", lectures: "M3 5h18v11H3z M8 20h8 M12 16v4",
  books: "M5 4h6v16H5z M13 4h6v16h-6z", courses: "M3 9l9-5 9 5-9 5z M7 11v5c3 2 7 2 10 0v-5", essays: "M4 5h16v14H4z M8 9h8 M8 13h8 M8 17h5",
  grounds: "M4 20l6-10 4 6 2-3 4 7z M15 4v5 M15 4l4 1.5-4 1.5", guides: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c1-4 4-6 8-6s7 2 8 6", glossary: "M6 4h11v16H6z M9 8h5 M9 12h5",
};

/** The side: the Library's title card and its collections (the current one in clay). */
export function LibraryAside({ cats = [], current, onCat, title = "Everything the map was drawn from" }) {
  return (
    <aside className="pl-at-laside" aria-label="Library collections">
      <div className="pl-at-laside__card">
        <span className="pl-at-laside__k">THE LIBRARY</span>
        <span className="pl-at-laside__title">{title}</span>
      </div>
      <nav className="pl-at-laside__nav" aria-label="Collections">
        {cats.map((c) => (
          <button key={c.id} type="button" className="pl-at-lcat" aria-current={current === c.id ? "true" : undefined} onClick={() => onCat?.(c.id)} data-collection={c.id}>
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={current === c.id ? 1.9 : 1.7} strokeLinecap="round" strokeLinejoin="round" className="pl-at-lcat__icon"><path d={CAT_ICONS[c.icon] || CAT_ICONS.notes}/></svg>
            <span className="pl-at-lcat__label">{c.label}</span><span className="pl-at-lcat__count">{c.count}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

/** The region chips: Every region + each region the collection holds something from. */
export function LibraryChips({ chips = [], current = "all", onChip }) {
  return (
    <div className="pl-at-lchips" role="group" aria-label="Filter by region">
      {chips.map((c) => (
        <button key={c.id} type="button" className="pl-at-lchip" aria-pressed={current === c.id} onClick={() => onChip?.(c.id)} data-region={c.region}>
          <span className="pl-at-lchip__tag" data-all={c.id === "all" ? "" : undefined}>{c.tag}</span>{c.label}<span className="pl-at-lchip__count">{c.count}</span>
        </button>
      ))}
    </div>
  );
}

/** A field note: a dark poster (kicker, length, the phrase with its highlight, play + progress) over its label strip. */
export function LibraryNote({ code, kicker, duration, pre, hl, post, progress = 0, views, title, creator, href, onOpen }) {
  return (
    <a className="pl-at-note" href={href} target={href && /^https?:/.test(href) ? "_blank" : undefined} rel="noopener noreferrer" onClick={() => onOpen?.()}>
      <span className="pl-at-note__poster">
        {kicker ? <span className="pl-at-note__k">{kicker}</span> : null}
        {duration ? <span className="pl-at-note__dur">{duration}</span> : null}
        <span className="pl-at-note__text">{pre}{hl ? <> <span className="pl-at-note__hi">{hl}</span></> : null}{post ? ` ${post}` : null}</span>
        <span className="pl-at-note__play">
          <span className="pl-at-note__btn" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24" style={{ fill: "var(--pl-poster)" }}><path d="M7 4l13 8-13 8z"/></svg></span>
          <span className="pl-at-note__track" role="img" aria-label={`${Math.round(progress * 100)}% watched`}><span style={{ width: `${Math.round(progress * 100)}%` }}/></span>
        </span>
      </span>
      <span className="pl-at-note__strip">
        <span className="pl-at-note__row"><span>{code}</span>{views ? <span className="pl-at-note__views">{views}</span> : null}</span>
        <span className="pl-at-note__title">{title}</span>
        {creator ? <span className="pl-at-note__by">{creator}</span> : null}
      </span>
    </a>
  );
}

/** A catalogue card (a source on file): call number, where it appeared, the serif title, who, why it matters, its region. */
export function LibrarySource({ call, venue, title, authors, why, region, href, explained, action, onOpen }) {
  return (
    <div className="pl-at-src" data-region={region?.roman} data-explained={explained ? "" : undefined}>
      <span aria-hidden="true" className="pl-at-src__hole"/>
      <span className="pl-at-src__top"><span className="pl-at-src__call">{call}</span>{venue ? <span className="pl-at-src__venue">{venue}</span> : null}</span>
      {href ? <a className="pl-at-src__title" href={href} target="_blank" rel="noopener noreferrer" onClick={() => onOpen?.()}>{title}</a> : <span className="pl-at-src__title">{title}</span>}
      {authors ? <span className="pl-at-src__authors">{authors}</span> : null}
      {why ? <span className="pl-at-src__why">{why}</span> : null}
      <span className="pl-at-src__foot">
        <span className="pl-at-src__region">Region {region?.roman} · {region?.name}</span>
        {action ? (action.href
          ? <a className="pl-at-src__btn" href={action.href} aria-pressed={explained ? "true" : "false"} onClick={(e) => { if (action.onClick && plain(e)) { e.preventDefault(); action.onClick(); } }}>{explained ? "✓ Explained" : action.label}</a>
          : <button type="button" className="pl-at-src__btn" aria-pressed={!!explained} onClick={action.onClick}>{explained ? "✓ Explained" : action.label}</button>) : null}
      </span>
      {explained ? <span className="pl-at-src__stamp at-stamp" aria-hidden="true">EXPLAINED</span> : null}
    </div>
  );
}

/** A collection's heading row. */
export function CollectionHead({ kicker, title, aside }) {
  return (
    <div className="pl-at-lhead">
      <div><span className="pl-at-k pl-at-k--clay pl-at-lhead__k">{kicker}</span><h1 className="pl-at-lhead__title">{title}</h1></div>
      {aside}
    </div>
  );
}

/** A drawer of field notes for one region. */
export function NotesDrawer({ region, count, children }) {
  return (
    <section className="pl-at-drawer" data-region={region.roman} aria-label={`Drawer ${region.roman}, ${region.name}`}>
      <div className="pl-at-drawer__head">
        <span className="pl-at-drawer__emblem"><RegionEmblem kind={region.kind} region={region.roman} size={48}/></span>
        <span className="pl-at-drawer__text"><span className="pl-at-drawer__k">DRAWER {region.roman}</span><span className="pl-at-drawer__name">{region.name}</span></span>
        <span className="pl-at-grow"/>
        <span aria-hidden="true" className="pl-at-drawer__pull"/>
        <span className="pl-at-drawer__count">{count} NOTES</span>
      </div>
      <div className="pl-at-drawer__row">{children}</div>
    </section>
  );
}

/** The empty drawer: the collection's name and what to do instead. */
export function EmptyDrawer({ title, text, action }) {
  return (
    <div className="pl-at-empty at-in" data-empty-drawer="">
      <span className="pl-at-empty__k">EMPTY DRAWER</span>
      <h1 className="pl-at-empty__title">{title}</h1>
      <p className="pl-at-empty__text">{text}</p>
      {action ? <a className="pl-at-src__btn" href={action.href} onClick={(e) => { if (action.onClick && plain(e)) { e.preventDefault(); action.onClick(); } }}>{action.label}</a> : null}
    </div>
  );
}

/** The Library's main column on real data (pages/atlas/AtlasVolume.jsx): chips, then the collection's view. */
export function LibraryShelfView({ status, onRetry, cat, view, items = [], mod = "all", onMod, onOpen, callNumber, lessonHref, onLesson, glossaryHref, onGlossary, shelfHref, onShelf }) {
  if (status === "loading") return <main className="pl-at-lmain"><p className="pl-at-msg" role="status">Opening the Library…</p></main>;
  if (status === "error") return <main className="pl-at-lmain"><p className="pl-at-msg" role="alert">The Library didn’t load. <button type="button" className="pl-btn" onClick={onRetry}>Try again</button></p></main>;
  const regions = [];
  for (const x of items) if (!regions.some((r) => r.roman === x.region.roman)) regions.push(x.region);
  const chips = [{ id: "all", tag: "ALL", label: "Every region", count: String(items.length) },
    ...regions.map((r) => ({ id: r.roman, tag: r.roman, label: r.name, region: r.roman, count: String(items.filter((x) => x.region.roman === r.roman).length) }))];
  const shown = items.filter((x) => mod === "all" || x.region.roman === mod);
  if (view === "glossary") {
    return <main className="pl-at-lmain"><EmptyDrawer title={cat.label} text="The plain-words list lives in the Atlas itself: every term, what it means, how many postings ask for it."
      action={{ label: "Open the glossary", href: glossaryHref, onClick: onGlossary }}/></main>;
  }
  if (!items.length) {
    return <main className="pl-at-lmain"><EmptyDrawer title={cat.label} text="Nothing filed here yet. Atlas’s own courses and guides are on their own shelf."
      action={{ label: "Courses and guides", href: shelfHref, onClick: onShelf }}/></main>;
  }
  const chipRow = <LibraryChips chips={chips} current={chips.some((c) => c.id === mod) ? mod : "all"} onChip={onMod}/>;
  if (view === "notes") {
    return (
      <main className="pl-at-lmain">
        {chipRow}
        <div className="pl-at-lview at-in">
          <CollectionHead kicker="COLLECTION · FIELD NOTES" title="Short explainers, filed by region" aside={<span className="pl-at-lhead__note">Each note opens where it lives; opening it from here counts on its lesson.</span>}/>
          {regions.filter((r) => mod === "all" || r.roman === mod).map((r) => {
            const notes = shown.filter((x) => x.region.roman === r.roman);
            return (
              <NotesDrawer key={r.roman} region={r} count={notes.length}>
                {notes.map((x, i) => (
                  <LibraryNote key={x.id} code={`FN-${r.roman}.${i + 1}`} kicker={x.kind.toUpperCase()} pre={x.lesson.title} title={x.title} creator={x.by}
                    progress={x.opened ? 1 : 0} views={x.opened ? "OPENED" : null} href={x.url} onOpen={() => onOpen?.(x)}/>
                ))}
              </NotesDrawer>
            );
          })}
        </div>
      </main>
    );
  }
  const explained = shown.filter((x) => x.explained).length;
  return (
    <main className="pl-at-lmain">
      {chipRow}
      <div className="pl-at-lview pl-at-lview--cards at-in">
        <CollectionHead kicker={`COLLECTION · ${cat.label.toUpperCase()}`} title={cat.label}
          aside={<span className="pl-at-lhead__count">{explained} / {shown.length} EXPLAINED</span>}/>
        <div className="pl-at-srcs">
          {shown.map((x, i) => (
            <LibrarySource key={x.id} call={callNumber(x, i)} venue={x.kind} title={x.title} authors={x.by} why={x.lesson.goal || x.lesson.title} region={x.region}
              href={x.url} onOpen={() => onOpen?.(x)} explained={x.explained}
              action={{ label: "I can explain it", href: lessonHref(x), onClick: () => onLesson(x) }}/>
          ))}
        </div>
      </div>
    </main>
  );
}
