import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ghostAPI } from '../services/ghostAPI';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { StoriesUnavailable } from '../components/StoriesUnavailable';
import { ArchiveEntry, BEAT_TAGS, monthLabel } from './Archive';

/* /search: the app's Search tab, and a page on the site. Readers who come
   back for an old story usually have a name in mind (a team, a deal, a
   person), so the search box leads; below it, the beats to browse and
   every story by month, which is the archive. The query lives in the URL
   (?q=), so going back from a story returns to the same results. */
const matches = (post, words) => {
  const hay = [post.title, post.subtitle, post.excerpt, post.author, post.theme, ...(post.tags || []).map((t) => t.name)]
    .filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
};

export const SearchMockup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    ghostAPI.getAllPosts().then((list) => { if (live) setPosts(list || []); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [attempt]);

  // Keep the URL in step with the box, without adding a history entry per key.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim();
      if ((searchParams.get('q') || '') !== q) setSearchParams(q ? { q } : {}, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => (words.length ? posts.filter((p) => matches(p, words)) : []), [posts, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const beats = useMemo(() => {
    const all = posts.flatMap((p) => p.tags || []);
    return BEAT_TAGS.map((n) => all.find((t) => t.name === n)).filter(Boolean)
      .filter((t, i, arr) => arr.findIndex((x) => x.slug === t.slug) === i);
  }, [posts]);

  const months = useMemo(() => {
    const out = [];
    for (const p of posts) {
      const label = monthLabel(p.created_at);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(p);
    }
    return out;
  }, [posts]);

  const failed = !loading && posts.length === 0;

  return (
    <MockupLayout testId="page-search" seo={{ title: 'Search', path: '/search', description: 'Search every story The State of Play has published.' }}>
      <section className="border-b border-[var(--rule)]">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-12 pt-10 pb-8 lg:pt-16 lg:pb-12">
          <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3 mb-8">
            <Overline>Search</Overline>
            <span className="font-plex text-[13px] text-[var(--text-muted)] tabular-nums">
              {loading ? '' : `${posts.length} stories`}
            </span>
          </div>
          <form role="search" onSubmit={(e) => { e.preventDefault(); inputRef.current?.blur(); }}
            className="flex items-center gap-3 border-b-2 border-[var(--text)] pb-2 focus-within:border-[var(--accent-ink)] transition-colors">
            <Search className="h-6 w-6 shrink-0 text-[var(--text-muted)]" strokeWidth={1.5} aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="A team or a deal"
              aria-label="Search stories"
              data-testid="search-input"
              className="flex-1 min-w-0 bg-transparent font-editorial text-[26px] md:text-[34px] leading-tight placeholder:text-[var(--text-label)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search"
                className="h-10 w-10 -mr-2 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            )}
          </form>

          {!words.length && beats.length > 0 && (
            <div className="mt-8">
              <p className="font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)] mb-3">Browse by beat</p>
              <div className="flex flex-wrap gap-2" data-testid="search-beats">
                {beats.map((t) => (
                  <Link key={t.slug} to={`/topic/${t.slug}`}
                    className="font-plex text-[13px] px-3.5 py-2 border border-[var(--rule)] text-[var(--text)] hover:border-[var(--text)] transition-colors">
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="max-w-[1100px] mx-auto px-6 lg:px-12 py-10 lg:py-16">
          {loading && <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading every story…</p>}
          {failed && <StoriesUnavailable onRetry={() => setAttempt((n) => n + 1)} />}

          {!loading && words.length > 0 && (
            <div data-testid="search-results">
              <h2 className="font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] pb-3 mb-1 border-b border-[var(--text)]">
                {results.length ? `${results.length} ${results.length === 1 ? 'story' : 'stories'}` : 'No stories'}
                <span className="normal-case tracking-normal"> for “{query.trim()}”</span>
              </h2>
              {results.length > 0 ? (
                <ul className="border-t border-[var(--rule)]">{results.map((p) => <ArchiveEntry key={p.id} post={p} />)}</ul>
              ) : (
                <p className="font-plex text-[15px] text-[var(--text-muted)] mt-6 max-w-[52ch]">
                  Try a company or a person’s name, or clear the search to browse every story.
                </p>
              )}
            </div>
          )}

          {!loading && !words.length && months.map((g) => (
            <div key={g.label} className="mb-12 last:mb-0">
              <h2 className="font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] pb-3 mb-1 border-b border-[var(--text)]">
                {g.label}
                <span className="ml-3 tabular-nums normal-case tracking-normal">{g.items.length}</span>
              </h2>
              <ul className="border-t border-[var(--rule)]">{g.items.map((p) => <ArchiveEntry key={p.id} post={p} />)}</ul>
            </div>
          ))}
        </div>
      </section>
    </MockupLayout>
  );
};

export default SearchMockup;
