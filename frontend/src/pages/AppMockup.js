import { useEffect, useState } from 'react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { isStandalone, isIOS, pushSupported, currentSubscription, turnOn, turnOff } from '../lib/push';

/* /app: install the site on a phone and turn on notifications for new
   stories (lib/push.js). What it shows depends on the phone: iPhone needs
   the site on the Home Screen before it can notify; Android can install
   from a prompt and notify straight from the browser. */
const btn = 'inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-12 px-8 transition-colors disabled:opacity-60';

export const AppMockup = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ios = isIOS();
  const canPush = pushSupported();

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    currentSubscription().then((s) => setOn(Boolean(s) && Notification.permission === 'granted')).catch(() => {});
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

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
        <Overline className="!normal-case !tracking-normal !text-sm block mb-4">On your phone</Overline>
        <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.1] mb-4">The State of Play, on your home screen.</h1>
        <p className="font-reading text-[18px] leading-[1.6] text-[var(--text-muted)] mb-10 max-w-[56ch]">
          Add it to your phone and each new story reaches you as a notification when it’s published.
          One notification per story, nothing else.
        </p>

        {iosNeedsInstall && (
          <section className="border-t border-[var(--rule)] pt-6 mb-10" data-testid="app-ios-steps">
            <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-4">On iPhone</p>
            <ol className="font-plex text-[16px] leading-[1.6] space-y-3 list-decimal pl-5">
              <li>In Safari, tap the Share button, then <strong>Add to Home Screen</strong>.</li>
              <li>Open State of Play from your home screen and come back to this page to turn on notifications.</li>
            </ol>
          </section>
        )}

        {!ios && !installed && installEvent && (
          <section className="border-t border-[var(--rule)] pt-6 mb-10" data-testid="app-install">
            <button type="button" className={btn} onClick={install} data-testid="app-install-button">Install the app</button>
          </section>
        )}

        {!iosNeedsInstall && (
          <section className="border-t border-[var(--rule)] pt-6" data-testid="app-notifications">
            <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-4">Notifications</p>
            {!canPush ? (
              <p className="font-plex text-[15px] text-[var(--text-muted)]">
                This browser can’t show notifications. Open stateofplay.club/app on your phone.
              </p>
            ) : on ? (
              <div className="flex flex-wrap items-center gap-6">
                <p className="font-plex text-[15px]">Notifications are on for this phone.</p>
                <button type="button" onClick={disable} disabled={busy} data-testid="app-push-off"
                  className="font-plex text-[14px] text-[var(--text-muted)] underline underline-offset-4">Turn off</button>
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
