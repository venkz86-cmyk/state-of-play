import { useEffect, useState } from 'react';
import axios from 'axios';
import { ghostAPI } from '../services/ghostAPI';
import { RazorpayCheckoutButton } from './RazorpayCheckoutButton';

const API = process.env.REACT_APP_BACKEND_URL;

const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// One card for a single story in either list below -- read state comes
// from openedSlugs, not from anything Ghost itself tracks.
const StoryCard = ({ post, read }) => (
  <a
    href={`/${post.slug}`}
    className="flex items-baseline justify-between gap-4 py-3 border-b border-[var(--rule)]/60 group"
  >
    <span>
      <span className="font-editorial font-medium text-[15px] leading-snug group-hover:text-[var(--accent-burgundy)] transition-colors">
        {post.title}
      </span>
      <span className="block font-plex text-[12.5px] text-[var(--text-label)] mt-0.5">
        {shortDate(post.created_at)} · {post.read_time || 5} min
      </span>
    </span>
    <span className="font-plex text-[11px] uppercase tracking-[0.05em] text-[var(--text-label)] shrink-0">
      {read ? 'Read' : 'Unread'}
    </span>
  </a>
);

/* TheTenPanel -- the reading-list view for a Trial member's account
   page, backing GET /api/trial/status (trial_tracking.py). Rendered by
   AccountMockup.js only when details.tier === 'trial'. Fetches the
   trial's real state (permanent snapshot slugs, any bonus slugs
   published since signup, which of those have been opened, days left),
   then batch-fetches the actual story metadata for all of them in one
   Ghost Content API call rather than one request per story. */
export const TheTenPanel = ({ email, country = 'IN' }) => {
  const [status, setStatus] = useState(null);
  const [posts, setPosts] = useState({});
  const [error, setError] = useState('');
  const [upgraded, setUpgraded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!email || !API) return;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/trial/status`, { params: { email } });
        if (!active) return;
        setStatus(r.data);

        const allSlugs = [...(r.data.slugs || []), ...(r.data.bonus_slugs || [])];
        if (allSlugs.length === 0) return;
        const fetched = await ghostAPI.getPosts({
          limit: allSlugs.length,
          filters: { filter: `slug:[${allSlugs.join(',')}]` },
        });
        if (!active) return;
        const bySlug = {};
        fetched.forEach((p) => { bySlug[p.slug] = p; });
        setPosts(bySlug);
      } catch (e) {
        if (active) setError('Could not load your ten stories right now.');
      }
    })();
    return () => { active = false; };
  }, [email]);

  if (error) {
    return <p className="font-plex text-[14px] text-[var(--accent-burgundy)]">{error}</p>;
  }
  if (!status) {
    return <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading your ten…</p>;
  }

  const openedSlugs = new Set(status.opened_slugs || []);
  const tenPosts = (status.slugs || []).map((slug) => posts[slug]).filter(Boolean);
  const bonusPosts = (status.bonus_slugs || []).map((slug) => posts[slug]).filter(Boolean);
  const availableCount = tenPosts.length + bonusPosts.length;
  const readCount = [...tenPosts, ...bonusPosts].filter((p) => openedSlugs.has(p.slug)).length;

  return (
    <div>
      <p className="font-plex text-sm text-[var(--text-muted)] mb-6">
        {status.expired
          ? 'Your trial has closed. Your original ten stay yours, for keeps.'
          : `${readCount} of ${availableCount} read · ${status.days_left} day${status.days_left === 1 ? '' : 's'} left`}
      </p>

      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-2">
        Your ten, permanently yours
      </p>
      <div className="mb-8">
        {tenPosts.map((post) => (
          <StoryCard key={post.slug} post={post} read={openedSlugs.has(post.slug)} />
        ))}
      </div>

      {!status.expired && bonusPosts.length > 0 && (
        <div className="mb-8">
          <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-2">
            Unlocked since you joined
          </p>
          <p className="font-plex text-[12.5px] text-[var(--text-muted)] mb-3">
            These close with your trial window, unlike the original ten.
          </p>
          {bonusPosts.map((post) => (
            <StoryCard key={post.slug} post={post} read={openedSlugs.has(post.slug)} />
          ))}
        </div>
      )}

      {country === 'IN' && (
        <div className="mt-8 pt-6 border-t border-[var(--rule)]">
          {upgraded ? (
            <p className="font-plex text-[14px] text-[var(--text-muted)]">You're upgraded. Reloading your account…</p>
          ) : (
            <>
              <p className="font-editorial font-medium text-[15px] mb-1">Ready for the full archive?</p>
              <p className="font-plex text-[13px] text-[var(--text-muted)] mb-4 max-w-[50ch]">
                Upgrade any time before day 30 and pay ₹2,999 + GST, the renewal rate, not the new-signup rate — thirteen months for the price of twelve.
              </p>
              <RazorpayCheckoutButton
                plan="trial-upgrade"
                country="IN"
                buttonLabel="Upgrade to annual"
                dataTestId="account-trial-upgrade"
                lockedEmail={email}
                disclosureText="₹2,999 + 18% GST = ₹3,539. One payment, thirteen months of access."
                onSuccess={() => {
                  setUpgraded(true);
                  setTimeout(() => { window.location.reload(); }, 1500);
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TheTenPanel;
