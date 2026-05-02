import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const PAGES = [
  {
    section: 'Reading & Discovery',
    items: [
      {
        no: '01',
        slug: '/mockup/home',
        title: 'Homepage',
        blurb: 'Editorial bento — hero, side rail, columns and the editor’s note.',
        meta: 'Logged-out + member view',
      },
      {
        no: '02',
        slug: '/mockup/article',
        title: 'Article reading',
        blurb: 'Single column, drop cap, mono captions, paywall block, related desk.',
        meta: 'Paywalled + full read',
      },
      {
        no: '03',
        slug: '/mockup/feed',
        title: 'The State of Play (feed)',
        blurb: 'Front-page index of the week’s reportage, in print-column form.',
        meta: 'Listing layout',
      },
      {
        no: '04',
        slug: '/mockup/left-field',
        title: 'The Left Field',
        blurb: 'Free Substack briefs — bi-weekly news on Indian sports business.',
        meta: 'Free funnel page',
      },
    ],
  },
  {
    section: 'Conversion & Sales',
    items: [
      {
        no: '05',
        slug: '/mockup/subscribe',
        title: 'Subscribe',
        blurb: 'Hero, sharp pricing card, what’s included, premium analysis sample, FAQ.',
        meta: 'Highest-stakes surface',
      },
      {
        no: '06',
        slug: '/mockup/teams',
        title: 'For Teams',
        blurb: 'Corporate pricing, audiences, included features, FAQ, founders pitch.',
        meta: 'B2B sales page',
      },
      {
        no: '07',
        slug: '/mockup/outfield',
        title: 'The Outfield',
        blurb: 'Roundtables and Speakeasies — events, schedules, audience.',
        meta: 'Events page',
      },
    ],
  },
  {
    section: 'Editorial & Account',
    items: [
      {
        no: '08',
        slug: '/mockup/about',
        title: 'About',
        blurb: 'Mission, what we cover, who reads it, and the bylined editor.',
        meta: 'Editorial credibility',
      },
      {
        no: '09',
        slug: '/mockup/login',
        title: 'Sign in',
        blurb: 'Minimalist split-screen auth with editorial copy.',
        meta: 'Member access',
      },
      {
        no: '10',
        slug: '/mockup/account',
        title: 'Member dashboard',
        blurb: 'Plan, reading list, billing, preferences and Insider Drops teaser.',
        meta: 'Logged-in only (forced for review)',
      },
    ],
  },
];

export const MockupIndex = () => {
  return (
    <MockupLayout testId="mockup-index">
      {/* Hero */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <Overline className="text-[#234ba0] mb-5 block">Design Review · Edition Zero</Overline>
          <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[4rem] leading-[1.02] max-w-4xl">
            The new aesthetic,{' '}
            <em className="italic font-normal text-[#234ba0]">page by page.</em>
          </h1>
          <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] mt-6 max-w-2xl leading-relaxed">
            A tour of every key surface, redrawn in Playfair Display + IBM Plex with cardless, high-contrast layouts. Each piece is sandboxed under <code className="font-plex-mono text-sm text-[#234ba0]">/mockup</code> — your live site is untouched.
          </p>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
            <Overline>Cream &nbsp;·&nbsp; <span className="text-[#234ba0]">Brand Blue</span> &nbsp;·&nbsp; <span className="text-[#FF6B35]">Accent Orange</span></Overline>
            <Overline>10 surfaces</Overline>
            <Overline>British English</Overline>
          </div>
        </div>
      </section>

      {/* Index list */}
      {PAGES.map((group) => (
        <section
          key={group.section}
          className="border-b border-[#E2E8F0] dark:border-[#1E293B]"
        >
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
            <Overline className="text-[#234ba0] mb-8 block">— {group.section} —</Overline>

            <ul className="border-t border-[#0F172A] dark:border-[#F8FAFC]">
              {group.items.map((p) => (
                <li key={p.slug}>
                  <Link
                    to={p.slug}
                    data-testid={`index-link-${p.no}`}
                    className="group grid grid-cols-12 gap-6 lg:gap-10 items-baseline py-8 lg:py-10 border-b border-[#E2E8F0] dark:border-[#1E293B] hover:bg-[#F1F1EE] dark:hover:bg-[#0F172A] -mx-3 px-3 transition-colors duration-200"
                  >
                    <span className="col-span-2 md:col-span-1 font-plex-mono text-[11px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                      {p.no}
                    </span>
                    <div className="col-span-10 md:col-span-7">
                      <h2 className="font-editorial font-semibold tracking-tight text-2xl lg:text-[2rem] leading-[1.15] text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#234ba0] transition-colors duration-200">
                        {p.title}
                      </h2>
                      <p className="font-plex text-sm md:text-base text-[#475569] dark:text-[#94A3B8] mt-2 max-w-[55ch]">
                        {p.blurb}
                      </p>
                    </div>
                    <div className="col-span-12 md:col-span-3 flex items-center justify-start md:justify-end gap-3">
                      <Overline>{p.meta}</Overline>
                      <ArrowUpRight
                        className="h-4 w-4 text-[#94A3B8] group-hover:text-[#234ba0] transition-colors duration-200"
                        strokeWidth={1.5}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      {/* Notes */}
      <section className="bg-[#F1F1EE] dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-3">
              <Overline className="text-[#FF6B35]">Notes for review</Overline>
            </div>
            <div className="lg:col-span-9 space-y-5 font-plex text-base lg:text-lg leading-relaxed text-[#0F172A] dark:text-[#F8FAFC] max-w-[65ch]">
              <p>
                Append <code className="font-plex-mono text-sm text-[#234ba0]">?preview=member</code> to most pages to see the logged-in state without signing in.
              </p>
              <p>
                Real Ghost articles are pulled where possible, so headlines and subtitles reflect the actual publication.
              </p>
              <p>
                Nothing here is wired to live payments or auth — these are visual surfaces. Once you approve, we’ll roll the system out to the live routes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default MockupIndex;
