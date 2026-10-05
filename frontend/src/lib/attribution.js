// Where a visitor came from, for the admin dashboard's Sources view.
//
// Links shared outside the site carry a ?ref= tag (e.g. ?ref=linkedin).
// The first one a visitor arrives with is kept for 30 days in their own
// browser and sent along with any sign-up or checkout, together with the
// page they first landed on. Nothing leaves the browser except to our
// own server, and only at the moment someone signs up or pays.
const KEY = 'tsop_first_ref';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const read = () => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.ts || Date.now() - saved.ts > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return saved;
  } catch (_e) {
    return null;
  }
};

// Called on every page view. Keeps the first tag, so a later visit from
// a different link doesn't overwrite where someone originally came from.
export const captureRef = (search, pathname) => {
  try {
    const params = new URLSearchParams(search);
    const ref = params.get('ref') || params.get('utm_source');
    if (!ref || read()) return;
    window.localStorage.setItem(KEY, JSON.stringify({ ref, landing: pathname, ts: Date.now() }));
  } catch (_e) {
    /* storage blocked: the sign-up is still recorded, just without a ref */
  }
};

// The fields every sign-up and checkout request adds to its body.
export const attributionFields = (source) => {
  const saved = read();
  return {
    source: source || '',
    ref: saved?.ref || '',
    landing: saved?.landing || '',
  };
};
