// client/src/pages/atlas/yourRunModel.js — ⭐ D172 (3) · Your run's words and links, pure (the numbers are the server's,
// services/atlas/points.js — never re-derived here).

/** The run's sentences: "Level 2: Building blocks" · "340 of 530 points to Level 3" · "4-day streak" · "Today · about 3 minutes". */
export function runLines(run) {
  const lv = run.level;
  const minutes = (run.quests || []).filter(q => !q.done).reduce((a, q) => a + (q.minutes || 0), 0);
  return {
    level: `Level ${lv.n}: ${lv.name}`,
    next: lv.next ? `${run.total} of ${lv.next.at} points to Level ${lv.next.n}` : `${run.total} points · the top level`,
    streak: run.streak ? "day streak" : "prove something today to start a streak",
    today: minutes ? `Today · about ${minutes} minute${minutes === 1 ? "" : "s"}` : "Today",
  };
}

/** Where a quest starts: the Learn piece for an idea to explain; the skill's own quick check for a check. */
export function questHref(base, q) {
  if (q.id === "explain") return `${base}/learn#step-${encodeURIComponent(q.stepId)}`;
  if (q.id === "prove") return `${base}/your-skills?prove=${encodeURIComponent(q.skill)}`;
  // ⭐ A154 (45o): the daily question and one deck.
  // ⭐ 47m (D203 (3)): today's question is the Today card on Your map now (/todays-question forwards there)
  if (q.id === "today") return `${base}/your-map#today`;
  if (q.id === "deck") return `${base}/library/${encodeURIComponent(q.deckId)}`;
  return base;
}
