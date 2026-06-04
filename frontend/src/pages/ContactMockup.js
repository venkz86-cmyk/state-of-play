import { MockupLayout, Overline } from '../components/MockupLayout';

const DESKS = [
  ['Memberships', 'Account, billing, GST invoices', 'venkat@stateofplay.club'],
  ['Editorial', 'Tips, leads, corrections', 'venkat@stateofplay.club'],
  ['Group / Corporate', 'Team subscriptions, multi-seat plans', 'prerna@stateofplay.club'],
  ['Partnerships & Press', 'Sponsorships, interviews, speaking', 'venkat@stateofplay.club'],
];

const ADDRESS_LINES = [
  'Left Field Ventures',
  'Ground Floor, 36, Infantry Road',
  'Tasker Town, Shivaji Nagar',
  'Bengaluru, Karnataka 560001',
];

export const ContactMockup = () => (
  <MockupLayout testId="mockup-contact">
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
      <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
        <Overline className="!normal-case !tracking-normal !text-sm">Contact</Overline>
        <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888]">Bengaluru · Mon–Fri</span>
      </div>
    </div>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-12">
      <h1 className="font-editorial font-semibold tracking-tight text-[2.25rem] sm:text-[3rem] lg:text-[3.75rem] leading-[1.05] mb-7 max-w-[22ch]">
        Write to us. <em className="italic font-normal">We answer.</em>
      </h1>
      <p className="font-reading italic text-[20px] leading-[1.6] text-[var(--text-muted)] max-w-[60ch]">
        For questions about your membership, collaborations, or editorial queries, write to{' '}
        <a href="mailto:venkat@stateofplay.club" className="not-italic text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1">
          venkat@stateofplay.club
        </a>.
      </p>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
      <div className="border-t border-[var(--rule)] pt-8">
        <Overline className="block mb-6">— Desks —</Overline>
        <ul className="border-t border-[var(--rule)]">
          {DESKS.map(([desk, role, email]) => (
            <li key={desk} className="grid grid-cols-12 gap-4 py-5 border-b border-[var(--rule)] items-baseline">
              <div className="col-span-12 md:col-span-3">
                <h3 className="font-editorial font-semibold text-[20px] leading-snug">{desk}</h3>
              </div>
              <div className="col-span-12 md:col-span-5">
                <p className="font-plex text-[14px] text-[var(--text-muted)]">{role}</p>
              </div>
              <div className="col-span-12 md:col-span-4 md:text-right">
                <a
                  href={`mailto:${email}`}
                  className="font-plex text-[14px] text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2 transition-all"
                >
                  {email} →
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
      <div className="border-t border-[var(--rule)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4">
          <Overline className="block mb-3">— Group & corporate —</Overline>
        </div>
        <div className="lg:col-span-8 max-w-[60ch]">
          <p className="font-plex text-[15px] leading-[1.7] text-[var(--text-muted)]">
            For group or corporate subscriptions, please mention your organisation and the number of seats required.
          </p>
        </div>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
      <div className="border-t border-[var(--rule)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4">
          <Overline className="block mb-3">— Partnerships, press, speaking —</Overline>
        </div>
        <div className="lg:col-span-8 max-w-[60ch]">
          <p className="font-plex text-[15px] leading-[1.7] text-[var(--text-muted)] mb-3">
            You can also reach out for press, partnerships, or speaking requests. We typically respond within two working days.
          </p>
          <p className="font-plex text-[15px] leading-[1.7] text-[var(--text-muted)]">
            Please note that The State of Play does not accept sponsored editorial content or unsolicited story pitches.
          </p>
        </div>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
      <div className="border-t border-[var(--rule)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4">
          <Overline className="block mb-3">— Registered office —</Overline>
        </div>
        <div className="lg:col-span-8 max-w-[60ch]">
          <address className="font-plex text-[15px] leading-[1.8] text-[var(--text)] not-italic">
            {ADDRESS_LINES.map((l, i) => (
              <span key={i} className="block">{l}</span>
            ))}
          </address>
        </div>
      </div>
    </section>
  </MockupLayout>
);

export default ContactMockup;
