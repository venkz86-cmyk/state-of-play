/**
 * Partner roster — single source of truth for who appears on /home and
 * /partnerships. Add new partners here; both pages update.
 *
 * Each entry:
 *   name        short name (used for data-testid)
 *   fullName    caption shown under the logo
 *   role        small overline above the logo (e.g. "Associate Partner")
 *   url         outbound link on logo / caption click
 *   logoSrc     optional. PNG/SVG at /public/partners/{file}.
 *               Falls back to fullName in Fraunces if omitted.
 */

import { Overline } from './MockupLayout';

export const PARTNERS = [
  {
    name: 'SI',
    fullName: 'SI (formerly Sportz Interactive)',
    role: 'Associate Partner',
    url: 'https://www.sportzinteractive.net/',
    logoSrc: '/partners/si.png',
  },
];

/**
 * variant:
 *   'minimal'   → tight strip used on the homepage, with surrounding header label.
 *   'tiers'     → fits the /partnerships page rhythm; no internal header
 *                 (the page provides the section heading itself).
 */
export const PartnersBlock = ({
  variant = 'minimal',
  showHeader = true,
  showFooterCTA = true,
}) => (
  <section
    data-testid="partners-block"
    className="theme-transition w-full"
    style={{ backgroundColor: 'var(--bg)' }}
  >
    <div className={`max-w-[1280px] mx-auto px-6 lg:px-12 ${variant === 'tiers' ? 'pb-12' : 'py-10 lg:py-12'}`}>
      {variant === 'tiers' ? (
        <div className="border-t border-[var(--rule)] pt-8">
          {showHeader && (
            <Overline className="block mb-6">— Current partners —</Overline>
          )}
          <PartnerGrid />
          {showFooterCTA && (
            <p className="mt-10 font-plex text-[13px] text-[var(--text-label)] max-w-[60ch]">
              Each cycle is bespoke. If your brand belongs alongside the names above, write to{' '}
              <a
                href="mailto:prerna@stateofplay.club?subject=Partnerships"
                className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
              >
                prerna@stateofplay.club
              </a>
              .
            </p>
          )}
        </div>
      ) : (
        <>
          {showHeader && (
            <span className="block text-center font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-8">
              Partners
            </span>
          )}
          <PartnerGrid />
          {showFooterCTA && (
            <p className="mt-8 text-center font-plex text-[13px] text-[var(--text-label)]">
              Interested in partnering with The State of Play?{' '}
              <a
                href="mailto:prerna@stateofplay.club?subject=Partnerships"
                className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1 hover:decoration-2"
              >
                Get in touch →
              </a>
            </p>
          )}
        </>
      )}
    </div>
  </section>
);

const PartnerGrid = () => (
  <div className="flex flex-wrap items-start justify-center gap-x-16 gap-y-10">
    {PARTNERS.map((p) => (
      <a
        key={p.name}
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        title={p.fullName}
        data-testid={`partner-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
        className="group flex flex-col items-center"
      >
        <span className="mt-1 mb-3 font-plex text-[10px] uppercase tracking-[0.08em] text-[#999999] group-hover:text-[var(--text-muted)] transition-colors">
          {p.role}
        </span>
        {p.logoSrc ? (
          <img
            src={p.logoSrc}
            alt={p.fullName}
            className="h-14 w-auto object-contain opacity-75 group-hover:opacity-100 transition-opacity duration-200"
            loading="lazy"
          />
        ) : (
          <span className="font-editorial font-semibold text-[18px] text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors duration-200">
            {p.fullName}
          </span>
        )}
        <span className="mt-2 font-plex text-[12px] text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors">
          {p.fullName}
        </span>
      </a>
    ))}
  </div>
);

export default PartnersBlock;
