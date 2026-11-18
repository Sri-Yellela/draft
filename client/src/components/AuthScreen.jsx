// client/src/components/AuthScreen.jsx — Design System v4
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { api, setAuthContext } from "../lib/api.js";
import { StampLogo } from "./StampLogo.jsx";
import { useTheme } from "../styles/theme.jsx";
import { useViewport } from "../hooks/useViewport.js";
import { Footer } from "./Footer.jsx";
import { C } from "../styles/colorTokens.js";
import { Z } from "../styles/zLayers.js";
import DealBackdrop from "./DealBackdrop.jsx";
import SignupAtsHook from "./SignupAtsHook.jsx";
import SignInProviders from "./SignInProviders.jsx";
import { returnToFromSearch } from "../lib/signInReturn.js";
import { usePhase1 } from "../lib/monetisation.jsx";
import OtpVerify from "./OtpVerify.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// 46v: AtomEmblem (the spinning "APPLY • TRACK • LAND" ring) is gone — nothing imported it any more; the plan retired the ring.

// ── The slash as the signup's progress (queue 30) ─────────────
// Brand as instrumentation: the mark's own "/" fills as the steps advance — a third at step 1, two
// thirds at step 2 (the account is created on step 2's submit, which is the last third).
function SlashSteps({ step, of }) {
  const p = step / (of + 1);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:2 }}
      role="img" aria-label={`Step ${step} of ${of}`}>
      <svg width="22" height="22" viewBox="0 0 30 30" aria-hidden="true">
        <line x1="8" y1="26" x2="22" y2="4" stroke={C.BORDER_STRONG} strokeWidth="5" strokeLinecap="round"/>
        <line x1="8" y1="26" x2={8 + 14 * p} y2={26 - 22 * p} stroke={C.ACCENT_INK} strokeWidth="5" strokeLinecap="round"
          style={{ transition:"all 320ms cubic-bezier(.2,.8,.2,1)" }}/>
      </svg>
      <span style={{ fontSize:ts(11), color:C.INK_FAINT, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>
        Step {step} of {of}
      </span>
    </div>
  );
}

// ── Auth modal ────────────────────────────────────────────────
function AuthModal({ onLogin, initialTab = "login", registerRequest = 0 }) {
  const { theme } = useTheme();
  const [tab,     setTab]   = useState(initialTab);
  const [regStep, setRegStep] = useState(1);
  // Login form
  const [login,   setLoginF]  = useState({ username:"", password:"" });
  // Registration step 1 — only in React state, never sent until step 2 completes
  const [step1,   setStep1]   = useState({ username:"", password:"", confirmPassword:"" });
  // Registration step 2
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
  const providers = () => (
    <SignInProviders returnTo={returnToFromSearch(window.location.search) || "/app"}
      buttonStyle={{ height:providerButtonStyle.height, fontSize:providerButtonStyle.fontSize, fontWeight:providerButtonStyle.fontWeight }}/>
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

  const inputStyle = {
    width:"100%", height:42, padding:"0 14px",
    borderRadius:10, border:"1px solid var(--border-glass)",
    background:"var(--bg-input)", color:theme.text,
    fontFamily:"'DM Sans',system-ui", fontSize:ts(13),
    outline:"none", boxSizing:"border-box",
    transition:"border-color 0.15s",
  };
  const halfInput = { ...inputStyle, flex:1 };
  const providerButtonStyle = {
    width:"100%", height:40, border:"1px solid var(--border-glass)",
    background:"var(--bg-input)", color:theme.text, fontWeight:800, cursor:"pointer",
    fontSize:ts(13), display:"flex", alignItems:"center", justifyContent:"center", gap:8,
  };

  return (
    // ⛔ No entrance animation: it was a 200 ms fade-and-scale, and a sign-in page that makes someone
    // wait for an animation is a worse sign-in page. The form is usable on the first paint.
    <div data-auth-form className="liquid-panel"
      style={{ borderRadius:24, padding:36, width:"100%", maxWidth:400, boxSizing:"border-box",
               position:"relative", zIndex:Z.CONTENT, background:C.SURFACE_MENU }}>

      {/* Tab switcher */}
      <div style={{ display:"flex", gap:4, marginBottom:28,
                    background:"var(--c-surface)",
                    borderRadius:10, padding:4 }}>
        {["login","register"].map(t => (
          <button className="dbx-depth" key={t} onClick={() => { setTab(t); setRegStep(1); setError(""); setNotice(""); }}
            style={{ flex:1, padding:"7px 0", border:"none",
                     fontWeight:700, fontSize:ts(12), cursor:"pointer",
                     background: tab===t ? theme.accent : "transparent",
                     color: tab===t ? "var(--c-on-accent)" : theme.textMuted,
                     transition:"all 0.2s" }}>
            {t === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      {tab === "login" ? (
        <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input style={inputStyle} placeholder="Username or email" value={login.username}
            onChange={e=>setL("username",e.target.value)} autoFocus/>
          <input style={inputStyle} placeholder="Password" type="password" value={login.password}
            onChange={e=>setL("password",e.target.value)}/>
          {error && <div style={{ color:theme.danger, fontSize:ts(12) }}>{error}</div>}
          {notice && <div style={{ color:theme.success, fontSize:ts(12) }}>{notice}</div>}
          <button className="dbx-depth" type="submit" disabled={loading}
            style={{ width:"100%", padding:"12px 0", border:"none",
                     background:theme.gradAccent, color:"var(--c-on-accent)", fontWeight:800,
                     fontSize:ts(14), cursor:"pointer", marginTop:4,
                     opacity:loading?0.7:1, transition:"opacity 0.2s" }}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
          <button type="button"
            onClick={() => { setTab("forgot"); setError(""); setNotice(""); }}
            style={{ background:"none", border:"none", color:theme.accentText,
                     fontSize:ts(12), fontWeight:700, cursor:"pointer", padding:4 }}>
            Forgot password?
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8, color:theme.textDim, fontSize:ts(11) }}>
            <span style={{ flex:1, height:1, background:theme.border }}/><span>or</span><span style={{ flex:1, height:1, background:theme.border }}/>
          </div>
          {providers()}
        </form>

      ) : tab === "forgot" ? (
        <form onSubmit={reset.token ? handlePasswordResetConfirm : handlePasswordResetRequest}
          style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontSize:ts(11), color:theme.textDim, fontWeight:600,
                        textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>
            Password reset
          </div>
          {!resetSent && !reset.token && (
            <input style={inputStyle} placeholder="Email" type="email" value={reset.email}
              onChange={e=>setR("email",e.target.value)} autoFocus/>
          )}
          {resetSent && !reset.token && (
            <div style={{ fontSize:ts(11), color:theme.textMuted, lineHeight:1.6,
                          padding:"10px 12px", background:theme.surfaceHigh,
                          borderRadius:10, border:`1px solid ${theme.border}` }}>
              Check your email for the reset link and OTP. This page will finish the reset after you open the link.
            </div>
          )}
          {reset.token && (
            <>
              <div style={{ fontSize:ts(11), color:theme.textMuted, lineHeight:1.6,
                            padding:"10px 12px", background:theme.surfaceHigh,
                            borderRadius:10, border:`1px solid ${theme.border}` }}>
                Enter the OTP from your email and choose a new password.
              </div>
              <input style={inputStyle} placeholder="Email OTP" value={reset.otp}
                onChange={e=>setR("otp",e.target.value)}/>
              <input style={inputStyle} placeholder="New password (min 8 chars)" type="password" value={reset.password}
                onChange={e=>setR("password",e.target.value)}/>
              <input style={inputStyle} placeholder="Confirm new password" type="password" value={reset.confirmPassword}
                onChange={e=>setR("confirmPassword",e.target.value)}/>
            </>
          )}
          {error && <div style={{ color:theme.danger, fontSize:ts(12) }}>{error}</div>}
          {notice && <div style={{ color:theme.success, fontSize:ts(12) }}>{notice}</div>}
          {(!resetSent || reset.token) && (
            <button className="dbx-depth" type="submit" disabled={loading}
              style={{ width:"100%", padding:"12px 0", border:"none",
                       background:theme.gradAccent, color:"var(--c-on-accent)", fontWeight:800,
                       fontSize:ts(14), cursor:"pointer", marginTop:4,
                       opacity:loading?0.7:1, transition:"opacity 0.2s" }}>
              {loading ? "Working..." : (reset.token ? "Reset Password" : "Send Reset Email")}
            </button>
          )}
          <button type="button"
            onClick={() => { setTab("login"); setError(""); setNotice(""); }}
            style={{ background:"none", border:"none", color:theme.textMuted,
                     fontSize:ts(12), fontWeight:700, cursor:"pointer", padding:4 }}>
            Back to sign in
          </button>
        </form>

      ) : regStep === 1 ? (
        /* ── Register step 1: credentials ── */
        <form onSubmit={handleStep1} style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <SlashSteps step={1} of={2}/>
          <input style={inputStyle} placeholder="Username" value={step1.username}
            onChange={e=>setS1("username",e.target.value)} autoFocus/>
          <input style={inputStyle} placeholder="Password (min 8 chars)" type="password" value={step1.password}
            onChange={e=>setS1("password",e.target.value)}/>
          <input style={inputStyle} placeholder="Confirm password" type="password" value={step1.confirmPassword}
            onChange={e=>setS1("confirmPassword",e.target.value)}/>
          {error && <div style={{ color:theme.danger, fontSize:ts(12) }}>{error}</div>}
          <button className="dbx-depth" type="submit"
            style={{ width:"100%", padding:"12px 0", border:"none",
                     background:theme.gradAccent, color:"var(--c-on-accent)", fontWeight:800,
                     fontSize:ts(14), cursor:"pointer", marginTop:4 }}>
            Continue →
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8, color:theme.textDim, fontSize:ts(11) }}>
            <span style={{ flex:1, height:1, background:theme.border }}/><span>or</span><span style={{ flex:1, height:1, background:theme.border }}/>
          </div>
          {providers()}
        </form>

      ) : (
        /* ── Register step 2: name + contact ── */
        <form onSubmit={handleRegister} style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <SlashSteps step={2} of={2}/>
          <div style={{ display:"flex", gap:8 }}>
            <input style={halfInput} placeholder="First name *" value={step2.first_name}
              onChange={e=>setS2("first_name",e.target.value)} autoFocus/>
            <input style={{ ...inputStyle, width:72, flex:"none" }} placeholder="M.I."
              value={step2.middle_name} onChange={e=>setS2("middle_name",e.target.value)}/>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input style={halfInput} placeholder="Last name *" value={step2.last_name}
              onChange={e=>setS2("last_name",e.target.value)}/>
            <input style={{ ...inputStyle, width:72, flex:"none" }} placeholder="Jr./Sr."
              value={step2.name_suffix} onChange={e=>setS2("name_suffix",e.target.value)}/>
          </div>
          <input style={inputStyle} placeholder="Email *" type="email" value={step2.email}
            onChange={e=>{ setS2("email",e.target.value); setProofs(p => ({ ...p, email: null })); }}/>
          {signupVerification && <OtpVerify channel="email" target={step2.email} proven={!!proofs.email} onProof={(p) => setProofs(x => ({ ...x, email: p }))} />}
          <input style={inputStyle} placeholder={signupVerification ? "Phone *" : "Phone (optional)"} type="tel" value={step2.phone}
            onChange={e=>{ setS2("phone",e.target.value); setProofs(p => ({ ...p, sms: null })); }}/>
          {signupVerification && <OtpVerify channel="sms" target={step2.phone} proven={!!proofs.sms} onProof={(p) => setProofs(x => ({ ...x, sms: p }))} />}
          <label data-marketing-opt-in="" style={{ display:"flex", gap:8, alignItems:"flex-start", fontSize:ts(12), color:theme.textMuted, lineHeight:1.5, cursor:"pointer" }}>
            <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)} style={{ marginTop:2 }}/>
            <span>Email me product news (optional). Account emails, like a password reset, come either way. You can switch this off at any time.</span>
          </label>
          {error && <div style={{ color:theme.danger, fontSize:ts(12) }}>{error}</div>}
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button className="dbx-depth" type="button" onClick={() => { setRegStep(1); setError(""); }}
              style={{ padding:"12px 20px", border:`1px solid ${theme.border}`,
                       background:"transparent", color:theme.textMuted, fontWeight:700,
                       fontSize:ts(13), cursor:"pointer" }}>
              ← Back
            </button>
            <button className="dbx-depth" type="submit" disabled={loading}
              style={{ flex:1, padding:"12px 0", border:"none",
                       background:theme.gradAccent, color:"var(--c-on-accent)", fontWeight:800,
                       fontSize:ts(14), cursor:"pointer",
                       opacity:loading?0.7:1, transition:"opacity 0.2s" }}>
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </div>
        </form>
      )}

      {/* Admin link — only visible on login tab */}
      {tab === "login" && (
        <div style={{ textAlign:"center", marginTop:20 }}>
          <Link to="/admin/login"
            style={{ fontSize:ts(12), color:theme.textDim, textDecoration:"none",
                     transition:"color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.color = theme.textMuted}
            onMouseLeave={e => e.currentTarget.style.color = theme.textDim}>
            Admin? Sign in here →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Main AuthScreen (queue 30: "it is the first impression and it is currently a form") ───────
//
// docs/BRAND_OUTLAY_AND_MOTION.md §Login and signup. Motion that is the product's own, and ⛔ NONE OF
// IT MAY DELAY THE FORM — it is behind, around and after, never in front:
//   · the deal behind the form (DealBackdrop): the deck's own card backs, dealt slowly
//   · type that sets ONCE, on the first paint of the page session — one gesture, then stillness
//   · paper that shifts, almost imperceptibly, with the pointer — a suggestion the surface is physical
//   · the "/" as the signup's progress (SlashSteps)
//   · a real ATS check as the signup hook (SignupAtsHook): value first, account second
// ⛔ prefers-reduced-motion stops every one of them; the page is then simply still.

const HEADLINE = "Ten jobs a day, picked for you.";
let headlineSet = false;   // module-level: the type sets once per page session, not per route change

function SetOnceHeading({ size }) {
  const [animate] = useState(() => { const first = !headlineSet; headlineSet = true; return first; });
  // 46q (A225): the animation's <style> sits BESIDE the heading, not inside it (it was the heading's text content).
  return (<>
      <style>{`
        @keyframes draft-type-set { from { opacity:0; transform:translate3d(0, 0.18em, 0); } }
        [data-set-once="playing"] span[data-ch] { display:inline-block; animation:draft-type-set 420ms cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { [data-set-once="playing"] span[data-ch] { animation:none; } }
      `}</style>
    <h1 aria-label={HEADLINE} data-set-once={animate ? "playing" : "set"}
      style={{ fontFamily:"var(--font-display)", fontWeight:400, fontSize:size, lineHeight:1.02, letterSpacing:"-0.01em",
               color:C.INK, margin:0, maxWidth:560 }}>
      {animate
        ? HEADLINE.split(" ").flatMap((word, wi, words) => {
            // Words never break inside: letters are inline-blocks, and a line may break between any two.
            const before = words.slice(0, wi).join(" ").length + (wi ? 1 : 0);
            const el = (
              <span key={wi} aria-hidden="true" style={{ whiteSpace:"nowrap" }}>
                {[...word].map((ch, ci) => <span key={ci} data-ch style={{ animationDelay:`${(before + ci) * 16}ms` }}>{ch}</span>)}
              </span>
            );
            return wi < words.length - 1 ? [el, " "] : [el];
          })
        : HEADLINE}
    </h1>
  </>);
}

// Paper that reacts: the substrate drifts a few pixels against the pointer. Fine pointers only (a
// finger has no hover position), never under reduced motion, and the substrate is put back on leave.
function usePaperDrift(reduced) {
  useEffect(() => {
    if (reduced || typeof window === "undefined" || !window.matchMedia?.("(pointer: fine)")?.matches) return;
    const el = document.querySelector('[data-substrate="paper"]');
    if (!el) return;
    const prev = { transform: el.style.transform, transition: el.style.transition };
    el.style.transition = "transform 900ms cubic-bezier(.2,.8,.2,1)";
    let raf = 0;
    const onMove = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const dx = (e.clientX / window.innerWidth - 0.5) * -8;
        const dy = (e.clientY / window.innerHeight - 0.5) * -8;
        // scale(1.02) so the drift never uncovers an edge of the fixed layer
        el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(1.02)`;
      });
    };
    window.addEventListener("pointermove", onMove, { passive:true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      el.style.transform = prev.transform;
      el.style.transition = prev.transition;
    };
  }, [reduced]);
}

export default function AuthScreen({ onLogin, initialTab = "login" }) {
  const { w } = useViewport();
  const reduced = useReducedMotion();
  const wide = w >= 980;
  const [registerRequest, setRegisterRequest] = useState(0);
  const formRef = useRef(null);
  usePaperDrift(reduced);

  const keep = () => {
    setRegisterRequest(n => n + 1);
    formRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block:"center" });
  };

  const intro = (
    <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:560 }}>
      <StampLogo size={wide ? "lg" : "md"} />
      <SetOnceHeading size={wide ? "clamp(48px, 5.4vw, 76px)" : "clamp(38px, 10vw, 52px)"} />
      <p style={{ fontSize: ts(wide ? 17 : 15), color:C.INK_MUTED, lineHeight:1.55, margin:0, maxWidth:470 }}>
        Not a search box. Every job on the board is read against your résumé, and the best ten are
        dealt to you each morning.
      </p>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", position:"relative", isolation:"isolate",
                  fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <DealBackdrop compact={!wide} />
      <main style={{ flex:"1 1 auto", position:"relative", zIndex:Z.CONTENT, width:"100%", margin:0, /* 46q FULL WIDTH */
                     boxSizing:"border-box", padding: wide ? "64px var(--page-gutter) 56px" : "28px 16px 40px",
                     display:"grid", gap: wide ? 48 : 24, alignItems:"start",
                     gridTemplateColumns: wide ? "minmax(0, 1fr) 400px" : "minmax(0, 1fr)" }}>
        {/* Narrow: the form comes straight after the headline — the hook follows it, never in front. */}
        <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
          {intro}
          {wide && <SignupAtsHook onKeep={keep} />}
        </div>
        <div ref={formRef} style={{ display:"flex", justifyContent:"center" }}>
          <AuthModal onLogin={onLogin} initialTab={initialTab} registerRequest={registerRequest}/>
        </div>
        {!wide && <SignupAtsHook onKeep={keep} />}
      </main>
      <div style={{ position:"relative", zIndex:Z.CONTENT }}><Footer/></div>
    </div>
  );
}
