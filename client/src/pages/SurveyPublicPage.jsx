// ⭐ D130 (owner 11-01) · jobsviadraft.com/survey — THE STANDALONE SURVEY, for people who can't try the app: no sign-in,
// no account, no résumé, no tour; the ONE form (SurveyForm) with the standalone questions from the server (name and
// email first — their only identity; questions about the idea, not our screens). A hidden honeypot rides along; the
// server limits each address to 5 an hour and keeps one response per email. The thank-you offers sign-up (/register).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SurveyForm, { surveyPage, surveyCard } from "../components/SurveyForm.jsx";
import DepthButton from "../components/DepthButton.jsx";
import { StampLogo } from "../components/StampLogo.jsx";
import { api } from "../lib/api.js";

// Owner 11-01: the site header with the /draft wordmark above the form (linking home; no app navigation — no account).
function SurveyHeader() {
  return (
    <header data-survey-header="" style={{ boxSizing: "border-box", width: "min(680px, calc(100% - 32px))", margin: "16px auto 0" }}>
      <a href="/" aria-label="draft — home" style={{ display: "inline-block" }}><StampLogo progress={0}/></a>
    </header>
  );
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
      <>
      <SurveyHeader/>
      <div style={surveyPage} data-survey-public="sent">
        <div style={{ ...surveyCard, textAlign: "center", padding: 22 }}>
          <h2 style={{ margin: "0 0 6px" }}>Thanks!</h2>
          <p style={{ margin: "0 0 14px", color: "var(--color-text-muted)" }}>Want to see it? Make an account and try draft.</p>
          <DepthButton primary onClick={() => navigate("/register")} data-survey-try="">Try draft</DepthButton>
        </div>
      </div>
      </>
    );
  }
  if (err) return <div style={surveyPage}><p role="alert">{err}</p></div>;
  if (!questions) return <div style={surveyPage} aria-busy="true"/>;
  return (
    <div data-survey-public="">
      <SurveyHeader/>
      <SurveyForm questions={questions} honeypot
        title="Help us build a better way to job hunt"
        intro="About two minutes. Your answers shape what we build. Nothing here is shared with employers."
        onSubmit={async (answers) => {
          await api("/api/survey", { method: "POST", body: JSON.stringify(answers) });
          setSent(true); window.scrollTo(0, 0);
        }}
        footer={<>We save your answers to improve draft and never share them with employers. <a href="/privacy" target="_blank" rel="noopener">Privacy</a></>}/>
    </div>
  );
}
