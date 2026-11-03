// ⭐ D136 (owner 11-02) · THIS WEEK'S BEST BETS — the top of the board: the few postings on the user's own board most
// likely to lead to a real conversation, each with its band and its reasons (GET /api/best-bets, services/bestBets.js).
//
// ⛔ A ranked score built from signals, never a probability — the band (Best bet · Good bet · Long shot) and the reasons
// are what is said. Default 5; the user sets 3–20 (Auto settings' bestBets, the same store the picks read). The rest of
// the board is one press away. Information only: opening a bet opens the same posting panel as the board's card.
import { useEffect, useState, useCallback } from "react";
import { useTheme } from "../styles/theme.jsx";
import { api } from "../lib/api.js";
import { markStyle } from "../styles/mark.js";
import { C } from "../styles/colorTokens.js";
import { SHORTLIST_MIN, SHORTLIST_MAX } from "../../../shared/bestBets.js";

const BAND_COLOUR = { best: C.SUCCESS, good: C.INFO, long: C.WARNING };
const SIZES = Array.from({ length: SHORTLIST_MAX - SHORTLIST_MIN + 1 }, (_, i) => SHORTLIST_MIN + i);

export default function BestBets({ onOpen, normalize = (j) => j, refreshKey = null }) {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setError(""); setData(await api("/api/best-bets")); }
    catch (e) { setError(e.message || "Best bets could not be loaded."); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function setSize(n) {
    setSaving(true);
    try {
      const { settings } = await api("/api/apply/auto-settings");
      await api("/api/apply/auto-settings", { method: "PUT", body: JSON.stringify({ settings: { ...settings, bestBets: n } }) });
      await load();
    } catch (e) { setError(e.message || "Not saved — try again."); }
    finally { setSaving(false); }
  }

  if (!data && !error) return null;
  if (data && !data.bets?.length) {
    // Nothing scored yet: say so, rather than rank on freshness alone.
    return data.reason === "scoring"
      ? <div data-best-bets="scoring" style={{ margin: "10px 16px 4px", fontSize: 12, color: theme.textMuted }}>This week's best bets appear as your matches are scored.</div>
      : null;
  }
  const box = { margin: "10px 16px 4px", padding: "10px 12px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface };

  if (!shown) {
    return (
      <div data-best-bets="collapsed" style={{ ...box, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>This week's best bets</span>
        <button type="button" onClick={() => setShown(true)}
          style={{ marginLeft: "auto", fontSize: 11, background: "none", border: `1px solid ${theme.border}`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", color: theme.text }}>
          Show {data?.bets?.length ?? ""}
        </button>
      </div>
    );
  }

  return (
    <section data-best-bets="" style={box} aria-label="This week's best bets">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: theme.text }}>This week's best bets</h2>
        <span style={{ fontSize: 11, color: theme.textMuted }}
          title="Ranked from signals: fit against the must-haves, your level, how new the posting is, whether it looks like a real opening, and how often the company closes roles. Not a probability.">
          ranked from signals, not a probability
        </span>
        <label style={{ marginLeft: "auto", fontSize: 11, color: theme.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
          Show
          <select value={data.size} disabled={saving} onChange={(e) => setSize(Number(e.target.value))} data-best-bets-size=""
            style={{ fontSize: 11, borderRadius: 4, border: `1px solid ${theme.border}`, background: "transparent", color: theme.text, padding: "2px 4px" }}>
            {SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {error && <div style={{ fontSize: 11, color: C.DANGER, marginTop: 6 }}>{error}</div>}
      <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
        {data.bets.map(({ job, bestBet }) => {
          const j = normalize(job);
          return (
            <li key={j.jobId ?? j.id} data-best-bet={bestBet.band}>
              <button type="button" onClick={() => onOpen?.(j)}
                style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", alignItems: "center", width: "100%",
                  textAlign: "left", background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 4, padding: "6px 8px", cursor: "pointer", color: theme.text }}>
                <span style={markStyle(BAND_COLOUR[bestBet.band])}>{bestBet.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {j.title} · {j.company}
                </span>
                <span />
                <span style={{ fontSize: 11, color: theme.textMuted }}>{bestBet.reasons.join(" · ")}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={() => setShown(false)} data-best-bets-all=""
          style={{ fontSize: 11, background: "none", border: "none", cursor: "pointer", color: theme.accentText ?? theme.text, textDecoration: "underline" }}>
          See all {data.matches} matches
        </button>
      </div>
    </section>
  );
}
