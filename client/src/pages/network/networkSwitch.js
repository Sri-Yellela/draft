// ⭐ 46f · is the network on? Feed and Messages ask before drawing anything: off (the default, counsel-gated — A169) →
// "This isn't available yet."; any failure reads as off, never as an empty feed or inbox. null = still asking.
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

export function useNetworkOn() {
  const [on, setOn] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/network/status").then(r => { if (live) setOn(!!r?.enabled); }).catch(() => { if (live) setOn(false); });
    return () => { live = false; };
  }, []);
  return on;
}
