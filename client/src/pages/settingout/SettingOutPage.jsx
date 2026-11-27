// ⭐ D197 Wave 2 #15 · M5 (47m, lane person) · ONBOARDING → *SETTING OUT*, at /app/setting-out — built from the approved mock
// (pages/dev/platePages/Onboarding.jsx; docs/revamp/onboarding.md). The first page of the journey, Region IV:
//   01 HAND OVER YOUR RÉSUMÉ  the drop (SettingOutDrop — the page's one clay point): one résumé → the first job profile
//                             (POST /api/domain-profiles/from-resume, D186-3 / A104); Or start with the audit (/audit);
//                             Set it up by hand instead (the five-stop wizard, O15–O24).
//   02 YOUR BEARING           what was read, as the market's cartouche sentence — tap a dashed word and the wizard opens on
//                             it, pre-filled (refine mode, D112 e2); "Looks right" marks it checked by saving the refine.
//   03 FOUR THINGS ONLY YOU KNOW  one at a time (FourThingsTicket — the passport shows the same ticket until they're done).
//   BY HAND                   the five stops as a RouteLine, the wizard one press away.
// ⛔ D190: nothing here calls a model — the résumé is read by the server's own parser (lib/parseResumeFile.js), and the
// wizard's "more suggestions" read the résumé against the taxonomy (services/chipSuggestions.js).
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { parseResumeFile } from "../../lib/parseResumeFile.js";
import { bearingParts, bearingLine, LEVEL_WORDS } from "../../lib/bearing.js";
import { useJobBoard } from "../../contexts/JobBoardContext.jsx";
import DomainProfileWizard from "../../components/DomainProfileWizard.jsx";
import { FourThingsTicket } from "../profile/ResumeSetup.jsx";
import PlateRoot from "../../plate/PlateRoot.jsx";
import { Kickers } from "../../plate/Marks.jsx";
import { PageTitle, StatsStrip, LegHeader, PlateHero } from "../../plate/Plates.jsx";
import { Ticket, Cartouche } from "../../plate/Tickets.jsx";
import { RouteLine } from "../../plate/Lists.jsx";
import { CompassDial } from "../../plate/Drawings.jsx";
import { Skeleton } from "../../plate/PlateState.jsx";
import { SettingOutDrop } from "../../plate/Person.jsx";
import MarketSurveyPlate from "../../plate/drawings/MarketSurveyPlate.jsx";
import SettingOutCounter from "../../plate/drawings/SettingOutCounter.jsx";
import "../../plate/personPages.css";

const STOPS = ["Domain", "Level", "Titles", "Keywords", "Save"];
const plain = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export default function SettingOutPage() {
  const navigate = useNavigate();
  const { setActiveProfileId } = useJobBoard() || {};
  const [profiles, setProfiles] = useState(null);   // null = loading
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState(null);   // null | { mode: "create" } | { mode: "edit", refine: true, profile }
  const [said, setSaid] = useState("");
  const [four, setFour] = useState({ open: null, left: 0, of: 4 });
  const [fileName, setFileName] = useState("");

  const load = useCallback(() => api("/api/domain-profiles", { timeoutMs: 10000 }).then((r) => setProfiles(Array.isArray(r) ? r : [])).catch(() => setProfiles([])), []);
  const loadFour = useCallback(() => api("/api/profile/four-things").then((s) => {
    const items = s?.items || [];
    setFour({ open: !!s?.open, left: items.filter((i) => !i.set && !i.skipped).length, of: items.length || 4 });
  }).catch(() => {}), []);
  useEffect(() => { load(); loadFour(); }, [load, loadFour]);

  const take = async (file) => {
    if (!file) return;
    setBusy(true); setFileName(file.name); setStatus(`Reading ${file.name}…`);
    try {
      const text = await parseResumeFile(file);
      if (!String(text || "").trim()) throw new Error("No text could be read from that file — try the PDF or Word version.");
      const r = await api("/api/domain-profiles/from-resume", { method: "POST", body: JSON.stringify({ content: text, name: file.name }) });
      const i = r.inferred || {};
      setStatus(`Set up as ${i.profileName || "your job profile"} · ${LEVEL_WORDS[i.seniority] || i.seniority || ""} level${i.titles?.length ? ` · ${i.titles.slice(0, 3).join(", ")}` : ""}. You can refine it any time.`);
      if (r?.profile?.id) setActiveProfileId?.(r.profile.id);
      await load(); loadFour();
      requestAnimationFrame(() => document.getElementById("so-02")?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
    } catch (e) { setStatus(e.message || "Could not read that résumé."); }
    finally { setBusy(false); }
  };
  const onClick = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented || !plain(e) || a.target) return;
    const href = a.getAttribute("href");
    if (!/^\/app\b/.test(href || "")) return;
    e.preventDefault(); navigate(href);
  };

  if (profiles === null) return <PlateRoot region="IV" className="pl-pp-page"><div className="pl-page pl-pp-loading"><Skeleton label="Loading" height={420} lines={5} /></div></PlateRoot>;
  const active = profiles.find((p) => p.is_active) || profiles[0] || null;
  const read = !!active;
  const openStop = (id) => {
    if (!active) { setWizard({ mode: "create" }); return; }
    const at = { role: 0, level: 1, titles: 2, tech: 3 }[id] ?? 0;
    setSaid(`Opened ${STOPS[at]} — change it and the bearing redraws.`);
    setWizard({ mode: "edit", refine: true, profile: active });
  };
  const fourDone = four.open === false || four.left === 0;
  const clay = !read ? "drop" : active.needs_refine ? "bearing" : !fourDone ? "four" : "market";

  return (
    <PlateRoot region="IV" className="pl-pp-page" data-setting-out={read ? "read" : "start"} onClick={onClick}>
      <header className="pl-hero">
        <div className="pl-hero__main">
          <Kickers parts={["A NEW ACCOUNT", "ONE RÉSUMÉ SETS UP EVERYTHING", "MANUAL ALWAYS AVAILABLE"]} />
          <PageTitle>Setting out</PageTitle>
          <p className="pl-lead">Hand over one résumé. draft takes your bearing, draws your first job profile on the map, then asks only what a résumé can’t say.</p>
          {read ? (
            <StatsStrip label="What your résumé said" cells={[
              { value: active.profile_name || "—", label: "FIELD", onClick: () => openStop("role") },
              { value: LEVEL_WORDS[active.seniority] || active.seniority || "—", label: "LEVEL", onClick: () => openStop("level") },
              { value: (active.target_titles || []).length, label: "TITLES", onClick: () => openStop("titles") },
              { value: four.of - four.left, label: `OF ${four.of} ANSWERED`, onClick: () => document.getElementById("so-03")?.scrollIntoView?.({ behavior: "smooth" }) },
            ]} />
          ) : null}
        </div>
        <div className="pl-pp-hero__plate">
          <PlateHero aspect="640 / 520" caption={<span className="pl-label">{read ? `YOUR BEARING · ${bearingLine(active).toUpperCase()}` : "THE MARKET · YOUR PLACE ON IT COMES WITH THE RÉSUMÉ"}</span>}
            tags={read ? [{ kicker: "YOU ARE HERE", line: active.profile_name || "Your field", x: 6, y: 8, kind: "here" }] : []}>
            <MarketSurveyPlate best={null} label={read ? `The market as a survey plate: you placed in ${active.profile_name || "your field"}, from your résumé` : "The market as a survey plate, before your résumé places you"} />
          </PlateHero>
        </div>
      </header>

      <section className="pl-section" aria-labelledby="so-01-t">
        <LegHeader n={1} meta="LEG 1 · ≈ 1 MIN · PDF, WORD OR TEXT" title={<span id="so-01-t">Hand over your résumé</span>} />
        <div className="pl-pp-row">
          <div className="pl-pp-main">
            <SettingOutDrop onFile={take} status={status} busy={busy} button={read ? "Upload another résumé" : "Upload your résumé"}
              title={read ? "Your résumé is read" : "Hand over your résumé"}
              aside={<button type="button" className="pl-btn pl-btn--flat" onClick={() => setWizard({ mode: "create" })}>Set it up by hand instead</button>} />
          </div>
          <div className="pl-pp-side">
            <Ticket kicker="THE AUDIT · 3 MINUTES" title="Or start with the audit" line="Either order leads to the map." go="Take the audit →" href="/audit" />
            <div style={{ marginTop: 18 }}>
              <PlateHero aspect="360 / 220">
                <SettingOutCounter label="A résumé slides across a counter; a clay ticket on it is stamped read" name={fileName ? fileName.replace(/\.[a-z]+$/i, "") : "Your résumé"}
                  caption={read ? "YOUR RÉSUMÉ · READ · NO AI" : "YOUR RÉSUMÉ · READ BY DRAFT · NO AI"} />
              </PlateHero>
            </div>
          </div>
        </div>
      </section>

      <section className="pl-section" id="so-02" aria-labelledby="so-02-t">
        <LegHeader n={2} meta="LEG 2 · READ FROM YOUR RÉSUMÉ · YOURS TO CHANGE" title={<span id="so-02-t">Your bearing</span>} />
        <div className="pl-pp-row">
          <div className="pl-pp-main">
            {read ? (
              <Cartouche source={active.base_resume_updated_at ? "FROM YOUR RÉSUMÉ" : "SET BY HAND"} onPart={openStop} parts={bearingParts(active)}
                actions={<>
                  <button type="button" className={clay === "bearing" ? "pl-btn pl-btn--primary" : "pl-btn pl-btn--ink"} onClick={() => setWizard({ mode: "edit", refine: true, profile: active })}>
                    {active.needs_refine ? "Check what it read" : "Change it"}</button>
                  <a className="pl-btn" href="/app/job-profiles">All your bearings</a>
                </>} />
            ) : <p className="pl-body pl-muted">Your bearing is drawn here once the résumé is read.</p>}
            <p className="pl-label pl-muted" aria-live="polite">{said}</p>
          </div>
          <div className="pl-pp-side"><p className="pl-body">The plate above is the same: the beacon lands on the field your résumé names.</p></div>
        </div>
      </section>

      <section className="pl-section" id="so-03" aria-labelledby="so-03-t">
        <LegHeader n={3} meta={`LEG 3 · ${four.left} LEFT · EACH SKIPPABLE · NEVER GUESSED`} title={<span id="so-03-t">Four things only you know</span>} />
        <div className="pl-pp-row">
          <div className="pl-pp-main">
            {!read ? <p className="pl-body pl-muted">Asked once your résumé is read — only what a résumé can’t say.</p>
              : fourDone ? <Ticket tone={clay === "market" ? "clay-tint" : "plain"} kicker="ALL ANSWERED OR SKIPPED" title="See your first picks" line="Ten jobs dealt from your bearing." go="Open the market →" href="/app/jobs" />
              : <FourThingsTicket onChanged={loadFour} clay={clay === "four"} />}
          </div>
          <div className="pl-pp-side"><CompassDial lit={four.of - four.left} total={four.of} size={128} label={`Compass dial: ${four.of - four.left} of ${four.of} answered or skipped`} /></div>
        </div>
      </section>

      <section className="pl-section" aria-labelledby="so-hand-t">
        <LegHeader meta="ALWAYS ONE PRESS AWAY · EVERY STEP OPTIONAL WHEN REFINING" title={<span id="so-hand-t">By hand</span>} />
        <div className="pl-pp-main" style={{ marginTop: 18 }}>
          <RouteLine label="The five stops" stops={STOPS.map((name, i) => ({ name, state: read ? "lit" : i === 0 ? "next" : "ahead" }))} />
          <div className="pl-actions">
            <button type="button" className="pl-btn pl-btn--ink" onClick={() => setWizard(read ? { mode: "edit", refine: true, profile: active } : { mode: "create" })}>
              {read ? "Walk the five stops again" : "Set it up by hand"}</button>
            <button type="button" className="pl-btn" onClick={() => setWizard({ mode: "create" })}>Add another bearing</button>
          </div>
        </div>
      </section>

      <section className="pl-section pl-section--last" aria-labelledby="so-onward-t">
        <LegHeader meta="ONWARD" title={<span id="so-onward-t">Tickets out</span>} />
        <div className="pl-tickets">
          <Ticket kicker="THE MARKET" title="See your first picks" line="Ten a day, read against your résumé." go="Open →" href="/app/jobs" />
          <Ticket kicker="YOUR PASSPORT" title="Your page, from your résumé" line="Only you can see it until you choose." go="Open →" href="/app/profile/about" />
          <Ticket kicker="THE AUDIT · 3 MINUTES" title="Take the 3-minute audit" line="Either order leads to the map." go="Take it →" href="/audit" />
        </div>
      </section>

      {wizard ? (
        <DomainProfileWizard
          key={wizard.profile ? `refine-${wizard.profile.id}` : "create-profile"}
          mode={wizard.mode}
          refine={wizard.refine || undefined}
          initialProfile={wizard.profile || null}
          bannerText={wizard.refine ? "Read from your résumé — change anything that is not right. Every step is optional." : "Set your first job profile up by hand — five stops."}
          onComplete={(saved) => { setWizard(null); if (saved?.id) setActiveProfileId?.(saved.id); setSaid(saved ? `Your bearing redrawn: ${bearingLine(saved)}.` : ""); load(); }}
          onDismiss={() => setWizard(null)}
        />
      ) : null}
    </PlateRoot>
  );
}
