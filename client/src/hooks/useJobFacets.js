import { useEffect, useRef, useState } from "react";
import { loadFacets } from "../lib/jobFacets.js";

// D24: the facets answer for the board's current querystring, fetched only while a panel that shows
// counts is open. Keyed on the querystring, so pressing an option refetches; an answer that arrives
// after a newer request started is dropped (the same staleness rule fetchJobs keeps).
//
// While a refetch is in flight the PREVIOUS answer stays on screen with status "loading" — counts
// that jump to blank and back on every press read as broken, and the previous answer is a true
// statement about the previous board.
// D51: `nonce` re-reads the same querystring — a Draft or an Undo moves the /d count without a reload.
export function useJobFacets(qs, enabled, fetchImpl, nonce = 0) {
  const [state, setState] = useState({ status: "idle", data: null });
  const seq = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    setState(s => ({ status: "loading", data: s.data }));
    loadFacets(qs, fetchImpl).then(next => {
      if (mine === seq.current) setState(next);
    });
  }, [qs, enabled, fetchImpl, nonce]);
  return state;
}
