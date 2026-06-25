import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';
import { PartnersBlock } from '../components/PartnersBlock';

const API = process.env.REACT_APP_BACKEND_URL;

const datelineDate = (d = new Date()) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const shortDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const longDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

// Section label — Geist uppercase 11px, tracked
const SectionLabel = ({ children, className = '' }) => (
  <p className={`section-label ${className}`}>{children}</p>
);

/* ============ Testimonial block (Fix 12) ============ */
const TESTIMONIALS = [
  {
    quote: 'The only publication that treats Indian sports business as a serious beat.',
    name: '—',
    title: 'Awaiting reader attribution',
  },
  {
    quote: 'I read every edition. The RCB coverage alone was worth the subscription.',
    name: '—',
    title: 'Awaiting reader attribution',
  },
];

const TestimonialBlock = () => {
  const [i, setI] = useState(0);
  const t = TESTIMONIALS[i];
  return (
    <section
      data-testid="home-testimonial"
      className="theme-transition w-full"
      style={{ backgroundColor: 'var(--surface)' }}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <SectionLabel className="mb-6 block">What readers say</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          <div
            aria-hidden="true"
            className="hidden lg:block lg:col-span-1 font-editorial font-semibold leading-none text-[var(--rule)]"
            style={{ fontSize: '120px' }}
          >
            “
          </div>
          <div className="lg:col-span-9 max-w-[60ch]">
            <blockquote className="font-editorial italic text-[22px] leading-snug text-[var(--text)]">
              “{t.quote}”
            </blockquote>
            <p className="mt-5 font-plex text-[13px] font-bold text-[var(--text)]">
              {t.name}
            </p>
            <p className="font-plex text-[13px] text-[var(--text-label)]">
              {t.title}
            </p>
          </div>
          <div className="lg:col-span-2 flex lg:justify-end items-center gap-4 mt-2 lg:mt-0">
            <button
              type="button"
              onClick={() => setI((i + TESTIMONIALS.length - 1) % TESTIMONIALS.length)}
              data-testid="testimonial-prev"
              className="font-plex text-[12px] uppercase tracking-[0.08em] text-[var(--text-label)] hover:text-[var(--text)] transition-colors"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setI((i + 1) % TESTIMONIALS.length)}
              data-testid="testimonial-next"
              className="font-plex text-[12px] uppercase tracking-[0.08em] text-[var(--text-label)] hover:text-[var(--text)] transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};


export const HomeMockup = () => {
  const [articles, setArticles] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [editionNo, setEditionNo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const { canAccessPremium } = useAuth();

  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [posts, count] = await Promise.all([
          ghostAPI.getPosts({ limit: 20 }),
          ghostAPI.getPostCount(),
        ]);
        if (!active) return;
        setArticles(posts);
        if (count && count > 0) setEditionNo(count);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    (async () => {
      try {
        if (!API) return;
        const r = await axios.get(`${API}/api/substack/feed`, { timeout: 5000 });
        if (active && Array.isArray(r.data)) setBriefs(r.data.slice(0, 4));
      } catch (e) { /* sidebar is non-blocking */ }
    })();

    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <span className="font-plex text-sm text-[var(--text-muted)]">Loading…</span>
      </div>
    );
  }

  const lead = articles[0];
  const secondary = articles.slice(1, 4);     // 3 stories
  const desk = articles.slice(4, 10);         // 6 stories — 3 columns × 2 each
  const archive = articles.slice(10);

  return (
    <div
      className="theme-transition min-h-screen bg-[var(--bg)] text-[var(--text)]"
      data-testid="mockup-home"
    >
      <MockupHeader />

      {/* DATELINE — Geist, #444, weight 400, "No. X · Year Two" */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 md:gap-0 border-b border-[var(--rule)] pb-3">
          <span className="font-plex text-[14px] font-normal text-[#444444] dark:text-[#888888]">
            Bengaluru · {datelineDate()}
          </span>
          <span className="font-plex text-[14px] font-normal text-[#444444] dark:text-[#888888] tabular-nums">
            {editionNo ? `No.\u00A0${editionNo}` : 'No.\u00A047'} · Year Two
          </span>
        </div>
      </div>

      {/* HERO ROW — Lead (8 cols) + Briefing (4 cols) */}
      {lead && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-12 lg:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            {/* LEAD */}
            <Link to={`/${lead.id}`} data-testid="lead-link" className="group lg:col-span-8 block">
              {lead.image_url && (
                <div className="mb-6 lg:mb-7 overflow-hidden">
                  <img
                    src={lead.image_url}
                    alt={lead.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[16/10] object-cover saturate-0 group-hover:saturate-100 transition-all duration-700 ease-out"
                  />
                </div>
              )}
              <SectionLabel className="mb-3">
                {lead.theme || 'Lead'} {lead.is_premium ? ' · For Subscribers' : ''}
              </SectionLabel>
              <h1 className="font-editorial font-semibold tracking-tight text-[1.875rem] sm:text-[2.5rem] lg:text-[3rem] leading-[1.06] text-[#0F172A] dark:text-[#F8FAFC] mb-4 max-w-[22ch] group-hover:text-[var(--accent)] transition-colors duration-300">
                {lead.title}
              </h1>
              {lead.subtitle && (
                <p className="font-plex text-lg lg:text-xl leading-[1.45] text-[#334155] dark:text-[#CBD5E1] max-w-[55ch] mb-5">
                  {lead.subtitle}
                </p>
              )}
              <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
                By {lead.author || 'Venkat Ananth'}
                {lead.read_time ? <span className="text-[#94A3B8]"> · {lead.read_time} min read</span> : null}
              </p>
            </Link>

            {/* BRIEFING RAIL — Fix 12 final: "The Briefing" italic left,
                 "THE LEFT FIELD · FREE" (FREE in burgundy) right.
                 Each brief = date label + Fraunces 18px headline only. */}
            <aside className="lg:col-span-4 lg:border-l lg:border-[var(--rule)] lg:pl-12">
              <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-[var(--rule)]">
                <p className="font-editorial italic text-[18px] text-[var(--text)]">
                  The Briefing
                </p>
                <span className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]">
                  The Left Field <span className="text-[var(--accent-burgundy)]">· Free</span>
                </span>
              </div>
              <ul>
                {(briefs.length > 0 ? briefs : []).map((b, i, arr) => (
                  <li
                    key={b.id || i}
                    className={`py-4 ${i === arr.length - 1 ? '' : 'border-b border-[var(--rule)]'}`}
                  >
                    <a
                      href={b.external_url || 'https://theleftfield.substack.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                      data-testid={`home-brief-${i}`}
                    >
                      <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[#999999] mb-1.5">
                        {shortDate(b.created_at) || 'Brief'}
                      </p>
                      <h3 className="headline-lock font-editorial font-semibold text-[18px] leading-snug">
                        {b.title}
                      </h3>
                    </a>
                  </li>
                ))}
                {briefs.length === 0 && (
                  <li className="font-plex text-sm text-[var(--text-muted)]">
                    Loading briefs…
                  </li>
                )}
              </ul>
              <a
                href="https://theleftfield.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-6 font-plex text-[13px] text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2 transition-all"
              >
                Subscribe to The Left Field →
              </a>
            </aside>
          </div>
        </section>
      )}

      {/* SECONDARY ROW — 3 stories side by side */}
      {secondary.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12 lg:pb-14">
          <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8 grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-12">
            {secondary.map((a) => (
              <Link
                key={a.id}
                to={`/${a.id}`}
                data-testid={`secondary-${a.id}`}
                className="group block"
              >
                <SectionLabel className="mb-3">
                  {a.theme || 'Reportage'}{a.is_premium ? ' · For Subscribers' : ''}
                </SectionLabel>
                <h2 className="font-editorial font-medium tracking-tight text-xl lg:text-[1.5rem] leading-[1.2] text-[#0F172A] dark:text-[#F8FAFC] mb-3 group-hover:text-[var(--accent)] transition-colors duration-300">
                  {a.title}
                </h2>
                {a.subtitle && (
                  <p className="font-plex text-sm leading-relaxed text-[#475569] dark:text-[#94A3B8] line-clamp-3 mb-3">
                    {a.subtitle}
                  </p>
                )}
                <p className="font-plex text-[12px] text-[var(--text-label)] tabular-nums">
                  {a.author || 'Venkat Ananth'} · {longDate(a.created_at)}
                  {a.read_time ? ` · ${a.read_time} min read` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* THE DESK — 3 column grid, 2 stories each, with section labels */}
      {desk.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-14 lg:pb-20">
          <div className="border-t border-[var(--rule)] pt-8">
            <div className="flex items-baseline justify-between mb-8">
              <SectionLabel>The Desk</SectionLabel>
              <SectionLabel>This issue · {desk.length.toString().padStart(2, '0')} stories</SectionLabel>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 lg:gap-x-12 gap-y-8">
              {desk.map((a) => (
                <Link
                  key={a.id}
                  to={`/${a.id}`}
                  data-testid={`desk-${a.id}`}
                  className="group block py-5 border-b border-[var(--rule)]"
                >
                  <SectionLabel className="mb-2 block">{a.theme || 'Analysis'}</SectionLabel>
                  <h3 className="headline-lock font-editorial font-medium text-[20px] leading-snug mb-2">
                    {a.title}
                  </h3>
                  <p className="font-plex text-[12px] text-[var(--text-label)] tabular-nums">
                    {a.author || 'Venkat Ananth'} · {longDate(a.created_at)}
                    {a.read_time ? ` · ${a.read_time} min read` : ''}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WHAT READERS SAY + PARTNERS blocks intentionally hidden until
          we have real testimonials and partner logos to publish. */}

      {/* ARCHIVE — quiet dense list */}
      {archive.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-20 lg:pb-28">
          <div className="border-t border-[var(--rule)] pt-8">
            <SectionLabel className="mb-6 block">From the Archive</SectionLabel>
            <div className="border-t border-[var(--rule)]">
              {archive.map((a) => (
                <Link
                  key={a.id}
                  to={`/${a.id}`}
                  data-testid={`archive-${a.id}`}
                  className="group flex items-baseline justify-between gap-6 py-4 border-b border-[var(--rule)]"
                >
                  <div className="flex-1 min-w-0">
                    <h2 className="headline-lock font-editorial font-medium text-[17px] leading-snug">
                      {a.title}
                    </h2>
                    <p className="font-plex text-[12px] text-[var(--text-label)] mt-1">
                      {a.author || 'Venkat Ananth'}
                      {a.theme ? <span> · {a.theme}</span> : null}
                      {a.read_time ? <span> · {a.read_time} min read</span> : null}
                    </p>
                  </div>
                  <p className="font-plex text-[12px] text-[var(--text-label)] shrink-0 tabular-nums whitespace-nowrap">
                    {longDate(a.created_at)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* QUIET SUBSCRIBE */}
      {!isMember && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32 lg:pb-40">
          <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8 max-w-[55ch]">
            <p className="font-editorial italic text-xl lg:text-[1.5rem] leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-4">
              The State of Play is a reader-supported publication.
            </p>
            <p className="font-plex text-base leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-5">
              Independent reporting on the business of Indian sport. ₹2,499 + GST a year (₹2,949 total).
            </p>
            <Link
              to="/signup"
              data-testid="subscribe-link"
              className="font-plex text-base text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
            >
              Subscribe →
            </Link>
          </div>
        </section>
      )}

      <PartnersBlock />

      <MockupFooter />
    </div>
  );
};

export default HomeMockup;
