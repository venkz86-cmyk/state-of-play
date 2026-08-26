import { MockupLayout, Overline } from '../components/MockupLayout';
import { PartnersBlock } from '../components/PartnersBlock';

const TIERS = [
  {
    name: 'Founding Partner',
    fee: 'On request',
    detail:
      'Sole partner for a calendar year. Co-presented quarterly Roundtable, branded annual report, prominent footer placement, four-line introductory note inside The Briefing.',
  },
  {
    name: 'Lead Partner',
    fee: 'On request',
    detail:
      'Named lead for one cycle (six months). Speakeasy co-presentation, banner above the homepage Briefing rail, two custom features negotiated in advance.',
  },
  {
    name: 'Associate Partner',
    fee: 'On request',
    detail:
      'Six-month association with a named beat: cricket markets, ISL, media rights or governance. Logo placement on partner row, two Outfield invitations per cycle.',
  },
];

const STORY = [
  ['Founded', 'Bengaluru, 2025'],
  ['Audience', 'Investors, owners, league executives, sports lawyers and global funds'],
  ['Reach', 'India + a growing international subscriber base'],
  ['Cadence', 'Weekly deep-dives and bi-weekly Left Field briefs'],
];

export const PartnershipsMockup = () => (
  <MockupLayout testId="mockup-partnerships" seo={{ title: 'Partnerships', path: '/partnerships', description: 'Partner with The State of Play. Sponsorship, branded content, and bespoke editorial collaborations across our subscriber base.' }}>
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 md:gap-0 border-b border-[var(--rule)] pb-3">
        <Overline className="!normal-case !tracking-normal !text-sm">Partnerships</Overline>
        <span className="font-plex text-[14px] text-[var(--text-muted)]">For brands, funds and federations</span>
      </div>
    </div>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-10">
      <Overline className="mb-4 block">Partner with us</Overline>
      <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[2.5rem] leading-[1.1] mb-4 max-w-[20ch]">
        Reach the people <em className="italic font-normal">writing the cheques.</em>
      </h1>
      <p className="font-reading italic text-[18px] md:text-[20px] leading-[1.5] text-[var(--text-muted)] max-w-[55ch]">
        The State of Play is read inside the meeting rooms where Indian sport is bought, sold, structured and financed. A small audience by design, and a useful one for partners with a point of view.
      </p>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
      <div className="border-t border-[var(--rule)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <Overline className="block mb-3">— The audience —</Overline>
          <p className="font-plex text-[15px] leading-[1.6] text-[var(--text-muted)] max-w-[40ch]">
            We do not publish ads. We work with a small number of partners each year. Volume is intentionally low; relevance is the only metric we care about.
          </p>
        </div>
        <div className="lg:col-span-8">
          <ul className="border-t border-[var(--rule)]">
            {STORY.map(([k, v]) => (
              <li key={k} className="grid grid-cols-12 py-4 border-b border-[var(--rule)]">
                <span className="col-span-4 md:col-span-3 font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]">{k}</span>
                <span className="col-span-8 md:col-span-9 font-plex text-[15px] text-[var(--text)]">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
      <div className="border-t border-[var(--rule)] pt-8">
        <Overline className="block mb-6">— Partner tiers —</Overline>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-10">
          {TIERS.map((t, i) => (
            <div key={t.name} data-testid={`partner-tier-${i}`}>
              <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-2">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="font-editorial font-semibold text-[22px] leading-snug mb-2">{t.name}</h3>
              <p className="font-plex text-[13px] uppercase tracking-[0.08em] text-[var(--accent-burgundy)] mb-4">{t.fee}</p>
              <p className="font-plex text-[14px] leading-[1.65] text-[var(--text-muted)] max-w-[40ch]">{t.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <PartnersBlock variant="tiers" />

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
      <div className="border-t border-[var(--rule)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4">
          <Overline className="block mb-3">— Get in touch —</Overline>
        </div>
        <div className="lg:col-span-8 max-w-[55ch]">
          <h2 className="font-editorial font-semibold text-[28px] leading-snug mb-4">
            A short note is enough.
          </h2>
          <p className="font-plex text-[15px] leading-[1.7] text-[var(--text-muted)] mb-6">
            Tell us who you are, what you’re trying to reach, and the cycle you have in mind. We’ll come back within a week with a tier that fits, or with a candid no.
          </p>
          <a
            href="mailto:prerna@stateofplay.club?subject=Partnerships"
            data-testid="partnerships-cta"
            className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200"
            style={{ borderRadius: 'var(--control-radius)' }}
          >
            Write to us
          </a>
        </div>
      </div>
    </section>
  </MockupLayout>
);

export default PartnershipsMockup;
