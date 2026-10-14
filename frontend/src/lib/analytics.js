// Google Analytics events (GA4, loaded in public/index.html). Every event
// also carries app_mode ('app' for the home-screen app, 'web' for the
// website) and platform ('ios', 'android', 'desktop'), set once in
// index.html, so the app can be told apart from the website in every
// report. Analytics never blocks or breaks what the reader is doing.
export const track = (name, params = {}) => {
  try { if (window.gtag) window.gtag('event', name, params); } catch (e) { /* never in the way */ }
};
