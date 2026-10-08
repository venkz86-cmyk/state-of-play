import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { STORIES_PER_SEASON, isSeasonStory } from '../lib/season';

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const pad = (n) => String(n).padStart(2, '0');

/* Season One: every story so far, numbered in publishing order and
   listed newest first, with a progress strip showing the slots still to
   come. The season is the first STORIES_PER_SEASON season stories
   (lib/season.js's isSeasonStory: not the welcome note, nothing tagged
   #not-season), the same rule the homepage's "No. X · Season One" count
   uses, so the two always agree. */
export const SeasonMockup = () => {
  const { canAccessPremium } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const all = await ghostAPI.getAllPosts();
      if (!active) return;
      // Numbered in publishing order (No. 01 is the first season story);
      // the welcome note and anything tagged #not-season don't count.
      const oldestFirst = all.filter(isSeasonStory)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setStories(oldestFirst.slice(0, STORIES_PER_SEASON));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const published = stories.length;
  const toCome = STORIES_PER_SEASON - published;
  const slots = Array.from({ length: STORIES_PER_SEASON }, (_, i) => stories[i] || null);

  return (
    <MockupLayout
      testId="mockup-season"
      seo={{
        title: 'Season One',
        path: '/season-one',
        description: 'Every story in Season One of The State of Play, the publication on the business of Indian sport.',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Bengaluru</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)]">Season One</span>
        </div>
      </div>

      {/* Intro + progress */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-12">
        <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] lg:text-[4rem] leading-[1.02] mb-6">
          Season One.
        </h1>
        <p className="font-plex text-lg lg:text-xl text-[var(--text-muted)] leading-relaxed max-w-[55ch] mb-10">
          A season of The State of Play is {STORIES_PER_SEASON} stories, one a week.
          {stories[0] && <> Season One began on {longDate(stories[0].created_at)}.</>}
        </p>

        {!loading && published > 0 && (
          <div data-testid="season-progress">
            {/* One cell per story in the season: filled once published. */}
            <div
              className="grid gap-[3px] mb-3"
              style={{ gridTemplateColumns: `repeat(${STORIES_PER_SEASON}, minmax(0, 1fr))` }}
              role="img"
              aria-label={`${published} of ${STORIES_PER_SEASON} stories published`}
            >
              {slots.map((s, i) => (
                <span
                  key={i}
                  className="h-5 lg:h-7"
                  style={{ backgroundColor: s ? 'var(--accent-burgundy)' : 'var(--rule)' }}
                />
              ))}
            </div>
            <p className="font-plex text-sm text-[var(--text-label)]">
              {published} of {STORIES_PER_SEASON} published.{toCome > 0 && ` ${toCome} to come.`}
            </p>
          </div>
        )}
      </section>

      {/* The list */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        {loading ? (
          <Overline>Loading the season…</Overline>
        ) : (
          <ol className="border-t border-[var(--text)]">
            {/* Newest first, so the page doubles as the season's archive.
                Each story keeps its season number. */}
            {stories.map((s, i) => ({ s, no: i + 1 })).reverse().map(({ s, no }) => (
              <li key={s.id} className="border-b border-[var(--rule)]">
                <Link
                  to={`/${s.id}`}
                  data-testid="season-story"
                  className="group grid grid-cols-12 gap-x-4 lg:gap-x-10 gap-y-1 items-baseline py-5"
                >
                  <span className="col-span-2 lg:col-span-1 font-plex text-[12px] tracking-[0.08em] text-[var(--text-label)]">
                    No.&nbsp;<span className="tabular-nums">{pad(no)}</span>
                  </span>
                  <h2 className="col-span-10 lg:col-span-7 font-editorial font-medium text-lg lg:text-xl leading-snug text-[var(--text)] group-hover:text-[var(--accent-burgundy)] transition-colors duration-200">
                    {s.title}
                  </h2>
                  <span className="col-span-10 col-start-3 lg:col-span-2 lg:col-start-auto font-plex text-[12px] uppercase tracking-[0.08em] text-[var(--text-label)]">
                    {s.theme}{s.is_premium ? '' : ' · Free'}
                  </span>
                  <span className="col-span-10 col-start-3 lg:col-span-2 lg:col-start-auto lg:text-right font-plex text-[12px] text-[var(--text-label)]">
                    {longDate(s.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {!canAccessPremium && !loading && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-24">
          <div className="border-t border-[var(--text)] pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <p className="font-editorial italic text-xl lg:text-2xl">A subscription opens every story in the season.</p>
            <Link
              to="/signup"
              data-testid="season-subscribe"
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

export default SeasonMockup;
