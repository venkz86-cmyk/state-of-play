import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupHeader } from '../components/MockupHeader';
import { MockupFooter } from '../components/MockupFooter';

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

// Mock Left Field briefs (free newsletter teaser)
const BRIEFS = [
  { title: 'BCCI commercial committee meets Thursday', date: '03 Jun', tag: 'Note' },
  { title: 'Sponsorship volumes Q1 ’26: ₹4,300 Cr, down 7%', date: '02 Jun', tag: 'Number' },
  { title: 'Why three franchises are quietly re-pricing their kit deals', date: '01 Jun', tag: 'Brief' },
  { title: 'The PE bid for an ISL club has stalled. Sources tell us why.', date: '30 May', tag: 'Tip' },
];

// Section label — small caps, restrained
const SectionLabel = ({ children, className = '' }) => (
  <p className={`font-plex text-[11px] tracking-[0.18em] uppercase text-[#475569] dark:text-[#94A3B8] tabular-nums ${className}`}>
    {children}
  </p>
);

export const HomeMockup = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const { canAccessPremium } = useAuth();

  const previewMember = searchParams.get('preview') === 'member';
  const isMember = canAccessPremium || previewMember;

  // Locked typography system
  const system = { display: 'Fraunces', body: 'Geist', tracking: '0.14em' };

  useEffect(() => {
    (async () => {
      try {
        const posts = await ghostAPI.getPosts({ limit: 20 });
        setArticles(posts);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <span className="text-sm text-[#475569]">Loading…</span>
      </div>
    );
  }

  const lead = articles[0];
  const secondary = articles.slice(1, 4);     // 3 stories
  const desk = articles.slice(4, 10);         // 6 stories — 3 columns × 2 each
  const archive = articles.slice(10);

  return (
    <div
      className="min-h-screen bg-[#F7F7F5] dark:bg-[#090E17] text-[#0F172A] dark:text-[#F8FAFC]"
      style={{
        '--display-font': `'${system.display}'`,
        '--body-font': `'${system.body}'`,
        '--label-font': `'${system.body}'`,
        '--label-tracking': system.tracking,
      }}
      data-testid="mockup-home"
    >
      <MockupHeader />

      {/* DATELINE */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[#0F172A]/15 dark:border-[#F8FAFC]/15 pb-3">
          <span className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
            Bengaluru · {datelineDate()}
          </span>
          <span className="font-editorial italic text-sm text-[#475569] dark:text-[#94A3B8] tabular-nums">
            No.&nbsp;47 · Vol.&nbsp;I
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

            {/* BRIEFING RAIL */}
            <aside className="lg:col-span-4 lg:border-l lg:border-[#0F172A]/15 lg:dark:border-[#F8FAFC]/15 lg:pl-12">
              <div className="flex items-baseline justify-between mb-6">
                <p className="font-editorial italic text-lg text-[#0F172A] dark:text-[#F8FAFC]">
                  The Briefing
                </p>
                <SectionLabel>The Left Field · Free</SectionLabel>
              </div>
              <ul>
                {BRIEFS.map((b, i) => (
                  <li
                    key={i}
                    className={`pb-5 mb-5 ${i === BRIEFS.length - 1 ? '' : 'border-b border-[#E2E8F0] dark:border-[#1E293B]'}`}
                  >
                    <a
                      href="https://theleftfield.substack.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <SectionLabel className="!text-[10px] !tracking-[0.16em] !text-[var(--accent)]">
                          {b.tag}
                        </SectionLabel>
                        <SectionLabel className="!text-[10px] shrink-0">{b.date}</SectionLabel>
                      </div>
                      <h3 className="font-editorial font-medium text-base lg:text-[1.0625rem] leading-snug text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[var(--accent)] transition-colors duration-200">
                        {b.title}
                      </h3>
                    </a>
                  </li>
                ))}
              </ul>
              <a
                href="https://theleftfield.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-plex text-sm text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
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
                <p className="font-plex text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
                  {a.author || 'Venkat Ananth'} · {longDate(a.created_at)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* THE DESK — 3 column grid, 2 stories each, with section labels */}
      {desk.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-14 lg:pb-20">
          <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
            <div className="flex items-baseline justify-between mb-8">
              <p className="font-editorial italic text-lg text-[#0F172A] dark:text-[#F8FAFC]">
                The Desk
              </p>
              <SectionLabel>This issue · {desk.length.toString().padStart(2, '0')} stories</SectionLabel>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 lg:gap-x-12 gap-y-8">
              {desk.map((a) => (
                <Link
                  key={a.id}
                  to={`/${a.id}`}
                  data-testid={`desk-${a.id}`}
                  className="group block py-5 border-b border-[#E2E8F0] dark:border-[#1E293B]"
                >
                  <SectionLabel className="mb-2">{a.theme || 'Analysis'}</SectionLabel>
                  <h3 className="font-editorial font-medium text-base lg:text-[1.125rem] leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-2 group-hover:text-[var(--accent)] transition-colors duration-200">
                    {a.title}
                  </h3>
                  <p className="font-plex text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
                    {a.author || 'Venkat Ananth'} · {longDate(a.created_at)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ARCHIVE — quiet dense list */}
      {archive.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-20 lg:pb-28">
          <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
            <p className="font-editorial italic text-lg text-[#0F172A] dark:text-[#F8FAFC] mb-6">
              From the Archive
            </p>
            <div className="border-t border-[#E2E8F0] dark:border-[#1E293B]">
              {archive.map((a) => (
                <Link
                  key={a.id}
                  to={`/${a.id}`}
                  data-testid={`archive-${a.id}`}
                  className="group flex items-baseline justify-between gap-6 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B]"
                >
                  <div className="flex-1 min-w-0">
                    <h2 className="headline-lock font-editorial font-medium text-base lg:text-[1.0625rem] leading-snug">
                      {a.title}
                    </h2>
                    <p className="font-plex text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
                      {a.author || 'Venkat Ananth'}
                      {a.theme ? <span className="text-[#94A3B8]"> · {a.theme}</span> : null}
                    </p>
                  </div>
                  <p className="font-plex text-xs text-[#475569] dark:text-[#94A3B8] shrink-0 tabular-nums whitespace-nowrap">
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
              Independent reporting on the business of Indian sport. ₹2,495 a year.
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

      <MockupFooter />
    </div>
  );
};

export default HomeMockup;
