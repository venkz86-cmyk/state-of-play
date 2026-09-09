import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';

const API = process.env.REACT_APP_BACKEND_URL;

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

// A code is 8 chars from gift_subscriptions.py's _CODE_CHARSET, shown
// as XXXX-XXXX -- lightly reformatted as the visitor types so typing
// it in lowercase, without the dash, or with stray spaces (reading it
// off a printed card, say) all still work. The backend normalizes
// again on its own side regardless -- this is just so the box doesn't
// look broken while they're mid-type.
const formatCodeInput = (raw) => {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
};

// The other half of GiftMockup.js's code path: someone with a
// stateofplay.club/gift/redeem?code=... link (or just the bare code,
// off an email or a card) claims it here with their own email. Same
// loading/invalid-code pattern TeamsManage.js uses for its own
// ?token=, plus a manual code-entry fallback for whoever wasn't
// handed a clickable link.

export const GiftRedeemMockup = () => {
  const [searchParams] = useSearchParams();
  const urlCode = searchParams.get('code');

  const [activeCode, setActiveCode] = useState(urlCode || null);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');

  const [loading, setLoading] = useState(() => !!urlCode);
  const [fatal, setFatal] = useState(null);
  const [gift, setGift] = useState(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading
  const [error, setError] = useState('');
  const [redeemed, setRedeemed] = useState(null);

  const lookupCode = async (codeToLookup) => {
    if (!API) return;
    setLoading(true);
    setFatal(null);
    try {
      const res = await fetch(`${API}/api/gifts/subscription/${encodeURIComponent(codeToLookup)}`);
      if (!res.ok) {
        setFatal('invalid');
        setActiveCode(null);
        return;
      }
      const data = await res.json();
      if (data.status === 'redeemed') {
        setFatal('redeemed');
        setActiveCode(null);
      } else {
        setGift(data);
        setActiveCode(codeToLookup);
      }
    } catch (e) {
      console.error('gift/redeem load failed:', e);
      setFatal('network');
      setActiveCode(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlCode) lookupCode(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  const submitManualCode = () => {
    const cleaned = manualCode.replace(/-/g, '');
    if (cleaned.length !== 8) {
      setManualError('Codes are 8 characters, like K7M2-P9QX.');
      return;
    }
    setManualError('');
    lookupCode(manualCode);
  };

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
        body: JSON.stringify({ code: activeCode, email: trimmedEmail, name }),
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

  // No active code yet, or the last attempt failed -- either way, the
  // way forward is the same manual-entry box, just with an explanatory
  // line on top when something was actually tried and failed.
  if (!activeCode) {
    const fatalMessages = {
      invalid: 'That code isn’t valid. Double-check it and try again, or write to venkat@stateofplay.club.',
      redeemed: 'That gift has already been claimed.',
      network: 'Something went wrong loading that. Please try again.',
    };
    return (
      <MockupLayout testId="page-gift-redeem-entry" hideFooterHeroCta seo={{ title: 'Claim Your Gift', path: '/gift/redeem' }}>
        <div className="max-w-[480px] mx-auto px-6 py-20 lg:py-28">
          <Overline className="!normal-case !tracking-normal !text-sm mb-4">Gift subscription</Overline>
          <h1 className="font-editorial font-semibold tracking-tight text-[28px] leading-[1.1] mb-6">
            Claim your <em className="italic font-normal">gift.</em>
          </h1>
          {fatal && (
            <p className="font-plex text-[14px] text-[var(--accent-burgundy)] leading-relaxed mb-6" data-testid="gift-redeem-fatal">
              {fatalMessages[fatal]}
            </p>
          )}
          <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed mb-6">
            Enter the code you were given.
          </p>
          <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Gift code</p>
          <input
            type="text"
            value={manualCode}
            onChange={(e) => { setManualCode(formatCodeInput(e.target.value)); if (manualError) setManualError(''); }}
            placeholder="K7M2-P9QX"
            data-testid="gift-redeem-code-input"
            className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg tracking-[0.05em] py-3 mb-2 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)]"
          />
          {manualError && (
            <p className="font-plex text-sm text-[var(--accent-burgundy)] mb-4" data-testid="gift-redeem-code-error">{manualError}</p>
          )}
          <button
            type="button"
            onClick={submitManualCode}
            data-testid="gift-redeem-code-submit"
            className="mt-4 inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200"
            style={{ borderRadius: 'var(--control-radius)' }}
          >
            Find my gift
          </button>
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
