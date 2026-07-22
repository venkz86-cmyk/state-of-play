import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Gift, Sparkles } from 'lucide-react';
import { useNominate } from '../hooks/useNominate';

/**
 * GiftArticleModal — subscriber-only "gift this article" surface.
 *
 * Reuses the same backend as NominateReaderBlock (POST /api/nominations/submit
 * → Apps Script → Sheet + Slack + nominee email). Only the reader-facing
 * copy changes. Backend / Sheet / Slack terminology intentionally kept as
 * "nomination" so ops workflow doesn't fork.
 *
 * Non-subscribers see a gentle prompt to subscribe instead — gifting is a
 * subscriber perk (backend enforces this via quota + Ghost membership).
 */
export const GiftArticleModal = ({
  open,
  onOpenChange,
  isPaidSubscriber,
  subscriberName,
  subscriberEmail,
  subscriberGhostId,
  postSlug,
  articleTitle,
}) => {
  const {
    name, email, context, submitting, submitted, error,
    setName, setEmail, setContext, handleSubmit, reset, clearBlock,
    quota, blocked, resetsOn, CONTEXT_MAX,
  } = useNominate({ subscriberName, subscriberEmail, subscriberGhostId, postSlug });

  const handleClose = (nextOpen) => {
    if (!nextOpen) {
      // Reset form state on close so re-opening feels fresh.
      // Preserve `blocked` — subscribers who hit quota shouldn't reset it.
      reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="gift-article-modal"
        className="max-w-[560px] bg-[var(--bg)] border border-[var(--rule)] p-0 sm:rounded-none rounded-none"
        style={{ borderRadius: 0 }}
      >
        {/* Editorial header strip */}
        <div className="px-8 pt-8 pb-6 border-b border-[var(--rule)]">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-4 h-4 text-[var(--accent-burgundy)]" strokeWidth={1.5} />
            <span className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]">
              Gift · reader to reader
            </span>
          </div>
          <DialogTitle
            className="font-editorial font-semibold text-[24px] md:text-[28px] leading-[1.15] text-[var(--text)] max-w-[26ch]"
            data-testid="gift-modal-title"
          >
            Gift this article to <em className="italic font-normal">someone.</em>
          </DialogTitle>
          <DialogDescription
            className="font-plex text-[14px] lg:text-[15px] leading-[1.55] text-[var(--text-muted)] mt-3 max-w-[52ch]"
            data-testid="gift-modal-subheading"
          >
            They read it in full. No paywall. No sign-up needed on their end.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="px-8 pt-6 pb-8">
          {!isPaidSubscriber ? (
            <div data-testid="gift-modal-subscribe-prompt">
              <p className="font-plex text-[14px] leading-[1.6] text-[var(--text)] mb-4">
                Gifting is a subscriber perk. Subscribers can send any story to a colleague — full access, no paywall on their end.
              </p>
              <a
                href="/signup"
                className="inline-block h-11 px-6 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] leading-[44px] transition-colors"
                style={{ borderRadius: 0 }}
                data-testid="gift-modal-subscribe-cta"
              >
                Subscribe to gift articles →
              </a>
            </div>
          ) : blocked === 'quota' ? (
            <div data-testid="gift-modal-blocked-quota" className="max-w-[46ch]">
              <p className="font-editorial font-semibold text-[20px] leading-[1.2] text-[var(--text)] mb-3">
                You’ve used all 5 gifts <em className="italic font-normal">this month.</em>
              </p>
              <p className="font-plex text-[14px] text-[var(--text-muted)]">
                Your quota resets on {resetsOn || 'the 1st of next month'}.
              </p>
            </div>
          ) : blocked === 'duplicate' ? (
            <div data-testid="gift-modal-blocked-duplicate" className="max-w-[46ch]">
              <p className="font-editorial font-semibold text-[20px] leading-[1.2] text-[var(--text)] mb-3">
                You’ve already gifted this to them <em className="italic font-normal">twice.</em>
              </p>
              <p className="font-plex text-[14px] text-[var(--text-muted)] mb-4">
                Time to let them decide.
              </p>
              <button
                type="button"
                onClick={clearBlock}
                data-testid="gift-modal-blocked-duplicate-try-another"
                className="font-plex text-[13px] uppercase tracking-[0.06em] text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
              >
                Gift to someone else →
              </button>
            </div>
          ) : !submitted ? (
            <form onSubmit={handleSubmit} className="space-y-5" data-testid="gift-modal-form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    placeholder="Jane Doe"
                    data-testid="gift-modal-name"
                    className="w-full h-11 px-3 bg-transparent border border-[var(--rule)] font-plex text-[14px] focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60"
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
                    disabled={submitting}
                    placeholder="jane@company.com"
                    data-testid="gift-modal-email"
                    className="w-full h-11 px-3 bg-transparent border border-[var(--rule)] font-plex text-[14px] focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60"
                    style={{ borderRadius: 0 }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    A short note (optional)
                  </label>
                  <span className="font-plex text-[11px] text-[#999999] tabular-nums">
                    {context.length} / {CONTEXT_MAX}
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  disabled={submitting}
                  placeholder="Thought you’d find this interesting."
                  data-testid="gift-modal-context"
                  className="w-full px-3 py-2 bg-transparent border border-[var(--rule)] font-plex text-[14px] leading-relaxed focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60 resize-none"
                  style={{ borderRadius: 0 }}
                />
              </div>

              {error && (
                <p
                  className="font-plex text-[13px] text-[var(--accent-burgundy)]"
                  data-testid="gift-modal-error"
                >
                  {error}
                </p>
              )}

              <div className="flex items-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="gift-modal-submit"
                  className="h-11 px-6 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] transition-colors disabled:opacity-70"
                  style={{ borderRadius: 0 }}
                >
                  {submitting ? 'Sending…' : 'Send gift →'}
                </button>
                {quota && typeof quota.remaining === 'number' && (
                  <span
                    className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]"
                    data-testid="gift-modal-quota-label"
                  >
                    {quota.remaining} of {quota.quota} gifts left this month
                  </span>
                )}
              </div>
            </form>
          ) : (
            <div data-testid="gift-modal-confirmation" className="max-w-[46ch]">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[var(--accent-burgundy)]" strokeWidth={1.5} />
                <span className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--accent-burgundy)]">
                  Gift sent
                </span>
              </div>
              <p className="font-editorial font-semibold text-[20px] leading-[1.2] text-[var(--text)] mb-3">
                {`${(name || 'Your friend').trim().split(' ')[0]} will get this${articleTitle ? ' shortly' : ''}.`}
              </p>
              <p className="font-plex text-[14px] text-[var(--text-muted)] mb-5">
                We’ve sent them a private link. They read it in full — no paywall, no sign-up.
              </p>
              <button
                type="button"
                onClick={reset}
                data-testid="gift-modal-again"
                className="font-plex text-[13px] uppercase tracking-[0.06em] text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
              >
                Gift to someone else →
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GiftArticleModal;
