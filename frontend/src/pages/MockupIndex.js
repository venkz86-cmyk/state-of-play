import { Link } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';

const PAGES = [
  { no: '01', slug: '/mockup/home', title: 'Homepage', blurb: 'Lead, Briefing rail, The Desk grid, archive.' },
  { no: '02', slug: '/mockup/article', title: 'Article reading', blurb: 'Single column, filed-under footer, dense related.' },
  { no: '03', slug: '/mockup/feed', title: 'The State of Play (feed)', blurb: 'Front-page index of recent reportage.' },
  { no: '04', slug: '/mockup/left-field', title: 'The Left Field', blurb: 'Free Substack briefs.' },
  { no: '05', slug: '/mockup/subscribe', title: 'Subscribe', blurb: 'Pricing, what’s included, sample of the desk, FAQ.' },
  { no: '06', slug: '/mockup/teams', title: 'For Teams', blurb: 'Corporate plans, audiences, features.' },
  { no: '07', slug: '/mockup/outfield', title: 'The Outfield', blurb: 'Roundtables and Speakeasies.' },
  { no: '08', slug: '/mockup/about', title: 'About', blurb: 'Mission, coverage, editor.' },
  { no: '09', slug: '/mockup/login', title: 'Sign in', blurb: 'Member access.' },
  { no: '10', slug: '/mockup/account', title: 'Member dashboard', blurb: 'Plan, reading list, billing.' },
];

export const MockupIndex = () => (
  <MockupLayout testId="mockup-index">
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
      <div className="flex items-baseline justify-between border-b border-[#0F172A]/15 dark:border-[#F8FAFC]/15 pb-3">
        <span className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
          Design Review · Edition Zero
        </span>
        <span className="font-editorial italic text-sm text-[#475569] dark:text-[#94A3B8] tabular-nums">
          {PAGES.length.toString().padStart(2, '0')} surfaces
        </span>
      </div>
    </div>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-12">
      <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3rem] leading-[1.06] max-w-[24ch] mb-5">
        The new aesthetic, <em className="italic font-normal">page by page.</em>
      </h1>
      <p className="font-plex text-base lg:text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] max-w-[60ch]">
        Each surface sandboxed under <code className="font-plex text-sm text-[var(--accent)]">/mockup</code>. The live site is untouched. Append <code className="font-plex text-sm text-[var(--accent)]">?preview=member</code> to most pages to see the logged-in state.
      </p>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
      <div className="border-t border-[#0F172A] dark:border-[#F8FAFC]">
        {PAGES.map((p) => (
          <Link
            key={p.slug}
            to={p.slug}
            data-testid={`index-${p.no}`}
            className="group grid grid-cols-12 gap-6 lg:gap-10 items-baseline py-6 lg:py-7 border-b border-[#E2E8F0] dark:border-[#1E293B]"
          >
            <span className="col-span-2 md:col-span-1 font-plex text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">{p.no}</span>
            <div className="col-span-10 md:col-span-8">
              <h2 className="font-editorial font-medium text-xl lg:text-[1.5rem] leading-snug text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[var(--accent)] transition-colors duration-200">
                {p.title}
              </h2>
              <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] mt-1.5 max-w-[55ch]">{p.blurb}</p>
            </div>
            <div className="hidden md:flex col-span-3 items-baseline justify-end">
              <Overline className="!normal-case !tracking-normal !text-sm">View →</Overline>
            </div>
          </Link>
        ))}
      </div>
    </section>
  </MockupLayout>
);

export default MockupIndex;
