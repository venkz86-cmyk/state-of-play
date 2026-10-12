import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { authHeader } from '../lib/sessionToken';
import { MockupLayout } from '../components/MockupLayout';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';

const API = process.env.REACT_APP_BACKEND_URL || '';

/* A story Venkat shared with a group (backend group_links.py): the
   headline and opening for anyone with the link, the full story once the
   reader confirms their email with a 6-digit code, and a first-year offer
   at the end until the link's last day. No share buttons on purpose: the
   link is for the group. */

const label = 'font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]';
const field = 'w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-label)]';
const primary = 'inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-12 px-7 transition-colors disabled:opacity-60';
const quiet = 'font-plex text-[14px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)]';

// Once the code is accepted the reader is signed in, and the page loads
// the full story by itself (it watches the signed-in user).
const EmailGate = ({ code }) => {
  const { verifyCode } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await fetch(`${API}/api/group-links/${encodeURIComponent(code)}/request-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || 'Something went wrong. Try again.');
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await verifyCode(email.trim(), digits.trim());
    setBusy(false);
    if (!res.success) setError(res.error || 'That code didn’t work. Try again.');
  };

  return (
    <div className="border-t-2 border-[var(--text)] pt-8 mt-10" data-testid="group-gate">
      <p className="font-editorial text-2xl mb-2">Read the rest of the story</p>
      {step === 'email' ? (
        <form onSubmit={send} className="max-w-[440px]">
          <p className="font-plex text-[15px] text-[var(--text-muted)] mb-6">
            Enter your email and we’ll send you a 6-digit code to open it in full.
          </p>
          <label htmlFor="group-email" className={label}>Email</label>
          <input id="group-email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@yourdomain.com" className={`${field} mb-6`} data-testid="group-email" />
          <button type="submit" className={primary} disabled={busy} data-testid="group-send">{busy ? 'Sending…' : 'Send my code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="max-w-[440px]">
          <p className="font-plex text-[15px] text-[var(--text-muted)] mb-6">
            We’ve sent a code to <span className="text-[var(--text)]">{email.trim()}</span>. It can take a minute to arrive.
          </p>
          <label htmlFor="group-code" className={label}>6-digit code</label>
          <input id="group-code" inputMode="numeric" autoComplete="one-time-code" required value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
            className={`${field} tracking-[0.3em] mb-6`} data-testid="group-code" />
          <div className="flex flex-wrap items-center gap-6">
            <button type="submit" className={primary} disabled={busy || digits.length !== 6} data-testid="group-verify">{busy ? 'Checking…' : 'Read the story'}</button>
            <button type="button" className={quiet} onClick={send} disabled={busy}>Send a new code</button>
            <button type="button" className={quiet} onClick={() => { setStep('email'); setDigits(''); setError(''); }}>Use a different email</button>
          </div>
        </form>
      )}
      {error && <p className="font-plex text-[14px] text-[var(--accent-ink)] mt-4" role="alert">{error}</p>}
    </div>
  );
};

const Offer = ({ link, user, isIndia }) => {
  const [joined, setJoined] = useState(false);
  if (joined) {
    return (
      <div className="border border-[var(--rule)] p-7 mt-14" data-testid="group-joined">
        <p className="font-editorial text-2xl mb-2">You’re in.</p>
        <p className="font-plex text-[15px] text-[var(--text-muted)] mb-4">Your year has started, and every story is now open to you.</p>
        <Link to="/state-of-play" className={quiet}>Go to the latest stories</Link>
      </div>
    );
  }
  return (
    <div className="border border-[var(--text)] p-7 lg:p-9 mt-14" data-testid="group-offer">
      <p className="font-editorial text-2xl lg:text-[1.75rem] leading-tight mb-3">Every week, one story like this.</p>
      <p className="font-plex text-[15px] text-[var(--text-muted)] mb-6 max-w-[56ch]">
        The State of Play reports one story a week on the business of Indian sport, and members read the full archive.
        Your first year is <strong className="text-[var(--text)]">{isIndia ? '₹2,949' : '$120'}</strong> instead
        of {isIndia ? '₹4,129' : '$169'} if you join by {link.last_day}.
      </p>
      <RazorpayCheckoutButton
        plan="standard"
        source="group-link"
        country={isIndia ? 'IN' : 'INTL'}
        buttonLabel={`Join for ${isIndia ? '₹2,949' : '$120'}`}
        dataTestId="group-checkout"
        lockedEmail={user?.email}
        extraOrderFields={{ invite: link.invite_code }}
        disclosureText={`${isIndia ? '₹2,499 + GST. ' : ''}One payment for the year. Nothing renews on its own.`}
        onSuccess={() => setJoined(true)}
      />
    </div>
  );
};

export const GroupStoryPage = () => {
  const { code = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const pricing = useGeoPricing();
  const isIndia = pricing.country === 'IN';
  const [link, setLink] = useState(null);
  const [story, setStory] = useState(null);
  const [storyError, setStoryError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/group-links/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : { state: r.status === 429 ? 'busy' : 'unknown' }))
      .then((d) => { if (active) setLink(d); })
      .catch(() => { if (active) setLink({ state: 'error' }); });
    return () => { active = false; };
  }, [code]);

  const loadStory = useCallback(async () => {
    setStoryError('');
    try {
      const r = await fetch(`${API}/api/group-links/${encodeURIComponent(code)}/story`, { headers: { ...authHeader() } });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { setStory(null); return; }
      if (!r.ok) throw new Error(d.detail || 'The story could not be loaded. Try again.');
      setStory(d);
    } catch (e) {
      setStoryError(e.message);
    }
  }, [code]);

  useEffect(() => {
    if (link?.state === 'open' && user && !authLoading) loadStory();
  }, [link?.state, user, authLoading, loadStory]);

  const seo = { title: link?.title || 'A shared story', path: `/g/${code}`, description: 'A story from The State of Play, shared with a group.', noindex: true };

  const closed = () => (
    <div className="max-w-[680px] mx-auto px-6 py-24" data-testid="group-closed">
      <p className="font-editorial text-3xl mb-3">
        {link.state === 'unknown' ? 'This link doesn’t work.' : link.state === 'busy' || link.state === 'error' ? 'This page didn’t load.' : 'This shared story has closed.'}
      </p>
      <p className="font-plex text-[15px] text-[var(--text-muted)] mb-6">
        {link.state === 'closed' || link.state === 'expired'
          ? `It was open to ${link.group_name} until ${link.last_day}. Members read every story, including this one.`
          : link.state === 'unknown' ? 'Check that you have the whole link.' : 'Refresh the page to try again.'}
      </p>
      <Link to="/signup?ref=group-link-closed" className={quiet}>See membership</Link>
    </div>
  );

  if (!link) {
    return <MockupLayout testId="page-group" seo={seo}><p className="max-w-[680px] mx-auto px-6 py-24 font-plex text-[14px] text-[var(--text-muted)]">Opening the story…</p></MockupLayout>;
  }
  if (link.state !== 'open') return <MockupLayout testId="page-group" seo={seo}>{closed()}</MockupLayout>;

  return (
    <MockupLayout testId="page-group" seo={seo}>
      <div className="bg-[var(--text)] text-[var(--bg)]">
        <p className="max-w-[720px] mx-auto px-6 py-3 font-plex text-[13px]" data-testid="group-note">
          Shared with {link.group_name}. Free to read until {link.last_day}.
        </p>
      </div>
      <article className="max-w-[720px] mx-auto px-6 pt-12 lg:pt-16 pb-20">
        <h1 className="font-editorial text-[2.2rem] lg:text-[3rem] leading-[1.05] tracking-tight mb-4" style={{ textWrap: 'balance' }}>{link.title}</h1>
        {link.excerpt && <p className="font-editorial italic text-xl text-[var(--text-muted)] mb-5">{link.excerpt}</p>}
        <p className="font-plex text-[13px] text-[var(--text-muted)] mb-8">By {link.author || 'Venkat Ananth'}</p>
        {link.feature_image && <img src={link.feature_image} alt="" className="w-full mb-10" />}
        {story ? (
          <div className="editorial-prose-quiet" data-size="md" data-testid="group-story" dangerouslySetInnerHTML={{ __html: story.html }} />
        ) : (
          <>
            <div className="editorial-prose-quiet" data-size="md" data-testid="group-preview" dangerouslySetInnerHTML={{ __html: link.preview_html || '' }} />
            {user && !storyError ? (
              <p className="font-plex text-[14px] text-[var(--text-muted)] mt-8">Opening the full story…</p>
            ) : storyError ? (
              <p className="font-plex text-[14px] text-[var(--accent-ink)] mt-8" role="alert">
                {storyError} <button type="button" className={quiet} onClick={loadStory}>Try again</button>
              </p>
            ) : (
              <EmailGate code={code} />
            )}
          </>
        )}
        {story && !story.is_paid && <Offer link={link} user={user} isIndia={isIndia} />}
      </article>
    </MockupLayout>
  );
};

export default GroupStoryPage;
