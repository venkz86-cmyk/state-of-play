import { useState, useEffect } from 'react';
import { TenCoverStack } from '../components/TenCoverStack';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';
import { trialUpgradePricing } from '../lib/octoberPricing';

const datelineDate = (d = new Date()) =>
  d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// The day a month bought today ends: trial_tracking.TRIAL_DAYS (30) on.
const TRIAL_DAYS = 30;
const monthEndsOn = (d = new Date()) =>
  new Date(d.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

// Three beats, Venkat's copy (proofread).
const TRACK = [
  ['Day 1', 'You start reading', 'The ten most recent paid stories open the moment you pay.'],
  ['During the month', 'One story a week', 'One comes out most Fridays, so that’s four new stories in most months.'],
  ['Day 30', 'The ten stay', 'Stories published during your month close. The original ten don’t.'],
];


// Two questions; the renewal and comparison answers live under the
// button and in "If it's for you" (Venkat's copy, proofread).
const FAQS = [
  ['What happens to my ten stories after 30 days?', 'They stay in your account for good, even if you never subscribe. Subscribe and the stories published since you joined open again, along with the rest of the archive.'],
  ['Can I upgrade before the 30 days are up?', 'Yes, any time before your month ends. Sign in with the account you joined with and the upgrade is on this page.'],
];

// Some live payment methods (UPI/netbanking redirect flows on mobile, in
// particular) take the browser through a full top-level navigation and
// back, rather than staying inside Checkout's in-page iframe -- when that
// happens, the confirmation state RazorpayCheckoutButton's `handler`
// sets in memory is lost the moment the tab reloads, and a real buyer can
// land back on this page with the payment succeeded but no confirmation
// ever shown. This key persists just enough (email + a short TTL) to
// redisplay the same "You're in" panel across that reload, without
// needing any backend change -- start_trial() is already idempotent per
// email and the welcome email already went out regardless of what this
// page renders.
const JUST_PAID_KEY = 'tsop_trial_just_paid';
const JUST_PAID_TTL_MS = 30 * 60 * 1000; // 30 minutes -- long enough to cover a slow redirect round trip, short enough not to stick around on a later, unrelated visit

const readPersistedJustPaidEmail = () => {
  try {
    const raw = window.sessionStorage.getItem(JUST_PAID_KEY);
    if (!raw) return null;
    const { email, ts } = JSON.parse(raw);
    if (!email || !ts || Date.now() - ts > JUST_PAID_TTL_MS) {
      window.sessionStorage.removeItem(JUST_PAID_KEY);
      return null;
    }
    return email;
  } catch (_e) {
    return null; // private-mode/storage-blocked -- just skip the restore
  }
};

const persistJustPaidEmail = (email) => {
  try {
    window.sessionStorage.setItem(JUST_PAID_KEY, JSON.stringify({ email, ts: Date.now() }));
  } catch (_e) {
    /* private-mode/storage-blocked -- confirmation just won't survive a reload */
  }
};

export const TrialMockup = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  // The "Start with The Ten" lines on the paywall, the homepage and
  // /signup link here with ?via=, so the Sources panel can tell them apart.
  const trialSource = {
    paywall: 'trial-via-paywall', home: 'trial-via-home', signup: 'trial-via-signup',
  }[searchParams.get('via')] || 'trial-page';
  const pricing = useGeoPricing();
  const isIndia = pricing.country === 'IN';
  // Prices stay hidden until the reader's country is known, so ₹ never
  // flashes before $ on a first visit (useGeoPricing remembers it after).
  const priceHidden = pricing.loading ? 'invisible' : '';
  const checkoutCountry = isIndia ? 'IN' : 'INTL';
  const [justPaidEmail, setJustPaidEmail] = useState(null);
  const [justUpgraded, setJustUpgraded] = useState(false);

  useEffect(() => {
    const restored = readPersistedJustPaidEmail();
    if (restored) setJustPaidEmail(restored);
  }, []);

  return (
    <MockupLayout testId="mockup-trial" seo={{ title: 'The Ten', path: '/trial', image: 'https://www.stateofplay.club/og/trial.png', description: 'Ten of The State of Play’s most recent stories on the business of Indian sport, for ₹590. Stay the month and everything new is yours too.' }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Bengaluru · {datelineDate()}</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)] tabular-nums">The Ten</span>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-16 pb-16 lg:grid lg:grid-cols-12 lg:gap-12 lg:items-start">
        <div className="lg:col-span-6">
        <Overline className="mb-4 block">The State of Play</Overline>
        <h1 className="font-editorial font-semibold tracking-tight text-[2.4rem] md:text-[3.5rem] leading-[1.05] mb-6 max-w-[16ch]">
          Ten stories.<br />Thirty days.<br /><em className={`italic font-normal ${priceHidden}`}>{isIndia ? '₹500.' : '$9.'}</em>
        </h1>
        <p className="font-plex text-lg text-[var(--text-muted)] leading-relaxed max-w-[54ch] mb-8">
          Read The State of Play's ten most recent paid stories on the business of Indian sport, from franchise valuations to ownership fights. While your month runs, every new story is yours too.
        </p>

        {justPaidEmail ? (
          <div data-testid="trial-checkout-success" className="max-w-[480px] border border-[var(--rule)] p-6">
            <p className="font-editorial font-medium text-lg mb-2">You're in.</p>
            {user?.email ? (
              <p className="font-plex text-[15px] text-[var(--text-muted)] leading-relaxed">
                Your ten stories are unlocked. Reloading your account now so your session picks up the change.
              </p>
            ) : (
              <p className="font-plex text-[15px] text-[var(--text-muted)] leading-relaxed">
                A welcome note is on its way to {justPaidEmail}. Sign in with that same email to start reading.
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
              {!user?.email && (
                <a href="/login" className="font-plex text-sm text-[var(--accent-burgundy)] underline underline-offset-4">
                  Sign in
                </a>
              )}
              <a href="/" className="font-plex text-sm text-[var(--accent-burgundy)] underline underline-offset-4">
                Start reading
              </a>
            </div>
          </div>
        ) : (
          <div className="border-t border-[var(--rule)] pt-8 max-w-[520px]">
            <div className={`flex items-end gap-3 ${isIndia ? 'mb-2' : 'mb-6'} ${priceHidden}`}>
              <span className="font-editorial font-semibold text-[2.75rem] leading-[0.9] text-[var(--text)]">{isIndia ? '₹500' : '$9'}</span>
              <span className="font-plex text-base text-[var(--text-muted)] pb-1">{isIndia ? '+ 18% GST' : 'one-time'}</span>
            </div>
            {isIndia && (
              <p className={`font-plex text-[13px] text-[var(--text-label)] mb-6 ${priceHidden}`}>₹590 total</p>
            )}
            <RazorpayCheckoutButton
              source={trialSource}
              plan="trial"
              country={checkoutCountry}
              buttonLabel="Start The Ten"
              dataTestId="trial-checkout"
              className="max-w-[520px] mb-4"
              lockedEmail={user?.email}
              disclosureText={`One payment. Nothing renews. Pay today and your month runs to ${monthEndsOn()}.`}
              onSuccess={(paidEmail) => {
                setJustPaidEmail(paidEmail);
                persistJustPaidEmail(paidEmail);
                // A logged-in reader's session was fetched before this
                // payment happened, so it still reads their pre-trial
                // tier. A full reload re-runs AuthContext's bootstrap
                // from scratch against the now-updated Ghost labels,
                // rather than needing a separate manual session-refresh
                // path that doesn't exist yet.
                if (user?.email) {
                  setTimeout(() => { window.location.href = '/account'; }, 1500);
                }
              }}
            />
            <p className="font-plex text-sm text-[var(--text-muted)] flex flex-wrap gap-x-5 gap-y-2">
              <a href="mailto:venkat@stateofplay.club?subject=The%20Ten" data-testid="trial-write" className="underline underline-offset-4 hover:text-[var(--text)] transition-colors">
                Questions? Write to me.
              </a>
              <a href="#compare" className="underline underline-offset-4 hover:text-[var(--text)] transition-colors">
                Compare with the annual membership
              </a>
            </p>
          </div>
        )}
        <div className="lg:hidden"><TenCoverStack variant="row" /></div>
        </div>
        <div className="hidden lg:block lg:col-span-6 lg:pt-10">
          <TenCoverStack />
        </div>
      </section>

      {/* How the month works */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-8">How the month works</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8" data-testid="trial-track">
            {TRACK.map(([day, title, desc], i) => (
              <div key={day} className="border-l-2 pl-4" style={{ borderColor: i === 0 ? 'var(--accent-burgundy)' : 'var(--rule)' }}>
                <p className="font-plex text-xs tracking-[0.1em] uppercase text-[var(--text-label)] tabular-nums mb-2">{day}</p>
                <h3 className="font-editorial font-medium text-xl leading-snug mb-1.5">{title}</h3>
                <p className="font-plex text-[15px] leading-relaxed text-[var(--text-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* If it's for you */}
      <section id="compare" className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12 scroll-mt-24">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-6">If it's for you</p>
          <div className={`max-w-[62ch] space-y-3 ${priceHidden}`} data-testid="trial-compare">
            <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text)]">
              {isIndia
                ? 'If you’d rather have the whole year, it’s ₹3,499 + GST. Upgrade before your thirty days end and it’s ₹2,999 + GST for thirteen months.'
                : 'If you’d rather have the whole year, it’s $169. Upgrade before your thirty days end and it’s $160 for thirteen months.'}
            </p>
            <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">
              The Ten has no comments or nominating other readers; the annual membership does.
            </p>
          </div>
          <p className="font-plex text-sm text-[var(--text-muted)] mt-8">
            The Left Field briefing is free whether you subscribe or not.
          </p>

          {/* The upgrade checkout only works for a signed-in trial member,
              so only they see it. A signed-out member gets a way in.
              Nothing renders until the session check finishes, so a trial
              member never sees the sign-in line flash first. */}
          {!authLoading && (user?.tier === 'trial' || !user) && (
          <div className="mt-10 border-t border-[var(--rule)] pt-8 max-w-[520px]">
            {!user ? (
              <p className="font-plex text-[15px] text-[var(--text-muted)]" data-testid="trial-upgrade-signin">
                <span className="font-editorial font-medium text-lg text-[var(--text)]">Already in The Ten?</span>{' '}
                <a href="/login" className="text-[var(--accent-burgundy)] underline underline-offset-4">Sign in to upgrade.</a>
              </p>
            ) : justUpgraded ? (
              <p className="font-plex text-[15px] text-[var(--text-muted)]">
                You're upgraded. Reloading your account now…
              </p>
            ) : (
              <>
                <p className="font-editorial font-medium text-lg mb-1">Already in The Ten?</p>
                <p className="font-plex text-sm text-[var(--text-muted)] mb-4">
                  {trialUpgradePricing(isIndia).blurb}
                </p>
                <RazorpayCheckoutButton
                  source="trial-upgrade-page"
                  plan="trial-upgrade"
                  country={isIndia ? 'IN' : 'INTL'}
                  buttonLabel="Upgrade to annual"
                  dataTestId="trial-upgrade-checkout"
                  lockedEmail={user?.email}
                  disclosureText={trialUpgradePricing(isIndia).disclosure}
                  onSuccess={() => {
                    setJustUpgraded(true);
                    setTimeout(() => { window.location.href = '/account'; }, 1500);
                  }}
                />
              </>
            )}
          </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-8">Before you start</p>
          <ul>
            {FAQS.map(([q, a]) => (
              <li key={q} className="py-6 border-b border-[var(--rule)]">
                <p className="font-editorial font-medium text-lg leading-snug mb-2">{q}</p>
                <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed max-w-[65ch]">{a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Close */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-xl mb-4">Ten stories. Thirty days. See if it is for you.</p>
          <p className="font-plex text-base text-[var(--text-muted)] max-w-[55ch] mb-6">
            And if it is not for you, no hard feelings. The Left Field keeps coming, free, every Monday and Wednesday.
          </p>
          <p className="font-editorial italic text-lg">Venkat</p>
        </div>
      </section>
    </MockupLayout>
  );
};

export default TrialMockup;
