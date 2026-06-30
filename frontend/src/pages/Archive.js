import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { MockupLayout, Overline } from '../components/MockupLayout';

/* =============================================================================
   /archive — chronological index of everything published.
   Loads ALL posts (paginated through Ghost), groups them by month,
   renders a dense, link-only directory. No covers, no excerpts.
   ============================================================================= */

const monthLabel = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

const dayLabel = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const ArchiveEntry = ({ post }) => (
  <li className="border-b border-[var(--rule)]">
    <Link
      to={`/${post.slug || post.id}`}
      data-testid={`archive-entry-${post.slug || post.id}`}
      className="group grid grid-cols-12 gap-4 py-4 px-1 items-baseline"
    >
      <span className="col-span-3 md:col-span-2 font-plex text-[12px] text-[var(--text-muted)] uppercase tabular-nums">
        {dayLabel(post.created_at)}
      </span>
      <span className="col-span-9 md:col-span-7">
        <p className="font-editorial text-[18px] md:text-[20px] leading-snug text-[var(--text)] group-hover:text-[var(--accent-burgundy)] transition-colors">
          {post.title}
        </p>
      </span>
      <span className="hidden md:block md:col-span-2 font-plex text-[12px] text-[var(--text-muted)] uppercase tracking-[0.06em] truncate">
        {post.theme || ''}
      </span>
      <span className="hidden md:block md:col-span-1 font-plex text-[12px] text-[var(--text-muted)] tabular-nums text-right">
        {post.read_time || 5}m
      </span>
    </Link>
  </li>
);

export const Archive = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | state-of-play | left-field

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await ghostAPI.getAllPosts();
        if (active) setPosts(list);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return posts;
    if (filter === 'left-field')
      return posts.filter((p) => (p.publication || '').toLowerCase().includes('left field'));
    return posts.filter((p) => (p.publication || '').toLowerCase().includes('state of play'));
  }, [posts, filter]);

  const grouped = useMemo(() => {
    const out = [];
    let currentLabel = null;
    let bucket = null;
    for (const p of filtered) {
      const label = monthLabel(p.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        bucket = { label, items: [] };
        out.push(bucket);
      }
      bucket.items.push(p);
    }
    return out;
  }, [filtered]);

  return (
    <MockupLayout testId="page-archive" seo={{ title: 'Archive', path: '/archive', description: 'Browse every dispatch from The State of Play, chronologically — by month, by year.' }}>
      {/* Header */}
      <section className="border-b border-[var(--rule)]">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
          <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3 mb-10 flex-wrap gap-4">
            <Overline>Archive</Overline>
            <span className="font-plex text-[13px] text-[var(--text-muted)] tabular-nums">
              {loading ? 'Loading…' : `${filtered.length} stor${filtered.length === 1 ? 'y' : 'ies'}`}
            </span>
          </div>
          <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[4rem] leading-[1.05] max-w-4xl">
            Everything we’ve <em className="italic font-normal text-[var(--accent-burgundy)]">put on the record.</em>
          </h1>
          <p className="font-plex text-base lg:text-lg text-[var(--text-muted)] mt-6 max-w-2xl leading-relaxed">
            Indexed by date. The full back catalogue of long-reads and the weekly briefing.
          </p>

          {/* Filter tabs */}
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--rule)] pt-6">
            {[
              ['all', 'Everything'],
              ['state-of-play', 'The State of Play'],
              ['left-field', 'The Left Field'],
            ].map(([key, label]) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  data-testid={`archive-filter-${key}`}
                  className="font-plex text-[13px] uppercase tracking-[0.06em] transition-colors"
                  style={{
                    color: active ? 'var(--accent-burgundy)' : 'var(--text-muted)',
                    textDecoration: active ? 'underline' : 'none',
                    textUnderlineOffset: '8px',
                    textDecorationThickness: '1px',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Body */}
      <section>
        <div className="max-w-[1100px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
          {loading && (
            <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading the archive…</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="font-plex text-[14px] text-[var(--text-muted)]">
              No stories in this section yet.
            </p>
          )}
          {!loading &&
            grouped.map((g) => (
              <div key={g.label} className="mb-12 last:mb-0">
                <h2
                  className="font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] pb-3 mb-1 border-b border-[var(--text)]"
                >
                  {g.label}
                  <span className="ml-3 text-[#999999] tabular-nums normal-case tracking-normal">
                    {g.items.length}
                  </span>
                </h2>
                <ul className="border-t border-[var(--rule)]">
                  {g.items.map((p) => (
                    <ArchiveEntry key={p.id} post={p} />
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </section>
    </MockupLayout>
  );
};

export default Archive;
