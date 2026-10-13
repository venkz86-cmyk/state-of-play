import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { IS_APP_MODE } from "@/lib/appMode";

// Home-screen app (lib/appMode.js): mark it for CSS, and let the page use
// the full screen so it can sit clear of the notch and the home bar.
if (IS_APP_MODE) {
  document.documentElement.classList.add('app-mode');
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

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
