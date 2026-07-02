import { useNominate } from '../hooks/useNominate';
import { Overline } from './MockupLayout';

export const NominateReaderBlock = ({
  subscriberName,
  subscriberEmail,
  subscriberGhostId,
  variant = 'account',          // 'account' | 'story'
}) => {
  const {
    name,
    email,
    context,
    submitting,
    submitted,
    error,
    setName,
    setEmail,
    setContext,
    handleSubmit,
    reset,
    clearBlock,
    quota,
    blocked,
    resetsOn,
    CONTEXT_MAX,
  } = useNominate({ subscriberName, subscriberEmail, subscriberGhostId });

  // Variant-specific copy
  const COPY = variant === 'story'
    ? {
        rightLabel: 'Reader to reader',
        heading: { plain: 'Worth more than a PDF', emphasis: 'forward, no?' },
        subheading: 'Send this piece to someone who should be reading it. We’ll take it from there.',
        confirmation: (nominee) => `Sent. ${nominee} will receive this story.`,
      }
    : {
        rightLabel: 'Reader to reader',
        heading: { plain: 'Know someone who should be', emphasis: 'reading?' },
        subheading: 'Someone in your world should be reading this. Tell us who — we’ll take it from there.',
        confirmation: () => null, // existing long-form confirmation
      };

  const onSubmit = handleSubmit;

  return (
    <section
      className="border-t border-[var(--rule)] pt-12 lg:pt-14 pb-8"
      data-testid="nominate-reader-block"
    >
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
        <Overline>Nominate a reader</Overline>
        <span
          className="font-plex text-[12px] text-[var(--text-muted)] uppercase tracking-[0.06em]"
          data-testid="nominate-quota-label"
        >
          {!blocked && !submitted && quota && typeof quota.remaining === 'number'
            ? `${quota.remaining} of ${quota.quota} nominations remaining this month`
            : COPY.rightLabel}
        </span>
      </div>

      {blocked === 'quota' ? (
        <div data-testid="nominate-blocked-quota" className="max-w-[55ch]">
          <h2 className="font-editorial font-semibold text-[1.75rem] md:text-[2rem] leading-[1.15] mb-4">
            You’ve used all 5 nominations{' '}
            <em className="italic font-normal">this month.</em>
          </h2>
          <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)]">
            Your quota resets on {resetsOn || 'the 1st of next month'}.
          </p>
        </div>
      ) : blocked === 'duplicate' ? (
        <div data-testid="nominate-blocked-duplicate" className="max-w-[55ch]">
          <h2 className="font-editorial font-semibold text-[1.75rem] md:text-[2rem] leading-[1.15] mb-4">
            You’ve already nominated this person{' '}
            <em className="italic font-normal">twice.</em>
          </h2>
          <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)]">
            Time to let them decide.
          </p>
          <button
            type="button"
            onClick={clearBlock}
            className="mt-6 font-plex text-[13px] uppercase tracking-[0.06em] text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
            data-testid="nominate-blocked-duplicate-try-another"
          >
            Nominate someone else →
          </button>
        </div>
      ) : !submitted ? (
        <>
          <h2 className="font-editorial font-semibold text-[1.75rem] md:text-[2rem] leading-[1.15] mb-4 max-w-[24ch]">
            {COPY.heading.plain} <em className="italic font-normal">{COPY.heading.emphasis}</em>
          </h2>
          <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)] mb-8 max-w-[58ch]">
            {COPY.subheading}
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
                  onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setContext(e.target.value)}
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
      ) : variant === 'story' ? (
        <div data-testid="nominate-confirmation" className="max-w-[55ch]">
          <h2 className="font-editorial font-semibold text-[1.5rem] md:text-[1.75rem] leading-[1.2] mb-3">
            {COPY.confirmation((name || 'Your colleague').trim().split(' ')[0])}
          </h2>
          <p className="font-plex text-[13px] text-[var(--text-muted)]">
            Want to send it to someone else too?{' '}
            <button
              type="button"
              onClick={reset}
              className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
            >
              Add another →
            </button>
          </p>
        </div>
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
              onClick={reset}
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
