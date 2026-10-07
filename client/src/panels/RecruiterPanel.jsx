import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import { StackSection, OrgSection, HiringSection, SponsorshipSection } from "../components/CompanyKbSections.jsx";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import { glass } from "../styles/glass.js";
import { TYPE } from "../styles/type.js";

const STATUS_COPY = {
  consistent: { label: "Consistent", color: C.SUCCESS, bg: C.SUCCESS_QUIET },
  flagged:    { label: "Flagged inconsistency", color: C.DANGER, bg: C.DANGER_QUIET },
  no_claim:   { label: "No claim to check", color: C.INK_FAINT, bg: "var(--color-surface-offset)" },
};

function CompanyKbCard({ company, theme }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!company) { setProfile(null); return; }
    let cancelled = false;
    setLoading(true); setError("");
    api(`/api/company/${encodeURIComponent(company)}`)
      .then(d => { if (!cancelled) setProfile(d); })
      .catch(e => { if (!cancelled) setError(e.message || "Could not load company data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [company]);

  if (!company) return null;
  return (
    <section style={{ ...glass({ radius: 20 }), padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={TYPE.CARD_TITLE}>
        {company} — KB Reference
      </div>
      {loading && <div style={{ fontSize: 12, color: theme.textMuted }}>Loading…</div>}
      {error && !loading && (
        <div style={{ background: C.DANGER_QUIET, color: C.DANGER, borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
          {error}
        </div>
      )}
      {!loading && !error && profile && !profile.hasData && (
        <div style={{ fontSize: 12, color: theme.textMuted }}>Not enough data on {company} yet.</div>
      )}
      {!loading && !error && profile?.hasData && (
        <>
          <StackSection stack={profile.stack} postings={profile.stackPostings} theme={theme} />
          <OrgSection orgUnits={profile.orgUnits} total={profile.orgUnitsTotal} theme={theme} />
          <HiringSection signal={profile.hiringSignal} theme={theme} />
          <SponsorshipSection lca={profile.lca} theme={theme} />
        </>
      )}
    </section>
  );
}

function ConsistencyCheckCard({ company, theme }) {
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    if (!company || !resumeText.trim()) return;
    setChecking(true); setError(""); setResult(null);
    try {
      const d = await api(`/api/company/${encodeURIComponent(company)}/consistency-check`, {
        method: "POST",
        body: JSON.stringify({ resumeText }),
      });
      setResult(d);
    } catch (e) {
      setError(e.message || "Could not run the consistency check.");
    } finally {
      setChecking(false);
    }
  };

  if (!company) return null;
  const statusCopy = result ? STATUS_COPY[result.status] : null;

  return (
    <section style={{ ...glass({ radius: 20 }), padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 400,
          fontSize: 21, color: theme.text }}>
          Candidate-Claim Consistency Check
        </div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4, lineHeight: 1.5 }}>
          Paste a candidate's resume text below. This checks whether their {company} claims
          cohere with {company}'s public job-posting KB above — it is advisory evidence, not a
          verdict on the person, and nothing pasted here is stored.
        </div>
      </div>
      <textarea
        value={resumeText}
        onChange={e => setResumeText(e.target.value)}
        rows={8}
        placeholder={`Paste the candidate's resume text here (checked against ${company})...`}
        style={{ width: "100%", borderRadius: 12, border: `1px solid ${C.BORDER_CONTROL}`,
                 background: C.SURFACE_INPUT, color: theme.text, fontSize: 13,
                 padding: "8px 10px", resize: "vertical", fontFamily: "inherit",
                 outline: "none", boxSizing: "border-box" }}
      />
      <button onClick={runCheck} disabled={checking || !resumeText.trim()}
        className="rm-btn rm-btn-primary" style={{ alignSelf: "flex-start" }}>
        {checking ? "Checking…" : "Check consistency"}
      </button>
      {error && (
        <div style={{ background: C.DANGER_QUIET, color: C.DANGER, borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
          {error}
        </div>
      )}
      {result && statusCopy && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...markStyle(statusCopy.color), alignSelf: "flex-start" }}>
            {statusCopy.label}
          </span>
          {result.findings.map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: theme.text, background: theme.surfaceHigh,
                                   border: `1px solid ${theme.border}`, borderRadius: 6, padding: "8px 10px" }}>
              {f.message}
              {f.evidence?.length > 0 && (
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                  {f.evidence.join(" ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RecruiterPanel() {
  const { theme } = useTheme();
  const location = useLocation();
  const [companyInput, setCompanyInput] = useState("");
  const [activeCompany, setActiveCompany] = useState("");

  // Deep-linked from a job card's company (JobCard.jsx) via /app/recruiter?company=X.
  useEffect(() => {
    const fromQuery = new URLSearchParams(location.search).get("company");
    if (fromQuery) { setCompanyInput(fromQuery); setActiveCompany(fromQuery); }
  }, [location.search]);

  const load = () => setActiveCompany(companyInput.trim());

  return (
    // A53: no glass sheet under the page — the leather is the substrate; the two cards are glass.
    <div style={{ flex: 1, overflowY: "auto", background: "transparent", padding: "28px 24px 44px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 style={TYPE.PAGE_TITLE}>
            Recruiter
          </h1>
          <div style={{ ...TYPE.LEAD, marginTop: 10, maxWidth: 560 }}>
            Companies and roles only — a KB reference and candidate-claim consistency aid, not a
            background-check or identity-linked service. No individual dossiers are built or
            stored here.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={companyInput}
            onChange={e => setCompanyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
            placeholder="Company name (e.g. Figma)"
            // An input's edge is a UI boundary: BORDER_CONTROL reaches 3:1, BORDER does not.
            style={{ flex: 1, minWidth: 0, border: `1px solid ${C.BORDER_CONTROL}`, borderRadius: 12,
                     background: C.SURFACE_INPUT, color: theme.text, fontSize: 13,
                     padding: "10px 16px", outline: "none" }}
          />
          <button onClick={load} disabled={!companyInput.trim()} className="rm-btn rm-btn-primary">
            Load
          </button>
        </div>

        <CompanyKbCard company={activeCompany} theme={theme} />
        <ConsistencyCheckCard company={activeCompany} theme={theme} />

        {!activeCompany && (
          <div style={{ fontSize: 12, color: theme.textMuted, textAlign: "center", padding: "40px 0" }}>
            Enter a company to load its KB reference and run a consistency check.
          </div>
        )}
      </div>
    </div>
  );
}
