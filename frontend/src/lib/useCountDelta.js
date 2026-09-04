import { useEffect, useRef, useState } from 'react';

// "If 2 have increased, show 2" -- a small per-viewer memory of the last
// count seen for a given metric (localStorage, same pattern as
// adminSessionToken.js), so a KPI tile can show "+2 since last visit"
// instead of just a static total. Single-admin tool, so per-browser
// state is the right scope -- no backend involved, nothing to keep in
// sync across viewers.
export function useCountDelta(storageKey, currentValue) {
  const [delta, setDelta] = useState(null);
  const recorded = useRef(false);

  useEffect(() => {
    if (currentValue == null || recorded.current) return;
    recorded.current = true;
    try {
      const prevRaw = localStorage.getItem(storageKey);
      const prev = prevRaw != null ? parseInt(prevRaw, 10) : null;
      if (prev != null && !Number.isNaN(prev) && currentValue > prev) {
        setDelta(currentValue - prev);
      }
      localStorage.setItem(storageKey, String(currentValue));
    } catch (_e) {
      /* private mode / storage blocked -- just skip the delta */
    }
  }, [storageKey, currentValue]);

  return delta;
}

export default useCountDelta;
