// Opened from the home screen (iPhone: Add to Home Screen; Android:
// installed). Decided once at start-up; the app can't change modes
// without being reopened. index.js marks <html class="app-mode"> so CSS
// can adjust for the notch, the home bar and the bottom tab bar.
export const IS_APP_MODE = typeof window !== 'undefined' && (
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  || window.navigator.standalone === true
);

// The bottom tab bar's tabs; every other page shows a back arrow.
export const TAB_ROOTS = ['/', '/left-field', '/search', '/you'];
