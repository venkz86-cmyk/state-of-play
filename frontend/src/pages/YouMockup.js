import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { getBookmarks, removeBookmark } from '../components/Bookmarks';
import { getReadingHistory } from '../components/ReadingHistory';

/* /you: the app's You tab. Saved stories come first because saving for
   later is the frequent thing; membership (renewal, invoices,
   notifications) sits below because it's needed a few times a year.
   Saved and recently read live in this browser (components/Bookmarks.js,
   ReadingHistory.js), so they work signed out too. */
const label = 'font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)]';

const StoryRow = ({ item, onRemove }) => (
  <li className="border-b border-[var(--rule)] flex items-start gap-3">
    <Link to={`/${item.id}`} className="group flex-1 min-w-0 py-4">
      <p className="font-editorial text-[19px] leading-snug group-hover:text-[var(--text-muted)] transition-colors">{item.title}</p>
      {(item.theme || item.read_time) && (
        <p className="font-plex text-[12px] text-[var(--text-muted)] mt-1.5">
          {[item.theme, item.read_time ? `${item.read_time} min read` : null].filter(Boolean).join(' · ')}
        </p>
      )}
    </Link>
    {onRemove && (
      <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title} from saved`}
        className="mt-3 h-10 w-10 -mr-2 shrink-0 inline-flex items-center justify-center text-[var(--text-label)] hover:text-[var(--text)]">
        <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
    )}
  </li>
);

const LinkRow = ({ to, title, desc, testId }) => (
  <li className="border-b border-[var(--rule)]">
    <Link to={to} data-testid={testId} className={`group flex items-center justify-between gap-4 ${desc ? 'py-4' : 'py-3.5'}`}>
      <span>
        <span className={`block font-plex ${desc ? 'text-[16px] font-medium' : 'text-[15px]'}`}>{title}</span>
        {desc && <span className="block font-plex text-[13px] text-[var(--text-muted)] mt-0.5">{desc}</span>}
      </span>
      <span className="font-plex text-[18px] text-[var(--text-label)] group-hover:text-[var(--text)]" aria-hidden="true">›</span>
    </Link>
  </li>
);

export const YouMockup = () => {
  const { user, isLoggedIn, loading } = useAuth();
  const [saved, setSaved] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    setSaved(getBookmarks());
    const savedIds = new Set(getBookmarks().map((s) => s.id));
    setRecent(getReadingHistory().filter((r) => !savedIds.has(r.id)).slice(0, 5));
  }, []);

  const remove = (id) => { removeBookmark(id); setSaved(getBookmarks()); };
  const first = (user?.name || '').trim().split(/\s+/)[0];

  return (
    <MockupLayout testId="page-you" seo={{ title: 'You', path: '/you', noindex: true }}>
      <div className="max-w-[720px] mx-auto px-6 lg:px-0 pt-10 lg:pt-16 pb-16">
        <div className="border-b border-[var(--rule)] pb-3 mb-8"><Overline>You</Overline></div>
        <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.1] mb-10" data-testid="you-heading">
          {isLoggedIn && first ? `Hello, ${first}.` : 'Your reading.'}
        </h1>

        <section className="mb-12" data-testid="you-saved">
          <div className="flex items-baseline justify-between border-b border-[var(--text)] pb-3">
            <p className={label}>Saved for later</p>
            {saved.length > 0 && <span className="font-plex text-[12px] text-[var(--text-muted)] tabular-nums">{saved.length}</span>}
          </div>
          {saved.length ? (
            <ul>{saved.map((s) => <StoryRow key={s.id} item={s} onRemove={remove} />)}</ul>
          ) : (
            <p className="font-plex text-[15px] text-[var(--text-muted)] py-5 max-w-[48ch]">
              Nothing saved yet. Tap Save on any story and it waits for you here.
            </p>
          )}
        </section>

        {recent.length > 0 && (
          <section className="mb-12" data-testid="you-recent">
            <div className="border-b border-[var(--text)] pb-3"><p className={label}>Recently read</p></div>
            <ul>{recent.map((r) => <StoryRow key={r.id} item={r} />)}</ul>
          </section>
        )}

        <section data-testid="you-membership">
          <div className="border-b border-[var(--text)] pb-3"><p className={label}>Membership</p></div>
          {loading ? null : isLoggedIn ? (
            <ul>
              <LinkRow to="/account" title="Your account" desc="Renewal and GST invoices" testId="you-account" />
              <LinkRow to="/app" title="Notifications" desc="New stories on your phone" testId="you-notifications" />
              <LinkRow to="/gift" title="Give a year" desc="A year of The State of Play for someone else" testId="you-gift" />
            </ul>
          ) : (
            <div className="py-6">
              <p className="font-plex text-[15px] text-[var(--text-muted)] mb-5 max-w-[48ch]">
                Sign in with your subscription email to read every story.
              </p>
              <div className="flex flex-wrap items-center gap-6">
                <Link to="/login" data-testid="you-sign-in"
                  className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-12 px-8 transition-colors">
                  Sign in
                </Link>
                <Link to="/signup" className="font-plex text-[15px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)]">
                  Become a member
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="mt-12" data-testid="you-links">
          <div className="border-b border-[var(--text)] pb-3"><p className={label}>The State of Play</p></div>
          <ul>
            <LinkRow to="/about" title="About" />
            <LinkRow to="/contact" title="Contact" />
            <LinkRow to="/terms" title="Terms" />
            <LinkRow to="/privacy" title="Privacy" />
          </ul>
        </section>
      </div>
    </MockupLayout>
  );
};

export default YouMockup;
