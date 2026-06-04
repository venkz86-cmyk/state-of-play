import { Link } from 'react-router-dom';

/* Subscriber paywall block — renders after the fade overlay
   that ends the visible portion of a members-only article.   */
export const Paywall = ({ subscriberCount = 1850 }) => (
  <div data-testid="article-paywall" className="relative">
    {/* Gradient fade — 80px, transparent → page background */}
    <div
      aria-hidden="true"
      className="pointer-events-none -mt-20 h-20"
      style={{
        background:
          'linear-gradient(to bottom, transparent, var(--bg) 80%)',
      }}
    />
    <div
      className="border border-[var(--rule)] bg-[var(--surface)] mt-2 p-8 md:p-10"
      style={{ borderRadius: 0 }}
    >
      <p
        className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-3"
      >
        For subscribers
      </p>
      <h3 className="font-editorial font-semibold text-2xl md:text-[1.75rem] leading-snug text-[var(--text)] mb-3">
        This edition is for members.
      </h3>
      <p className="font-plex text-[15px] text-[var(--text-muted)] leading-relaxed max-w-[55ch] mb-6">
        Join {subscriberCount.toLocaleString('en-IN')} readers who follow Indian sports business closely. ₹2,499 per year, GST inclusive.
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          to="/signup"
          data-testid="paywall-subscribe"
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] tracking-wide h-12 px-6 transition-colors duration-200"
          style={{ borderRadius: 0 }}
        >
          Subscribe
        </Link>
        <Link
          to="/login"
          data-testid="paywall-login"
          className="font-plex text-[15px] text-[var(--accent-blue)] underline underline-offset-[5px] decoration-1 hover:decoration-2 transition-all"
        >
          Sign in
        </Link>
      </div>
    </div>
  </div>
);

export default Paywall;
