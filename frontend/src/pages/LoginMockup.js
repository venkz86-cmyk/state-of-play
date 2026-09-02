import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MockupLayout } from '../components/MockupLayout';

const datelineDate = (d = new Date()) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export const LoginMockup = () => {
  const navigate = useNavigate();
  const { requestCode, verifyCode, isLoggedIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // If already signed in, send straight to /account
  useEffect(() => {
    if (!loading && isLoggedIn) navigate('/account', { replace: true });
  }, [loading, isLoggedIn, navigate]);

  const sendCode = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestCode(email.trim());
      if (result.success) {
        setCodeSent(true);
      } else {
        setError(result.error || 'Could not send a sign-in code. Please try again.');
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
        navigate('/account', { replace: true });
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
    <MockupLayout testId="page-login" seo={{ title: 'Sign In', path: '/login', noindex: true }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
          <span className="font-plex text-[14px] text-[var(--text-muted)]">
            Bengaluru · {datelineDate()}
          </span>
          <span className="font-plex text-[14px] text-[var(--text-muted)] tabular-nums">
            Sign in
          </span>
        </div>
      </div>

      <section className="max-w-[560px] mx-auto px-6 lg:px-0 pt-16 lg:pt-24 pb-32">
        <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3rem] leading-[1.06] mb-5">
          Welcome back.
        </h1>

        {!codeSent ? (
          <>
            <p className="font-plex text-sm text-[var(--text-muted)] mb-3">
              Password-free sign-in for subscribers — nothing to remember.
            </p>
            <p className="font-plex text-base lg:text-lg text-[var(--text-muted)] mb-10 max-w-[45ch] leading-relaxed">
              Enter the email associated with your subscription. We'll send a sign-in code to your inbox.
            </p>

            <form onSubmit={onRequestCode} className="space-y-7">
              <div>
                <label htmlFor="email" className="block font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  data-testid="login-email"
                  placeholder="you@yourdomain.com"
                  className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                />
              </div>

              {error && (
                <p className="font-plex text-sm text-[var(--accent-burgundy)] max-w-[55ch]" data-testid="login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="login-submit"
                className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send code →'}
              </button>
              <p className="font-plex text-sm text-[var(--text-muted)]">
                Not a member yet?{' '}
                <Link to="/signup" className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors">
                  Subscribe
                </Link>.
              </p>
            </form>
          </>
        ) : (
          <>
            <p className="font-plex text-base lg:text-lg text-[var(--text-muted)] mb-10 max-w-[45ch] leading-relaxed">
              If {email.trim()} has an account, a sign-in code is on its way. Enter it below — it expires in 10 minutes.
            </p>

            <form onSubmit={onVerifyCode} className="space-y-7">
              <div>
                <label htmlFor="code" className="block font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">
                  Code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={submitting}
                  data-testid="login-code"
                  placeholder="000000"
                  className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 tracking-[0.3em] focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                />
              </div>

              {error && (
                <p className="font-plex text-sm text-[var(--accent-burgundy)] max-w-[55ch]" data-testid="login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="login-submit"
                className="font-plex text-base text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all disabled:opacity-60"
              >
                {submitting ? 'Verifying…' : 'Sign in →'}
              </button>

              <div className="space-y-2">
                <p className="font-plex text-sm text-[var(--text-muted)]">
                  Check promotions or spam — codes usually arrive in under a minute.
                </p>
                <p className="font-plex text-sm text-[var(--text-muted)]">
                  Didn't get it?{' '}
                  <button
                    type="button"
                    onClick={onResendCode}
                    disabled={submitting}
                    data-testid="login-resend"
                    className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors disabled:opacity-60"
                  >
                    Send a new code
                  </button>.
                </p>
                <p className="font-plex text-sm text-[var(--text-muted)]">
                  Subscribed under a different email?{' '}
                  <button
                    type="button"
                    onClick={() => { setCodeSent(false); setCode(''); setError(null); }}
                    data-testid="login-different-email"
                    className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors"
                  >
                    Use a different email
                  </button>.
                </p>
              </div>
            </form>
          </>
        )}

        <div className="mt-16 pt-6 border-t border-[var(--rule)]">
          <p className="font-plex text-sm text-[var(--text-muted)]">
            Trouble signing in?{' '}
            <a href="mailto:venkat@stateofplay.club" className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors">
              Email the desk
            </a>.
          </p>
        </div>
      </section>
    </MockupLayout>
  );
};

export default LoginMockup;
