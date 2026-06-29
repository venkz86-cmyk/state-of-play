import { useState } from 'react';
import { Overline } from './MockupLayout';

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxuRQHvQZfZFYCxLirt8ry2mbiwYGlVKm7N3oe-Oy4-GuosggZZU1t5AV1Q97HmyIZ6Pg/exec';

const API = process.env.REACT_APP_BACKEND_URL;

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

const CONTEXT_MAX = 200;

export const NominateReaderBlock = ({ subscriberName, subscriberEmail, subscriberGhostId }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [context, setContext] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedContext = context.trim();

    if (!trimmedName) return setError('Please enter the nominee’s name.');
    if (!isValidEmail(trimmedEmail)) return setError('Please enter a valid email address.');
    if (!trimmedContext) return setError('A line of context helps Venkat reach out well.');
    if (trimmedEmail === (subscriberEmail || '').toLowerCase()) {
      return setError('You’re already a reader. Try nominating someone else.');
    }

    setSubmitting(true);
    try {
      // Backend handles Ghost member creation, token mint, nominee email,
      // and forwards to Apps Script for Sheet/Slack. Single round-trip.
      await fetch(`${API}/api/nominations/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_ghost_id: subscriberGhostId || '',
          subscriber_name: subscriberName || '',
          subscriber_email: subscriberEmail || '',
          nominee_name: trimmedName,
          nominee_email: trimmedEmail,
          nominee_context: trimmedContext,
        }),
      });
      // Same confirmation regardless of response — like /teams/login pattern.
    } catch (err) {
      console.debug('nominate fetch error (suppressed):', err);
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
  };

  return (
    <section
      className="border-t border-[var(--rule)] pt-12 lg:pt-14 pb-8"
      data-testid="nominate-reader-block"
    >
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
        <Overline>Nominate a reader</Overline>
        <span className="font-plex text-[12px] text-[var(--text-muted)] uppercase tracking-[0.06em]">
          Reader to reader
        </span>
      </div>

      {!submitted ? (
        <>
          <h2 className="font-editorial font-semibold text-[1.75rem] md:text-[2rem] leading-[1.15] mb-4 max-w-[24ch]">
            Know someone who should be <em className="italic font-normal">reading?</em>
          </h2>
          <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)] mb-8 max-w-[58ch]">
            Someone in your world should be reading this. Tell us who — we’ll take it from there.
          </p>

          <form onSubmit={onSubmit} className="space-y-6 max-w-[640px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
                  data-testid="nominate-name"
                  disabled={submitting}
                  placeholder="Jane Doe"
                  className="w-full h-12 px-4 bg-transparent border border-[var(--rule)] font-plex text-[15px] focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60"
                  style={{ borderRadius: 0 }}
                />
              </div>
              <div>
                <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                  data-testid="nominate-email"
                  disabled={submitting}
                  placeholder="jane@company.com"
                  className="w-full h-12 px-4 bg-transparent border border-[var(--rule)] font-plex text-[15px] focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60"
                  style={{ borderRadius: 0 }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Why should they be reading TSOP?
                </label>
                <span className="font-plex text-[11px] text-[#999999] tabular-nums">
                  {context.length} / {CONTEXT_MAX}
                </span>
              </div>
              <textarea
                rows={3}
                value={context}
                onChange={(e) => {
                  const next = e.target.value.slice(0, CONTEXT_MAX);
                  setContext(next);
                  if (error) setError('');
                }}
                data-testid="nominate-context"
                disabled={submitting}
                placeholder="Works in franchise strategy. We were on a panel together last year."
                className="w-full px-4 py-3 bg-transparent border border-[var(--rule)] font-plex text-[15px] leading-relaxed focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60 resize-none"
                style={{ borderRadius: 0 }}
              />
              <p className="font-plex text-[12px] text-[var(--text-muted)] mt-2 max-w-[55ch]">
                What do they do, and how do you know them?
              </p>
            </div>

            {error && (
              <p
                className="font-plex text-[13px] text-[var(--accent-burgundy)]"
                data-testid="nominate-error"
              >
                {error}
              </p>
            )}

            <div className="flex items-center gap-6">
              <button
                type="submit"
                disabled={submitting}
                data-testid="nominate-submit"
                className="h-12 px-8 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] transition-colors disabled:opacity-70"
                style={{ borderRadius: 0 }}
              >
                {submitting ? 'Sending…' : 'Nominate →'}
              </button>
              <p className="font-plex text-[12px] text-[var(--text-muted)] max-w-[36ch]">
                We only send one note. No marketing follow-ups.
              </p>
            </div>
          </form>
        </>
      ) : (
        <div data-testid="nominate-confirmation" className="max-w-[55ch]">
          <h2 className="font-editorial font-semibold text-[1.75rem] md:text-[2rem] leading-[1.15] mb-4">
            Thanks — Venkat reviews every <em className="italic font-normal">nomination personally.</em>
          </h2>
          <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)] mb-3">
            If your nominee fits the desk, you’ll see a quiet outreach go out within a few days.
          </p>
          <p className="font-plex text-[13px] text-[var(--text-muted)]">
            Want to nominate someone else?{' '}
            <button
              type="button"
              onClick={() => {
                setName(''); setEmail(''); setContext(''); setSubmitted(false);
              }}
              className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
            >
              Add another →
            </button>
          </p>
        </div>
      )}
    </section>
  );
};

export default NominateReaderBlock;
