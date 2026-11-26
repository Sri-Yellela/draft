// ⭐ D197 Wave 2 · M3 (47j, lane w2-person) · #17 SIGN IN / SIGN UP — the mock (docs/revamp/settings.md §6).
// Plate library + --pl-* tokens; signed out, so Region IV (the public pages'). A138's ONE provider block keeps its order
// (Google first). The intro keeps today's headline and lead; the deal backdrop becomes a drawing to come (the market plate,
// faint, behind the form). The operable model: the binder tabs Sign in ⇄ Create account (step 1 → step 2).
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { Wordmark } from "../../../plate/Shell.jsx";
import { Kickers } from "../../../plate/Marks.jsx";
import { PageTitle, BinderTabs } from "../../../plate/Plates.jsx";
import { Ticket } from "../../../plate/Tickets.jsx";
import { LabelledField } from "../../../plate/Person.jsx";
import { DrawingToCome } from "../../../plate/Drawings.jsx";

/** A field that keeps what is typed (the mock has no server). */
function SignInMockField(props) {
  const [v, setV] = useState("");
  return <LabelledField {...props} value={v} onChange={setV}/>;
}

const PROVIDERS = [["google", "Continue with Google"], ["linkedin", "Continue with LinkedIn"], ["github", "Continue with GitHub"]];

export default function SignInMock({ width = 1280 }) {
  const wide = width >= 980;
  const [tab, setTab] = useState("login");
  const [step, setStep] = useState(1);
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [forgot, setForgot] = useState(false);
  const [news, setNews] = useState(false);
  const submit = (e) => { e.preventDefault(); setErr(pw.length < 8 ? "Password must be at least 8 characters." : ""); };
  const providers = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label="Sign in with">
      <span className="pl-label pl-muted" style={{ textAlign: "center" }}>OR</span>
      {PROVIDERS.map(([p, w]) => <a key={p} className="pl-btn" href={`#oauth-${p}`} data-sign-in-provider={p}>{w}</a>)}
    </div>
  );
  const login = forgot ? (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gap: 12 }}>
      <SignInMockField label="Email" type="email" autoComplete="email"/>
      <button type="submit" className="pl-btn pl-btn--primary">Send the code</button>
      <button type="button" className="pl-btn pl-btn--flat" onClick={() => setForgot(false)}>Back to sign in</button>
    </form>
  ) : (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <LabelledField label="Username or email" value={user} onChange={setUser} autoComplete="username"/>
      <LabelledField label="Password" type="password" value={pw} onChange={setPw} error={err} autoComplete="current-password"/>
      <button type="submit" className="pl-btn pl-btn--primary">Sign in →</button>
      <button type="button" className="pl-btn pl-btn--flat" onClick={() => setForgot(true)}>Forgot password?</button>
      {providers}
      <a className="pl-label pl-muted" href="#admin" style={{ textAlign: "center", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>Admin? Sign in here →</a>
    </form>
  );
  const register = step === 1 ? (
    <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} style={{ display: "grid", gap: 12 }}>
      <span className="pl-label pl-muted">STEP 1 OF 2 · NOTHING IS SENT UNTIL STEP 2</span>
      <SignInMockField label="Username" autoComplete="username" required/>
      <SignInMockField label="Password (min 8 characters)" type="password" autoComplete="new-password" required/>
      <SignInMockField label="Confirm password" type="password" autoComplete="new-password" required/>
      <button type="submit" className="pl-btn pl-btn--primary">Continue →</button>
      {providers}
    </form>
  ) : (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gap: 12 }}>
      <span className="pl-label pl-muted">STEP 2 OF 2 · YOUR ACCOUNT IS MADE HERE</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}><SignInMockField label="First name" required/></div>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}><SignInMockField label="Last name" required/></div>
      </div>
      <SignInMockField label="Email" type="email" required note="We email a one-time code while sign-up checks are on."/>
      <SignInMockField label="Phone (optional)" type="tel"/>
      <label className="pl-body" style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "var(--pl-t-small)" }}>
        <input type="checkbox" className="pl-check" checked={news} onChange={(e) => setNews(e.target.checked)}/>
        <span>Email me product news (optional). Account emails, like a password reset, come either way. You can switch this off at any time.</span>
      </label>
      <div className="pl-actions"><button type="button" className="pl-btn" onClick={() => setStep(1)}>← Back</button><button type="submit" className="pl-btn pl-btn--primary">Create account →</button></div>
    </form>
  );

  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh", paddingBottom: 72 }} data-mock="signin">
      <div className="pl-page" style={{ paddingTop: 20 }}><Wordmark/></div>
      <main className="pl-page" style={{ display: "grid", gap: wide ? 48 : 24, alignItems: "start", paddingTop: wide ? 40 : 20,
        gridTemplateColumns: wide ? "minmax(0, 1fr) 420px" : "minmax(0, 1fr)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Kickers parts={["DRAFT", "SIGN IN OR START"]}/>
          <PageTitle>Ten jobs a day, picked for you</PageTitle>
          <p className="pl-lead">Not a search box. Every job on the board is read against your résumé, and the best ten are dealt to you each morning.</p>
          {wide ? <DrawingToCome aspect="640 / 360" what="the market plate, faint, as the paper behind the form"/> : null}
          {wide ? <Ticket kicker="TRY IT FIRST · NO ACCOUNT" title="Try it before you sign up" line="Your résumé and one posting, read the way an applicant-tracking system reads them. Free, and nothing is kept." go="Check the fit →" href="#ats"/> : null}
        </div>
        <section className="pl-card" aria-label="Sign in or create an account" style={{ padding: 0 }}>
          <div style={{ padding: "16px 16px 0" }}>
            <BinderTabs label="Sign in or create an account" idBase="auth" selected={tab} onSelect={(t) => { setTab(t); setStep(1); setForgot(false); }}
              tabs={[{ id: "login", label: "Sign in" }, { id: "register", label: "Create account" }]}>
              <div style={{ padding: "16px 0" }}>{tab === "login" ? login : register}</div>
            </BinderTabs>
          </div>
        </section>
        {wide ? null : <Ticket kicker="TRY IT FIRST · NO ACCOUNT" title="Try it before you sign up" line="Your résumé and one posting, read the way an applicant-tracking system reads them. Free, and nothing is kept." go="Check the fit →" href="#ats"/>}
      </main>
    </PlateRoot>
  );
}
