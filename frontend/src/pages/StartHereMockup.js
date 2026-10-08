import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupLayout, Overline } from '../components/MockupLayout';

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// Venkat picks the stories in Ghost by adding the hidden tag "#start-here"
// (slug "hash-start-here") to a post, so the selection changes without a
// code change. Until any post carries it, the page shows the latest few
// and says so, rather than claiming a pick that hasn't been made.
const PICK_TAG = 'hash-start-here';
const FALLBACK_COUNT = 5;

export const StartHereMockup = () => {
  const { canAccessPremium } = useAuth();
  const [stories, setStories] = useState([]);
  const [picked, setPicked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const all = await ghostAPI.getAllPosts();
      if (!active) return;
      const picks = all.filter((p) => (p.tag_slugs || []).includes(PICK_TAG));
      if (picks.length > 0) {
        // Oldest first, so the list reads in the order the stories ran.
        setStories([...picks].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
        setPicked(true);
      } else {
        setStories(all.slice(0, FALLBACK_COUNT));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return (
    <MockupLayout
      testId="mockup-start-here"
      seo={{
        title: 'Start here',
        path: '/start-here',
        description: 'Where to begin with The State of Play: the stories to read first.',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Bengaluru</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)]">Start here</span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-10">
        <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] lg:text-[4rem] leading-[1.02] mb-6">
          Start here.
        </h1>
        {!loading && (
          <p className="font-plex text-lg lg:text-xl text-[var(--text-muted)] leading-relaxed max-w-[55ch]" data-testid="start-here-intro">
            {picked ? 'The stories to read first, picked by Venkat.' : 'The five latest stories.'}
          </p>
        )}
      </section>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        {loading ? (
          <Overline>Loading…</Overline>
        ) : (
          <ol className="border-t border-[var(--text)]">
            {stories.map((s) => (
              <li key={s.id} className="border-b border-[var(--rule)]">
                <Link to={`/${s.id}`} data-testid="start-here-story" className="group block py-7 lg:py-8 max-w-[800px]">
                  <p className="font-plex text-[12px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-2">
                    {s.theme}{s.is_premium ? '' : ' · Free'}
                  </p>
                  <h2 className="font-editorial font-semibold text-2xl lg:text-[2rem] leading-[1.15] tracking-tight text-[var(--text)] group-hover:text-[var(--accent-burgundy)] transition-colors duration-200 mb-3">
                    {s.title}
                  </h2>
                  {s.subtitle && (
                    <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed max-w-[60ch] mb-3">{s.subtitle}</p>
                  )}
                  <p className="font-plex text-[12px] text-[var(--text-label)]">
                    {longDate(s.created_at)} · {s.read_time || 5} min read
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        )}
        {!loading && (
          <Link
            to="/season-one"
            data-testid="start-here-season"
            className="inline-block mt-8 font-plex text-sm text-[var(--accent-burgundy)] underline underline-offset-4"
          >
            See all of Season One
          </Link>
        )}
      </section>

      {!canAccessPremium && !loading && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-24">
          <div className="border-t border-[var(--text)] pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <p className="font-editorial italic text-xl lg:text-2xl">A subscription opens every story, back to No. 01.</p>
            <Link
              to="/signup"
              data-testid="start-here-subscribe"
              className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200 self-start md:self-auto"
            >
              Subscribe
            </Link>
          </div>
        </section>
      )}
    </MockupLayout>
  );
};

export default StartHereMockup;
