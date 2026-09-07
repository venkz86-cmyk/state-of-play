import { useEffect, useState } from 'react';
import axios from 'axios';
import { ghostAPI } from '../services/ghostAPI';
import { Overline } from './MockupLayout';
import { RazorpayCheckoutButton } from './RazorpayCheckoutButton';
import { trialUpgradePricing } from '../lib/trialUpgradePricing';

const API = process.env.REACT_APP_BACKEND_URL;

const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// Byline/meta line shared by every card size below. A read story doesn't
// carry a badge -- the title itself dims, and "Read" quietly joins the
// same meta line the way an unread story shows its read time.
const Meta = ({ post, read, className = '' }) => (
  <p className={`font-plex text-[12px] text-[var(--text-label)] tabular-nums ${className}`}>
    {shortDate(post.created_at)}
    {post.read_time ? ` · ${post.read_time} min` : ''}
    {read ? ' · Read' : ''}
  </p>
);

const titleClass = (read) =>
  `transition-colors duration-300 ${read ? 'text-[var(--text-muted)]' : 'text-[var(--text)] group-hover:text-[var(--accent-burgundy)]'}`;

// Lead card -- the single most recent story, same treatment as the
// homepage's own hero: image (when the post has one), theme label, big
// serif headline, dek, byline.
const LeadCard = ({ post, read }) => (
  <a href={`/${post.slug}`} className="group block">
    {post.image_url && (
      <div className="mb-5 lg:mb-6 overflow-hidden">
        <img
          src={post.image_url}
          alt={post.title}
          referrerPolicy="no-referrer"
          className="w-full aspect-[16/10] object-cover saturate-0 group-hover:saturate-100 transition-all duration-700 ease-out"
        />
      </div>
    )}
    <Overline className="!normal-case !tracking-normal !text-xs block mb-2">{post.theme}</Overline>
    <h2 className={`font-editorial font-semibold tracking-tight text-[1.6rem] lg:text-[2rem] leading-[1.1] mb-3 max-w-[26ch] ${titleClass(read)}`}>
      {post.title}
    </h2>
    {post.subtitle && (
      <p className="font-plex text-base lg:text-lg leading-[1.5] text-[var(--text-secondary)] max-w-[55ch] mb-3">
        {post.subtitle}
      </p>
    )}
    <Meta post={post} read={read} />
  </a>
);

// Secondary card -- the next three, side by side, same shape as the
// homepage's secondary row.
const SecondaryCard = ({ post, read }) => (
  <a href={`/${post.slug}`} className="group block">
    <Overline className="!normal-case !tracking-normal !text-xs block mb-2">{post.theme}</Overline>
    <h3 className={`font-editorial font-medium tracking-tight text-[1.15rem] leading-[1.25] mb-2 ${titleClass(read)}`}>
      {post.title}
    </h3>
    {post.subtitle && (
      <p className="font-plex text-sm leading-relaxed text-[var(--text-muted)] line-clamp-2 mb-2">
        {post.subtitle}
      </p>
    )}
    <Meta post={post} read={read} />
  </a>
);

// Desk card -- everything else, dense 3-column grid, same shape as the
// homepage's "The Desk".
const DeskCard = ({ post, read }) => (
  <a href={`/${post.slug}`} className="group block py-5 border-b border-[var(--rule)]">
    <Overline className="!normal-case !tracking-normal !text-xs block mb-2">{post.theme}</Overline>
    <h3 className={`font-editorial font-medium text-[17px] leading-snug mb-2 ${titleClass(read)}`}>
      {post.title}
    </h3>
    <Meta post={post} read={read} />
  </a>
);

/* TheTenPanel -- the reading-list view for a Trial member's account
   page, backing GET /api/trial/status (trial_tracking.py). Rendered by
   AccountMockup.js only when details.tier === 'trial'. Fetches the
   trial's real state (permanent snapshot slugs, any bonus slugs
   published since signup, which of those have been opened, days left),
   then batch-fetches the actual story metadata for all of them in one
   Ghost Content API call rather than one request per story. Laid out
   as lead + 3 secondary + a desk grid -- the same 1/3/6 split
   HomeMockup.js uses for its own hero, deliberately: "The Ten" is
   exactly ten stories, most recent first, so the homepage's own shape
   fits it without inventing a new one. */
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
  // snapshot_slugs is already stored most-recent-first (the order
  // _fetch_recent_premium_slugs fetched them in at signup) -- preserved
  // here by mapping over status.slugs rather than whatever order Ghost's
  // own slug:[...] filter happens to return.
  const tenPosts = (status.slugs || []).map((slug) => posts[slug]).filter(Boolean);
  const bonusPosts = (status.bonus_slugs || []).map((slug) => posts[slug]).filter(Boolean);
  const availableCount = tenPosts.length + bonusPosts.length;
  const readCount = [...tenPosts, ...bonusPosts].filter((p) => openedSlugs.has(p.slug)).length;

  const [lead, ...rest] = tenPosts;
  const secondary = rest.slice(0, 3);
  const desk = rest.slice(3);

  return (
    <div>
      <div className="border-y border-[var(--rule)] grid grid-cols-2 mb-10">
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

      <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-6">
        Your ten, permanently yours
      </p>

      {lead && (
        <div className="mb-10 lg:mb-12">
          <LeadCard post={lead} read={openedSlugs.has(lead.slug)} />
        </div>
      )}

      {secondary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8 pb-10 lg:pb-12 border-b border-[var(--rule)] mb-10">
          {secondary.map((post) => (
            <SecondaryCard key={post.slug} post={post} read={openedSlugs.has(post.slug)} />
          ))}
        </div>
      )}

      {desk.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-2 mb-10">
          {desk.map((post) => (
            <DeskCard key={post.slug} post={post} read={openedSlugs.has(post.slug)} />
          ))}
        </div>
      )}

      {!status.expired && bonusPosts.length > 0 && (
        <div className="mb-10">
          <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-1">
            Unlocked since you joined
          </p>
          <p className="font-plex text-[12.5px] text-[var(--text-muted)] mb-4">
            These close with your trial window, unlike the original ten.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-2">
            {bonusPosts.map((post) => (
              <DeskCard key={post.slug} post={post} read={openedSlugs.has(post.slug)} />
            ))}
          </div>
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
                {trialUpgradePricing().blurb}
              </p>
              <RazorpayCheckoutButton
                plan="trial-upgrade"
                country="IN"
                buttonLabel="Upgrade to annual"
                dataTestId="account-trial-upgrade"
                lockedEmail={email}
                disclosureText={trialUpgradePricing().disclosure}
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
