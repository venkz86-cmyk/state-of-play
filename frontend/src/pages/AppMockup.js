import { useEffect, useState } from 'react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { track } from '../lib/analytics';
import { APP_QR_PATH, APP_QR_SIZE } from '../lib/appQr';
import { isStandalone, isIOS, isAndroid, iosBrowser, inAppBrowser, pushSupported, currentSubscription, turnOn, turnOff, getPrefs, setPref, mixedZoneEligible } from '../lib/push';

/* /app: install the site on a phone and turn on notifications for new
   stories (lib/push.js). What it shows depends on the phone: iPhone needs
   the site on the Home Screen before it can notify; Android can install
   from a prompt and notify straight from the browser. */
// One choice, as a row with a switch.
const Choice = ({ title, desc, on, onChange, disabled, testId }) => (
  <li className="border-b border-[var(--rule)]">
    <label className="flex items-center justify-between gap-6 py-4 cursor-pointer">
      <span>
        <span className="block font-plex text-[16px] font-medium">{title}</span>
        <span className="block font-plex text-[13px] text-[var(--text-muted)] mt-0.5">{desc}</span>
      </span>
      <input type="checkbox" role="switch" className="sr-only peer" checked={on} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span aria-hidden="true"
        className="relative shrink-0 h-7 w-12 rounded-full bg-[var(--rule)] peer-checked:bg-[var(--accent-burgundy)] transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:h-[22px] after:w-[22px] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--accent-ink)]" />
    </label>
  </li>
);

const btn = 'inline-flex items-center justify-center btn-cta disabled:opacity-60';

const label = 'font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-4';
const quietBtn = 'inline-flex items-center justify-center border border-[var(--text)] text-[var(--text)] hover:bg-[var(--text)] hover:text-[var(--bg)] font-plex btn-type h-12 px-8 transition-colors disabled:opacity-60';

// The icons a reader has to find on their phone, drawn inline so the step
// shows exactly what to look for.
const Glyph = ({ name, label: text }) => (
  <span className="whitespace-nowrap">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="inline-block align-[-3px] mr-1"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {name === 'share' && (<><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M8 10H6v11h12V10h-2" /></>)}
      {name === 'menu' && (<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>)}
      {name === 'kebab' && (<><circle cx="12" cy="5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="19" r="1.2" fill="currentColor" /></>)}
      {name === 'dots' && (<><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></>)}
    </svg>
    <strong>{text}</strong>
  </span>
);

// The same last two steps on both phones: open the app, then the bell is
// Menu › Notifications (components/AppMenu.js).
const LastSteps = () => (
  <>
    <li>Open <strong>State of Play</strong> from your home screen.</li>
    <li>Tap <Glyph name="menu" label="Menu" /> at the top right, then <strong>Notifications</strong> › <strong>Turn on notifications</strong>.</li>
  </>
);

const IPhoneSteps = ({ browser, nested }) => (
  <section className={nested ? 'mt-4' : 'border-t border-[var(--rule)] pt-6 mb-6'} data-testid={nested ? 'app-ios-steps-other' : 'app-ios-steps'}>
    {!nested && <p className={label}>On iPhone</p>}
    <ol className="font-plex text-[16px] leading-[1.7] space-y-3 list-decimal pl-5">
      {browser === 'Chrome' && <li>Tap <Glyph name="share" label="Share" /> in Chrome’s address bar, then <strong>Add to Home Screen</strong>.</li>}
      {browser === 'other' && <li>Tap your browser’s <Glyph name="share" label="Share" /> button, then <strong>Add to Home Screen</strong>. If it isn’t there, open this page in Safari.</li>}
      {browser === 'Safari' && <li>In Safari, tap <Glyph name="share" label="Share" /> at the bottom of the screen, then <strong>Add to Home Screen</strong>.</li>}
      <LastSteps />
    </ol>
  </section>
);

const AndroidSteps = ({ installEvent, onInstall, nested }) => (
  <section className={nested ? 'mt-4' : 'border-t border-[var(--rule)] pt-6 mb-6'} data-testid={nested ? 'app-android-other' : 'app-install-android'}>
    {!nested && <p className={label}>On Android</p>}
    {installEvent ? (
      <>
        <button type="button" className={btn} onClick={onInstall} data-testid="app-install-button">Install the app</button>
        <ol start={2} className="font-plex text-[16px] leading-[1.7] space-y-3 list-decimal pl-5 mt-5"><LastSteps /></ol>
      </>
    ) : (
      // Samsung Internet and Firefox never offer Chrome's install prompt,
      // and Chrome holds it back for a while once dismissed.
      <>
        <ol className="font-plex text-[16px] leading-[1.7] space-y-3 list-decimal pl-5" data-testid="app-android-steps">
          <li>In Chrome, tap <Glyph name="kebab" label="Menu" /> at the top right, then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <LastSteps />
        </ol>
        <p className="font-plex text-[14px] text-[var(--text-muted)] mt-4">Using Samsung Internet? Tap its menu, then Add page to › Home screen.</p>
      </>
    )}
  </section>
);

export const AppMockup = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [prefs, setPrefs] = useState(null);
  const [mzEligible, setMzEligible] = useState(false);
  const ios = isIOS();
  const android = isAndroid();
  const inApp = inAppBrowser();
  const browser = ios ? iosBrowser() : null;
  const platform = ios ? 'ios' : android ? 'android' : 'desktop';
  const canPush = pushSupported();

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    currentSubscription().then((s) => setOn(Boolean(s) && Notification.permission === 'granted')).catch(() => {});
    mixedZoneEligible().then(setMzEligible);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (on) getPrefs().then((p) => p && setPrefs(p)).catch(() => {});
  }, [on]);

  const choose = async (name, value) => {
    setPrefs((p) => ({ ...p, [name]: value }));
    track('push_pref', { name, on: value });
    try { setPrefs(await setPref(name, value)); } catch (e) {
      setPrefs((p) => ({ ...p, [name]: !value }));
      setMessage('That didn’t save. Try again in a minute.');
    }
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    track('app_install_prompt', { outcome: choice ? choice.outcome : 'unknown' });
    if (choice && choice.outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  };

  const enable = async () => {
    setBusy(true); setMessage('');
    try {
      await turnOn();
      setOn(true);
      track('push_on', { result: 'on' });
      setMessage('Notifications are on for this phone.');
    } catch (e) {
      track('push_on_failed', { result: e.message || 'error' });
      setMessage(e.message === 'blocked'
        ? 'Notifications are blocked for this site. Allow them in your phone’s settings, then try again.'
        : e.message === 'dismissed' ? '' : 'That didn’t work. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    await turnOff().catch(() => {});
    track('push_off');
    setOn(false); setMessage('Notifications are off.'); setBusy(false);
  };

  const iosNeedsInstall = ios && !installed;
  const device = platform === 'desktop' ? 'computer' : 'phone';
  const showsSteps = !installed && (inApp || ios || android || platform === 'desktop');
  useEffect(() => {
    if (showsSteps) track('app_install_steps_view', { platform, browser: inApp || browser || (android ? 'android' : '') });
  }, [showsSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Turning notifications on from a browser that isn't the installed app:
  // fine on Android and on a computer; an iPhone needs the app first.
  const notifySection = !iosNeedsInstall && canPush && (
    <section className={installed ? '' : 'border-t border-[var(--rule)] pt-6 mt-10'} data-testid="app-notifications">
      {!installed && (
        <>
          <p className={label}>{platform === 'desktop' ? 'On this computer' : 'Or skip installing'}</p>
          <p className="font-plex text-[15px] leading-[1.6] text-[var(--text-muted)] mb-5 max-w-[56ch]">
            {platform === 'desktop'
              ? 'You can also get them as notifications on this computer.'
              : 'You can turn on notifications in this browser without adding it to your home screen.'}
            {!on && ' Once they’re on, you choose which ones you get.'}
          </p>
        </>
      )}
      {on ? (
        <div data-testid="app-push-choices">
          <p className="font-plex text-[15px] text-[var(--text-muted)] mb-2">Choose which ones you get.</p>
          <ul className="border-t border-[var(--rule)]">
            <Choice title="New stories" desc="When a story is published" testId="app-pref-stories"
              on={prefs ? prefs.stories : true} disabled={!prefs} onChange={(v) => choose('stories', v)} />
            <Choice title="The Left Field" desc="Each new edition, twice a week" testId="app-pref-left-field"
              on={prefs ? prefs.left_field : true} disabled={!prefs} onChange={(v) => choose('left_field', v)} />
            {mzEligible && (
              <Choice title="Mixed Zone notes" desc="New notes, and when one is confirmed" testId="app-pref-mixed-zone"
                on={prefs ? prefs.mixed_zone : true} disabled={!prefs} onChange={(v) => choose('mixed_zone', v)} />
            )}
          </ul>
          <button type="button" onClick={disable} disabled={busy} data-testid="app-push-off"
            className="mt-5 font-plex text-[14px] text-[var(--text-muted)] underline underline-offset-4">Turn off all notifications</button>
        </div>
      ) : (
        <button type="button" className={installed ? btn : quietBtn} onClick={enable} disabled={busy} data-testid="app-push-on">
          {busy ? 'Turning on…' : 'Turn on notifications'}
        </button>
      )}
    </section>
  );

  return (
    <MockupLayout testId="mockup-app" seo={{ title: 'On your phone', path: '/app', image: 'https://www.stateofplay.club/og/app.png', description: 'Add The State of Play to your phone and get a notification when a story is published or a new edition of The Left Field is out.' }}>
      <div className="max-w-[720px] mx-auto px-6 lg:px-0 pt-10 lg:pt-14 pb-20">
        {/* In the app it's installed already, so this is just the settings. */}
        {installed ? (
          <>
            <div className="border-b border-[var(--rule)] pb-3 mb-8"><Overline>Settings</Overline></div>
            <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.1] mb-3" data-testid="app-heading">Notifications</h1>
            {!on && <p className="font-plex text-[15px] text-[var(--text-muted)] mb-8">Turn them on, then choose which ones you get.</p>}
            {canPush ? notifySection : (
              <p className="font-plex text-[15px] text-[var(--text-muted)]">This phone can’t show notifications from the app. Update it to the latest iOS, then try again.</p>
            )}
          </>
        ) : (
          <>
            <Overline className="!normal-case !tracking-normal !text-sm block mb-4">On your phone</Overline>
            <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.1] mb-4" data-testid="app-heading">The State of Play, on your home screen.</h1>
            <p className="font-reading text-[18px] leading-[1.6] text-[var(--text-muted)] mb-10 max-w-[56ch]">
              Add it to your phone and get a notification when a story is published or a new edition of The Left Field is out.
            </p>

            {inApp && (
              <section className="border-t border-[var(--rule)] pt-6 mb-10" data-testid="app-in-app-browser">
                <p className={label}>Open it in {ios ? 'Safari' : 'Chrome'} first</p>
                <p className="font-plex text-[16px] leading-[1.6]">
                  {inApp}’s own browser can’t add sites to your home screen. Tap <Glyph name="dots" label="the menu" /> and open this page in {ios ? 'Safari' : 'Chrome'}, then follow the steps there.
                </p>
              </section>
            )}

            {platform === 'desktop' && (
              <section className="border-t border-[var(--rule)] pt-6 mb-10 flex flex-col sm:flex-row gap-6 sm:items-center" data-testid="app-desktop">
                <svg viewBox={`-2 -2 ${APP_QR_SIZE + 4} ${APP_QR_SIZE + 4}`} width="148" height="148" role="img" aria-label="QR code for stateofplay.club/app"
                  className="shrink-0 bg-[var(--bg)] text-[var(--text)]" shapeRendering="crispEdges">
                  <path d={APP_QR_PATH} fill="currentColor" />
                </svg>
                <div>
                  <p className={label}>This is for your phone</p>
                  <p className="font-plex text-[16px] leading-[1.6] max-w-[44ch]">
                    Point your phone’s camera at the code to open this page there, then follow the steps for your phone below.
                  </p>
                </div>
              </section>
            )}

            {!inApp && (ios || platform === 'desktop') && <IPhoneSteps browser={browser || 'Safari'} />}
            {!inApp && (android || platform === 'desktop') && (
              <AndroidSteps installEvent={android ? installEvent : null} onInstall={install} />
            )}

            {/* The other kind of phone, folded away. */}
            {!inApp && ios && (
              <details className="mt-6 font-plex text-[15px]" data-testid="app-other-android">
                <summary className="cursor-pointer text-[var(--text-muted)] underline underline-offset-4">Using an Android phone?</summary>
                <AndroidSteps installEvent={null} onInstall={install} nested />
              </details>
            )}
            {!inApp && android && (
              <details className="mt-6 font-plex text-[15px]" data-testid="app-other-iphone">
                <summary className="cursor-pointer text-[var(--text-muted)] underline underline-offset-4">Using an iPhone?</summary>
                <IPhoneSteps browser="Safari" nested />
              </details>
            )}

            {/* A computer's browser offering to install the app (Chrome, Edge). */}
            {platform === 'desktop' && installEvent && (
              <section className="border-t border-[var(--rule)] pt-6 mt-10" data-testid="app-install">
                <p className={label}>On this computer</p>
                <p className="font-plex text-[15px] leading-[1.6] text-[var(--text-muted)] mb-5 max-w-[56ch]">Your browser can add The State of Play as an app on this computer too.</p>
                <button type="button" className={quietBtn} onClick={install} data-testid="app-install-button">Install on this computer</button>
              </section>
            )}

            {notifySection}
          </>
        )}
        {message && <p className="font-plex text-[14px] mt-4" role="status" data-testid="app-message">{message.replace('this phone', `this ${device}`)}</p>}
      </div>
    </MockupLayout>
  );
};

export default AppMockup;
