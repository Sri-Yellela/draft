// client/src/components/AuthScreen.jsx — /login and /signup.
// ⭐ D197 Wave 2 #17 · M5 (47m): SIGN IN / SIGN UP IN THE PLATE SYSTEM, built from the approved mock
// (/dev/plate?page=signin, docs/revamp/settings.md §6). Signed out, so Region IV (the public pages'). The intro keeps
// today's headline and lead; the market plate (the DrawingsPublic board's SignInMarketBehind) is the paper beside the form;
// the binder tabs Sign in ⇄ Create account (step 1 → step 2) hold the form. A138's ONE provider block keeps its order
// (Google first). EVERY HANDLER IS TODAY'S (login, the two-step register with A167's codes, the password reset by link +
// code, the OAuth notices, the leave warning on step 2, the admin link) — only the markup moved onto the plate.
// ⛔ No entrance animation: a sign-in page that makes someone wait for an animation is a worse sign-in page.
// Agent's pick (47m — owner may reverse): the mock's "Try it before you sign up" ticket OPENS the real check in place
// (SignupAtsHook, D141: "keep it" carries the scored résumé into the account made next) rather than leaving for /tools/ats,
// so nothing the page did is lost (D200 Rule 1). The deal behind the form (DealBackdrop) and the slash steps are retired:
// the mock draws the market plate and the step in words.
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api, setAuthContext } from "../lib/api.js";
import { useViewport } from "../hooks/useViewport.js";
import { Footer } from "./Footer.jsx";
import SignupAtsHook from "./SignupAtsHook.jsx";
import SignInProviders from "./SignInProviders.jsx";
import { returnToFromSearch } from "../lib/signInReturn.js";
import { usePhase1 } from "../lib/monetisation.jsx";
import OtpVerify from "./OtpVerify.jsx";
import PlateRoot from "../plate/PlateRoot.jsx";
import { Wordmark } from "../plate/Shell.jsx";
import { Kickers } from "../plate/Marks.jsx";
import { PageTitle, BinderTabs } from "../plate/Plates.jsx";
import { Ticket } from "../plate/Tickets.jsx";
import { LabelledField } from "../plate/Person.jsx";
import SignInMarketBehind from "../plate/drawings/SignInMarketBehind.jsx";

const PROVIDER_LOOK = { background: "var(--pl-card)", color: "var(--pl-ink)", height: 44, fontSize: "var(--pl-t-ui)", fontWeight: 700 };
const TRY_LINE = "Your résumé and one posting, read the way an applicant-tracking system reads them. Free, and nothing is kept.";

// ── The form (the binder tabs) ────────────────────────────────
function AuthForm({ onLogin, initialTab = "login", registerRequest = 0 }) {
  const [tab,     setTab]   = useState(initialTab);
  const [regStep, setRegStep] = useState(1);
  const [login,   setLoginF]  = useState({ username:"", password:"" });
  // Registration step 1 — only in React state, never sent until step 2 completes
  const [step1,   setStep1]   = useState({ username:"", password:"", confirmPassword:"" });
  const [step2,   setStep2]   = useState({ first_name:"", middle_name:"", last_name:"", name_suffix:"", email:"", phone:"" });
  // ⭐ D73 §B 2: product news by email — a separate, OPTIONAL box that starts UNTICKED; never tied to the terms.
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  // ⭐ A167 (d): while sign-up verification is on, the email AND the phone are each proven by a one-time code first.
  const { signupVerification } = usePhase1();
  const [proofs, setProofs] = useState({ email: null, sms: null });
  const [reset,   setReset]   = useState({ email:"", otp:"", password:"", confirmPassword:"", token:"" });
  const [resetSent, setResetSent] = useState(false);
  const [error,   setError]   = useState("");
  const [notice,  setNotice]  = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!registerRequest) return;
    setTab("register"); setRegStep(1); setError(""); setNotice("");
  }, [registerRequest]);

  const oauthLabel = provider =>
    provider === "linkedin" ? "LinkedIn" : provider === "github" ? "GitHub" : "Google";

  const setL  = (k,v) => setLoginF(f => ({ ...f, [k]:v }));
  const setS1 = (k,v) => setStep1(f => ({ ...f, [k]:v }));
  const setS2 = (k,v) => setStep2(f => ({ ...f, [k]:v }));
  const setR  = (k,v) => setReset(f => ({ ...f, [k]:v }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken");
    const oauthError = params.get("oauthError");
    const oauthStatus = params.get("oauthStatus");
    const oauthProvider = params.get("oauthProvider");
    if (oauthError) setError(oauthError);
    if (oauthStatus) setNotice(`${oauthLabel(oauthProvider)} ${oauthStatus.replace(/_/g, " ")}.`);
    if (!token) return;
    setReset(f => ({ ...f, token }));
    setTab("forgot");
    setResetSent(true);
  }, []);

  // Warn before tab close while on step 2 (data would be lost)
  useEffect(() => {
    if (tab !== "register" || regStep !== 2) return;
    const handler = e => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [tab, regStep]);

  const handleLogin = async e => {
    e.preventDefault(); setError(""); setNotice(""); setLoading(true);
    try {
      const d = await api("/api/auth/login", { method:"POST", body:JSON.stringify({ username:login.username.trim(), password:login.password }) });
      if (d.user) { setAuthContext(d.authContext); onLogin(d.user); }
      else setError(d.error || "Login failed");
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  // ⭐ A138: the ONE shared provider block (Google first), returning to the page /login was opened from.
  const providers = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label="Sign in with">
      <span className="pl-label pl-muted" style={{ textAlign: "center" }}>OR</span>
      <SignInProviders returnTo={returnToFromSearch(window.location.search) || "/app"} className="pl-btn" buttonStyle={PROVIDER_LOOK}/>
    </div>
  );

  const handleStep1 = e => {
    e.preventDefault(); setError(""); setNotice("");
    if (!step1.username.trim() || !step1.password) return setError("Username and password are required");
    if (step1.password.length < 8) return setError("Password must be at least 8 characters");
    if (step1.password !== step1.confirmPassword) return setError("Passwords do not match");
    setRegStep(2);
  };

  const handleRegister = async e => {
    e.preventDefault(); setError(""); setNotice("");
    if (signupVerification && (!proofs.email || !proofs.sms)) return setError(!proofs.email ? "Confirm your email with the code we send it." : "Confirm your phone with the code we text it.");
    setLoading(true);
    try {
      const d = await api("/api/auth/register", { method:"POST", body:JSON.stringify({
        username: step1.username.trim(),
        password: step1.password,
        profile: {
          first_name:  step2.first_name.trim(),
          middle_name: step2.middle_name.trim() || undefined,
          last_name:   step2.last_name.trim(),
          name_suffix: step2.name_suffix.trim() || undefined,
          email:       step2.email.trim(),
          phone:       step2.phone.trim() || undefined,
        },
        marketingOptIn: marketingOptIn === true,
        ...(signupVerification ? { emailProof: proofs.email, phoneProof: proofs.sms } : {}),
      }) });
      if (d.user) { setAuthContext(d.authContext); onLogin(d.user); }
      else setError(d.error || "Registration failed");
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const handlePasswordResetRequest = async e => {
    e.preventDefault(); setError(""); setNotice(""); setLoading(true);
    try {
      const d = await api("/api/auth/password-reset/request", {
        method:"POST",
        body:JSON.stringify({ email:reset.email }),
      });
      setResetSent(true);
      if (d.message) setNotice(d.message);
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const handlePasswordResetConfirm = async e => {
    e.preventDefault(); setError(""); setNotice("");
    if (!reset.token) return setError("Open the reset link from your email first.");
    if (!reset.otp.trim()) return setError("OTP is required");
    if (reset.password.length < 8) return setError("Password must be at least 8 characters");
    if (reset.password !== reset.confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    try {
      await api("/api/auth/password-reset/confirm", {
        method:"POST",
        body:JSON.stringify({ token:reset.token, otp:reset.otp.trim(), password:reset.password }),
      });
      setTab("login");
      setReset({ email:"", otp:"", password:"", confirmPassword:"", token:"" });
      setResetSent(false);
      setLoginF(f => ({ ...f, password:"" }));
      setNotice("Password reset. Sign in with your new password.");
      window.history.replaceState({}, "", window.location.pathname);
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const said = (
    <>
      {error ? <p className="pl-field__error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
      {notice ? <p className="pl-notice__text" role="status" style={{ margin: 0 }}>{notice}</p> : null}
    </>
  );

  const loginForm = (
    <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
      <LabelledField label="Username or email" value={login.username} onChange={v => setL("username", v)} autoComplete="username"/>
      <LabelledField label="Password" type="password" value={login.password} onChange={v => setL("password", v)} autoComplete="current-password"/>
      {said}
      <button type="submit" className="pl-btn pl-btn--primary" disabled={loading}>{loading ? "Signing in…" : "Sign in →"}</button>
      <button type="button" className="pl-btn pl-btn--flat" onClick={() => { setTab("forgot"); setError(""); setNotice(""); }}>Forgot password?</button>
      {providers}
      <Link className="pl-label pl-muted" to="/admin/login" style={{ textAlign: "center", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>Admin? Sign in here →</Link>
    </form>
  );

  const forgotForm = (
    <form onSubmit={reset.token ? handlePasswordResetConfirm : handlePasswordResetRequest} style={{ display: "grid", gap: 12 }}>
      <span className="pl-label pl-muted">PASSWORD RESET</span>
      {!resetSent && !reset.token ? <LabelledField label="Email" type="email" value={reset.email} onChange={v => setR("email", v)} autoComplete="email"/> : null}
      {resetSent && !reset.token ? <p className="pl-body" style={{ margin: 0 }}>Check your email for the reset link and OTP. This page will finish the reset after you open the link.</p> : null}
      {reset.token ? (
        <>
          <p className="pl-body" style={{ margin: 0 }}>Enter the OTP from your email and choose a new password.</p>
          <LabelledField label="Email OTP" value={reset.otp} onChange={v => setR("otp", v)} autoComplete="one-time-code"/>
          <LabelledField label="New password (min 8 characters)" type="password" value={reset.password} onChange={v => setR("password", v)} autoComplete="new-password"/>
          <LabelledField label="Confirm new password" type="password" value={reset.confirmPassword} onChange={v => setR("confirmPassword", v)} autoComplete="new-password"/>
        </>
      ) : null}
      {said}
      {(!resetSent || reset.token)
        ? <button type="submit" className="pl-btn pl-btn--primary" disabled={loading}>{loading ? "Working…" : (reset.token ? "Reset the password" : "Send the reset email")}</button>
        : null}
      <button type="button" className="pl-btn pl-btn--flat" onClick={() => { setTab("login"); setError(""); setNotice(""); }}>Back to sign in</button>
    </form>
  );

  const registerForm = regStep === 1 ? (
    <form onSubmit={handleStep1} style={{ display: "grid", gap: 12 }}>
      <span className="pl-label pl-muted">STEP 1 OF 2 · NOTHING IS SENT UNTIL STEP 2</span>
      <LabelledField label="Username" value={step1.username} onChange={v => setS1("username", v)} autoComplete="username" required/>
      <LabelledField label="Password (min 8 characters)" type="password" value={step1.password} onChange={v => setS1("password", v)} autoComplete="new-password" required/>
      <LabelledField label="Confirm password" type="password" value={step1.confirmPassword} onChange={v => setS1("confirmPassword", v)} autoComplete="new-password" required/>
      {said}
      <button type="submit" className="pl-btn pl-btn--primary">Continue →</button>
      {providers}
    </form>
  ) : (
    <form onSubmit={handleRegister} style={{ display: "grid", gap: 12 }}>
      <span className="pl-label pl-muted">STEP 2 OF 2 · YOUR ACCOUNT IS MADE HERE</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}><LabelledField label="First name" value={step2.first_name} onChange={v => setS2("first_name", v)} autoComplete="given-name" required/></div>
        <div style={{ flex: "0 0 84px", minWidth: 0 }}><LabelledField label="M.I." value={step2.middle_name} onChange={v => setS2("middle_name", v)} autoComplete="additional-name"/></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}><LabelledField label="Last name" value={step2.last_name} onChange={v => setS2("last_name", v)} autoComplete="family-name" required/></div>
        <div style={{ flex: "0 0 84px", minWidth: 0 }}><LabelledField label="Jr./Sr." value={step2.name_suffix} onChange={v => setS2("name_suffix", v)} autoComplete="honorific-suffix"/></div>
      </div>
      <LabelledField label="Email" type="email" value={step2.email} required autoComplete="email"
        note={signupVerification ? "We email a one-time code while sign-up checks are on." : undefined}
        onChange={v => { setS2("email", v); setProofs(p => ({ ...p, email: null })); }}/>
      {signupVerification && <OtpVerify channel="email" target={step2.email} proven={!!proofs.email} onProof={(p) => setProofs(x => ({ ...x, email: p }))} />}
      <LabelledField label={signupVerification ? "Phone" : "Phone (optional)"} type="tel" value={step2.phone} required={!!signupVerification} autoComplete="tel"
        onChange={v => { setS2("phone", v); setProofs(p => ({ ...p, sms: null })); }}/>
      {signupVerification && <OtpVerify channel="sms" target={step2.phone} proven={!!proofs.sms} onProof={(p) => setProofs(x => ({ ...x, sms: p }))} />}
      <label data-marketing-opt-in="" className="pl-body" style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "var(--pl-t-small)", cursor: "pointer" }}>
        <input type="checkbox" className="pl-check" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)}/>
        <span>Email me product news (optional). Account emails, like a password reset, come either way. You can switch this off at any time.</span>
      </label>
      {said}
      <div className="pl-actions">
        <button type="button" className="pl-btn" onClick={() => { setRegStep(1); setError(""); }}>← Back</button>
        <button type="submit" className="pl-btn pl-btn--primary" disabled={loading}>{loading ? "Creating the account…" : "Create account →"}</button>
      </div>
    </form>
  );

  // The forgot form sits under the Sign in tab (the mock's two tabs; the reset is a step of signing in).
  const selected = tab === "register" ? "register" : "login";
  return (
    <section data-auth-form="" className="pl-card" aria-label="Sign in or create an account" style={{ padding: 0 }}>
      <div style={{ padding: "16px 16px 0" }}>
        <BinderTabs label="Sign in or create an account" idBase="auth" selected={selected}
          onSelect={(t) => { setTab(t); setRegStep(1); setError(""); setNotice(""); }}
          tabs={[{ id: "login", label: "Sign in" }, { id: "register", label: "Create account" }]}>
          <div style={{ padding: "16px 0" }}>{tab === "register" ? registerForm : tab === "forgot" ? forgotForm : loginForm}</div>
        </BinderTabs>
      </div>
    </section>
  );
}

export default function AuthScreen({ onLogin, initialTab = "login" }) {
  const { w } = useViewport();
  const wide = w >= 980;
  const [registerRequest, setRegisterRequest] = useState(0);
  const [trying, setTrying] = useState(false);
  const formRef = useRef(null);

  const keep = () => {
    setRegisterRequest(n => n + 1);
    formRef.current?.scrollIntoView({ block: "center" });
  };
  const tryFirst = trying
    ? <div data-signup-try=""><SignupAtsHook onKeep={keep}/></div>
    : <Ticket kicker="TRY IT FIRST · NO ACCOUNT" title="Try it before you sign up" line={TRY_LINE} go="Check the fit →"
        href="#try-it-first" onClick={(e) => { e.preventDefault(); setTrying(true); }}/>;

  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }} data-page="signin">
      <div className="pl-page" style={{ paddingTop: 20 }}><Link to="/" aria-label="draft, the home page" style={{ textDecoration: "none" }}><Wordmark/></Link></div>
      <main className="pl-page" style={{ flex: "1 1 auto", display: "grid", gap: wide ? 48 : 24, alignItems: "start", paddingTop: wide ? 40 : 20, paddingBottom: 56,
        gridTemplateColumns: wide ? "minmax(0, 1fr) 420px" : "minmax(0, 1fr)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Kickers parts={["DRAFT", "SIGN IN OR START"]}/>
          <PageTitle>Ten jobs a day, picked for you</PageTitle>
          <p className="pl-lead">Not a search box. Every job on the board is read against your résumé, and the best ten are dealt to you each morning.</p>
          {wide ? <div className="pl-card" style={{ padding: 0, overflow: "hidden" }}><SignInMarketBehind/></div> : null}
          {wide ? tryFirst : null}
        </div>
        <div ref={formRef} style={{ minWidth: 0 }}>
          <AuthForm onLogin={onLogin} initialTab={initialTab} registerRequest={registerRequest}/>
        </div>
        {wide ? null : tryFirst}
      </main>
      <Footer/>
    </PlateRoot>
  );
}
