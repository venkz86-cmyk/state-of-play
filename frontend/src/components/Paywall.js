import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

/* Subscriber paywall — typographic continuation of the article, not a card.
   Geo-IP detection picks INR vs USD pricing automatically.                */
export const Paywall = () => {
  const [isIndia, setIsIndia] = useState(true);

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
        if (active) setIsIndia(true); // sensible default for an Indian publication
      }
    })();
    return () => { active = false; };
  }, []);

  const subtext = `The State of Play publishes one deeply reported edition each week on the business of Indian sport. Franchise valuations, broadcast rights, ownership deals, and the people driving them. Read by investors, league executives, and sports business professionals across India and internationally.`;

  const priceLine = isIndia
    ? '₹2,499 + 18% GST per year (₹2,949 total)'
    : '$120 / year';

  const ctaLabel = isIndia
    ? 'Subscribe — ₹2,499 + GST / year'
    : 'Subscribe — $120 / year';

  return (
    <section
      data-testid="article-paywall"
      className="relative"
    >
      {/* Fade overlay — 100px, starts mid-paragraph */}
      <div
        aria-hidden="true"
        className="pointer-events-none -mt-[100px] h-[100px]"
        style={{
          background:
            'linear-gradient(to bottom, transparent, var(--bg) 80%)',
        }}
      />

      <div
        className="border-t-2 border-[var(--text)] pt-10 pb-10 max-w-[680px]"
        style={{ borderRadius: 0 }}
      >
        <p className="section-label mb-4 block">For subscribers</p>

        <h2 className="font-editorial font-semibold text-[28px] leading-[1.15] text-[var(--text)] mb-4">
          The rest of this edition is for members.
        </h2>

        <p className="font-plex text-[16px] leading-[1.6] text-[var(--text-muted)] mb-2 max-w-[60ch]">
          {subtext}
        </p>
        <p className="font-plex text-[16px] leading-[1.6] text-[var(--text-muted)] mb-6">
          {priceLine}
        </p>

        <p className="font-plex text-[13px] text-[var(--text-muted)] mb-6">
          Weekly deep-dives · Full archive · Member events
        </p>

        <Link
          to="/signup"
          data-testid="paywall-subscribe"
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] h-12 transition-colors duration-200"
          style={{ borderRadius: 0, padding: '0 32px' }}
        >
          {ctaLabel}
        </Link>

        <div className="mt-3">
          <Link
            to="/login"
            data-testid="paywall-login"
            className="font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)] hover:underline underline-offset-[5px] decoration-1 transition-all"
          >
            Already a member? Sign in →
          </Link>
        </div>

        {isIndia && (
          <p className="font-plex text-[11px] text-[#999999] mt-6">
            Payments secured by Razorpay
          </p>
        )}
      </div>
    </section>
  );
};

export default Paywall;
