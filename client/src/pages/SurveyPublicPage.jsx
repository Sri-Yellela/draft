// ⭐ D130 (owner 11-01) · jobsviadraft.com/survey — THE STANDALONE SURVEY, for people who can't try the app: no sign-in,
// no account, no résumé, no tour; the ONE form (SurveyForm) with the standalone questions from the server (name and
// email first — their only identity; questions about the idea, not our screens). A hidden honeypot rides along; the
// server limits each address to 5 an hour and keeps one response per email. The thank-you offers sign-up (/register).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SurveyForm, { surveyPage, surveyCard } from "../components/SurveyForm.jsx";
import DepthButton from "../components/DepthButton.jsx";
import { api } from "../lib/api.js";
import { PublicPage } from "../components/PublicChrome.jsx";
import { Stamp } from "../plate/Marks.jsx";

// Owner 11-01: the site header with the /draft wordmark above the form (linking home; no account needed).
// ⭐ 47m (D197 · marketing.md 16q, M5): that header is the plate public nav now (the wordmark → /), the public footer under it.
function SurveyFrame({ children, ...data }) {
  return <PublicPage region="I" data-survey-header="" {...data}>{children}</PublicPage>;
}

export default function SurveyPublicPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState(null);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    api("/api/survey/form").then(j => setQuestions(j.survey || [])).catch(() => setErr("The survey did not load. Refresh to try again."));
  }, []);
  if (sent) {
    return (
      <SurveyFrame>
      <div style={surveyPage} data-survey-public="sent">
        <div style={{ ...surveyCard, textAlign: "center", padding: 22 }}>
          <Stamp tone="ink">SENT</Stamp>
          <h2 style={{ margin: "10px 0 6px", fontFamily: "var(--pl-serif)", fontWeight: 400, fontSize: "var(--pl-t-card)" }}>Thanks!</h2>
          <p style={{ margin: "0 0 14px", color: "var(--color-text-muted)" }}>Want to see it? Make an account and try draft.</p>
          <DepthButton primary onClick={() => navigate("/register")} data-survey-try="">Try draft</DepthButton>
        </div>
      </div>
      </SurveyFrame>
    );
  }
  if (err) return <SurveyFrame><div style={surveyPage}><p role="alert" className="pl-body">{err}</p></div></SurveyFrame>;
  if (!questions) return <SurveyFrame><div style={surveyPage} aria-busy="true"/></SurveyFrame>;
  return (
    <SurveyFrame data-survey-public="">
      <SurveyForm questions={questions} honeypot
        title="Help us build a better way to job hunt"
        intro="About two minutes. Your answers shape what we build. Nothing here is shared with employers."
        onSubmit={async (answers) => {
          await api("/api/survey", { method: "POST", body: JSON.stringify(answers) });
          setSent(true); window.scrollTo(0, 0);
        }}
        footer={<>We save your answers to improve draft and never share them with employers. <a href="/privacy" target="_blank" rel="noopener">Privacy</a></>}/>
    </SurveyFrame>
  );
}
