import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Gift, Sparkles } from 'lucide-react';
import { useNominate } from '../hooks/useNominate';

/**
 * GiftArticleModal — subscriber-only "gift this story" surface.
 *
 * Two views:
 *  - 'link' (default, primary): a self-serve, anonymous share link via
 *    POST /api/gifts/create (auth is the real session cookie, not
 *    anything in the body). Copy link / Share on WhatsApp. v0: flat
 *    72-hour access window from creation, no per-browser grant limit.
 *  - 'email' (secondary, reached via "Nominate a reader instead"): the
 *    original nomination flow, unchanged underneath -- same backend
 *    (POST /api/nominations/submit -> Apps Script -> Sheet + Slack +
 *    nominee email), same quota/duplicate rules.
 *
 * Non-subscribers see a gentle prompt to subscribe instead.
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
  const [view, setView] = useState('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    name, email, context, submitting, submitted, error,
    setName, setEmail, setContext, handleSubmit, reset, clearBlock,
    quota, blocked, resetsOn, CONTEXT_MAX,
  } = useNominate({ subscriberName, subscriberEmail, subscriberGhostId, postSlug });

  // Create (or fetch the still-active) gift link as soon as the modal
  // opens in link view -- no extra click needed to get something to copy.
  // Relative path, not an absolute cross-origin URL: this call needs the
  // session cookie, and going cross-site with it is what let Safari's
  // iOS tracking prevention block it outright. A 20s cap means a real
  // failure surfaces as a message instead of an endless spinner.
  useEffect(() => {
    if (!open || view !== 'link' || !isPaidSubscriber || !postSlug) return;
    if (linkUrl || linkLoading) return;
    let cancelled = false;
    setLinkLoading(true);
    setLinkError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    fetch('/api/gifts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ story_slug: postSlug }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.detail || 'Could not create a link. Please try again.');
        if (!cancelled) setLinkUrl(data.url);
      })
      .catch((err) => {
        if (cancelled) return;
        setLinkError(
          err.name === 'AbortError'
            ? 'Taking longer than expected. Please try again.'
            : err.message || 'Could not create a link. Please try again.',
        );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLinkLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
    // linkUrl/linkLoading are read (as a guard) but intentionally not in
    // the deps below -- setLinkLoading(true) above would otherwise
    // re-trigger this effect and abort the request it just started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, isPaidSubscriber, postSlug]);

  const handleClose = (nextOpen) => {
    if (!nextOpen) {
      // Reset form state on close so re-opening feels fresh.
      // Preserve `blocked` — subscribers who hit quota shouldn't reset it.
      reset();
      setView('link');
      setLinkUrl('');
      setLinkError('');
      setLinkCopied(false);
    }
    onOpenChange(nextOpen);
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  const whatsappHref = linkUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `I thought you'd find this State of Play story useful: ${articleTitle || ''}. This link unlocks the full story for a short time: ${linkUrl}`,
      )}`
    : '#';

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
              {view === 'link' ? 'Gift · reader to reader' : 'Nominate a reader'}
            </span>
          </div>
          {view === 'link' ? (
            <>
              <DialogTitle
                className="font-editorial font-semibold text-[24px] md:text-[28px] leading-[1.15] text-[var(--text)] max-w-[26ch]"
                data-testid="gift-modal-title"
              >
                Gift this story to <em className="italic font-normal">anyone.</em>
              </DialogTitle>
              <DialogDescription
                className="font-plex text-[14px] lg:text-[15px] leading-[1.55] text-[var(--text-muted)] mt-3 max-w-[52ch]"
                data-testid="gift-modal-subheading"
              >
                Copy the link or send it on WhatsApp. Anyone can read the full story free for the next 72 hours — no sign-up needed on their end.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle
                className="font-editorial font-semibold text-[24px] md:text-[28px] leading-[1.15] text-[var(--text)] max-w-[28ch]"
                data-testid="gift-modal-title"
              >
                Some people shouldn’t <em className="italic font-normal">just read this one.</em>
              </DialogTitle>
              <DialogDescription
                className="font-plex text-[14px] lg:text-[15px] leading-[1.55] text-[var(--text-muted)] mt-3 max-w-[52ch]"
                data-testid="gift-modal-subheading"
              >
                Put someone’s name forward and I’ll give them two weeks of full access - every story, no paywall. They’ll know it came from you.
              </DialogDescription>
            </>
          )}
        </div>

        {/* Body */}
        <div className="px-8 pt-6 pb-8">
          {!isPaidSubscriber ? (
            <div data-testid="gift-modal-subscribe-prompt">
              <p className="font-plex text-[14px] leading-[1.6] text-[var(--text)] mb-4">
                Gifting is a subscriber perk. Subscribers can send any story to a colleague: full access, no paywall on their end.
              </p>
              <a
                href="/signup"
                className="inline-block h-11 px-6 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] leading-[44px] transition-colors"
                style={{ borderRadius: 'var(--control-radius)' }}
                data-testid="gift-modal-subscribe-cta"
              >
                Subscribe to gift articles →
              </a>
            </div>
          ) : view === 'link' ? (
            <div data-testid="gift-modal-link-view">
              {linkLoading && !linkUrl && (
                <p className="font-plex text-[14px] text-[var(--text-muted)]">Creating your link…</p>
              )}
              {linkError && (
                <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mb-4" data-testid="gift-link-error">
                  {linkError}
                </p>
              )}
              {linkUrl && (
                <>
                  <div
                    className="flex items-center gap-2 border border-[var(--rule)] px-4 py-3 mb-5"
                    style={{ borderRadius: 'var(--control-radius)' }}
                  >
                    <span className="font-plex text-[13px] text-[var(--text)] truncate flex-1" data-testid="gift-link-url">
                      {linkUrl}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      type="button"
                      onClick={onCopyLink}
                      data-testid="gift-link-copy"
                      className="h-11 px-6 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] transition-colors"
                      style={{ borderRadius: 'var(--control-radius)' }}
                    >
                      {linkCopied ? 'Copied' : 'Copy link'}
                    </button>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="gift-link-whatsapp"
                      className="h-11 px-6 border border-[var(--rule)] text-[var(--text)] font-plex font-medium text-[13px] uppercase tracking-[0.05em] inline-flex items-center hover:border-[var(--text)] transition-colors"
                      style={{ borderRadius: 'var(--control-radius)' }}
                    >
                      Share on WhatsApp
                    </a>
                  </div>
                </>
              )}
              <p className="font-plex text-[13px] text-[var(--text-muted)] mt-6">
                Want to introduce them directly?{' '}
                <button
                  type="button"
                  onClick={() => setView('email')}
                  data-testid="gift-modal-switch-email"
                  className="text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors"
                >
                  Nominate a reader instead
                </button>.
              </p>
            </div>
          ) : (
            <div data-testid="gift-modal-email-view">
              <button
                type="button"
                onClick={() => setView('link')}
                data-testid="gift-modal-switch-link"
                className="font-plex text-[13px] text-[var(--text-muted)] hover:text-[var(--accent-burgundy)] transition-colors mb-6"
              >
                ← Get a shareable link instead
              </button>

              {blocked === 'quota' ? (
                <div data-testid="gift-modal-blocked-quota" className="max-w-[46ch]">
                  <p className="font-editorial font-semibold text-[20px] leading-[1.2] text-[var(--text)] mb-3">
                    You’ve used all 5 nominations <em className="italic font-normal">this month.</em>
                  </p>
                  <p className="font-plex text-[14px] text-[var(--text-muted)]">
                    Your quota resets on {resetsOn || 'the 1st of next month'}.
                  </p>
                </div>
              ) : blocked === 'duplicate' ? (
                <div data-testid="gift-modal-blocked-duplicate" className="max-w-[46ch]">
                  <p className="font-editorial font-semibold text-[20px] leading-[1.2] text-[var(--text)] mb-3">
                    You’ve already put their name forward <em className="italic font-normal">twice.</em>
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
                    Nominate someone else →
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
                        style={{ borderRadius: 'var(--control-radius)' }}
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
                        style={{ borderRadius: 'var(--control-radius)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Why should they be reading TSOP? (optional)
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
                      placeholder="Works in franchise strategy. We were on a panel together last year."
                      data-testid="gift-modal-context"
                      className="w-full px-3 py-2 bg-transparent border border-[var(--rule)] font-plex text-[14px] leading-relaxed focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60 resize-none"
                      style={{ borderRadius: 'var(--control-radius)' }}
                    />
                    <p className="font-plex text-[12px] text-[var(--text-muted)] mt-1.5">
                      What do they do, and how do you know them?
                    </p>
                  </div>

                  {error && (
                    <p
                      className="font-plex text-[13px] text-[var(--accent-burgundy)]"
                      data-testid="gift-modal-error"
                    >
                      {error}
                    </p>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      data-testid="gift-modal-submit"
                      className="h-11 px-6 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] transition-colors disabled:opacity-70"
                      style={{ borderRadius: 'var(--control-radius)' }}
                    >
                      {submitting ? 'Sending…' : 'Nominate →'}
                    </button>
                    <p className="font-plex text-[12px] text-[var(--text-muted)] mt-3">
                      One note from me, nothing else. No marketing, ever.
                    </p>
                    {quota && typeof quota.remaining === 'number' && (
                      <p
                        className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)] mt-1.5"
                        data-testid="gift-modal-quota-label"
                      >
                        {quota.remaining} of {quota.quota} nominations left this month
                      </p>
                    )}
                  </div>
                </form>
              ) : (
                <div data-testid="gift-modal-confirmation" className="max-w-[46ch]">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[var(--accent-burgundy)]" strokeWidth={1.5} />
                    <span className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--accent-burgundy)]">
                      Name put forward
                    </span>
                  </div>
                  <p className="font-editorial font-semibold text-[20px] leading-[1.2] text-[var(--text)] mb-3">
                    {`${(name || 'Your friend').trim().split(' ')[0]} will hear from us shortly.`}
                  </p>
                  <p className="font-plex text-[14px] text-[var(--text-muted)] mb-5">
                    One note, saying you put their name forward. Two weeks of full access, every story, no sign-up needed on their end.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    data-testid="gift-modal-again"
                    className="font-plex text-[13px] uppercase tracking-[0.06em] text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
                  >
                    Nominate someone else →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GiftArticleModal;
