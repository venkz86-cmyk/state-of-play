import { useState } from 'react';
import { MockupLayout, Overline } from '../components/MockupLayout';

/* =============================================================================
   /teams/login — Self-serve recovery for the team dashboard link
   --------------------------------------------------------------------
   Admin enters their email; Apps Script (server-side) looks up the
   matching account and emails the dashboard link.

   By design we ALWAYS show the same confirmation message after submit —
   success or failure — so the form can't be used to enumerate which
   companies have a teams account.
   ============================================================================= */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxuRQHvQZfZFYCxLirt8ry2mbiwYGlVKm7N3oe-Oy4-GuosggZZU1t5AV1Q97HmyIZ6Pg/exec';

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

export const TeamsLogin = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    setValidationError('');
    setSubmitting(true);

    // Fire-and-show. We swallow both network and Apps Script errors and
    // always show the same confirmation — this is the security design.
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'send_dashboard_link', email: trimmed }),
      });
    } catch (err) {
      // Intentionally ignored — same UX whether email exists or not.
      console.debug('teams/login send_dashboard_link error (ignored):', err);
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
  };

  return (
    <MockupLayout testId="page-teams-login" hideFooterHeroCta seo={{ title: 'Teams Login', path: '/teams/login', noindex: true }}>
      <div className="max-w-[560px] mx-auto px-6 pt-12 lg:pt-16 pb-32">
        <div className="border-b border-[var(--rule)] pb-3 mb-12 flex items-baseline justify-between">
          <Overline className="!normal-case !tracking-normal !text-sm">For Teams</Overline>
          <span className="font-plex text-[13px] text-[var(--text-muted)]">Dashboard access</span>
        </div>

        {!submitted ? (
          <>
            <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.25rem] lg:text-[2.5rem] leading-[1.1] mb-5">
              Find your <em className="italic font-normal">team dashboard.</em>
            </h1>
            <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)] mb-10 max-w-[52ch]">
              Enter the email address you used when your company subscribed. We&rsquo;ll send your private dashboard link there.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Overline className="block mb-3">Admin email</Overline>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  placeholder="you@yourcompany.com"
                  disabled={submitting}
                  data-testid="teams-login-email"
                  className="w-full h-12 px-4 bg-transparent border border-[var(--rule)] font-plex text-[15px] focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60"
                  style={{ borderRadius: 0 }}
                />
                {validationError && (
                  <p
                    className="font-plex text-[13px] text-[var(--accent-burgundy)] mt-2"
                    data-testid="teams-login-validation"
                  >
                    {validationError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                data-testid="teams-login-submit"
                className="h-12 px-8 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] transition-colors disabled:opacity-70"
                style={{ borderRadius: 0 }}
              >
                {submitting ? 'Sending…' : 'Email me the link →'}
              </button>
            </form>

            <p className="font-plex text-[13px] text-[#999999] mt-10 max-w-[52ch]">
              The dashboard is for the company admin who set up the subscription. Team members
              don&rsquo;t need it — they sign in at{' '}
              <a
                href="/login"
                className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1"
              >
                stateofplay.club/login
              </a>{' '}
              with their company email.
            </p>
          </>
        ) : (
          <div data-testid="teams-login-confirmation">
            <Overline className="block mb-8">— Sent —</Overline>
            <h1 className="font-editorial font-semibold tracking-tight text-[1.75rem] sm:text-[2rem] leading-[1.15] mb-5">
              Check your inbox.
            </h1>
            <p className="font-plex text-[16px] leading-[1.7] text-[var(--text-muted)] max-w-[55ch] mb-8">
              If we have a teams account for that email, you&rsquo;ll receive your dashboard link
              shortly. It usually arrives within a minute &mdash; check spam if you don&rsquo;t see it.
            </p>
            <p className="font-plex text-[14px] text-[var(--text-muted)] max-w-[55ch]">
              Still nothing after five minutes? Write to{' '}
              <a
                href="mailto:prerna@stateofplay.club?subject=Team%20dashboard%20link"
                className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1"
              >
                prerna@stateofplay.club
              </a>{' '}
              and we&rsquo;ll resend it.
            </p>
          </div>
        )}
      </div>
    </MockupLayout>
  );
};

export default TeamsLogin;
