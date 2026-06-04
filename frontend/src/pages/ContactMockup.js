import { MockupLayout, Overline } from '../components/MockupLayout';

const ROWS = [
  ['Editorial', 'Tips, leads, corrections', 'venkat@stateofplay.club'],
  ['Memberships', 'Billing, access, refunds', 'support@stateofplay.club'],
  ['Partnerships', 'Sponsorships and partner desk', 'venkat@stateofplay.club'],
  ['Press', 'Citation requests, interviews', 'venkat@stateofplay.club'],
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
        A small newsroom by design. Tips and leads from inside the industry are how a lot of our reporting starts.
      </p>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
      <div className="border-t border-[var(--rule)] pt-8">
        <Overline className="block mb-6">— Desks —</Overline>
        <ul className="border-t border-[var(--rule)]">
          {ROWS.map(([desk, role, email]) => (
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

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
      <div className="border-t border-[var(--rule)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4">
          <Overline className="block mb-3">— Tips & leaks —</Overline>
        </div>
        <div className="lg:col-span-8 max-w-[60ch]">
          <p className="font-plex text-[15px] leading-[1.7] text-[var(--text-muted)] mb-3">
            If you have a story for us — a deal, a memo, a meeting that shouldn’t have happened — write from a personal address, not a corporate one.
          </p>
          <p className="font-plex text-[15px] leading-[1.7] text-[var(--text-muted)]">
            We treat sources with care. We don’t identify people who ask not to be identified.
          </p>
        </div>
      </div>
    </section>
  </MockupLayout>
);

export default ContactMockup;
