import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';

const API = process.env.REACT_APP_BACKEND_URL;

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

// The other half of GiftMockup.js's code path: someone with a
// stateofplay.club/gift/redeem?code=... link claims it here with
// their own email. Same loading/invalid-code pattern TeamsManage.js
// uses for its own ?token=.

export const GiftRedeemMockup = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  const [loading, setLoading] = useState(() => !!code);
  const [fatal, setFatal] = useState(() => (code ? null : 'invalid'));
  const [gift, setGift] = useState(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading
  const [error, setError] = useState('');
  const [redeemed, setRedeemed] = useState(null);

  useEffect(() => {
    if (!code || !API) return undefined;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/gifts/subscription/${encodeURIComponent(code)}`);
        if (!res.ok) {
          if (active) setFatal('invalid');
          return;
        }
        const data = await res.json();
        if (!active) return;
        if (data.status === 'redeemed') {
          setFatal('redeemed');
        } else {
          setGift(data);
        }
      } catch (e) {
        console.error('gift/redeem load failed:', e);
        if (active) setFatal('network');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [code]);

  const redeem = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setStatus('loading');
    try {
      const res = await fetch(`${API}/api/gifts/subscription/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: trimmedEmail, name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not redeem this gift. Please try again.');
      }
      const body = await res.json().catch(() => ({}));
      setRedeemed(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setStatus('idle');
    }
  };

  if (loading) {
    return (
      <MockupLayout testId="page-gift-redeem-loading" hideFooterHeroCta>
        <div className="max-w-[480px] mx-auto px-6 py-32 text-center">
          <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading…</p>
        </div>
      </MockupLayout>
    );
  }

  if (fatal) {
    const messages = {
      invalid: 'This gift link isn’t valid. If you think this is a mistake, write to venkat@stateofplay.club.',
      redeemed: 'This gift has already been claimed.',
      network: 'Something went wrong loading this link. Please try again.',
    };
    return (
      <MockupLayout testId="page-gift-redeem-invalid" hideFooterHeroCta>
        <div className="max-w-[480px] mx-auto px-6 py-32 text-center">
          <p className="font-editorial font-medium text-xl mb-3">Not quite.</p>
          <p className="font-plex text-[14px] text-[var(--text-muted)] leading-relaxed">{messages[fatal]}</p>
        </div>
      </MockupLayout>
    );
  }

  return (
    <MockupLayout testId="page-gift-redeem" hideFooterHeroCta seo={{ title: 'Claim Your Gift', path: '/gift/redeem' }}>
      <div className="max-w-[480px] mx-auto px-6 py-20 lg:py-28">
        <Overline className="!normal-case !tracking-normal !text-sm mb-4">Gift subscription</Overline>
        <h1 className="font-editorial font-semibold tracking-tight text-[28px] leading-[1.1] mb-6">
          {redeemed ? (
            <>You're in.</>
          ) : (
            <>{gift?.buyer_name || 'Someone'} gave you a year of <em className="italic font-normal">The State of Play.</em></>
          )}
        </h1>

        {redeemed ? (
          <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed" data-testid="gift-redeem-success">
            {redeemed.already_subscribed
              ? `You already subscribe, so a year has been added on top of your current membership. Sign in with ${email} whenever you're ready.`
              : `Every weekly story, the Left Field briefing, and the full archive are yours now. Sign in with ${email} whenever you're ready.`}
          </p>
        ) : (
          <>
            {gift?.personal_note && (
              <p className="font-plex text-base italic text-[var(--text-muted)] border-l-2 border-[var(--accent-burgundy)] pl-4 mb-8">
                “{gift.personal_note}”
              </p>
            )}
            <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed mb-8">
              Already paid for — just tell us where to set up your account.
            </p>

            <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Your name</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="gift-redeem-name"
              className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 mb-5 focus:outline-none focus:border-[var(--accent-burgundy)]"
            />

            <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Your email</p>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              placeholder="you@yourdomain.com"
              disabled={status === 'loading'}
              data-testid="gift-redeem-email"
              className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 mb-6 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
            />

            <button
              type="button"
              onClick={redeem}
              disabled={status === 'loading'}
              data-testid="gift-redeem-submit"
              className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200 disabled:opacity-60"
              style={{ borderRadius: 'var(--control-radius)' }}
            >
              {status === 'loading' ? 'Claiming…' : 'Claim your year'}
            </button>
            {error && (
              <p className="font-plex text-sm text-[var(--accent-burgundy)] mt-3" data-testid="gift-redeem-error">{error}</p>
            )}
          </>
        )}
      </div>
    </MockupLayout>
  );
};

export default GiftRedeemMockup;
