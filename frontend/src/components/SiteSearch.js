import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ghostAPI } from '../services/ghostAPI';

/* Lightweight client-side search — titles, tags and authors, over posts
   already fetched for the Archive page. No third-party widget: Ghost's
   own native search widget was tried and pulled (its stylesheet leaked
   site-wide and results were broken). Posts are fetched lazily on first
   open, then cached in memory for the rest of the session. */

let cachedPosts = null;
let cachedPromise = null;

const loadPosts = () => {
  if (cachedPosts) return Promise.resolve(cachedPosts);
  if (!cachedPromise) {
    cachedPromise = ghostAPI.getAllPosts().then((posts) => {
      cachedPosts = posts;
      return posts;
    });
  }
  return cachedPromise;
};

const matches = (post, q) => {
  if (!q) return false;
  const hay = [
    post.title,
    post.author,
    ...(post.tags || []).map((t) => t.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
};

export const SiteSearchTrigger = ({ className = '' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const openSearch = () => {
    setOpen(true);
    if (!posts) {
      setLoading(true);
      loadPosts().then((list) => {
        setPosts(list);
        setLoading(false);
      });
    }
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = q && posts ? posts.filter((p) => matches(p, q)).slice(0, 12) : [];

  const goTo = (post) => {
    close();
    navigate(`/${post.slug || post.id}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        data-testid="mockup-header-search"
        aria-label="Search"
        className={`h-9 w-9 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-200 ${className}`}
      >
        <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-6"
          data-testid="site-search-overlay"
        >
          <div
            className="fixed inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={close}
          />
          <div
            className="relative w-full max-w-[560px] max-h-[70vh] flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--control-radius, 4px)',
            }}
          >
            <div className="flex items-center gap-3 px-5 border-b border-[var(--rule)]">
              <Search className="h-4 w-4 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stories, companies, people…"
                data-testid="site-search-input"
                className="flex-1 h-14 bg-transparent font-plex text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-label)]"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="h-8 w-8 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="overflow-y-auto">
              {!q && (
                <p className="font-plex text-[13px] text-[var(--text-label)] px-5 py-6">
                  Start typing to search the archive.
                </p>
              )}
              {q && loading && (
                <p className="font-plex text-[13px] text-[var(--text-label)] px-5 py-6">
                  Loading…
                </p>
              )}
              {q && !loading && results.length === 0 && (
                <p className="font-plex text-[13px] text-[var(--text-label)] px-5 py-6">
                  No stories found for &ldquo;{query}&rdquo;.
                </p>
              )}
              {results.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => goTo(post)}
                  data-testid={`site-search-result-${post.id}`}
                  className="w-full text-left px-5 py-3 border-b border-[var(--rule)] last:border-b-0 hover:bg-[var(--surface)] transition-colors"
                >
                  <p className="font-plex text-[11px] uppercase tracking-[0.06em] text-[var(--text-label)] mb-1">
                    {post.theme}{post.is_premium ? ' · For Subscribers' : ' · Free'}
                  </p>
                  <p className="font-editorial text-[16px] leading-snug text-[var(--text)]">
                    {post.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SiteSearchTrigger;
