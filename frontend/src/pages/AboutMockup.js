import { Link } from 'react-router-dom';
import { ArrowUpRight, Linkedin, Mail } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const COVERAGE = [
  ['IPL & Cricket Economics', 'Franchise valuations, media rights, player economics.'],
  ['Sports Tech', 'Startups, platforms and the digital transformation of sport.'],
  ['Media Rights', 'Broadcasting deals, streaming wars, viewership.'],
  ['Governance', 'BCCI, IOA, federations and sports policy.'],
  ['Sponsorships', 'Brand deals, endorsements, activation strategies.'],
  ['Infrastructure', 'Stadiums, facilities and real estate in sport.'],
];

const READERS = [
  'Premier League ownership groups',
  'Private equity and venture capital investors in India and abroad',
  'North American sports funds analysing cricket economics',
  'IPL franchise ownership and management teams',
  'Global sports agencies with India operations',
  'International consultancies advising on sports sector deals',
];

export const AboutMockup = () => {
  return (
    <MockupLayout testId="mockup-about">
      {/* Hero */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <Overline className="text-[#234ba0] mb-5 block">— About —</Overline>
          <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[5rem] leading-[1] max-w-4xl">
            A weekly publication for{' '}
            <em className="italic font-normal text-[#234ba0]">how sport actually works.</em>
          </h1>
          <p className="font-plex text-lg lg:text-xl text-[#475569] dark:text-[#94A3B8] mt-8 max-w-[60ch] leading-relaxed">
            The State of Play is a subscription-only publication providing in-depth, original insight into the business of sport — with sharp reporting, analysis and a distinct editorial voice grounded in India.
          </p>
        </div>
      </section>

      {/* Mission essay */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-3">
            <Overline className="text-[var(--accent)]">Editor’s Note</Overline>
          </div>
          <div className="lg:col-span-9 space-y-7 font-plex text-lg lg:text-xl leading-relaxed text-[#0F172A] dark:text-[#F8FAFC] max-w-[65ch]">
            <p className="font-editorial font-semibold text-2xl lg:text-[1.875rem] leading-snug tracking-tight">
              Sport is no longer just what happens on the field. It is a high-stakes, capital-intensive and profoundly global business with fast-evolving dynamics.
            </p>
            <p className="text-[#334155] dark:text-[#94A3B8]">
              In India, however, most coverage still gravitates to match results or off-field drama. As social media accelerates that cycle, a gap has opened for sustained, intelligent reporting on how sport actually works.
            </p>
            <p className="text-[#334155] dark:text-[#94A3B8]">
              The State of Play aims to fill that gap. Each week, you’ll receive a carefully reported edition that cuts through noise to explain how money, power and strategy are reshaping Indian sport — and how those shifts connect to the wider sporting economy. When a major story breaks, from sponsorships to media rights, we offer timely, informed perspective.
            </p>
          </div>
        </div>
      </section>

      {/* Coverage grid */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <div className="flex items-end justify-between mb-12">
            <div>
              <Overline className="text-[#234ba0] mb-3 block">— What We Cover —</Overline>
              <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                The remit, in brief.
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#E2E8F0] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B]">
            {COVERAGE.map(([title, desc], i) => (
              <div key={title} className="bg-[#F7F7F5] dark:bg-[#090E17] p-7 lg:p-8">
                <span className="font-plex-mono text-[10px] tracking-[0.22em] text-[#94A3B8] tabular-nums block mb-4">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-editorial font-semibold text-xl leading-snug text-[#0F172A] dark:text-[#F8FAFC] mb-3">
                  {title}
                </h3>
                <p className="font-plex text-sm leading-relaxed text-[#475569] dark:text-[#94A3B8]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why global investors */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <Overline className="text-[#234ba0] mb-3 block">— Global Readers —</Overline>
            <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-[3rem] leading-[1.05]">
              Why global investors read TSOP.
            </h2>
            <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] mt-5 leading-relaxed max-w-[40ch]">
              Indian sport is no longer a local story. International funds, families and franchises are actively evaluating the world’s fastest-growing sports economy — and they read us.
            </p>
          </div>
          <div className="lg:col-span-7">
            <Overline className="block mb-5">Our Readers Include</Overline>
            <ul className="border-y border-[#0F172A]/15 dark:border-[#F8FAFC]/15 divide-y divide-[#0F172A]/10 dark:divide-[#F8FAFC]/10">
              {READERS.map((r) => (
                <li key={r} className="py-4 flex items-baseline gap-4">
                  <span className="font-plex-mono text-[11px] tracking-[0.22em] text-[#234ba0]">·</span>
                  <span className="font-plex text-base lg:text-lg leading-snug">
                    {r}
                  </span>
                </li>
              ))}
            </ul>
            <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] mt-8">
              Cited by{' '}
              <span className="text-[#0F172A] dark:text-[#F8FAFC] font-medium">Bloomberg, SportBusiness, ESPNCricinfo, The Athletic, SportsPro</span> and leading sports and business media globally.
            </p>
          </div>
        </div>
      </section>

      {/* Editor / Author block */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-3">
            <div className="aspect-[3/4] bg-[#0F172A] dark:bg-[#F8FAFC] flex items-center justify-center">
              <span className="font-editorial text-[7rem] leading-none text-[#F7F7F5] dark:text-[#090E17]">V</span>
            </div>
            <Overline className="block mt-4">Founding Editor</Overline>
          </div>
          <div className="lg:col-span-8 lg:col-start-5">
            <Overline className="text-[var(--accent)] mb-5 block">Who’s Behind It</Overline>
            <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-[3rem] leading-[1.05] mb-6">
              Venkat Ananth.
            </h2>
            <p className="font-plex text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-5 max-w-[60ch]">
              A Bengaluru-based journalist and writer who focuses on deeply reported stories about the business of sport and technology.
            </p>
            <p className="font-plex text-base leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-8 max-w-[60ch]">
              Over 18 years he has worked with and written for leading Indian print and digital publications, including <em>Hindustan Times</em>, Yahoo! Cricket, <em>Mint</em>, <em>The Ken</em>, <em>The Economic Times</em>, <em>The Times of India</em> and, until recently, <em>The Indian Express</em>.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <a
                href="https://www.linkedin.com/in/venkat-ananth/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1 hover:text-[#234ba0] hover:border-[#234ba0] transition-colors duration-200"
              >
                <Linkedin className="h-3.5 w-3.5" strokeWidth={1.5} />
                LinkedIn
              </a>
              <a
                href="mailto:venkat@stateofplay.club"
                className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1 hover:text-[#234ba0] hover:border-[#234ba0] transition-colors duration-200"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                venkat@stateofplay.club
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-32">
          <Overline className="text-[var(--accent)] mb-5 block">Support the desk</Overline>
          <h2 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[3.5rem] leading-[1.05] max-w-3xl mb-8">
            Independent journalism, paid for by readers.
          </h2>
          <Link
            to="/mockup/subscribe"
            data-testid="about-cta"
            className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
          >
            View membership
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </section>
    </MockupLayout>
  );
};

export default AboutMockup;
