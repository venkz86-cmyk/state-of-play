import { Link } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';

const PAGES = [
  { no: '01', slug: '/mockup/home', title: 'Homepage', blurb: 'Lead, Briefing rail, The Desk grid, archive, testimonial, partners.' },
  { no: '02', slug: '/mockup/article', title: 'Article reading', blurb: 'Single column, share row, font-size toggle, paywall, related, comments.' },
  { no: '03', slug: '/mockup/feed', title: 'The State of Play (feed)', blurb: 'Front-page index of recent reportage.' },
  { no: '04', slug: '/mockup/left-field', title: 'The Left Field', blurb: 'Free Substack briefs.' },
  { no: '05', slug: '/mockup/subscribe', title: 'Subscribe', blurb: 'Pricing, what’s included, sample of the desk, FAQ.' },
  { no: '06', slug: '/mockup/teams', title: 'For Teams', blurb: 'Corporate plans, audiences, features.' },
  { no: '07', slug: '/mockup/outfield', title: 'The Outfield', blurb: 'Roundtables and Speakeasies.' },
  { no: '08', slug: '/mockup/about', title: 'About', blurb: 'Mission, coverage, editor.' },
  { no: '09', slug: '/mockup/partnerships', title: 'Partnerships', blurb: 'Founding / Lead / Associate tiers.' },
  { no: '10', slug: '/mockup/contact', title: 'Contact', blurb: 'Desks, tips and leaks.' },
  { no: '11', slug: '/mockup/login', title: 'Sign in', blurb: 'Member access.' },
  { no: '12', slug: '/mockup/account', title: 'Member dashboard', blurb: 'Plan, reading list, billing.' },
  { no: '13', slug: '/mockup/terms', title: 'Terms of Service', blurb: 'A short, readable contract.' },
  { no: '14', slug: '/mockup/privacy', title: 'Privacy Policy', blurb: 'Less data, kept carefully.' },
  { no: '15', slug: '/mockup/404', title: '404', blurb: 'Custom not-found page.' },
];

export const MockupIndex = () => (
  <MockupLayout testId="mockup-index">
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
      <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
        <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888]">
          Design Review · Edition Zero
        </span>
        <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888] tabular-nums">
          {PAGES.length.toString().padStart(2, '0')} surfaces
        </span>
      </div>
    </div>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-12">
      <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3rem] leading-[1.06] max-w-[24ch] mb-5">
        The new aesthetic, <em className="italic font-normal">page by page.</em>
      </h1>
      <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)] max-w-[60ch]">
        Each surface sandboxed under <code className="font-plex text-sm text-[var(--accent-burgundy)]">/mockup</code>. The live site is untouched. Append <code className="font-plex text-sm text-[var(--accent-burgundy)]">?preview=member</code> to most pages to see the logged-in state.
      </p>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
      <div className="border-t border-[var(--rule)]">
        {PAGES.map((p) => (
          <Link
            key={p.slug}
            to={p.slug}
            data-testid={`index-${p.no}`}
            className="group grid grid-cols-12 gap-6 lg:gap-10 items-baseline py-6 lg:py-7 border-b border-[var(--rule)]"
          >
            <span className="col-span-2 md:col-span-1 font-plex text-xs text-[var(--text-label)] tabular-nums">{p.no}</span>
            <div className="col-span-10 md:col-span-8">
              <h2 className="headline-lock font-editorial font-medium text-xl lg:text-[1.5rem] leading-snug">
                {p.title}
              </h2>
              <p className="font-plex text-sm text-[var(--text-muted)] mt-1.5 max-w-[55ch]">{p.blurb}</p>
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
