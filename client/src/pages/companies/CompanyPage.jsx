// ⭐ D179 P4b (45l) · A PAGE FOR EVERY COMPANY, opened inside the shell for a signed-in reader (/app/companies/<slug>, the dock
// stays; Back returns to where they were) and public at /companies/<slug> (the marketing nav above it). One read: GET
// /api/public/companies/:slug (services/companies/publicCompany.js); signed in also Your match (/match), the network's
// status and the résumé Your match reads.
// ⭐ D197 Wave 1 #4 (47h): the page IS the survey sheet — plate/SurveySheet.jsx draws, to the approved `Survey` board; the
// reads and the state stay here (docs/revamp/survey.md says where each of the D179 / A149 / A157 page's rows lives now).
// ⛔ 47j R3 (w1-retire): the classic page (`?plate=0`, the `co` sections, CompanyPage.css) is DELETED with the plate switch;
// its loading / error / missing states are the plate library's (plate/PlateState.jsx) inside the sheet's PlateRoot.
// ⛔ D182: no label restates what the row already says; no taxonomy chips. ⛔ D60: no pills. Colours from tokens only.
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../../lib/api.js";
import SendJobPicker from "../../components/SendJobPicker.jsx";
import WorksHere from "../../components/WorksHere.jsx";   // D180 P4 (45s: shared)   // (11) 45q: D180's Send on the open jobs
import SurveySheet from "../../plate/SurveySheet.jsx";
import PlateRoot from "../../plate/PlateRoot.jsx";
import { Skeleton, Drawer, ErrorLine } from "../../plate/PlateState.jsx";

// ⭐ D180 P4: "1 connection works here" → Ask for a referral is components/WorksHere.jsx (45s: one component for the company
// page, the posting panel and the deck).
export default function CompanyPage({ slug, base = "/companies", inApp = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tries, setTries] = useState(0);   // 47j R3: the error state's Try again re-reads
  const [match, setMatch] = useState(null);   // D179: Your match — signed in (inside the shell) only
  const navigate = useNavigate();
  // ⭐ A157 (45q): the posting the reader came from (?job=<board job id>) — first, with its Apply link.
  const { search } = useLocation();
  const cameFrom = new URLSearchParams(search).get("job") || null;
  // ⭐ (11) 45q · Send a job from the company page — inside the shell (signed in) and only while the network is on.
  const [networkOn, setNetworkOn] = useState(false);   // (also D180 P4's "works here", 45r)
  const [sending, setSending] = useState(null);
  const [people, setPeople] = useState(null);       // 47h: who works here, for the sheet's referral ticket (network on)
  const [resumeName, setResumeName] = useState(null);   // 47h: the résumé Your match reads ("FROM MAYA_CHEN.PDF")
  useEffect(() => {
    if (!inApp) return undefined;
    let live = true;
    api("/api/base-resume").then((r) => { if (live && r?.name) setResumeName(r.name); }).catch(() => {});
    return () => { live = false; };
  }, [inApp]);
  useEffect(() => {
    if (!inApp) return undefined;
    let live = true;
    api("/api/network/status").then(r => live && setNetworkOn(!!r?.enabled)).catch(() => {});
    return () => { live = false; };
  }, [inApp]);
  useEffect(() => {
    if (!inApp) return undefined;
    let live = true;
    setMatch(null);
    api(`/api/companies/${encodeURIComponent(slug)}/match`).then((m) => { if (live) setMatch(m); }).catch(() => {});
    return () => { live = false; };
  }, [slug, inApp]);
  useEffect(() => {
    let live = true;
    setData(null); setError(null);
    api(`/api/public/companies/${encodeURIComponent(slug)}${cameFrom ? `?job=${encodeURIComponent(cameFrom)}` : ""}`)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e?.status === 404 || /no_such_company/.test(String(e?.message)) ? "missing" : "failed"); });
    return () => { live = false; };
  }, [slug, cameFrom, tries]);

  const coName = data?.company?.name || null;
  useEffect(() => {
    setPeople(null);
    if (!networkOn || !coName) return undefined;
    let live = true;
    api(`/api/network/at-company?name=${encodeURIComponent(coName)}`).then((r) => { if (live) setPeople(r); }).catch(() => {});
    return () => { live = false; };
  }, [networkOn, coName]);

  // ⭐ 47j R3: the page's own states, in the library's one implementation (plate/PlateState.jsx), inside the sheet's root —
  // the same words the classic page said.
  if (error === "missing") return (
    <PlateRoot className="pl-sheetpage" data-plate-page="survey" data-company-missing="">
      <Drawer text="We don't have a page for this company." action={{ label: "Browse open jobs", onClick: () => navigate(inApp ? "/app" : "/jobs") }}/>
    </PlateRoot>
  );
  if (error) return (
    <PlateRoot className="pl-sheetpage" data-plate-page="survey" data-company-error="">
      <ErrorLine text="This page couldn't load just now — try again in a moment." onRetry={() => setTries((n) => n + 1)}/>
    </PlateRoot>
  );
  if (!data) return (
    <PlateRoot className="pl-sheetpage" data-plate-page="survey" aria-busy="true">
      <Skeleton label="Loading the survey sheet" height={420} radius="plate" lines={4}/>
    </PlateRoot>
  );

  const { company: c, focus } = data;
  // Signed out there is no Pending list to tag — the link just opens the employer's posting.
  const applyOpen = inApp ? undefined : () => {};
  // ⭐ 47j R3: the Recruiter view (panels/RecruiterPanel.jsx, /app/recruiter?company= the name) is the sheet's ticket out, signed in only
  const follow = () => api(`/api/companies/${encodeURIComponent(slug)}/follow`, { method: "POST", body: JSON.stringify({ on: !match?.following }) })
    .then((r) => setMatch((m) => ({ ...m, following: !!r.following }))).catch(() => {});
  return (
    <SurveySheet data={data} match={match} inApp={inApp} base={base} resumeName={resumeName} people={people} networkOn={networkOn}
      onBack={inApp ? () => navigate(-1) : undefined} onFollow={follow} onSend={setSending} applyOpen={applyOpen}
      worksHere={networkOn ? <WorksHere company={c.name} job={focus || null} enabled /> : null}
      sendPicker={sending ? <SendJobPicker job={sending} onClose={() => setSending(null)} /> : null}
      recruiterHref={inApp ? `/app/recruiter?company=${encodeURIComponent(c.name)}` : null} />
  );
}
