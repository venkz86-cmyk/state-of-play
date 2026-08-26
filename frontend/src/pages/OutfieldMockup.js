import { MockupLayout, Overline } from '../components/MockupLayout';

const ROUNDTABLES = [
  { period: 'May', city: 'Mumbai', done: true, heldDate: '07 May 2026' },
  { period: 'August', city: 'Bengaluru', done: true, heldDate: '01 Aug 2026' },
  { period: 'September / October', city: 'New Delhi', tentative: true },
  { period: 'December', city: 'Mumbai or Bengaluru', tentative: true },
];
const SPEAKEASIES = [
  { period: 'June', city: 'Bengaluru', tentative: true },
  { period: 'November', city: 'New Delhi', tentative: true },
];
const SANDBOXES = [
  { period: '18 July', city: 'Bengaluru', name: 'The Auction Room', done: true, heldDate: '18 July 2026' },
  { period: '21 August', city: 'New Delhi', name: 'The Auction Room: Media Rights Edition', done: true, heldDate: '21 Aug 2026' },
];
const AUDIENCE = [
  'VCs investing in gaming and sports tech', 'Founders running platforms and apps',
  'Gaming company executives', 'IPL franchise executives',
  'PE investors evaluating sports as an asset class', 'Investment bankers',
  'Broadcast executives and media buyers', 'Sports lawyers and law firms',
];

const Sched = ({ rows }) => (
  <ul className="border-t border-[var(--rule)]">
    {rows.map((r) => (
      <li key={`${r.period}-${r.city}`} className="grid grid-cols-12 gap-3 items-baseline py-3 border-b border-[var(--rule)]">
        <span className="col-span-4 font-plex text-sm tabular-nums text-[var(--text-muted)]">{r.period}</span>
        <div className="col-span-6 flex items-center gap-2 flex-wrap">
          <span className={`font-plex text-sm ${r.done ? 'text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/40' : (r.confirmed ? 'font-medium text-[var(--text)]' : 'text-[var(--text-muted)]')}`}>
            {r.city}
          </span>
          {r.name && (
            <span className="font-editorial italic text-sm text-[var(--text)]">
              · {r.name}
            </span>
          )}
          {r.done && <span className="font-plex text-xs text-[var(--text-muted)]">held · {r.heldDate || r.period}</span>}
          {r.tentative && <span className="font-plex text-xs text-[var(--text-muted)]">tentative</span>}
        </div>
        <div className="col-span-2 flex justify-end">
          {r.registerUrl ? (
            <a href={r.registerUrl} target="_blank" rel="noopener noreferrer" className="font-plex text-sm text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all">
              Register →
            </a>
          ) : (
            <span className="font-plex text-xs text-[var(--text-muted)]">{r.done ? '' : 'soon'}</span>
          )}
        </div>
      </li>
    ))}
  </ul>
);

export const OutfieldMockup = () => (
  <MockupLayout testId="mockup-outfield" seo={{ title: 'Outfield', path: '/outfield', description: 'Outfield, a weekly read on the lateral edges of sport. Culture, identity, and the stories beyond the scoreboard.' }}>
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
      <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
        <Overline className="!normal-case !tracking-normal !text-sm">The Outfield</Overline>
        <span className="font-editorial italic text-sm text-[var(--text-muted)] tabular-nums">Events · 2026</span>
      </div>
    </div>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-10">
      <Overline className="mb-4 block">In person</Overline>
      <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[2.5rem] leading-[1.1] mb-4 max-w-[20ch]">
        Three rooms. No stage. No slides.
      </h1>
      <p className="font-plex text-base md:text-lg text-[var(--text-muted)] max-w-[55ch] leading-relaxed">
        The State of Play covers the business of Indian sport. The Outfield is where that community meets in person. Roundtable is a conversation. Speakeasy is a room. Sandbox is a game. All in person, all off the record.
      </p>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
      <div className="border-t border-[var(--text)] pt-8 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-12">
        <div data-testid="outfield-roundtables">
          <Overline className="!normal-case !tracking-normal !text-sm block mb-3">01 — Quarterly subscriber discussions</Overline>
          <h2 className="font-editorial font-medium text-2xl lg:text-[2rem] mb-4">The Roundtables.</h2>
          <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed mb-6 max-w-[50ch]">
            Closed-door. Ninety minutes. We take a Friday story and go deeper with the protagonist. What couldn’t fit in 1,500 words. What has developed since.
          </p>
          <ul className="grid grid-cols-2 gap-y-2 gap-x-6 mb-6 font-plex text-sm">
            <li><span className="text-[var(--text-muted)]">Size · </span>25–30 people</li>
            <li><span className="text-[var(--text-muted)]">In 2026 · </span>4 events</li>
            <li><span className="text-[var(--text-muted)]">Setting · </span>Boardroom or café</li>
            <li><span className="text-[var(--text-muted)]">Cost · </span>Free for subscribers</li>
          </ul>
          <p className="font-editorial italic text-sm text-[var(--text)] mb-3">2026 schedule</p>
          <Sched rows={ROUNDTABLES} />
        </div>

        <div data-testid="outfield-speakeasies" className="lg:border-l lg:border-[var(--rule)]/15 lg:pl-12">
          <Overline className="!normal-case !tracking-normal !text-sm block mb-3">02 — Premium off-record gatherings</Overline>
          <h2 className="font-editorial font-medium text-2xl lg:text-[2rem] mb-4">The Speakeasy.</h2>
          <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed mb-6 max-w-[50ch]">
            Each speaker gets 20–30 minutes for a fireside chat. Forward-looking topics. After the chats, Q&A, a short pub quiz, then networking. One drink on the house.
          </p>
          <ul className="grid grid-cols-2 gap-y-2 gap-x-6 mb-6 font-plex text-sm">
            <li><span className="text-[var(--text-muted)]">Size · </span>30 people, 3 CXOs</li>
            <li><span className="text-[var(--text-muted)]">In 2026 · </span>2 events</li>
            <li><span className="text-[var(--text-muted)]">Setting · </span>Cocktail bar</li>
            <li><span className="text-[var(--text-muted)]">Cost · </span>Ticketed</li>
          </ul>
          <p className="font-editorial italic text-sm text-[var(--text)] mb-3">2026 schedule</p>
          <Sched rows={SPEAKEASIES} />
        </div>

        <div data-testid="outfield-sandbox" className="lg:border-l lg:border-[var(--rule)]/15 lg:pl-12">
          <Overline className="!normal-case !tracking-normal !text-sm block mb-3">03 — Weekend experiential first-contact</Overline>
          <h2 className="font-editorial font-medium text-2xl lg:text-[2rem] mb-4">The Sandbox.</h2>
          <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed mb-4 max-w-[50ch]">
            Twenty to thirty people spend an hour as someone they aren’t: a broadcaster, a PE fund, a league office, a franchise fighting for its own turf. The mechanics come straight from real transactions in Indian sport, actual pricing, actual deal structure, actual leverage points. Nobody’s reading from a script.
          </p>
          <p className="font-editorial italic text-base text-[var(--text)] leading-relaxed mb-6 max-w-[50ch]">
            Sports business is easier to argue about than to feel. Sandbox is where you feel it.
          </p>
          <ul className="grid grid-cols-2 gap-y-2 gap-x-6 mb-6 font-plex text-sm">
            <li><span className="text-[var(--text-muted)]">Size · </span>20–30 people</li>
            <li><span className="text-[var(--text-muted)]">In 2026 · </span>2 events so far</li>
            <li><span className="text-[var(--text-muted)]">Setting · </span>Weekend, hands-on</li>
            <li><span className="text-[var(--text-muted)]">Cost · </span>Low-cost</li>
          </ul>
          <p className="font-editorial italic text-sm text-[var(--text)] mb-3">2026 schedule</p>
          <Sched rows={SANDBOXES} />
        </div>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
      <div className="border-t border-[var(--text)] pt-8">
        <blockquote className="max-w-[60ch] border-l border-[var(--accent)] pl-6">
          <p className="font-editorial italic text-xl lg:text-[1.75rem] leading-[1.25] text-[var(--text)]">
            No stages. No panels. No 500-person halls. Small rooms force depth. The Chatham House rule encourages honesty. This is where the real conversations happen.
          </p>
        </blockquote>
      </div>
    </section>

    {/* ============================================================
        HIDDEN — WHAT ATTENDEES SAY
        Block lives here ready for content. Flip `SHOW_ATTENDEE_QUOTES`
        to true (and fill in the quotes/attribution below) when you've
        collected the testimonials.
        ============================================================ */}
    {false && (
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12" data-testid="outfield-attendees-say">
        <div className="border-t border-[var(--text)] pt-8">
          <Overline className="block mb-6">— What attendees say —</Overline>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
            {[
              { quote: '__attendee quote 1__', name: '—', title: '—' },
              { quote: '__attendee quote 2__', name: '—', title: '—' },
            ].map((q, i) => (
              <blockquote key={i} className="max-w-[55ch]">
                <p className="font-editorial italic text-xl lg:text-[1.5rem] leading-snug text-[var(--text)] mb-4">
                  “{q.quote}”
                </p>
                <p className="font-plex text-[13px] font-bold text-[var(--text)]">{q.name}</p>
                <p className="font-plex text-[13px] text-[var(--text-label)]">{q.title}</p>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
    )}

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
      <div className="border-t border-[var(--text)] pt-8">
        <p className="font-editorial italic text-lg mb-6">Who attends</p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 border-t border-[var(--rule)]">
          {AUDIENCE.map((a, i) => (
            <li key={a} className="flex items-baseline gap-4 py-3 border-b border-[var(--rule)]">
              <span className="font-plex text-xs text-[var(--text-muted)] tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-plex text-base">{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  </MockupLayout>
);

export default OutfieldMockup;
