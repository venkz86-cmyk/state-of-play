// Which Left Field editions this reader has opened in the app, so the tab
// can mark a new one. Kept in this browser only; losing it just shows the
// marker again.
const KEY = 'tsop_lf_read';
const API = process.env.REACT_APP_BACKEND_URL;

export const readSlugs = () => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); }
};

export const markRead = (slug) => {
  if (!slug) return;
  try {
    const all = [slug, ...[...readSlugs()].filter((s) => s !== slug)].slice(0, 60);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) { /* private mode */ }
  window.dispatchEvent(new Event('lf-read'));
};

// The newest edition's slug, at most once every 10 minutes.
let cache = { at: 0, slug: null };
export const latestSlug = async () => {
  if (Date.now() - cache.at < 10 * 60 * 1000) return cache.slug;
  try {
    const r = await fetch(`${API}/api/left-field/editions?page=0`);
    const d = await r.json();
    cache = { at: Date.now(), slug: d.editions?.[0]?.slug || null };
  } catch (e) { /* offline: no marker */ }
  return cache.slug;
};
