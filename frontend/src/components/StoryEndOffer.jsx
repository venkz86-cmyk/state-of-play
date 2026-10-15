import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { annualPricingFor } from '../lib/octoberPricing';

/* After the last paragraph of a story the reader could open (a free one,
   or a members-only one they signed up for): the moment they have just
   seen what a subscription buys. Only for readers who aren't subscribers
   or on The Ten, and not until sign-in has been checked. */
export const StoryEndOffer = () => {
  const { user, loading } = useAuth();
  const pricing = useGeoPricing();
  if (loading || user?.is_paid || user?.tier === 'trial') return null;
  const isIndia = pricing.country === 'IN';
  const annual = annualPricingFor(isIndia, user);

  return (
    <aside className="mt-14 border border-[var(--text)] p-7 lg:p-9" data-testid="story-end-offer">
      <p className="font-editorial text-2xl lg:text-[1.75rem] leading-tight text-[var(--text)] mb-3">
        Every week, one story like this.
      </p>
      <p className="font-plex text-[15px] leading-relaxed text-[var(--text-muted)] mb-6 max-w-[52ch]">
        The State of Play reports on the business of Indian sport, and subscribers read the full archive.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
        <Link
          to="/signup?ref=story-end"
          data-testid="story-end-subscribe"
          className="btn-cta self-start"
          data-detail={isIndia ? `${annual.total} a year` : `${annual.amount} a year`}
        >
          Subscribe
        </Link>
      </div>
      {!user?.trial_expired && (
        <p className="font-plex text-[14px] text-[var(--text-muted)] mt-5">
          Not ready for a year?{' '}
          <Link to="/trial?via=story-end" className="text-[var(--accent-ink)] underline underline-offset-4">
            Start with The Ten
          </Link>
          , ten stories for {isIndia ? '₹590' : '$9'}.
        </p>
      )}
    </aside>
  );
};

export default StoryEndOffer;
