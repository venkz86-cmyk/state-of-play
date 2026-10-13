// Phone notifications for new stories (backend push.py, public/sw.js).
import { authHeader } from './sessionToken';

const API = process.env.REACT_APP_BACKEND_URL;

export const isStandalone = () =>
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const registration = async () => {
  const reg = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  return reg;
};

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

// Must be called straight from a tap: iPhone only shows the permission
// question in direct response to one.
export async function turnOn() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'blocked' : 'dismissed');
  const reg = await registration();
  const { key } = await fetch(`${API}/api/push/key`).then((r) => r.json());
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  const { endpoint, keys } = sub.toJSON();
  const res = await fetch(`${API}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ endpoint, keys }),
  });
  if (!res.ok) throw new Error('server');
}

export async function turnOff() {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch(`${API}/api/push/unsubscribe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}
