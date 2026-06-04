import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { RazorpayButton } from './RazorpayButton';

const API = process.env.REACT_APP_BACKEND_URL;

/* Subscriber paywall — typographic continuation of the article, not a card.
   The CTA is a real Razorpay button rendered through our TSOP-styled proxy
   (RazorpayButton). Geo-IP picks India (₹2,499 + GST) vs International ($120). */
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
        if (active) setIsIndia(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const subtext = 'The State of Play publishes one deeply reported edition each week on the business of Indian sport. Franchise valuations, broadcast rights, ownership deals, and the people driving them. Read by investors, league executives, and sports business professionals across India and internationally.';

  const priceLine = isIndia
    ? '₹2,499 + 18% GST per year (₹2,949 total)'
    : '$120 / year';

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

        <RazorpayButton dataTestId="paywall-subscribe" />

        <div className="mt-4">
          <Link
            to="/login"
            data-testid="paywall-login"
            className="font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)] hover:underline underline-offset-[5px] decoration-1 transition-all"
          >
            Already a member? Sign in →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Paywall;
