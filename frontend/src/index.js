import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { IS_APP_MODE } from "@/lib/appMode";
import { track } from "@/lib/analytics";

// Home-screen app (lib/appMode.js): mark it for CSS, and let the page use
// the full screen so it can sit clear of the notch and the home bar.
if (IS_APP_MODE) {
  document.documentElement.classList.add('app-mode');
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

// Analytics for the app (lib/analytics.js): an open per visit, a tap on a
// notification (its link carries ?source=push), and an install. Only
// Android reports installs (app_install), so app_first_open, sent the first
// time the app opens on a phone, counts them on iPhone and Android alike
// (the home-screen app keeps its own storage, apart from the browser's).
if (IS_APP_MODE) {
  try {
    if (!localStorage.getItem('tsop_app_first_open')) {
      localStorage.setItem('tsop_app_first_open', new Date().toISOString());
      track('app_first_open');
    }
  } catch (e) { /* storage blocked: no install count */ }
  try {
    if (!sessionStorage.getItem('tsop_app_open')) {
      sessionStorage.setItem('tsop_app_open', '1');
      track('app_open');
    }
  } catch (e) { track('app_open'); }
}
if (new URLSearchParams(window.location.search).get('source') === 'push') {
  const path = window.location.pathname;
  track('notification_open', {
    kind: path.startsWith('/left-field') ? 'left_field' : path.startsWith('/mixed-zone') ? 'mixed_zone' : 'story',
    path,
  });
}
window.addEventListener('appinstalled', () => track('app_install'));

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Lets the site be installed and receive notifications for new stories
// (public/sw.js). It caches nothing, so pages always load fresh.
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
