import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowUpRight } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const SUBSTACK_URL = 'https://theleftfield.substack.com';

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

/* Sign-up in two steps. Substack has no supported way for another site to
   add a subscriber, so: (1) our own form creates a free member here
   (register-free: free account, signed in, welcome email), then (2)
   Substack's own embedded form, where the reader enters their email once
   more and Substack sends The Left Field. A signed-in reader skips (1). */
const LeftFieldSignup = () => {
  const { user, registerFree } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading
  const [error, setError] = useState('');
  const [step, setStep] = useState(null); // null | 'new' | 'existing'

  const onSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) { setError('Enter a valid email address.'); return; }
    setError('');
    setStatus('loading');
    try {
      const result = await registerFree(trimmed, name.trim(), 'left-field-form');
      if (result.success) setStep('new');
      else if (result.exists) setStep('existing');
      else { setError(result.error); setStatus('idle'); }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  const substackStep = (heading, line) => (
    <div data-testid="leftfield-substack-step">
      {heading && <p className="font-editorial font-semibold text-2xl mb-2">{heading}</p>}
      <p className="font-plex text-[15px] text-[var(--text-muted)] leading-relaxed mb-4 max-w-[42ch]">{line}</p>
      <iframe
        title="Sign up for The Left Field on Substack"
        src={`${SUBSTACK_URL}/embed`}
        className="w-full max-w-[480px] h-[320px] border border-[var(--rule)] bg-white"
        frameBorder="0"
        scrolling="no"
      />
    </div>
  );

  if (step === 'new') return substackStep('Last step.', 'Enter your email once more below. Substack sends The Left Field.');
  if (step === 'existing' || user?.email) {
    return substackStep(null, 'You already have an account here. Enter your email below to get The Left Field from Substack.');
  }

  const field = 'w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)] disabled:opacity-60';
  return (
    <form onSubmit={onSubmit} className="w-full max-w-[420px]" data-testid="leftfield-signup">
      <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-4">Get The Left Field free</p>
      <label htmlFor="lf-name" className="sr-only">Your name (optional)</label>
      <input id="lf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={status === 'loading'}
        placeholder="Your name (optional)" className={`${field} mb-4`} data-testid="leftfield-name" />
      <label htmlFor="lf-email" className="sr-only">Email</label>
      <input id="lf-email" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
        disabled={status === 'loading'} placeholder="Email" className={`${field} mb-6`} data-testid="leftfield-email" />
      <button type="submit" disabled={status === 'loading'} data-testid="leftfield-submit"
        className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-4 text-base tracking-wide transition-colors duration-200 disabled:opacity-60">
        {status === 'loading' ? 'Please wait…' : 'Sign up free'}
      </button>
      <p className="font-plex text-[13px] text-[var(--text-muted)] mt-3">You also get a free account on The State of Play.</p>
      {error && <p className="font-plex text-sm text-[var(--accent)] mt-3" data-testid="leftfield-error">{error}</p>}
      <a href={SUBSTACK_URL} target="_blank" rel="noopener noreferrer" data-testid="leftfield-subscribe"
        className="inline-flex items-center gap-1 font-plex text-[13px] text-[var(--text-muted)] underline underline-offset-4 mt-5 hover:text-[var(--text)]">
        Or sign up on Substack directly <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
      </a>
    </form>
  );
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso)
        .toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        .toUpperCase()
    : '';


export const LeftFieldMockup = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // No stand-in briefs when the feed can't load: invented headlines must
  // never reach a reader. They get a plain link to Substack instead.
  const [feedFailed, setFeedFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (API) {
          const r = await axios.get(`${API}/api/substack/feed`, { timeout: 15000 });
          if (active && Array.isArray(r.data) && r.data.length > 0) {
            setItems(r.data);
            return;
          }
        }
        if (active) setFeedFailed(true);
      } catch (e) {
        if (active) setFeedFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const lead = items[0];
  const secondary = items[1];
  const grid = items.slice(2, 5);
  const list = items.slice(5);

  return (
    <MockupLayout testId="mockup-leftfield" hideFooterHeroCta seo={{ title: 'Left Field', path: '/left-field', description: 'The Left Field: free news briefs on the deals and people moving Indian sport, twice a week.' }}>
      {/* Hero */}
      <section className="border-b border-[var(--rule)]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-5">
              <Overline className="text-[var(--accent)]">The Left Field</Overline>
              <span className="h-px w-8 bg-[var(--accent)]/40" />
              <Overline className="text-[var(--accent)]">Free · Twice a week</Overline>
            </div>
            <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[5rem] leading-[1] mb-6">
              The brief on{' '}
              <em className="italic font-normal text-[var(--accent)]">Indian sport, in your inbox.</em>
            </h1>
            <p className="font-plex text-lg lg:text-xl text-[var(--text-muted)] max-w-[60ch] leading-relaxed">
              Short, sharp news briefs on the deals and people moving Indian sport. Published twice a week on Substack. Free to read. The on-ramp to the full TSOP desk.
            </p>
          </div>
          <div className="lg:col-span-4">
            <LeftFieldSignup />
          </div>
        </div>
      </section>

      {/* Editor's pitch — italic strip */}
      <section className="border-b border-[var(--rule)] bg-[var(--surface)]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-3">
            <Overline className="text-[var(--accent)]">What it is</Overline>
          </div>
          <div className="lg:col-span-9 max-w-[60ch]">
            <p className="font-editorial italic text-2xl lg:text-[2rem] leading-[1.2] tracking-tight text-[var(--text)]">
              “Six minutes, twice a week. The deals worth knowing about and the small stories that turn into big ones.”
            </p>
            <footer className="mt-8 flex items-center gap-3">
              <span className="h-px w-12 bg-[var(--text)]" />
              <Overline>The Left Field · Editorial</Overline>
            </footer>
          </div>
        </div>
      </section>

      {/* Lead + grid */}
      {loading ? (
        <section className="py-20 text-center">
          <Overline>Loading edition…</Overline>
        </section>
      ) : feedFailed ? (
        <section className="border-b border-[var(--rule)]" data-testid="leftfield-feed-fallback">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
            <p className="font-editorial italic text-xl lg:text-2xl mb-4">The latest briefs are on Substack.</p>
            <a
              href="https://theleftfield.substack.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-plex text-[11px] tracking-[0.22em] uppercase text-[var(--text)] border-b border-[var(--text)] pb-1 hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors duration-200"
            >
              Read The Left Field <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          </div>
        </section>
      ) : (
        <>
          {lead && (
            <section className="border-b border-[var(--rule)]">
              <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
              <div className="lg:col-span-7 flex flex-col">
                <a
                  href={lead.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="leftfield-lead"
                  className="group block"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Overline className="text-[var(--accent)]">Latest Brief</Overline>
                    <span className="h-px w-6 bg-[var(--accent)]/40" />
                    <Overline>{fmtDate(lead.created_at)}</Overline>
                  </div>
                  <h2 className="headline-lock font-editorial font-semibold tracking-tight text-3xl lg:text-[3rem] leading-[1.05] mb-5">
                    {lead.title}
                  </h2>
                  {lead.subtitle && (
                    <p className="font-reading italic text-xl lg:text-[1.5rem] text-[var(--text-secondary)] max-w-[60ch] leading-[1.5] mb-6">
                      {lead.subtitle}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-[var(--text)] border-b border-[var(--text)] pb-1 group-hover:text-[var(--accent)] group-hover:border-[var(--accent)] transition-colors duration-200">
                    Read on Substack
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </span>
                </a>

                {/* Secondary brief — fills the column visually when no body text is available */}
                {secondary && (
                  <a
                    href={secondary.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="leftfield-secondary"
                    className="group block mt-12 pt-10 border-t border-[var(--rule)]"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Overline className="text-[var(--accent)]">Also this week</Overline>
                      <span className="h-px w-6 bg-[var(--accent)]/40" />
                      <Overline>{fmtDate(secondary.created_at)}</Overline>
                    </div>
                    <h3 className="headline-lock font-editorial font-semibold tracking-tight text-2xl lg:text-[1.875rem] leading-[1.15] mb-3">
                      {secondary.title}
                    </h3>
                    {secondary.subtitle && (
                      <p className="font-reading italic text-base lg:text-lg text-[var(--text-muted)] max-w-[60ch] leading-snug">
                        {secondary.subtitle}
                      </p>
                    )}
                  </a>
                )}
              </div>

                <aside className="lg:col-span-5 lg:pl-10 lg:border-l lg:border-[var(--rule)]">
                  <Overline className="text-[var(--accent)] mb-8 block">Recent briefs</Overline>
                  <ul>
                    {grid.map((p, i) => (
                      <li
                        key={p.id}
                        className={i === grid.length - 1 ? '' : 'pb-7 mb-7 border-b border-[var(--rule)]'}
                      >
                        <a
                          href={p.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block"
                          data-testid={`leftfield-side-${p.id}`}
                        >
                          <Overline className="block mb-2">{fmtDate(p.created_at)}</Overline>
                          <h3 className="headline-lock font-editorial font-semibold text-xl lg:text-[1.5rem] leading-[1.2] mb-2">
                            {p.title}
                          </h3>
                          {p.subtitle && (
                            <p className="font-plex text-sm text-[var(--text-muted)] line-clamp-2 max-w-[40ch]">
                              {p.subtitle}
                            </p>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </section>
          )}

          {/* Index list */}
          {list.length > 0 && (
            <section className="border-b border-[var(--rule)]">
              <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
                <div className="flex items-end justify-between mb-12">
                  <div>
                    <Overline className="text-[var(--accent)] mb-3 block">The archive</Overline>
                    <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                      Earlier briefs.
                    </h2>
                  </div>
                </div>

                <ul className="border-t border-[var(--text)]">
                  {list.map((p, i) => (
                    <li key={p.id}>
                      <a
                        href={p.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`leftfield-list-${p.id}`}
                        className="group grid grid-cols-12 gap-6 lg:gap-10 items-baseline py-7 border-b border-[var(--rule)] hover:bg-[var(--surface)] -mx-3 px-3 transition-colors duration-200"
                      >
                        <span className="hidden md:block col-span-1 font-plex tabular-nums text-[11px] tracking-[0.22em] text-[var(--text-muted)] tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="col-span-12 md:col-span-2">
                          <Overline className="text-[var(--accent)]">Brief</Overline>
                        </div>
                        <h3 className="col-span-12 md:col-span-7 font-editorial font-semibold text-xl lg:text-[1.5rem] leading-[1.2] group-hover:text-[var(--accent)] transition-colors duration-200">
                          {p.title}
                        </h3>
                        <div className="hidden md:flex col-span-2 items-center justify-end gap-3">
                          <Overline>{fmtDate(p.created_at)}</Overline>
                          <ArrowUpRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors duration-200" strokeWidth={1.5} />
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}

      {/* Closing note — a pointer to the paid desk, not a pricing pitch */}
      <section className="bg-[var(--surface)]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <div className="max-w-[640px]">
            <p className="font-editorial italic text-xl lg:text-[1.5rem] leading-[1.4] text-[var(--text)] mb-5">
              If the briefs are useful, the full desk goes further, with the deal analysis and reporting behind each brief.
            </p>
            <Link
              to="/state-of-play"
              data-testid="leftfield-upgrade"
              className="font-plex text-base text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-colors duration-200"
            >
              Read The State of Play
            </Link>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default LeftFieldMockup;
