import { useEffect, useState } from 'react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { isStandalone, isIOS, isAndroid, pushSupported, currentSubscription, turnOn, turnOff, getPrefs, setPref, mixedZoneEligible } from '../lib/push';

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

const btn = 'inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-12 px-8 transition-colors disabled:opacity-60';

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
    try { setPrefs(await setPref(name, value)); } catch (e) {
      setPrefs((p) => ({ ...p, [name]: !value }));
      setMessage('That didn’t save. Try again in a minute.');
    }
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice && choice.outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  };

  const enable = async () => {
    setBusy(true); setMessage('');
    try {
      await turnOn();
      setOn(true);
      setMessage('Notifications are on. You’ll get the next story here.');
    } catch (e) {
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
    setOn(false); setMessage('Notifications are off.'); setBusy(false);
  };

  const iosNeedsInstall = ios && !installed;

  return (
    <MockupLayout testId="mockup-app" seo={{ title: 'On your phone', path: '/app', description: 'Add The State of Play to your phone and get each new story as a notification.' }}>
      <div className="max-w-[720px] mx-auto px-6 lg:px-0 pt-10 lg:pt-14 pb-20">
        {/* In the app it's installed already, so this is just the settings. */}
        {installed ? (
          <>
            <div className="border-b border-[var(--rule)] pb-3 mb-8"><Overline>Settings</Overline></div>
            <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.1] mb-3" data-testid="app-heading">Notifications</h1>
            <p className="font-plex text-[15px] text-[var(--text-muted)] mb-8">You choose what you get.</p>
          </>
        ) : (
          <>
            <Overline className="!normal-case !tracking-normal !text-sm block mb-4">On your phone</Overline>
            <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.1] mb-4" data-testid="app-heading">The State of Play, on your home screen.</h1>
            <p className="font-reading text-[18px] leading-[1.6] text-[var(--text-muted)] mb-10 max-w-[56ch]">
              Add it to your phone and each new story reaches you as a notification when it’s published.
              You choose what you get.
            </p>
          </>
        )}

        {iosNeedsInstall && (
          <section className="border-t border-[var(--rule)] pt-6 mb-10" data-testid="app-ios-steps">
            <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-4">On iPhone</p>
            <ol className="font-plex text-[16px] leading-[1.6] space-y-3 list-decimal pl-5">
              <li>In Safari, tap the Share button, then <strong>Add to Home Screen</strong>.</li>
              <li>Open State of Play from your home screen and come back to this page to turn on notifications.</li>
            </ol>
          </section>
        )}

        {!ios && !installed && (installEvent || android) && (
          <section className="border-t border-[var(--rule)] pt-6 mb-10" data-testid="app-install">
            {android && <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-4">On Android</p>}
            {installEvent ? (
              <button type="button" className={btn} onClick={install} data-testid="app-install-button">Install the app</button>
            ) : (
              // Samsung Internet and Firefox never offer Chrome's install
              // prompt, and Chrome holds it back for a while once dismissed.
              <ol className="font-plex text-[16px] leading-[1.6] space-y-3 list-decimal pl-5" data-testid="app-android-steps">
                <li>In Chrome, tap the menu (⋮), then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Open State of Play from your home screen and come back to this page to turn on notifications.</li>
              </ol>
            )}
          </section>
        )}

        {!iosNeedsInstall && (
          <section className={installed ? '' : 'border-t border-[var(--rule)] pt-6'} data-testid="app-notifications">
            {!installed && <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-4">Notifications</p>}
            {!canPush ? (
              <p className="font-plex text-[15px] text-[var(--text-muted)]">
                This browser can’t show notifications. Open stateofplay.club/app on your phone.
              </p>
            ) : on ? (
              <div data-testid="app-push-choices">
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
              <button type="button" className={btn} onClick={enable} disabled={busy} data-testid="app-push-on">
                {busy ? 'Turning on…' : 'Turn on notifications'}
              </button>
            )}
          </section>
        )}
        {message && <p className="font-plex text-[14px] mt-4" role="status" data-testid="app-message">{message}</p>}
      </div>
    </MockupLayout>
  );
};

export default AppMockup;
