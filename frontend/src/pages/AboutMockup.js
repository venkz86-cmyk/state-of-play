import { Link } from 'react-router-dom';
import { Linkedin, Mail } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const COVERAGE = [
  ['Cricket Markets', 'Franchise valuations, IPL economics, M&A, media rights.'],
  ['Football', 'ISL, federation, club ownership, broadcast.'],
  ['Media Rights', 'Broadcasting deals, streaming wars, viewership.'],
  ['Governance', 'BCCI, IOA, federations and sports policy.'],
  ['Sponsorship', 'Brand deals, endorsements, activation strategies.'],
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

export const AboutMockup = () => (
  <MockupLayout testId="mockup-about">
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
      <div className="flex items-baseline justify-between border-b border-[#0F172A]/15 dark:border-[#F8FAFC]/15 pb-3">
        <Overline className="!normal-case !tracking-normal !text-sm">Bengaluru</Overline>
        <span className="font-editorial italic text-sm text-[#475569] dark:text-[#94A3B8] tabular-nums">About</span>
      </div>
    </div>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-16">
      <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3.25rem] leading-[1.05] mb-7 max-w-[22ch]">
        A weekly publication for <em className="italic font-normal">how sport actually works.</em>
      </h1>
      <p className="font-plex text-lg lg:text-xl text-[#475569] dark:text-[#94A3B8] max-w-[60ch] leading-relaxed">
        The State of Play is a subscription-only publication providing in-depth, original insight into the business of sport — with sharp reporting, analysis and a distinct editorial voice grounded in India.
      </p>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-3"><p className="font-editorial italic text-lg">Editor’s note</p></div>
      <div className="lg:col-span-9 space-y-5 font-plex text-base lg:text-lg leading-relaxed text-[#334155] dark:text-[#CBD5E1] max-w-[65ch]">
        <p className="font-editorial font-medium text-xl lg:text-[1.5rem] leading-snug tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          Sport is no longer just what happens on the field. It is a high-stakes, capital-intensive and profoundly global business with fast-evolving dynamics.
        </p>
        <p>
          In India, however, most coverage still gravitates to match results or off-field drama. As social media accelerates that cycle, a gap has opened for sustained, intelligent reporting on how sport actually works.
        </p>
        <p>
          The State of Play aims to fill that gap. Each week, you’ll receive a carefully reported edition on how money, power and strategy are reordering Indian sport, and what those shifts mean for the wider sporting economy.
        </p>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
      <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
        <p className="font-editorial italic text-lg mb-6">What we cover</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-7">
          {COVERAGE.map(([t, d], i) => (
            <div key={t}>
              <p className="font-plex text-xs tracking-[0.18em] uppercase text-[#94A3B8] tabular-nums mb-2">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="font-editorial font-medium text-lg leading-snug mb-1.5">{t}</h3>
              <p className="font-plex text-sm leading-relaxed text-[#475569] dark:text-[#94A3B8]">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
      <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <p className="font-editorial italic text-lg mb-3">Our readers</p>
          <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] max-w-[40ch] leading-relaxed">
            Indian sport is no longer a local story. International funds, families and franchises are actively evaluating the world’s fastest-growing sports economy — and they read us.
          </p>
        </div>
        <div className="lg:col-span-8">
          <ul className="border-t border-[#E2E8F0] dark:border-[#1E293B]">
            {READERS.map((r, i) => (
              <li key={r} className="flex items-baseline gap-4 py-3 border-b border-[#E2E8F0] dark:border-[#1E293B]">
                <span className="font-plex text-xs text-[#94A3B8] tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-plex text-base">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
      <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-3">
          <p className="font-editorial italic text-lg mb-3">Editor</p>
        </div>
        <div className="lg:col-span-9 max-w-[60ch]">
          <h2 className="font-editorial font-semibold tracking-tight text-2xl lg:text-[2rem] leading-tight mb-4">
            Venkat Ananth.
          </h2>
          <p className="font-plex text-base lg:text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-4">
            A Bengaluru-based journalist who focuses on deeply reported stories about the business of sport and technology.
          </p>
          <p className="font-plex text-base leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-6">
            Over 18 years he has worked with leading Indian publications including <em>Hindustan Times</em>, Yahoo! Cricket, <em>Mint</em>, <em>The Ken</em>, <em>The Economic Times</em>, <em>The Times of India</em> and <em>The Indian Express</em>.
          </p>
          <div className="flex items-center gap-6">
            <a href="https://www.linkedin.com/in/venkat-ananth/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-plex text-sm text-[#0F172A] dark:text-[#F8FAFC] underline underline-offset-[6px] decoration-1 hover:text-[var(--accent)] hover:decoration-2 transition-all">
              <Linkedin className="h-3.5 w-3.5" strokeWidth={1.5} />
              LinkedIn
            </a>
            <a href="mailto:venkat@stateofplay.club" className="inline-flex items-center gap-2 font-plex text-sm text-[#0F172A] dark:text-[#F8FAFC] underline underline-offset-[6px] decoration-1 hover:text-[var(--accent)] hover:decoration-2 transition-all">
              <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
              venkat@stateofplay.club
            </a>
          </div>
          <Link to="/mockup/subscribe" data-testid="about-cta" className="inline-block mt-10 font-plex text-base text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all">
            View membership →
          </Link>
        </div>
      </div>
    </section>
  </MockupLayout>
);

export default AboutMockup;
