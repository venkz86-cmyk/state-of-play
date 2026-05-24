import { ArrowUpRight, MapPin } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const ROUNDTABLES = [
  { period: 'May', city: 'Mumbai', confirmed: true, registerUrl: 'https://lu.ma/8xh1try1' },
  { period: 'June / July', city: 'Bengaluru', tentative: true },
  { period: 'September / October', city: 'New Delhi', tentative: true },
  { period: 'December', city: 'Mumbai or Bengaluru', tentative: true },
];

const SPEAKEASIES = [
  { period: 'June', city: 'Bengaluru', tentative: true },
  { period: 'November', city: 'New Delhi', tentative: true },
];

const AUDIENCE = [
  'VCs investing in gaming and sports tech',
  'Founders running platforms and apps',
  'Gaming company executives',
  'IPL franchise executives',
  'PE investors evaluating sports as an asset class',
  'Investment bankers',
  'Broadcast executives and media buyers',
  'Sports lawyers and law firms',
];

const Sched = ({ rows, accent }) => (
  <ul className="border-t border-[#0F172A]/15 dark:border-[#F8FAFC]/15">
    {rows.map((r) => (
      <li
        key={`${r.period}-${r.city}`}
        className="grid grid-cols-12 gap-3 items-baseline py-4 border-b border-[#0F172A]/10 dark:border-[#F8FAFC]/10"
      >
        <Overline className={`col-span-4 ${accent}`}>{r.period}</Overline>
        <div className="col-span-6 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-[#94A3B8]" strokeWidth={1.5} />
          <span className={`font-plex text-sm ${r.confirmed ? 'font-semibold text-[#0F172A] dark:text-[#F8FAFC]' : 'text-[#475569] dark:text-[#94A3B8]'}`}>
            {r.city}
          </span>
          {r.tentative && (
            <Overline className="text-[#94A3B8]">Tentative</Overline>
          )}
        </div>
        <div className="col-span-2 flex justify-end">
          {r.registerUrl ? (
            <a
              href={r.registerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-[var(--accent)] border-b border-[var(--accent)]/40 pb-px hover:border-[var(--accent)] transition-colors duration-200"
            >
              Register
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          ) : (
            <Overline className="text-[#94A3B8]">Soon</Overline>
          )}
        </div>
      </li>
    ))}
  </ul>
);

export const OutfieldMockup = () => {
  return (
    <MockupLayout testId="mockup-outfield">
      {/* Hero */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-32">
          <Overline className="text-[#234ba0] mb-5 block">— The Outfield —</Overline>
          <h1 className="font-editorial font-semibold tracking-tight text-[3rem] sm:text-6xl lg:text-[6rem] leading-[0.95] max-w-5xl">
            Where sports business{' '}
            <em className="italic font-normal text-[#234ba0]">meets, in person.</em>
          </h1>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
            <Overline>Mumbai</Overline>
            <Overline>Bengaluru</Overline>
            <Overline>New Delhi</Overline>
            <Overline className="text-[var(--accent)]">Three cities · Six events · 2026</Overline>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-3">
            <Overline className="text-[var(--accent)]">— Premise —</Overline>
          </div>
          <div className="lg:col-span-9 space-y-6 font-editorial text-2xl lg:text-[2rem] leading-snug tracking-tight text-[#0F172A] dark:text-[#F8FAFC] max-w-[55ch]">
            <p>
              The State of Play covers the business of Indian sport. <span className="text-[#234ba0]">The Outfield</span> is where that community meets in person.
            </p>
            <p className="font-plex font-normal text-base lg:text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] max-w-[60ch]">
              Quarterly Roundtables for subscribers. Premium Speakeasies for decision-makers. Small formats that force depth and encourage candour.
            </p>
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <Overline className="text-[#234ba0] mb-3 block">— The Events —</Overline>
          <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05] mb-14">
            Two formats.
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Roundtables */}
            <div data-testid="outfield-roundtables">
              <Overline className="text-[var(--accent)] mb-4 block">— 01 — Quarterly Subscriber Discussions</Overline>
              <h3 className="font-editorial font-semibold tracking-tight text-3xl lg:text-[2.5rem] leading-tight mb-5">
                The Roundtables.
              </h3>
              <p className="font-plex text-base lg:text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-6 max-w-[55ch]">
                Closed-door. Ninety minutes. We take a Friday story from The State of Play and go deeper with the protagonist. What couldn’t fit in 1,500 words. What has developed since.
              </p>

              <ul className="grid grid-cols-2 gap-y-2 gap-x-6 mb-8">
                <li className="font-plex text-sm"><span className="text-[#94A3B8]">Size · </span>25–30 people</li>
                <li className="font-plex text-sm"><span className="text-[#94A3B8]">In 2026 · </span>4 events</li>
                <li className="font-plex text-sm"><span className="text-[#94A3B8]">Setting · </span>Boardroom or café</li>
                <li className="font-plex text-sm"><span className="text-[#94A3B8]">Cost · </span>Free for subscribers</li>
              </ul>

              <Overline className="block mb-4">2026 Schedule</Overline>
              <Sched rows={ROUNDTABLES} accent="!text-[#234ba0]" />

              <p className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase text-[#94A3B8] mt-6 max-w-[40ch]">
                Tickets redeemable against an annual State of Play subscription.
              </p>
            </div>

            {/* Speakeasies */}
            <div data-testid="outfield-speakeasies">
              <Overline className="text-[var(--accent)] mb-4 block">— 02 — Premium Off-Record Gatherings</Overline>
              <h3 className="font-editorial font-semibold tracking-tight text-3xl lg:text-[2.5rem] leading-tight mb-5">
                The Speakeasy.
              </h3>
              <p className="font-plex text-base lg:text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8] mb-6 max-w-[55ch]">
                Each speaker gets 20–30 minutes for a fireside chat. Forward-looking topics. After the chats, Q&A, a short pub quiz, then networking. One drink on the house. The evening runs about two and a half hours.
              </p>

              <ul className="grid grid-cols-2 gap-y-2 gap-x-6 mb-8">
                <li className="font-plex text-sm"><span className="text-[#94A3B8]">Size · </span>30 people, 3 CXOs</li>
                <li className="font-plex text-sm"><span className="text-[#94A3B8]">In 2026 · </span>2 events</li>
                <li className="font-plex text-sm"><span className="text-[#94A3B8]">Setting · </span>Cocktail bar</li>
                <li className="font-plex text-sm"><span className="text-[#94A3B8]">Cost · </span>Ticketed</li>
              </ul>

              <Overline className="block mb-4">2026 Schedule</Overline>
              <Sched rows={SPEAKEASIES} accent="!text-[var(--accent)]" />
            </div>
          </div>
        </div>
      </section>

      {/* Why this works — pull quote */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-3">
            <Overline className="text-[var(--accent)]">— Why It Works —</Overline>
          </div>
          <blockquote className="lg:col-span-9 border-l-4 border-[var(--accent)] pl-8 lg:pl-12 max-w-[60ch]">
            <p className="font-editorial italic text-2xl sm:text-3xl lg:text-[2.25rem] leading-[1.18] text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
              “No stages. No panels. No 500-person halls. Small rooms force depth. The Chatham House rule encourages honesty. This is where the real conversations happen.”
            </p>
          </blockquote>
        </div>
      </section>

      {/* Audience */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <Overline className="text-[#234ba0] mb-3 block">— Who Attends —</Overline>
          <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05] mb-12">
            The room, broadly.
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 border-y border-[#0F172A]/10 dark:border-[#F8FAFC]/10 divide-y md:divide-y-0">
            {AUDIENCE.map((a, i) => (
              <li
                key={a}
                className="flex items-baseline gap-4 py-4 border-b border-[#0F172A]/10 dark:border-[#F8FAFC]/10 last:border-b-0"
              >
                <span className="font-plex tabular-nums text-[11px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-plex text-base lg:text-lg leading-snug">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0F172A] text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8">
            <Overline className="text-[var(--accent)] mb-5 block">— Stay in the loop —</Overline>
            <h2 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[3.5rem] leading-[1.05] max-w-3xl">
              Event announcements go out via the newsletter.
            </h2>
          </div>
          <div className="lg:col-span-4 flex flex-col gap-4 lg:items-end">
            <a
              href="/mockup/subscribe"
              data-testid="outfield-cta"
              className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-10 py-5 text-base tracking-wide transition-colors duration-200"
            >
              Subscribe to TSOP
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </a>
            <a
              href="mailto:venkat@stateofplay.club"
              className="inline-flex items-center gap-2 font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors duration-200"
            >
              Questions? venkat@stateofplay.club
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default OutfieldMockup;
