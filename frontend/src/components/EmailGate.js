import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

/* Free-registration gate -- Paywall.js's structural sibling, for a
   'members'-visibility story instead of a 'paid' one (see
   ghostAPI.js's requires_registration). Same gradient-fade/preview
   break in the reading flow, but the CTA is a plain email form
   instead of a payment button: no price, no RazorpayButton, just
   registerFree() from AuthContext, which creates a free Ghost member
   and signs them straight in. Once that succeeds, ArticleMockup.js's
   own isLoggedIn-driven effect picks up and fetches the real content
   -- this component doesn't need to know the article at all. */
export const EmailGate = () => {
  const { registerFree } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setStatus('loading');
    try {
      const result = await registerFree(trimmed, name.trim());
      if (!result.success) {
        setError(result.error || 'Could not register. Please try again.');
        setStatus('idle');
      }
      // On success, AuthContext's user updates and ArticleMockup.js's
      // own effect takes it from here -- no local "done" state needed.
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <section
      data-testid="article-email-gate"
      className="relative"
    >
      {/* Same gradient-fade mechanics as Paywall.js -- the last preview
          paragraph dissolves into the page background. */}
      <div
        aria-hidden="true"
        className="pointer-events-none -mt-[180px] h-[180px] relative z-10"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, var(--bg) 65%, var(--bg) 100%)',
        }}
        data-testid="email-gate-fade"
      />

      <div
        className="border-t-2 border-[var(--text)] pt-10 pb-12 max-w-[680px] relative"
        style={{ borderRadius: 0 }}
      >
        <div className="mb-6 flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-11 h-11 bg-[var(--accent-burgundy)] text-white"
            style={{ borderRadius: 0 }}
            aria-hidden="true"
            data-testid="email-gate-icon"
          >
            <Mail className="w-5 h-5" strokeWidth={2} />
          </span>
          <span className="section-label">Free, sign up to read</span>
        </div>

        <h2
          className="font-editorial font-semibold text-[30px] md:text-[34px] leading-[1.1] tracking-tight text-[var(--text)] mb-3 max-w-[22ch]"
          data-testid="email-gate-heading"
        >
          You’re reading a preview.
        </h2>

        <p
          className="font-editorial text-[22px] md:text-[24px] italic font-normal leading-[1.3] text-[var(--text-muted)] mb-8 max-w-[26ch]"
          data-testid="email-gate-subheading"
        >
          Enter your email to keep reading, free.
        </p>

        <p className="font-plex text-[15px] leading-[1.65] text-[var(--text-muted)] mb-8 max-w-[58ch]">
          This story is free. We just ask for your email so we can keep sending you the stories we publish.
        </p>

        <form onSubmit={onSubmit} className="max-w-[420px]" data-testid="email-gate-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            disabled={status === 'loading'}
            data-testid="email-gate-name"
            className="w-full bg-transparent border-0 border-b border-[var(--rule)] font-plex text-[15px] py-2.5 mb-4 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            placeholder="you@yourdomain.com"
            disabled={status === 'loading'}
            data-testid="email-gate-email"
            className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-[15px] py-2.5 mb-5 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            data-testid="email-gate-submit"
            className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200 disabled:opacity-60"
            style={{ borderRadius: 'var(--control-radius)' }}
          >
            {status === 'loading' ? 'Please wait…' : 'Continue reading'}
          </button>
          {error && (
            <p className="font-plex text-sm text-[var(--accent-burgundy)] mt-3 max-w-[50ch]" data-testid="email-gate-error">
              {error}
            </p>
          )}
        </form>
      </div>
    </section>
  );
};

export default EmailGate;
