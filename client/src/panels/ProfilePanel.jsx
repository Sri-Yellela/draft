// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
// client/src/panels/ProfilePanel.jsx — Design System v4
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api }      from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import DomainProfileWizard from "../components/DomainProfileWizard.jsx";
import {
  emitProfileSuggestionsUpdated,
  PROFILE_SUGGESTIONS_UPDATED_EVENT,
} from "../lib/profileSuggestions.js";
import { prefillFromResumeText, prefillDiff } from "../../../shared/resumePrefill.js";
import ProfileSections from "../components/ProfileSections.jsx";
import RefineJobProfile from "../components/RefineJobProfile.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// D55 (f) / D101: the EEO answers ("Not set" vs "Choose not to disclose") live in Application defaults —
// components/ProfileSections.jsx.

// A33: the labels the prefill review shows. Only PREFILL_FIELDS can appear — eligibility and EEO
// answers are attestations and are never proposed (shared/resumePrefill.js NEVER_PREFILL).
const PREFILL_LABELS = {
  full_name: "Full name", email: "Email", phone: "Phone", linkedin_url: "LinkedIn", github_url: "GitHub",
  website_url: "Website", city: "City", state: "State",
};
// D112 d2: education is the Education SECTION's (its own "Your résumé says X — use it?"), not this review's.
const EDUCATION_PREFILL = new Set(["highest_degree", "field_of_study", "university", "graduation_year"]);

// ── Field normalisers ─────────────────────────────────────────
function normalisePhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return raw;
  return `+1 (${local.slice(0,3)}) ${local.slice(3,6)}-${local.slice(6)}`;
}
function normaliseUrl(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return "https://" + trimmed;
}
function normaliseZip(raw) {
  if (!raw) return "";
  return raw.replace(/[^\dA-Z\s-]/gi, "").trim().slice(0, 7);
}
function normaliseState(raw) {
  if (!raw) return "";
  return raw.trim().toUpperCase().slice(0, 2);
}

/** Whatever the API hands back — object, JSON string, junk — as a plain object. */
function parseMap(v) {
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  try {
    const p = JSON.parse(v || "{}");
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch { return {}; }
}

// ── Custom answers: the `{company}` template rules ────────────────────────────
// Kept in step with services/customAnswers.js. The server is the authority — it decides what is
// actually submitted — but the editor has to SHOW the same verdict, or the candidate cannot tell
// which of their answers will be used and which are only drafts.
const COMPANY_TOKEN = "{company}";
const COMPANY_TOKEN_TEST = /\{\s*company\s*\}/i;
const MOTIVATION_PATTERNS = [
  /\bwhy\b[^?]*\b(join|work|apply|applying|interested|interest|want|choose|chose)\b/i,
  /\bwhat\b[^?]*\b(interests?|excites?|draws?|attracts?|appeals?)\b/i,
  /\bmotivat/i,
  /\bwhy (are|do|did) you\b/i,
  /\bexcites? you\b/i,
  /\btell us why\b/i,
];
const isTemplateQ  = (t) => COMPANY_TOKEN_TEST.test(String(t ?? ""));
const isMotivationQ = (t) => MOTIVATION_PATTERNS.some(re => re.test(String(t ?? "")));
const companyKeyOf = (c) => String(c ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const expandCompanyText = (t, c) => String(t ?? "").replace(/\{\s*company\s*\}/gi, String(c ?? ""));

/** The five questions the Figma posting asked. Wordings only — the answers are the candidate's. */
const SEED_QUESTIONS = [
  "Why do you want to join {company}?",
  "From where do you intend to work?",
  "Have you ever worked for {company} before?",
  "Have you worked as a full-time software engineer (excluding internships)?",
  "Years of professional experience",
];

function splitChipText(raw) {
  return String(raw || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

function joinChipText(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

// ── Sub-components ─────────────────────────────────────────────
function PSec({ title, children, theme }) {
  return (
    <div style={{ marginBottom:20 }}>
      {title && <div className="rm-section-label">{title}</div>}
      <div style={{ background:theme.surface, border:`1px solid ${theme.border}`,
                    borderRadius:16, padding:"20px 24px",
                    boxShadow:theme.shadowSm }}>
        {children}
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize:ts(11), fontWeight:600, textTransform:"uppercase",
  letterSpacing:"0.05em", display:"block", marginBottom:4,
};

// ⭐ D186-1 (45s): a contact / form field the résumé filled says so — quietly, beside its label; it stays editable, and a
// value the person saves is theirs (the server drops it from the list). Keyed by the row's label (CONTACT_FIELD_OF).
const ResumeFilledCtx = createContext(new Set());
const CONTACT_FIELD_OF = { "Full Name": "full_name", "Email": "email", "Phone": "phone", "LinkedIn URL": "linkedin_url", "GitHub URL": "github_url",
  "City": "city", "State": "state", "Country": "country", "Website URL": "website_url", "Portfolio URL": "portfolio_url",
  "Current Job Title": "current_job_title", "Current Company": "current_company" };
const PRow = ({ label, children, theme }) => {
  const filled = useContext(ResumeFilledCtx);
  const fromResume = filled.has(CONTACT_FIELD_OF[label]) || (label === "Years of Experience" && filled.has("years_of_experience"));
  return (
    <div style={{ display:"flex", flexDirection:"column", marginBottom:12 }}>
      <span style={{ ...labelStyle, color:theme.textMuted }}>{label}{fromResume && <span data-from-resume="" style={{ fontWeight:400, marginLeft:6, opacity:0.8 }}>· from your résumé</span>}</span>
      {children}
    </div>
  );
};

const PHint = ({ children, theme }) => (
  <span style={{ fontSize:ts(10), color:theme.textDim, marginTop:3, lineHeight:1.4, display:"block" }}>
    {children}
  </span>
);

function CustomAnswerAdder({ onAdd, theme }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="rm-btn"
        onClick={() => setOpen(true)}
        style={{ fontSize:ts(12), border:`1px dashed ${theme.border}`,
                 background:theme.bg, color:theme.textMuted, cursor:"pointer",
                 borderRadius:8, padding:"6px 12px" }}>
        + Add Question
      </button>
    );
  }
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end", marginTop:8 }}>
      <div style={{ flex:"1 1 200px" }}>
        <span style={{ fontSize:ts(11), fontWeight:600, textTransform:"uppercase",
                       letterSpacing:"0.05em", color:theme.textMuted,
                       display:"block", marginBottom:4 }}>Question</span>
        <input className="rm-input" value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="How did you hear about us?"/>
      </div>
      <div style={{ flex:"1 1 200px" }}>
        <span style={{ fontSize:ts(11), fontWeight:600, textTransform:"uppercase",
                       letterSpacing:"0.05em", color:theme.textMuted,
                       display:"block", marginBottom:4 }}>Answer</span>
        <input className="rm-input" value={a}
          onChange={e => setA(e.target.value)}
          placeholder="LinkedIn"/>
      </div>
      <div style={{ display:"flex", gap:6 }}>
        <button type="button" className="rm-btn rm-btn-primary"
          onClick={() => { onAdd(q, a); setQ(""); setA(""); setOpen(false); }}
          style={{ fontSize:ts(12) }}>
          Add
        </button>
        <button type="button" className="rm-btn"
          onClick={() => setOpen(false)}
          style={{ fontSize:ts(12), border:`1px solid ${theme.border}`,
                   background:theme.surface, color:theme.text }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const CA_CHIP = {
  fontSize:ts(9), fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em",
  borderRadius:5, padding:"2px 6px", whiteSpace:"nowrap",
};

/**
 * The per-company overrides for one templated question.
 *
 * This is the surface that makes a motivation question answerable at all: the generic template is
 * never submitted, so the only thing that can answer "Why do you want to join Figma?" is text the
 * candidate wrote for Figma. The template above is a starting point they edit, not a claim the
 * system makes on their behalf.
 */
function CompanyOverrides({ question, overrides, onChange, theme, needsOwnWords }) {
  const [company, setCompany] = useState("");
  const mine = Object.entries(overrides)
    .map(([ck, byQ]) => [ck, byQ?.[question]])
    .filter(([, a]) => a !== undefined)
    .sort((x, y) => x[0].localeCompare(y[0]));

  const write = (ck, value) => {
    const next = {};
    for (const [k, v] of Object.entries(overrides)) next[k] = { ...v };
    if (value === null) {
      if (next[ck]) {
        delete next[ck][question];
        if (Object.keys(next[ck]).length === 0) delete next[ck];
      }
    } else {
      if (!next[ck]) next[ck] = {};
      next[ck][question] = value;
    }
    onChange(next);
  };

  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:`1px dashed ${theme.border}` }}>
      <span style={{ fontSize:ts(10), fontWeight:700, textTransform:"uppercase",
                     letterSpacing:"0.06em", color:theme.textMuted }}>
        Per-company answers
      </span>
      <PHint theme={theme}>
        {needsOwnWords
          ? "Required for this question. Without one, the run holds and asks you — the generic answer above is only ever offered back to you as a draft."
          : "Optional. A company listed here uses its own answer instead of the template."}
      </PHint>
      {mine.length === 0 ? null : (
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
          {mine.map(([ck, a]) => (
            <div key={ck} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <div style={{ flex:"0 0 110px", fontSize:ts(11), fontWeight:600, color:theme.text,
                            paddingTop:7, textTransform:"capitalize", overflowWrap:"anywhere" }}>
                {ck}
              </div>
              <textarea className="rm-input" rows={2} value={a}
                onChange={e => write(ck, e.target.value)}
                style={{ flex:1, fontSize:ts(12), resize:"vertical", fontFamily:"inherit" }}
                placeholder={expandCompanyText(question, ck)}/>
              <button type="button" onClick={() => write(ck, null)}
                title={`Remove the ${ck} answer`}
                style={{ border:"none", background:"transparent", color:theme.danger,
                         cursor:"pointer", fontSize:ts(16), lineHeight:1, padding:"6px 4px" }}>
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:"flex", gap:6, marginTop:8 }}>
        <input className="rm-input" value={company}
          onChange={e => setCompany(e.target.value)}
          placeholder="Company name (e.g. Figma)"
          style={{ flex:"0 0 190px", fontSize:ts(12) }}/>
        <button type="button" className="rm-btn"
          disabled={!companyKeyOf(company) || !!overrides[companyKeyOf(company)]?.[question]}
          onClick={() => { write(companyKeyOf(company), ""); setCompany(""); }}
          style={{ fontSize:ts(12), border:`1px dashed ${theme.border}`,
                   background:theme.bg, color:theme.textMuted, cursor:"pointer",
                   borderRadius:8, padding:"6px 12px" }}>
          + Add company
        </button>
      </div>
    </div>
  );
}

/**
 * One stored answer, editable in place.
 *
 * The QUESTION is editable, not just the answer, because these arrive by capture from a real form
 * and matching is on exact wording: a stray character is the difference between an answer that
 * resolves and one that never fires again.
 */
function CustomAnswerRow({ question, answer, overrides, onRename, onAnswer, onDelete, onOverrides, theme }) {
  const templated = isTemplateQ(question);
  const ownWords  = templated && isMotivationQ(question);
  const [open, setOpen] = useState(false);
  const overrideCount = Object.values(overrides).filter(byQ => byQ?.[question] !== undefined).length;

  return (
    <div style={{ border:`1px solid ${theme.border}`, borderRadius:12, padding:"12px 14px",
                  marginBottom:10, background:theme.bg }}>
      <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
        <input className="rm-input" value={question}
          onChange={e => onRename(e.target.value)}
          style={{ flex:1, fontSize:ts(12), fontWeight:600 }}/>
        <button type="button" onClick={onDelete} title="Delete this answer"
          style={{ border:"none", background:"transparent", color:theme.danger,
                   cursor:"pointer", fontSize:ts(16), lineHeight:1, padding:"7px 4px" }}>
          &times;
        </button>
      </div>

      <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap", alignItems:"center" }}>
        {templated ? (
          <span style={{ ...CA_CHIP, background:`${theme.accent}1f`, color:theme.accentText }}>
            Per-company template
          </span>
        ) : null}
        {ownWords ? (
          <span style={{ ...CA_CHIP, background:`${theme.warning || theme.danger}22`,
                         color:theme.warning || theme.danger }}>
            Your words only
          </span>
        ) : null}
        {overrideCount > 0 ? (
          <span style={{ ...CA_CHIP, background:theme.surface, color:theme.textMuted,
                         border:`1px solid ${theme.border}` }}>
            {overrideCount} company{overrideCount === 1 ? "" : " answers"}
          </span>
        ) : null}
      </div>

      <textarea className="rm-input" rows={2} value={answer}
        onChange={e => onAnswer(e.target.value)}
        placeholder={ownWords ? "A starting point you edit per company — never submitted as-is" : "Your answer"}
        style={{ width:"100%", marginTop:8, fontSize:ts(12), resize:"vertical", fontFamily:"inherit" }}/>

      {ownWords ? (
        <PHint theme={theme}>
          This asks why you want a specific employer, so it is answered in your voice. The text above
          is never submitted — a run holds and offers it back as a draft, and only the per-company
          answer below is sent.
        </PHint>
      ) : null}
      {templated && !ownWords ? (
        <PHint theme={theme}>
          <code>{COMPANY_TOKEN}</code> is replaced with the employer's name, so this one answer
          matches the question at every company that asks it.
        </PHint>
      ) : null}

      {templated ? (
        open || overrideCount > 0 ? (
          <CompanyOverrides question={question} overrides={overrides} onChange={onOverrides}
            theme={theme} needsOwnWords={ownWords}/>
        ) : (
          <button type="button" onClick={() => setOpen(true)}
            style={{ marginTop:8, border:"none", background:"transparent", color:theme.accentText,
                     cursor:"pointer", fontSize:ts(11), fontWeight:600, padding:0 }}>
            + Per-company answer
          </button>
        )
      ) : null}
    </div>
  );
}

// ⭐ D183 P1: `resumeView={false}` — the Profile page draws the résumé view itself (pages/profile/YourProfile.jsx, with the
// same ProfileSections editors) and mounts this panel under "Behind your profile" for the private machinery only.
// ⭐ D183 P2: fired after a base résumé is saved or uploaded here — Your profile (pages/profile/YourProfile.jsx) listens.
export const RESUME_REPLACED_EVENT = "draft:resume-replaced";

export function ProfilePanel({ onOpenJobProfiles = () => {}, section = null, resumeView = true }) {
  const { theme } = useTheme();
  // ⭐ D167: Profile has its own navigation now (pages/profile/ProfilePage.jsx) and this page is drawn in three of its
  // panels — About you ("about"), Your résumés ("resumes"), Saved answers ("answers"). `section` picks the part; with no
  // section the whole page draws as before. One state, one save: each part is the same form, nothing copied.
  // ⭐ A140 (owner 11-08): About you and Your résumés are ONE panel — `section` may name several parts.
  const on = (part) => !section || (Array.isArray(section) ? section.includes(part) : section === part);

  const BLANK = {
    full_name:"", email:"", phone:"",
    linkedin_url:"", github_url:"",
    location:"", address_line1:"", address_line2:"",
    city:"", state:"", zip:"", country:"United States",
    gender:"", ethnicity:"", veteran_status:"", disability_status:"",
    requires_sponsorship:false, sponsorship_need:"", has_clearance:false,
    clearance_level:"", visa_type:"", work_auth:"",
    website_url:"", portfolio_url:"",
    desired_salary:"", salary_currency:"USD",
    available_start_date:"", willing_to_relocate:false,
    current_job_title:"", current_company:"", years_of_experience:"",
    custom_answers:{},
    // {companyKey: {question: answer}} — a per-company answer to a `{company}`-templated question.
    custom_answer_overrides:{},
  };

  const [form,   setForm]   = useState(BLANK);
  const [status, setStatus] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [profileForm, setProfileForm] = useState(null);
  const [signalsForm, setSignalsForm] = useState({
    titles: "", keywords: "", skills: "", searchTerms: "", yearsExperience: "",
  });
  const [structuredFactsForm, setStructuredFactsForm] = useState({
    citizenshipStatus: "",
    workAuthorization: "",
    requiresSponsorship: false,
    hasClearance: false,
    clearanceLevel: "",
    degreeLevel: "",
  });
  const [suggestedSignals, setSuggestedSignals] = useState({
    inactiveSkills: [],
    selectedSkills: [],
    appliedSkills: [],
    inactiveActionVerbs: [],
    selectedActionVerbs: [],
    appliedActionVerbs: [],
    structuredFacts: [],
  });
  const [enhancementStatus, setEnhancementStatus] = useState({
    eligible: false,
    selectedCount: 0,
    threshold: 5,
    suggestedSkillCount: 0,
    structuredFactCount: 0,
    hasEnhancedDraft: false,
    history: [],
  });
  const [enhancementHistory, setEnhancementHistory] = useState([]);
  const [enhancingProfileResume, setEnhancingProfileResume] = useState(false);
  const [enhancePreview, setEnhancePreview] = useState(null);
  const [suggestionStatus, setSuggestionStatus] = useState("");
  const [resumeDraft, setResumeDraft] = useState("");
  // A33: proposals read from the résumé, each ticked or not by the user. null = closed.
  const [prefillRows, setPrefillRows] = useState(null);
  const [prefillPicked, setPrefillPicked] = useState({});
  const [resumeName, setResumeName] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [resumeStatus, setResumeStatus] = useState("");
  const [signalStatus, setSignalStatus] = useState("");
  const [loadingProfileAssets, setLoadingProfileAssets] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [showProfileWizard, setShowProfileWizard] = useState(false);
  const resumeInputRef = useRef(null);

  const loadProfileAssets = useCallback(async (profileId) => {
    if (!profileId) return;
    setEnhancePreview(null);
    const [resume, signals, enhance, history] = await Promise.all([
      api(`/api/domain-profiles/${profileId}/base-resume`),
      api(`/api/domain-profiles/${profileId}/signals`),
      api(`/api/domain-profiles/${profileId}/enhance-status`),
      api(`/api/domain-profiles/${profileId}/enhancement-history`).catch(() => ({ history: [] })),
    ]);
    setResumeDraft(resume?.content || "");
    setResumeName(resume?.name || "");
    setSignalsForm({
      titles: joinChipText(signals?.titles),
      keywords: joinChipText(signals?.keywords),
      skills: joinChipText(signals?.skills),
      searchTerms: joinChipText(signals?.searchTerms),
      yearsExperience: signals?.yearsExperience ?? "",
    });
    setStructuredFactsForm({
      citizenshipStatus: signals?.structuredFacts?.citizenshipStatus || "",
      workAuthorization: signals?.structuredFacts?.workAuthorization || "",
      requiresSponsorship: !!signals?.structuredFacts?.requiresSponsorship,
      hasClearance: !!signals?.structuredFacts?.hasClearance,
      clearanceLevel: signals?.structuredFacts?.clearanceLevel || "",
      degreeLevel: signals?.structuredFacts?.degreeLevel || "",
    });
    setSuggestedSignals(signals?.suggestions || {
      inactiveSkills: [],
      selectedSkills: [],
      appliedSkills: [],
      inactiveActionVerbs: [],
      selectedActionVerbs: [],
      appliedActionVerbs: [],
      structuredFacts: [],
    });
    setEnhancementStatus(enhance || {
      eligible: false,
      selectedCount: 0,
      threshold: 5,
      suggestedSkillCount: 0,
      structuredFactCount: 0,
      hasEnhancedDraft: false,
      history: [],
    });
    setEnhancementHistory(history?.history || enhance?.history || []);
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const rows = await api("/api/domain-profiles");
      const next = Array.isArray(rows) ? rows : [];
      setProfiles(next);
      const active = next.find(p => p.is_active) || next[0] || null;
      setActiveProfileId(prev => (next.some(p => p.id === prev) ? prev : (active?.id ?? null)));
    } catch {}
  }, []);

  // D186-1: the fields the résumé filled (GET /api/profile carries resume_filled_json).
  const filledFromResume = useMemo(() => { try { return new Set(JSON.parse(form.resume_filled_json || "[]")); } catch { return new Set(); } }, [form.resume_filled_json]);
  useEffect(() => {
    api("/api/profile")
      .then(d => setForm(f => ({
        ...f, ...d,
        requires_sponsorship: !!d.requires_sponsorship,
        // "" renders as "Select…", which is the honest rendering of never-asked. Do NOT collapse
        // an unset situation to 'none' — that is the wrong guess for exactly the people this field
        // exists for.
        sponsorship_need:     d.sponsorship_need || "",
        has_clearance:        !!d.has_clearance,
        willing_to_relocate:  !!d.willing_to_relocate,
        custom_answers: parseMap(d.custom_answers),
        custom_answer_overrides: parseMap(d.custom_answer_overrides),
      })))
      .catch(() => {});
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  useEffect(() => {
    if (!activeProfileId) {
      setProfileForm(null);
      setResumeDraft("");
      setResumeName("");
      setSignalsForm({ titles: "", keywords: "", skills: "", searchTerms: "", yearsExperience: "" });
      setStructuredFactsForm({
        citizenshipStatus: "",
        workAuthorization: "",
        requiresSponsorship: false,
        hasClearance: false,
        clearanceLevel: "",
        degreeLevel: "",
      });
      setSuggestedSignals({ inactiveSkills: [], selectedSkills: [], appliedSkills: [], inactiveActionVerbs: [], selectedActionVerbs: [], appliedActionVerbs: [], structuredFacts: [] });
      setEnhancementStatus({ eligible: false, selectedCount: 0, threshold: 5, suggestedSkillCount: 0, structuredFactCount: 0, hasEnhancedDraft: false, history: [] });
      setEnhancementHistory([]);
      return;
    }
    const selected = profiles.find(p => p.id === activeProfileId);
    if (selected) {
      setProfileForm({
        id: selected.id,
        profile_name: selected.profile_name || "",
        role_family: selected.role_family || "",
        domain: selected.domain || "",
        seniority: selected.seniority || "mid",
        target_titles: joinChipText(selected.target_titles),
        selected_keywords: joinChipText(selected.selected_keywords),
        selected_verbs: joinChipText(selected.selected_verbs),
        selected_tools: joinChipText(selected.selected_tools),
      });
    }

    setLoadingProfileAssets(true);
    loadProfileAssets(activeProfileId).catch(() => {
      setResumeDraft("");
      setResumeName("");
      setSignalsForm({ titles: "", keywords: "", skills: "", searchTerms: "", yearsExperience: "" });
    }).finally(() => setLoadingProfileAssets(false));
  }, [activeProfileId, profiles, loadProfileAssets]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeProfileId) return undefined;
    const handleSuggestionsUpdated = (event) => {
      if (Number(event.detail?.profileId) !== Number(activeProfileId)) return;
      loadProfiles().catch(() => {});
      loadProfileAssets(activeProfileId).catch(() => {});
    };
    window.addEventListener(PROFILE_SUGGESTIONS_UPDATED_EVENT, handleSuggestionsUpdated);
    return () => window.removeEventListener(PROFILE_SUGGESTIONS_UPDATED_EVENT, handleSuggestionsUpdated);
  }, [activeProfileId, loadProfileAssets, loadProfiles]);

  // A105 finding 5: the one Save sat below every other section; it now follows the page (sticky) and says when
  // something is unsaved.
  const [unsaved, setUnsaved] = useState(false);
  const set = (k, v) => { setUnsaved(true); setForm(f => ({ ...f, [k]: v })); };

  const blurPhone     = () => set("phone",         normalisePhone(form.phone));
  const blurLinkedin  = () => set("linkedin_url",  normaliseUrl(form.linkedin_url));
  const blurGithub    = () => set("github_url",    normaliseUrl(form.github_url));
  const blurWebsite   = () => set("website_url",   normaliseUrl(form.website_url));
  const blurPortfolio = () => set("portfolio_url", normaliseUrl(form.portfolio_url));
  const blurZip       = () => set("zip",           normaliseZip(form.zip));
  const blurState     = () => set("state",         normaliseState(form.state));

  const syncLocation = () => {
    if (form.city || form.state) {
      set("location", [form.city, form.state].filter(Boolean).join(", "));
    }
  };

  const save = async e => {
    e.preventDefault();
    const cleaned = {
      ...form,
      phone:         normalisePhone(form.phone),
      linkedin_url:  normaliseUrl(form.linkedin_url),
      github_url:    normaliseUrl(form.github_url),
      website_url:   normaliseUrl(form.website_url),
      portfolio_url: normaliseUrl(form.portfolio_url),
      zip:           normaliseZip(form.zip),
      state:         normaliseState(form.state),
      location:      form.city && form.state
                       ? `${form.city}, ${form.state}`
                       : (form.city || form.state || form.location || ""),
      custom_answers: parseMap(form.custom_answers),
      custom_answer_overrides: parseMap(form.custom_answer_overrides),
    };
    try {
      await api("/api/profile", { method:"POST", body:JSON.stringify(cleaned) });
      setForm(cleaned);
      setUnsaved(false);
      // D186-1: a field changed by hand is no longer "from your résumé" — the server's list, read back.
      api("/api/profile").then(d => setForm(f => ({ ...f, resume_filled_json: d.resume_filled_json }))).catch(() => {});
      setStatus("✓ Saved");
      setTimeout(() => setStatus(""), 3000);
    } catch { setStatus("✗ Save failed"); }
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;

  const saveProfileSettings = async () => {
    if (!profileForm?.id) return;
    try {
      const updated = await api(`/api/domain-profiles/${profileForm.id}`, {
        method: "PUT",
        body: JSON.stringify({
          profile_name: profileForm.profile_name,
          role_family: profileForm.role_family,
          domain: profileForm.domain,
          seniority: profileForm.seniority,
          target_titles: splitChipText(profileForm.target_titles),
          selected_keywords: splitChipText(profileForm.selected_keywords),
          selected_verbs: splitChipText(profileForm.selected_verbs),
          selected_tools: splitChipText(profileForm.selected_tools),
        }),
      });
      setProfiles(prev => prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p)));
      setProfileStatus("Saved job profile");
      setTimeout(() => setProfileStatus(""), 2500);
    } catch (e) {
      setProfileStatus(e.message || "Could not save profile");
    }
  };

  const saveSignals = async () => {
    if (!activeProfileId) return;
    try {
      await api(`/api/domain-profiles/${activeProfileId}/signals`, {
        method: "PUT",
        body: JSON.stringify({
          titles: splitChipText(signalsForm.titles),
          keywords: splitChipText(signalsForm.keywords),
          skills: splitChipText(signalsForm.skills),
          searchTerms: splitChipText(signalsForm.searchTerms),
          structuredFacts: structuredFactsForm,
          yearsExperience: signalsForm.yearsExperience === "" ? null : Number(signalsForm.yearsExperience),
        }),
      });
      setSignalStatus("Saved extracted signals");
      setTimeout(() => setSignalStatus(""), 2500);
      await loadProfileAssets(activeProfileId);
    } catch (e) {
      setSignalStatus(e.message || "Could not save signals");
    }
  };

  // P1 (10-02): re-extracting REPLACES hand edits to these three lists (claimed terms are stored
  // separately and survive). The server always said so in `notice`; the button now asks first and
  // shows that sentence, instead of a cheerful "Refreshed".
  const REEXTRACT_WARNING = "Re-extract from your résumé? Any hand edits to Titles, Keywords and Skills are replaced. " +
    "Terms you claimed are kept — they are stored separately.";
  const refreshSignals = async () => {
    if (!activeProfileId) return;
    if (!window.confirm(REEXTRACT_WARNING)) return;
    try {
      const next = await api(`/api/domain-profiles/${activeProfileId}/signals/refresh`, { method: "POST" });
      setSignalsForm({
        titles: joinChipText(next?.titles),
        keywords: joinChipText(next?.keywords),
        skills: joinChipText(next?.skills),
        searchTerms: joinChipText(next?.searchTerms),
        yearsExperience: next?.yearsExperience ?? "",
      });
      setStructuredFactsForm({
        citizenshipStatus: next?.structuredFacts?.citizenshipStatus || structuredFactsForm.citizenshipStatus,
        workAuthorization: next?.structuredFacts?.workAuthorization || structuredFactsForm.workAuthorization,
        requiresSponsorship: next?.structuredFacts?.requiresSponsorship ?? structuredFactsForm.requiresSponsorship,
        hasClearance: next?.structuredFacts?.hasClearance ?? structuredFactsForm.hasClearance,
        clearanceLevel: next?.structuredFacts?.clearanceLevel || structuredFactsForm.clearanceLevel,
        degreeLevel: next?.structuredFacts?.degreeLevel || structuredFactsForm.degreeLevel,
      });
      setSignalStatus(next?.notice || "Re-extracted from your résumé. Hand edits to these lists were replaced; claimed terms were kept.");
      setTimeout(() => setSignalStatus(""), 2500);
      await loadProfileAssets(activeProfileId);
    } catch (e) {
      setSignalStatus(e.message || "Could not refresh signals");
    }
  };

  const saveResume = async () => {
    if (!activeProfileId) return;
    try {
      await api(`/api/domain-profiles/${activeProfileId}/base-resume`, {
        method: "POST",
        body: JSON.stringify({ content: resumeDraft, name: resumeName || "resume.txt" }),
      });
      setResumeStatus("Saved profile resume");
      window.dispatchEvent(new Event(RESUME_REPLACED_EVENT));   // ⭐ D183 P2: Your profile re-reads and shows What changed
      setTimeout(() => setResumeStatus(""), 2500);
      await refreshSignals();
      loadProfiles();
      await loadProfileAssets(activeProfileId);
    } catch (e) {
      setResumeStatus(e.message || "Could not save profile resume");
    }
  };

  const activateProfile = async (id) => {
    try {
      await api(`/api/domain-profiles/${id}/activate`, { method: "POST" });
      setActiveProfileId(id);
      setProfiles(prev => prev.map(p => ({ ...p, is_active: p.id === id ? 1 : 0 })));
    } catch {}
  };

  const updateSelectedSuggestions = async (nextKeys) => {
    if (!activeProfileId) return;
    try {
      const next = await api(`/api/domain-profiles/${activeProfileId}/suggestions`, {
        method: "PUT",
        body: JSON.stringify({ selectedSkillKeys: nextKeys }),
      });
      setSuggestedSignals(prev => ({
        ...prev,
        inactiveSkills: next?.inactiveSkills || [],
        selectedSkills: next?.selectedSkills || [],
        appliedSkills: next?.appliedSkills || prev.appliedSkills || [],
        inactiveActionVerbs: next?.inactiveActionVerbs || prev.inactiveActionVerbs || [],
        selectedActionVerbs: next?.selectedActionVerbs || prev.selectedActionVerbs || [],
        appliedActionVerbs: next?.appliedActionVerbs || prev.appliedActionVerbs || [],
        structuredFacts: prev.structuredFacts,
      }));
      emitProfileSuggestionsUpdated(activeProfileId, next || null);
      setEnhancementStatus(prev => ({ ...prev, ...(next?.enhancement || {}) }));
      setSuggestionStatus("Updated enhancement skill selections");
      setTimeout(() => setSuggestionStatus(""), 2500);
    } catch (e) {
      setSuggestionStatus(e.message || "Could not update suggested skills");
    }
  };

  const toggleSuggestedSkill = async (key, enabled) => {
    const current = (suggestedSignals.selectedSkills || []).map(item => item.key);
    const next = enabled
      ? [...new Set([...current, key])]
      : current.filter(item => item !== key);
    await updateSelectedSuggestions(next);
  };

  const runEnhancement = async () => {
    if (!activeProfileId || enhancingProfileResume) return;
    setEnhancingProfileResume(true);
    setResumeStatus("");
    try {
      const preview = await api(`/api/domain-profiles/${activeProfileId}/enhance`, { method: "POST" });
      setEnhancePreview(preview);
      setResumeStatus("Enhanced draft ready for review");
      await loadProfileAssets(activeProfileId);
    } catch (e) {
      setResumeStatus(e.message || "Could not enhance profile resume");
    } finally {
      setEnhancingProfileResume(false);
    }
  };

  const adoptEnhancedResume = async () => {
    if (!activeProfileId) return;
    try {
      await api(`/api/domain-profiles/${activeProfileId}/adopt-enhanced`, { method: "PATCH" });
      setEnhancePreview(null);
      setResumeStatus("Enhanced resume adopted for this profile");
      setTimeout(() => setResumeStatus(""), 2500);
      await loadProfileAssets(activeProfileId);
      await loadProfiles();
    } catch (e) {
      setResumeStatus(e.message || "Could not adopt enhanced resume");
    }
  };

  const uploadResumePdf = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !activeProfileId) return;
    setUploadingResume(true);
    setResumeStatus("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const parsed = await api("/api/parse-pdf", { method: "POST", body: formData });
      setResumeDraft(parsed?.text || "");
      setResumeName(file.name);
      await api(`/api/domain-profiles/${activeProfileId}/base-resume`, {
        method: "POST",
        body: JSON.stringify({ content: parsed?.text || "", name: file.name }),
      });
      const nextSignals = await api(`/api/domain-profiles/${activeProfileId}/signals/refresh`, { method: "POST" });
      setSignalsForm({
        titles: joinChipText(nextSignals?.titles),
        keywords: joinChipText(nextSignals?.keywords),
        skills: joinChipText(nextSignals?.skills),
        searchTerms: joinChipText(nextSignals?.searchTerms),
        yearsExperience: nextSignals?.yearsExperience ?? "",
      });
      window.dispatchEvent(new Event(RESUME_REPLACED_EVENT));   // ⭐ D183 P2: Your profile re-reads and shows What changed
      // P1: say what the re-extraction replaced, as the refresh does.
      setResumeStatus(nextSignals?.notice || "Uploaded. Titles, keywords and skills were re-extracted — hand edits to them were replaced; claimed terms were kept.");
      setTimeout(() => setResumeStatus(""), 9000);   // long enough to read what was replaced
      loadProfiles();
      await loadProfileAssets(activeProfileId);
    } catch (e) {
      setResumeStatus(e.message || "Could not parse resume");
    } finally {
      setUploadingResume(false);
      event.target.value = "";
    }
  };

  const selStyle = {
    width:"100%", height:40, padding:"0 12px", borderRadius:10,
    border:`1px solid ${theme.border}`, background:theme.surface,
    color:theme.text, fontSize:ts(13), outline:"none", boxSizing:"border-box",
  };

  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"32px 24px",
                  overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      {!section && (
      <div style={{ fontWeight:900, fontSize:ts(22), color:theme.text,
                    letterSpacing:"-0.5px", marginBottom:24 }}>
        Profile
      </div>
      )}
      <form onSubmit={save}>

        <ResumeFilledCtx.Provider value={filledFromResume}>
        {on("about") && <>
        {/* ⛔ A140 (owner 11-08: "we had updated the profile section to have resume like UI with company logos … with
            inline editing, instead of the traditional text fields, cannot see it now"): the résumé-like view
            (ProfileSections — summary, experience with company logos, projects, education, skills, each edited in
            place) LEADS About you. It was mounted below three blocks of text fields and read as missing. The contact,
            address and visa fields the form-filler needs fold into one closed section under it. */}
        {/* A140: the job profile's extracted skills and keywords are drawn bold in the experience (no separate section). */}
        {resumeView && <ProfileSections theme={theme} highlight={[...splitChipText(signalsForm.keywords), ...splitChipText(signalsForm.skills)]}/>}
        <details data-contact-fields="" style={{ marginBottom: 20 }} open={!!resumeDraft}>
          <summary className="rm-section-label" style={{ cursor: "pointer", marginBottom: 12 }}>Contact details for application forms</summary>
        {/* ── Personal ── */}
        <PSec title="Personal" theme={theme}>
          {/* ── A33: FILL FROM YOUR RÉSUMÉ — proposed, never auto-accepted ─────────────────────────
              Each value is shown with the line it was read from. An empty field is ticked by
              default; a value that would REPLACE what you typed is not. Nothing is saved until Save,
              and work authorisation, sponsorship, clearance and the EEO answers are never proposed. */}
          {resumeDraft && (
            <div data-resume-prefill style={{ marginBottom: 14 }}>
              {!prefillRows ? (
                <button type="button" className="rm-btn rm-btn-secondary rm-btn-sm"
                  onClick={() => {
                    const rows = prefillDiff(prefillFromResumeText(resumeDraft), form).filter(r => !EDUCATION_PREFILL.has(r.field));
                    setPrefillRows(rows);
                    setPrefillPicked(Object.fromEntries(rows.map(r => [r.field, !String(r.current || "").trim()])));
                  }}>
                  Fill from your résumé…
                </button>
              ) : (
                <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: ts(12), color: theme.textMuted, marginBottom: 8 }}>
                    {prefillRows.length
                      ? "Read from your résumé. Tick what is right — nothing is saved until you press Save. Work authorisation, sponsorship, clearance and the voluntary questions are never filled from a résumé."
                      : "Nothing in your résumé differs from what is already here."}
                  </div>
                  {prefillRows.map(r => (
                    <label key={r.field} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: ts(12), padding: "4px 0" }}>
                      <input type="checkbox" checked={!!prefillPicked[r.field]}
                        onChange={e => setPrefillPicked(p => ({ ...p, [r.field]: e.target.checked }))}/>
                      <span>
                        <strong>{PREFILL_LABELS[r.field] || r.field}:</strong> {r.value}
                        {String(r.current || "").trim() && <span style={{ color: theme.textMuted }}> (replaces “{r.current}”)</span>}
                        <span style={{ display: "block", color: theme.textMuted, fontSize: ts(11) }}>from: {r.from}</span>
                      </span>
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {prefillRows.length > 0 && (
                      <button type="button" className="rm-btn rm-btn-primary rm-btn-sm"
                        onClick={() => {
                          const chosen = prefillRows.filter(r => prefillPicked[r.field]);
                          setForm(f => ({ ...f, ...Object.fromEntries(chosen.map(r => [r.field, r.value])) }));
                          setStatus(chosen.length ? `Filled ${chosen.length} field${chosen.length === 1 ? "" : "s"} — check them, then Save.` : "");
                          setPrefillRows(null);
                        }}>
                        Fill the ticked fields
                      </button>
                    )}
                    <button type="button" className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setPrefillRows(null)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <PRow label="Full Name" theme={theme}>
            <input className="rm-input" value={form.full_name || ""}
              onChange={e => set("full_name", e.target.value)}
              placeholder="First Last (or First Middle Last)"/>
            <PHint theme={theme}>Enter your name exactly as it should appear on your resume and applications.</PHint>
          </PRow>
          <PRow label="Email" theme={theme}>
            <input className="rm-input" type="email" value={form.email || ""}
              onChange={e => set("email", e.target.value)}
              placeholder="you@email.com"/>
          </PRow>
          <PRow label="Phone" theme={theme}>
            <input className="rm-input" type="tel" value={form.phone || ""}
              onChange={e => set("phone", e.target.value)}
              onBlur={blurPhone}
              placeholder="+1 (555) 000-0000 or 5550001234"/>
            <PHint theme={theme}>Any format accepted — normalised to +1 (XXX) XXX-XXXX on save.</PHint>
          </PRow>
          <PRow label="LinkedIn URL" theme={theme}>
            <input className="rm-input" value={form.linkedin_url || ""}
              onChange={e => set("linkedin_url", e.target.value)}
              onBlur={blurLinkedin}
              placeholder="linkedin.com/in/yourhandle"/>
          </PRow>
          <PRow label="GitHub URL" theme={theme}>
            <input className="rm-input" value={form.github_url || ""}
              onChange={e => set("github_url", e.target.value)}
              onBlur={blurGithub}
              placeholder="github.com/yourhandle"/>
          </PRow>
        </PSec>

        {/* ── Address ── */}
        <PSec title="Address (for autofill)" theme={theme}>
          <PRow label="Street Address" theme={theme}>
            <input className="rm-input" value={form.address_line1 || ""}
              onChange={e => set("address_line1", e.target.value)}
              placeholder="123 Main St"/>
          </PRow>
          <PRow label="Apt / Suite" theme={theme}>
            <input className="rm-input" value={form.address_line2 || ""}
              onChange={e => set("address_line2", e.target.value)}
              placeholder="Apt 4B"/>
          </PRow>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <PRow label="City" theme={theme}>
              <input className="rm-input" value={form.city || ""}
                onChange={e => set("city", e.target.value)}
                onBlur={syncLocation} placeholder="Boston"/>
            </PRow>
            <PRow label="State" theme={theme}>
              <input className="rm-input" value={form.state || ""}
                onChange={e => set("state", e.target.value)}
                onBlur={() => { blurState(); syncLocation(); }} placeholder="MA"/>
              <PHint theme={theme}>2-letter code</PHint>
            </PRow>
            <PRow label="ZIP" theme={theme}>
              <input className="rm-input" value={form.zip || ""}
                onChange={e => set("zip", e.target.value)}
                onBlur={blurZip} placeholder="02101"/>
            </PRow>
          </div>
          <PRow label="Country" theme={theme}>
            <select style={selStyle} value={form.country}
              onChange={e => set("country", e.target.value)}>
              <option>United States</option><option>Canada</option>
              <option>United Kingdom</option><option>India</option><option>Other</option>
            </select>
          </PRow>
        </PSec>

        {/* ── D101 · Work authorisation, sponsorship, clearance and voluntary self-ID are APPLICATION DEFAULTS now
            (components/ProfileSections.jsx) — the one place the fill reads them (withApplicationDefaults). The old
            Work Authorization and EEO selects here wrote user_profile columns that the fill no longer reads after the
            first import, so an edit there was silently ignored (A105 finding 1). Visa type is not a default and stays. ── */}
        {/* D182 (45n): no section title — the one field's own label says it. */}
        <PSec theme={theme}>
          <PRow label="Visa / Immigration Status" theme={theme}>
            <select style={selStyle} value={form.visa_type}
              onChange={e => set("visa_type", e.target.value)}>
              <option value="">Select…</option>
              <option>US Citizen</option><option>Green Card / LPR</option>
              <option>H-1B</option><option>OPT</option><option>STEM OPT</option>
              <option>TN Visa</option><option>O-1</option><option>Other</option>
            </select>
          </PRow>
        </PSec>

        </details>

        {/* ── Application Extras ── */}
        <PSec title="Application Extras" theme={theme}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <PRow label="Website URL" theme={theme}>
              <input className="rm-input" value={form.website_url || ""}
                onChange={e => set("website_url", e.target.value)}
                onBlur={blurWebsite}
                placeholder="yoursite.com"/>
            </PRow>
            <PRow label="Portfolio URL" theme={theme}>
              <input className="rm-input" value={form.portfolio_url || ""}
                onChange={e => set("portfolio_url", e.target.value)}
                onBlur={blurPortfolio}
                placeholder="portfolio.example.com"/>
            </PRow>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <PRow label="Current Job Title" theme={theme}>
              <input className="rm-input" value={form.current_job_title || ""}
                onChange={e => set("current_job_title", e.target.value)}
                placeholder="Software Engineer"/>
            </PRow>
            <PRow label="Current Company" theme={theme}>
              <input className="rm-input" value={form.current_company || ""}
                onChange={e => set("current_company", e.target.value)}
                placeholder="Acme Corp"/>
            </PRow>
          </div>
          <PRow label="Years of Experience" theme={theme}>
            <input className="rm-input" type="number" min="0" max="60" value={form.years_of_experience || ""}
              onChange={e => set("years_of_experience", e.target.value)}
              placeholder="5"/>
          </PRow>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
            <PRow label="Desired Salary" theme={theme}>
              <input className="rm-input" type="number" min="0" value={form.desired_salary || ""}
                onChange={e => set("desired_salary", e.target.value)}
                placeholder="100000"/>
            </PRow>
            <PRow label="Currency" theme={theme}>
              <select style={selStyle} value={form.salary_currency || "USD"}
                onChange={e => set("salary_currency", e.target.value)}>
                <option>USD</option><option>EUR</option><option>GBP</option>
                <option>CAD</option><option>AUD</option>
              </select>
            </PRow>
          </div>
          <PRow label="Available Start Date" theme={theme}>
            <input className="rm-input" type="date" value={form.available_start_date || ""}
              onChange={e => set("available_start_date", e.target.value)}/>
          </PRow>
          <label style={{ display:"flex", alignItems:"center", gap:8,
                          marginBottom:10, cursor:"pointer",
                          fontSize:ts(13), color:theme.text }}>
            <input type="checkbox" checked={!!form.willing_to_relocate}
              onChange={e => set("willing_to_relocate", e.target.checked)}
              style={{ accentColor:theme.accent, width:16, height:16 }}/>
            Willing to relocate
          </label>
        </PSec>
        </>}

        {/* D112 d2: the old Education block is gone — the Education SECTION (ProfileSections, above) is the source of
            the degree, with its own Change override. Migration 179 moved the block's values into it. */}

        </ResumeFilledCtx.Provider>
        {on("answers") && <>
        {/* ── Custom Answers ── */}
        <PSec title="Custom Answers" theme={theme}>
          <p style={{ fontSize:ts(12), color:theme.textMuted, lineHeight:1.5, marginBottom:6 }}>
            The answers only you can write. Each one is keyed to the question's exact wording, so
            "Have you worked for us before?" and "Are you a former employee?" are separate entries —
            store both if both get asked.
          </p>
          <p style={{ fontSize:ts(12), color:theme.textMuted, lineHeight:1.5, marginBottom:14 }}>
            Write <code>{COMPANY_TOKEN}</code> where the employer's name goes and one entry covers
            every company that asks it. Answers are matched exactly and never guessed at; a question
            worded differently is left for you rather than answered from a near-miss.
          </p>

          {Object.keys(form.custom_answers || {}).length === 0 ? (
            <div style={{ fontSize:ts(12), color:theme.textDim, marginBottom:12 }}>
              Nothing stored yet. Held runs offer to save the answers you write, so this fills itself
              as you apply — or seed the five questions below and answer them once.
            </div>
          ) : null}

          {Object.entries(form.custom_answers || {}).map(([q, a], i) => (
            <CustomAnswerRow
              key={`${i}:${q}`}
              question={q}
              answer={String(a ?? "")}
              overrides={form.custom_answer_overrides || {}}
              theme={theme}
              onRename={(next) => {
                const trimmed = next;
                const rebuilt = {};
                // Rebuilt in order so renaming a question does not jump it to the end of the list
                // while it is being typed in.
                for (const [k, v] of Object.entries(form.custom_answers)) {
                  if (k === q) rebuilt[trimmed] = v; else rebuilt[k] = v;
                }
                // Overrides are keyed by the stored wording, so they have to follow the rename or
                // they would be silently orphaned.
                const nextOv = {};
                for (const [ck, byQ] of Object.entries(form.custom_answer_overrides || {})) {
                  const inner = {};
                  for (const [k, v] of Object.entries(byQ)) inner[k === q ? trimmed : k] = v;
                  nextOv[ck] = inner;
                }
                setForm(f => ({ ...f, custom_answers: rebuilt, custom_answer_overrides: nextOv }));
              }}
              onAnswer={(next) => set("custom_answers", { ...form.custom_answers, [q]: next })}
              onDelete={() => {
                const next = { ...form.custom_answers };
                delete next[q];
                const nextOv = {};
                for (const [ck, byQ] of Object.entries(form.custom_answer_overrides || {})) {
                  const inner = { ...byQ };
                  delete inner[q];
                  if (Object.keys(inner).length) nextOv[ck] = inner;
                }
                setForm(f => ({ ...f, custom_answers: next, custom_answer_overrides: nextOv }));
              }}
              onOverrides={(nextOv) => set("custom_answer_overrides", nextOv)}
            />
          ))}

          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <CustomAnswerAdder onAdd={(q, a) => {
              if (!q.trim()) return;
              set("custom_answers", { ...form.custom_answers, [q.trim()]: a });
            }} theme={theme} selStyle={selStyle} />
            {SEED_QUESTIONS.every(q => Object.prototype.hasOwnProperty.call(form.custom_answers || {}, q)) ? null : (
              <button type="button" className="rm-btn"
                onClick={() => {
                  const next = { ...form.custom_answers };
                  // Wordings only. Seeding an ANSWER would be the system putting words in your
                  // mouth, which is the one thing this store exists not to do.
                  for (const q of SEED_QUESTIONS) {
                    if (!Object.prototype.hasOwnProperty.call(next, q)) next[q] = "";
                  }
                  set("custom_answers", next);
                }}
                style={{ fontSize:ts(12), border:`1px dashed ${theme.border}`,
                         background:theme.bg, color:theme.textMuted, cursor:"pointer",
                         borderRadius:8, padding:"6px 12px" }}>
                + Add the 5 commonly-asked questions
              </button>
            )}
          </div>
        </PSec>
        </>}

        {on("resumes") && <>
        {/* ── Job Profiles ── */}
        <PSec title="Job Profiles" theme={theme}>
          {/* D112 e2: a profile made from a résumé — the same wizard, everything filled. */}
          <RefineJobProfile profiles={profiles} activeId={activeProfileId} onRefined={() => loadProfiles()} />
          {/* ⭐ D186-3 (owner 11-09): the dead end ("Active profile: None selected · Open Job Profiles") is gone — the pipeline
              makes the job profile from the first résumé; here is its name, a switch between profiles and the manual section. */}
          <div data-active-job-profile={activeProfile ? activeProfile.id : "none"} style={{ fontSize:ts(12), color:theme.textMuted, marginBottom:16, display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
            {activeProfile
              ? <>Active job profile: <strong style={{ color:theme.text }}>{activeProfile.profile_name}</strong>
                  {profiles.length > 1 && (
                    <select aria-label="Switch job profile" value={activeProfileId || ""} onChange={(e) => activateProfile(Number(e.target.value))}
                      data-switch-job-profile="" style={{ font:"inherit", fontSize:ts(12), padding:"3px 6px", borderRadius:6, border:`1px solid ${theme.border}`, background:theme.bg, color:theme.text }}>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={onOpenJobProfiles} data-manage-job-profiles=""
                    style={{ font:"inherit", fontSize:ts(12), padding:"3px 8px", borderRadius:6, border:`1px solid ${theme.border}`, background:"transparent", color:theme.text, cursor:"pointer" }}>Manage</button></>
              : <>No job profile yet — upload your résumé on Your profile and one is made for you. Or <button type="button" onClick={onOpenJobProfiles}
                  style={{ font:"inherit", fontSize:ts(12), padding:0, border:"none", background:"transparent", color:theme.text, textDecoration:"underline", cursor:"pointer" }}>make one by hand</button>.</>}
          </div>
          <div style={{ display:"none", flexWrap:"wrap", gap:10, marginBottom:16 }}>
            {profiles.map(profile => (
              <button
                key={profile.id}
                type="button"
                onClick={() => activateProfile(profile.id)}
                style={{
                  padding:"10px 12px",
                  borderRadius:10,
                  border:`1px solid ${profile.id === activeProfileId ? theme.accent : theme.border}`,
                  background: profile.id === activeProfileId ? "color-mix(in srgb, var(--color-primary) 13%, transparent)" : theme.bg,
                  color: theme.text,
                  cursor:"pointer",
                  minWidth:160,
                  textAlign:"left",
                }}
              >
                <div style={{ fontSize:ts(13), fontWeight:700 }}>{profile.profile_name}</div>
                <div style={{ fontSize:ts(11), color:theme.textMuted, marginTop:4 }}>
                  {profile.seniority} · {profile.has_base_resume ? "resume linked" : "resume missing"}
                </div>
              </button>
            ))}
            {profiles.length < 4 && (
              <button
                type="button"
                onClick={onOpenJobProfiles}
                style={{
                  padding:"10px 14px",
                  borderRadius:10,
                  border:`1px dashed ${theme.border}`,
                  background:theme.bg,
                  color:theme.textMuted,
                  cursor:"pointer",
                  fontWeight:700,
                }}
              >
                + Add / Edit Profiles
              </button>
            )}
          </div>
          <button type="button" className="rm-btn rm-btn-primary" onClick={onOpenJobProfiles}>
            Open Job Profiles
          </button>

          {!activeProfile && (
            <div style={{ fontSize:ts(12), color:theme.textMuted }}>
              Create a job profile to connect a profile-specific base resume, extracted signals, titles, and search settings.
            </div>
          )}

          {false && activeProfile && profileForm && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <PRow label="Profile Name" theme={theme}>
                  <input className="rm-input" value={profileForm.profile_name}
                    onChange={e => setProfileForm(f => ({ ...f, profile_name: e.target.value }))}/>
                </PRow>
                {/* THE SENIORITY SELECT IS DELETED, not repointed at the registry.
                    It was four hardcoded <option> values inside a `{false && ...}` block — dead
                    code carrying its own copy of a vocabulary, which is exactly how the four
                    earlier divergences hid. Deriving it from shared/jobFilterOptions.js's
                    PROFILE_SENIORITY was the alternative and is ceremony: this form does not
                    render, and a control nobody can reach does not need correct options, it needs
                    to not exist. The vocabulary is single-sourced where it is LIVE — see
                    DomainProfileWizard, which reads PROFILE_SENIORITY now. If this editor is ever
                    revived, it derives from there too. */}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <PRow label="Role Family" theme={theme}>
                  <input className="rm-input" value={profileForm.role_family}
                    onChange={e => setProfileForm(f => ({ ...f, role_family: e.target.value }))}/>
                </PRow>
                <PRow label="Domain Key" theme={theme}>
                  <input className="rm-input" value={profileForm.domain}
                    onChange={e => setProfileForm(f => ({ ...f, domain: e.target.value }))}/>
                </PRow>
              </div>
              <PRow label="Target Titles" theme={theme}>
                <textarea className="rm-input" rows={3} value={profileForm.target_titles}
                  onChange={e => setProfileForm(f => ({ ...f, target_titles: e.target.value }))}
                  placeholder="Software Engineer, Backend Engineer, Platform Engineer"/>
                <PHint theme={theme}>Comma-separated. These titles shape search query variants and profile fit.</PHint>
              </PRow>
              <PRow label="Keywords" theme={theme}>
                <textarea className="rm-input" rows={3} value={profileForm.selected_keywords}
                  onChange={e => setProfileForm(f => ({ ...f, selected_keywords: e.target.value }))}
                  placeholder="distributed systems, APIs, cloud infrastructure"/>
              </PRow>
              <PRow label="Action Verbs" theme={theme}>
                <textarea className="rm-input" rows={2} value={profileForm.selected_verbs}
                  onChange={e => setProfileForm(f => ({ ...f, selected_verbs: e.target.value }))}
                  placeholder="Built, Designed, Automated"/>
              </PRow>
              <PRow label="Tools / Skills" theme={theme}>
                <textarea className="rm-input" rows={2} value={profileForm.selected_tools}
                  onChange={e => setProfileForm(f => ({ ...f, selected_tools: e.target.value }))}
                  placeholder="Node.js, React, PostgreSQL, AWS"/>
              </PRow>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:ts(12), color:profileStatus ? theme.text : theme.textMuted }}>
                  {profileStatus || "Edit this profile any time. Changes affect only this profile."}
                </span>
                <button type="button" className="rm-btn rm-btn-primary" onClick={saveProfileSettings}>
                  Save Job Profile
                </button>
              </div>
            </>
          )}
        </PSec>

        {activeProfile && (
          <PSec title="Profile Resume and Signals" theme={theme}>
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf"
              onChange={uploadResumePdf}
              style={{ display:"none" }}
            />
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
              <button type="button" className="rm-btn rm-btn-primary"
                onClick={() => resumeInputRef.current?.click()}>
                {uploadingResume ? "Parsing PDF..." : "Upload / Replace PDF"}
              </button>
              <button type="button" className="rm-btn"
                onClick={saveResume}
                style={{ border:`1px solid ${theme.border}`, background:theme.surfaceHigh, color:theme.text }}>
                Save Resume Text
              </button>
              <button type="button" className="rm-btn"
                onClick={refreshSignals}
                style={{ border:`1px solid ${theme.border}`, background:theme.surfaceHigh, color:theme.text }}>
                Refresh Extracted Signals
              </button>
            </div>
            <PRow label="Resume File Name" theme={theme}>
              <input className="rm-input" value={resumeName}
                onChange={e => setResumeName(e.target.value)}
                placeholder="resume.pdf"/>
            </PRow>
            <PRow label="Profile Base Resume" theme={theme}>
              <textarea className="rm-input" rows={10} value={resumeDraft}
                onChange={e => setResumeDraft(e.target.value)}
                placeholder="Upload a profile-specific PDF or paste resume text here."/>
              <PHint theme={theme}>This base resume belongs only to the selected profile and drives profile-specific ATS/search behavior.</PHint>
            </PRow>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
              <div style={{ fontSize:ts(12), color:theme.textMuted }}>
                {enhancementStatus.eligible
                  ? `Enhancement ready: ${enhancementStatus.selectedCount}/${enhancementStatus.threshold} ATS-backed additions selected.`
                  : `Select at least ${enhancementStatus.threshold} broadly useful ATS suggestions before enhancing this profile resume.`}
              </div>
              {enhancementStatus.eligible && (
                <button
                  type="button"
                  className="rm-btn rm-btn-primary"
                  onClick={runEnhancement}
                  disabled={enhancingProfileResume}
                >
                  {enhancingProfileResume ? "Enhancing..." : "Enhance Base Resume"}
                </button>
              )}
            </div>
            <div style={{ fontSize:ts(12), color:resumeStatus ? theme.text : theme.textMuted, marginBottom:16 }}>
              {loadingProfileAssets ? "Loading profile resume..." : (resumeStatus || "Each profile keeps its own stored resume and extracted signal set.")}
            </div>

            {enhancePreview && (
              <div style={{
                border:`1px solid ${theme.border}`,
                borderRadius:12,
                padding:"14px 16px",
                marginBottom:16,
                background:theme.surfaceHigh,
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", marginBottom:10, flexWrap:"wrap" }}>
                  <div style={{ fontSize:ts(13), fontWeight:700, color:theme.text }}>
                    Enhanced draft ready
                  </div>
                  <div style={{ fontSize:ts(12), color:theme.textMuted }}>
                    ATS delta: {enhancePreview.delta > 0 ? "+" : ""}{enhancePreview.delta ?? 0}
                  </div>
                </div>
                <div style={{ fontSize:ts(11), color:theme.textMuted, marginBottom:10 }}>
                  Selected additions: {(enhancePreview.selectedSkills || []).join(", ") || "No new additions"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <textarea className="rm-input" rows={8} readOnly value={enhancePreview.original?.text || ""} />
                  <textarea className="rm-input" rows={8} readOnly value={enhancePreview.enhanced?.text || ""} />
                </div>
                <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
                  <button type="button" className="rm-btn" onClick={() => setEnhancePreview(null)}
                    style={{ border:`1px solid ${theme.border}`, background:theme.surface, color:theme.text }}>
                    Dismiss
                  </button>
                  <button type="button" className="rm-btn rm-btn-primary" onClick={adoptEnhancedResume}>
                    Adopt Enhanced Resume
                  </button>
                </div>
              </div>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <PRow label="Citizenship / Status" theme={theme}>
                <input className="rm-input" value={structuredFactsForm.citizenshipStatus}
                  onChange={e => setStructuredFactsForm(f => ({ ...f, citizenshipStatus: e.target.value }))}
                  placeholder="U.S. citizen, permanent resident, etc." />
              </PRow>
              <PRow label="Work Authorization" theme={theme}>
                <input className="rm-input" value={structuredFactsForm.workAuthorization}
                  onChange={e => setStructuredFactsForm(f => ({ ...f, workAuthorization: e.target.value }))}
                  placeholder="Authorized to work without sponsorship" />
              </PRow>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:ts(13), color:theme.text }}>
                <input type="checkbox" checked={!!structuredFactsForm.requiresSponsorship}
                  onChange={e => setStructuredFactsForm(f => ({ ...f, requiresSponsorship: e.target.checked }))}/>
                Requires sponsorship
              </label>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:ts(13), color:theme.text }}>
                <input type="checkbox" checked={!!structuredFactsForm.hasClearance}
                  onChange={e => setStructuredFactsForm(f => ({ ...f, hasClearance: e.target.checked }))}/>
                Active clearance
              </label>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
              <PRow label="Clearance Level" theme={theme}>
                <input className="rm-input" value={structuredFactsForm.clearanceLevel}
                  onChange={e => setStructuredFactsForm(f => ({ ...f, clearanceLevel: e.target.value }))}
                  placeholder="Secret, TS/SCI, Public Trust" />
              </PRow>
              <PRow label="Degree Level" theme={theme}>
                <input className="rm-input" value={structuredFactsForm.degreeLevel}
                  onChange={e => setStructuredFactsForm(f => ({ ...f, degreeLevel: e.target.value }))}
                  placeholder="Bachelor's, Master's, PhD" />
              </PRow>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <PRow label="Titles — from your résumé (re-extracting replaces edits)" theme={theme}>
                <textarea className="rm-input" rows={3} value={signalsForm.titles}
                  onChange={e => setSignalsForm(f => ({ ...f, titles: e.target.value }))}/>
              </PRow>
              <PRow label="Years of Experience" theme={theme}>
                <input className="rm-input" type="number" min="0" max="50" value={signalsForm.yearsExperience}
                  onChange={e => setSignalsForm(f => ({ ...f, yearsExperience: e.target.value }))}/>
              </PRow>
            </div>
            {/* ⭐ A140 (owner 11-08): no separate Keywords / Skills sections — both are drawn bold in "Your experience" above
                (or listed under it). They still rank the board's jobs, so they stay editable here, folded. */}
            <details data-signal-terms-edit="" style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: ts(12), color: theme.textMuted, cursor: "pointer", marginBottom: 10 }}>
                Edit the skills and keywords read from your résumé</summary>
            <PRow label="Keywords — from your résumé" theme={theme}>
              <textarea className="rm-input" rows={4} value={signalsForm.keywords}
                onChange={e => setSignalsForm(f => ({ ...f, keywords: e.target.value }))}/>
            </PRow>
            <PRow label="Skills / tools — from your résumé" theme={theme}>
              <textarea className="rm-input" rows={3} value={signalsForm.skills}
                onChange={e => setSignalsForm(f => ({ ...f, skills: e.target.value }))}/>
            </PRow>
            </details>
            <div style={{ marginBottom:16 }}>
              <div style={{ ...labelStyle, color:theme.textMuted, marginBottom:8 }}>Inactive ATS-Suggested Skills</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {(suggestedSignals.inactiveSkills || []).length === 0 && (
                  <span style={{ fontSize:ts(12), color:theme.textMuted }}>
                    ATS suggestions will appear here after enough scraped jobs surface recurring missing skills.
                  </span>
                )}
                {(suggestedSignals.inactiveSkills || []).map(skill => (
                  <button className="dbx-depth"
                    key={skill.key}
                    type="button"
                    onClick={() => toggleSuggestedSkill(skill.key, true)}
                    style={{
                      border:`1px dashed ${theme.border}`,
                      background:theme.bg,
                      color:theme.text,
                      padding:"6px 10px",
                      cursor:"pointer",
                      fontSize:ts(12),
                    }}
                  >
                    + {skill.label} ({skill.frequency})
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ ...labelStyle, color:theme.textMuted, marginBottom:8 }}>Inactive ATS-Suggested Action Verbs</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {(suggestedSignals.inactiveActionVerbs || []).length === 0 && (
                  <span style={{ fontSize:ts(12), color:theme.textMuted }}>
                    Missing action verbs clicked from ATS cards will appear here as inactive profile suggestions.
                  </span>
                )}
                {(suggestedSignals.inactiveActionVerbs || []).map(verb => (
                  <span
                    key={verb.key}
                    style={{
                      border:`1px dashed ${theme.border}`,
                      background:theme.bg,
                      color:theme.text,
                      borderRadius:6,
                      padding:"6px 10px",
                      fontSize:ts(12),
                    }}
                  >
                    {verb.label} ({verb.frequency})
                  </span>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ ...labelStyle, color:theme.textMuted, marginBottom:8 }}>Selected For Enhancement</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {(suggestedSignals.selectedSkills || []).length === 0 && (
                  <span style={{ fontSize:ts(12), color:theme.textMuted }}>
                    Pick broadly useful ATS suggestions here. Enhancement unlocks when you reach the threshold.
                  </span>
                )}
                {(suggestedSignals.selectedSkills || []).map(skill => (
                  <button className="dbx-depth"
                    key={skill.key}
                    type="button"
                    onClick={() => toggleSuggestedSkill(skill.key, false)}
                    style={{
                      border:`1px solid ${theme.accent}`,
                      background:"color-mix(in srgb, var(--color-primary) 13%, transparent)",
                      color:theme.text,
                      padding:"6px 10px",
                      cursor:"pointer",
                      fontSize:ts(12),
                    }}
                  >
                    ✓ {skill.label}
                  </button>
                ))}
              </div>
              <PHint theme={theme}>
                Structured ATS facts stay separate from skill suggestions. They should be edited in the profile facts fields above.
              </PHint>
            </div>
            {(suggestedSignals.structuredFacts || []).length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ ...labelStyle, color:theme.textMuted, marginBottom:8 }}>Structured ATS Facts Seen In Target Jobs</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {(suggestedSignals.structuredFacts || []).map(item => (
                    <span key={item.key} style={{
                      border:`1px solid ${theme.border}`,
                      borderRadius:6,
                      padding:"6px 10px",
                      fontSize:ts(12),
                      color:theme.textMuted,
                      background:theme.surface,
                    }}>
                      {item.label} ({item.frequency})
                    </span>
                  ))}
                </div>
              </div>
            )}
            <PRow label="Search Terms" theme={theme}>
              <textarea className="rm-input" rows={2} value={signalsForm.searchTerms}
                onChange={e => setSignalsForm(f => ({ ...f, searchTerms: e.target.value }))}/>
              <PHint theme={theme}>draft searches for these words and matches your jobs on them — for this job profile only.</PHint>
            </PRow>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:ts(12), color:signalStatus ? theme.text : theme.textMuted }}>
                {signalStatus || suggestionStatus || "Edit extracted values when needed. They persist per profile and do not leak across profiles."}
              </span>
              <button type="button" className="rm-btn rm-btn-primary" onClick={saveSignals}>
                Save Extracted Signals
              </button>
            </div>
            {enhancementHistory.length > 0 && (
              <div style={{ marginTop:16, fontSize:ts(12), color:theme.textMuted }}>
                {enhancementHistory.length} enhancement version{enhancementHistory.length === 1 ? "" : "s"} stored for this profile.
              </div>
            )}
          </PSec>
        )}
        </>}

        {(on("about") || on("answers")) && (
        <div data-profile-savebar="" style={{ display:"flex", justifyContent:"flex-end", alignItems:"center",
                      gap:14, marginTop:8, position:"sticky", bottom:0, zIndex:1, padding:"10px 0",
                      background:theme.bg }}>
          {unsaved && !status && <span style={{ fontSize:ts(12), color:theme.textMuted }}>Unsaved changes</span>}
          {status && (
            <span style={{ fontSize:ts(12),
              color:status.startsWith("✓") ? theme.success : theme.danger }}>
              {status}
            </span>
          )}
          <button type="submit" className="rm-btn rm-btn-primary"
            style={{ padding:"10px 28px", fontSize:ts(14) }}>
            Save Profile
          </button>
        </div>
        )}
      </form>
      {false && showProfileWizard && (
        <DomainProfileWizard
          onComplete={(profile) => {
            setShowProfileWizard(false);
            loadProfiles().then(() => setActiveProfileId(profile?.id || null));
          }}
          onDismiss={() => setShowProfileWizard(false)}
        />
      )}
    </div>
  );
}
