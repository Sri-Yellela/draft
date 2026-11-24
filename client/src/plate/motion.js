// ⭐ D196 R3 · motion: one looping animation per component, all of it off under prefers-reduced-motion.
// The CSS classes in plate/plate.css stop themselves; SMIL <animate> cannot be stopped by CSS, so a drawing
// renders its <animate> only when this says motion is allowed (draw-on shows the finished line instead).
import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/** true = motion allowed. Starts from the media query (no flash of motion), follows it if it changes. */
export function usePlateMotion() {
  const [motion, setMotion] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(QUERY);
    const on = () => setMotion(!mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return motion;
}
