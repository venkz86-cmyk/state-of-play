import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { RazorpayCheckoutButton } from './RazorpayCheckoutButton';
import { newSignupAnnualPricing } from '../lib/octoberPricing';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

/* Subscriber paywall — an obvious, unmissable break in the reading flow.
   Gradient fade eats the last preview paragraph so readers can *see* the
   text end mid-thought. Below that: a solid, high-contrast block with a
   lock icon, unmissable heading, and a primary CTA (Razorpay). Pricing
   is geo-IP-aware and comes from lib/octoberPricing.js, so it switches
   at the 6 October cutover with the backend.

   Readers whose complimentary Sandbox-event access has lapsed (Ghost's
   sandbox-event-comp label, now downgraded to free) get a heading and
   lede that acknowledge that directly, instead of the generic first-time
   pitch — same gate, same price, same CTA underneath. */
export const Paywall = () => {
  const [isIndia, setIsIndia] = useState(true);
  const { hasExpiredTrial, isLoggedIn, user } = useAuth();
  const [justPaidEmail, setJustPaidEmail] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!API) return;
        const r = await axios.get(`${API}/api/geo/location`, { timeout: 3000 });
        if (!active) return;
        const cc = (r.data && r.data.country_code) || 'IN';
        setIsIndia(cc === 'IN');
      } catch {
        if (active) setIsIndia(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const annual = newSignupAnnualPricing(isIndia);
  const priceLine = isIndia
    ? `${annual.amount} + 18% GST per year (${annual.total} total)`
    : `${annual.amount} / year`;

  return (
    <section
      data-testid="article-paywall"
      className="relative"
    >
      {/* Gradient fade — 180px tall, sits ON TOP of the last preview paragraph
          so readers see text literally dissolve into the page background.
          Deliberately taller + more opaque than the previous 100px/80% so
          the "you can't read past this" cue is unmissable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none -mt-[180px] h-[180px] relative z-10"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, var(--bg) 65%, var(--bg) 100%)',
        }}
        data-testid="paywall-fade"
      />

      <div
        className="border-t-2 border-[var(--text)] pt-10 pb-12 max-w-[680px] relative"
        style={{ borderRadius: 0 }}
      >
        {/* Lock icon — solid burgundy circle so it reads as an interruption,
            not decoration. */}
        <div className="mb-6 flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-11 h-11 bg-[var(--accent-burgundy)] text-white"
            style={{ borderRadius: 0 }}
            aria-hidden="true"
            data-testid="paywall-lock"
          >
            <Lock className="w-5 h-5" strokeWidth={2} />
          </span>
          <span className="section-label">For subscribers</span>
        </div>

        <h2
          className="font-editorial font-semibold text-[30px] md:text-[34px] leading-[1.1] tracking-tight text-[var(--text)] mb-3 max-w-[22ch]"
          data-testid="paywall-heading"
        >
          {hasExpiredTrial ? 'Your trial has ended.' : 'You’re reading a preview.'}
        </h2>

        <p
          className="font-editorial text-[22px] md:text-[24px] italic font-normal leading-[1.3] text-[var(--text-muted)] mb-8 max-w-[26ch]"
          data-testid="paywall-subheading"
        >
          {hasExpiredTrial ? 'Subscribe to keep reading with us.' : 'Subscribers get the full story.'}
        </p>

        <p className="font-plex text-[15px] leading-[1.65] text-[var(--text-muted)] mb-2 max-w-[58ch]">
          {hasExpiredTrial
            ? 'You had a preview of what we cover each week: franchise valuations, broadcast rights, ownership deals, and the people driving them. A subscription gets you the rest.'
            : 'The State of Play publishes one deeply reported edition each week on the business of Indian sport. Franchise valuations, broadcast rights, ownership deals, and the people driving them.'}
        </p>

        <p className="font-plex text-[15px] leading-[1.65] text-[var(--text)] font-medium mb-1">
          {priceLine}
        </p>
        <p
          className="font-plex text-[13px] text-[var(--text-muted)] mb-8"
        >
          Weekly deep-dives · Full archive · Member events
        </p>

        <p
          className="font-plex text-[13px] uppercase tracking-[0.08em] text-[var(--accent-burgundy)] mb-3"
          data-testid="paywall-cta-prompt"
        >
          Subscribe to continue reading
        </p>
        {justPaidEmail ? (
          <div data-testid="paywall-checkout-success" className="border border-[var(--rule)] p-6 max-w-[520px]">
            <p className="font-editorial font-medium text-lg mb-2">You're in.</p>
            <p className="font-plex text-[15px] text-[var(--text-muted)] leading-relaxed">
              {user?.email
                ? 'Your membership is active. Reloading the story now.'
                : `A welcome note is on its way to ${justPaidEmail}. Sign in with that same email to read the rest.`}
            </p>
          </div>
        ) : (
          <RazorpayCheckoutButton
            plan="standard"
            country={isIndia ? 'IN' : 'INTL'}
            buttonLabel="Subscribe"
            dataTestId="paywall-subscribe"
            className="max-w-[520px]"
            lockedEmail={user?.email}
            onSuccess={(paidEmail) => {
              setJustPaidEmail(paidEmail);
              if (user?.email) {
                setTimeout(() => { window.location.reload(); }, 1500);
              }
            }}
          />
        )}

        {/* A cheaper first step for a reader not ready for a year. Hidden
            from anyone already in The Ten or whose trial has ended. */}
        {!justPaidEmail && !hasExpiredTrial && user?.tier !== 'trial' && (
          <p className="font-plex text-[14px] text-[var(--text-muted)] mt-5" data-testid="paywall-the-ten">
            Not ready for a year?{' '}
            <Link to="/trial" className="text-[var(--accent-burgundy)] underline underline-offset-4">
              Start with The Ten
            </Link>
            , ten stories for {isIndia ? '₹590' : '$9'}.
          </p>
        )}

        {/* Already signed in — the "sign in" link would be confusing, not helpful */}
        {!isLoggedIn && (
          <div className="mt-5">
            <Link
              to="/login"
              data-testid="paywall-login"
              className="font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)] hover:underline underline-offset-[5px] decoration-1 transition-all"
            >
              Already a member? Sign in
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default Paywall;
