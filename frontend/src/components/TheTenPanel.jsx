import { useEffect, useState } from 'react';
import axios from 'axios';
import { ghostAPI } from '../services/ghostAPI';
import { Overline } from './MockupLayout';
import { RazorpayCheckoutButton } from './RazorpayCheckoutButton';

const API = process.env.REACT_APP_BACKEND_URL;

const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// A row for one of the original ten -- numbered, since "The Ten" is a
// literal, countable set and the number is real information (this is
// story No. 4 of your ten), not decoration. A story already opened
// dims rather than carries a separate badge -- the same quiet, no-chrome
// way the rest of the site distinguishes visited from unvisited.
const NumberedRow = ({ n, post, read }) => (
  <a href={`/${post.slug}`} className="grid grid-cols-[2.5rem_1fr] gap-4 py-4 border-b border-[var(--rule)]/60 group">
    <span className="font-editorial italic text-[1.4rem] leading-none text-[var(--text-label)] tabular-nums pt-0.5">
      {String(n).padStart(2, '0')}
    </span>
    <span>
      <Overline className="!normal-case !tracking-normal !text-[11px] block mb-1">{post.theme}</Overline>
      <span
        className={`block font-editorial font-medium text-[15px] leading-snug transition-colors ${
          read ? 'text-[var(--text-muted)]' : 'text-[var(--text)] group-hover:text-[var(--accent-burgundy)]'
        }`}
      >
        {post.title}
      </span>
      <span className="block font-plex text-[12px] text-[var(--text-label)] mt-1 tabular-nums">
        {shortDate(post.created_at)} · {post.read_time || 5} min{read ? ' · Read' : ''}
      </span>
    </span>
  </a>
);

// A bonus row -- not numbered, since these aren't part of the countable
// ten and a number here would imply an order that doesn't mean anything.
const BonusRow = ({ post, read }) => (
  <a href={`/${post.slug}`} className="grid grid-cols-[2.5rem_1fr] gap-4 py-4 border-b border-[var(--rule)]/60 group">
    <span className="font-plex text-[13px] text-[var(--text-label)] pt-0.5">+</span>
    <span>
      <Overline className="!normal-case !tracking-normal !text-[11px] block mb-1">{post.theme}</Overline>
      <span
        className={`block font-editorial font-medium text-[15px] leading-snug transition-colors ${
          read ? 'text-[var(--text-muted)]' : 'text-[var(--text)] group-hover:text-[var(--accent-burgundy)]'
        }`}
      >
        {post.title}
      </span>
      <span className="block font-plex text-[12px] text-[var(--text-label)] mt-1 tabular-nums">
        {shortDate(post.created_at)} · {post.read_time || 5} min{read ? ' · Read' : ''}
      </span>
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
      <div className="border-y border-[var(--rule)] grid grid-cols-2 mb-8">
        <div className="py-6 px-6">
          <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">Read</Overline>
          <p className="font-editorial font-medium text-lg lg:text-xl leading-tight tabular-nums">
            {readCount} of {availableCount}
          </p>
        </div>
        <div className="py-6 px-6 border-l border-[var(--rule)]">
          <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">
            {status.expired ? 'Status' : 'Time left'}
          </Overline>
          <p className="font-editorial font-medium text-lg lg:text-xl leading-tight tabular-nums">
            {status.expired ? 'Closed' : `${status.days_left} day${status.days_left === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-1">
        Your ten, permanently yours
      </p>
      <div className="mb-10">
        {tenPosts.map((post, i) => (
          <NumberedRow key={post.slug} n={i + 1} post={post} read={openedSlugs.has(post.slug)} />
        ))}
      </div>

      {!status.expired && bonusPosts.length > 0 && (
        <div className="mb-10">
          <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-1">
            Unlocked since you joined
          </p>
          <p className="font-plex text-[12.5px] text-[var(--text-muted)] mb-2">
            These close with your trial window, unlike the original ten.
          </p>
          {bonusPosts.map((post) => (
            <BonusRow key={post.slug} post={post} read={openedSlugs.has(post.slug)} />
          ))}
        </div>
      )}

      {country === 'IN' && (
        <div className="border border-[var(--rule)] p-6 lg:p-8">
          {upgraded ? (
            <p className="font-plex text-[14px] text-[var(--text-muted)]">You're upgraded. Reloading your account…</p>
          ) : (
            <>
              <p className="font-editorial italic text-lg mb-1">Ready for the full archive?</p>
              <p className="font-plex text-[13px] text-[var(--text-muted)] mb-5 max-w-[50ch]">
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
