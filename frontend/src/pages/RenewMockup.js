import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { useAuth } from '../contexts/AuthContext';

// The landing page for annual_renewal.py's reminder/grace emails' CTA --
// a per-subscriber link (?t=<token>), not the generic /account URL every
// other email points at. Exchanges the token for a real session via
// AuthContext's completeRenewalLink, then lands on the already-built
// renewal banner on /account, signed in. On an expired/invalid token,
// doesn't dead-end -- the normal sign-in-code path at /login is always
// one click away. Opened without a link, it sends a signed-in member
// to their account and anyone else to sign in first.

export const RenewMockup = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const navigate = useNavigate();
  const { completeRenewalLink, isLoggedIn, loading } = useAuth();

  useEffect(() => {
    if (token || loading) return;
    navigate(isLoggedIn ? '/account' : '/login?next=/account', { replace: true });
  }, [token, loading, isLoggedIn, navigate]);

  const [status, setStatus] = useState(() => (token ? 'loading' : 'missing'));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await completeRenewalLink(token);
        if (cancelled) return;
        if (result.success) {
          navigate('/account', { replace: true });
        } else {
          setError(result.error);
          setStatus('failed');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Could not reach the server. Please try again.');
          setStatus('failed');
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === 'loading' || status === 'missing') {
    return (
      <MockupLayout testId="page-renew-loading" hideFooterHeroCta seo={{ title: 'Renew Your Membership', path: '/renew' }}>
        <div className="max-w-[480px] mx-auto px-6 py-32 text-center">
          <p className="font-plex text-[14px] text-[var(--text-muted)]">Signing you in…</p>
        </div>
      </MockupLayout>
    );
  }

  return (
    <MockupLayout testId="page-renew-failed" hideFooterHeroCta seo={{ title: 'Renew Your Membership', path: '/renew' }}>
      <div className="max-w-[480px] mx-auto px-6 py-20 lg:py-28">
        <Overline className="!normal-case !tracking-normal !text-sm mb-4">Renew your membership</Overline>
        <h1 className="font-editorial font-semibold tracking-tight text-[28px] leading-[1.1] mb-6">
          That link didn't <em className="italic font-normal">work.</em>
        </h1>
        <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed mb-8" data-testid="renew-error">
          {error}
        </p>
        <Link
          to="/login"
          data-testid="renew-fallback-login"
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200"
          style={{ borderRadius: 'var(--control-radius)' }}
        >
          Sign in instead
        </Link>
      </div>
    </MockupLayout>
  );
};

export default RenewMockup;
