import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { MockupLayout } from '../components/MockupLayout';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const { requestCode, verifyCode, isAdminLoggedIn, loading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && isAdminLoggedIn) navigate('/admin/dashboard', { replace: true });
  }, [loading, isAdminLoggedIn, navigate]);

  const sendCode = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestCode(email.trim());
      if (result.success) {
        setCodeSent(true);
      } else {
        setError(result.error || 'Could not send a sign-in code.');
      }
    } catch (err) {
      setError(err.message || 'Failed to send a code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onRequestCode = (e) => {
    e.preventDefault();
    sendCode();
  };

  const onResendCode = () => {
    setCode('');
    setError(null);
    sendCode();
  };

  const onVerifyCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await verifyCode(email.trim(), code.trim());
      if (result.success) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        setError(result.error || 'Incorrect code. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MockupLayout testId="page-admin-login" seo={{ title: 'Admin', path: '/admin/login', noindex: true }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
          <span className="font-plex text-[14px] text-[var(--text-muted)]">
            The State of Play
          </span>
          <span className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]">
            Admin
          </span>
        </div>
      </div>

      <section className="max-w-[560px] mx-auto px-6 lg:px-0 pt-16 lg:pt-24 pb-32">
        <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3rem] leading-[1.06] mb-5">
          Dashboard <em className="italic font-normal">sign-in.</em>
        </h1>

        {!codeSent ? (
          <>
            <p className="font-plex text-base lg:text-lg text-[var(--text-muted)] mb-10 max-w-[45ch] leading-relaxed">
              Enter the admin email. A sign-in code goes to that inbox.
            </p>

            <form onSubmit={onRequestCode} className="space-y-7">
              <div>
                <label htmlFor="admin-email" className="block font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  data-testid="admin-login-email"
                  placeholder="you@stateofplay.club"
                  className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                />
              </div>

              {error && (
                <p className="font-plex text-sm text-[var(--accent-burgundy)] max-w-[55ch]" data-testid="admin-login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="admin-login-submit"
                className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send code →'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="font-plex text-base lg:text-lg text-[var(--text-muted)] mb-10 max-w-[45ch] leading-relaxed">
              If that's the admin email, a code is on its way. Enter it below — it expires in 10 minutes.
            </p>

            <form onSubmit={onVerifyCode} className="space-y-7">
              <div>
                <label htmlFor="admin-code" className="block font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">
                  Code
                </label>
                <input
                  id="admin-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={submitting}
                  data-testid="admin-login-code"
                  placeholder="000000"
                  className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 tracking-[0.3em] focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                />
              </div>

              {error && (
                <p className="font-plex text-sm text-[var(--accent-burgundy)] max-w-[55ch]" data-testid="admin-login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="admin-login-submit"
                className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all disabled:opacity-60"
              >
                {submitting ? 'Verifying…' : 'Sign in →'}
              </button>

              <p className="font-plex text-sm text-[var(--text-muted)]">
                Didn't get it?{' '}
                <button
                  type="button"
                  onClick={onResendCode}
                  disabled={submitting}
                  data-testid="admin-login-resend"
                  className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors disabled:opacity-60"
                >
                  Send a new code
                </button>.
              </p>
            </form>
          </>
        )}
      </section>
    </MockupLayout>
  );
};

export default AdminLogin;
