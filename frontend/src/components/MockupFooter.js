import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const COL_NAV = [
  { label: 'The State of Play', to: '/state-of-play' },
  { label: 'The Left Field', to: '/left-field' },
  { label: 'The Outfield', to: '/outfield' },
  { label: 'Archive', to: '/archive' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

const COL_LEGAL = [
  { label: 'Membership', to: '/membership' },
  { label: 'For Teams', to: '/teams' },
  { label: 'Partnerships', to: '/partnerships' },
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy' },
];

export const MockupFooter = ({ hideHeroCta = false }) => {
  const year = new Date().getFullYear();
  const { isLoggedIn, canAccessPremium } = useAuth();
  // For paid members we replace the Subscribe CTA with an editorial "tell us what you think" panel.
  const showMemberPanel = isLoggedIn && canAccessPremium;
  return (
    <footer
      data-testid="mockup-footer"
      className="theme-transition text-white"
      style={{ backgroundColor: 'var(--footer-bg)' }}
    >
      {/* Editorial CTA — hidden on pages with their own conversion section */}
      {!hideHeroCta && (
        <div
          className="border-t border-b border-white/10"
          style={{ backgroundColor: 'var(--footer-cta-bg)' }}
        >
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-7">
              <h2 className="font-editorial font-semibold tracking-tight text-3xl md:text-5xl lg:text-[3.5rem] leading-[1.05] max-w-3xl">
                {showMemberPanel ? (
                  <>
                    Enjoying The State of Play?
                    <br />
                    <em className="italic font-normal text-[#AAAAAA]">
                      Tell us what’s landing — and what isn’t.
                    </em>
                  </>
                ) : (
                  <>
                    The State of Play.
                    <br />
                    <em className="italic font-normal text-[#AAAAAA]">
                      The business of sport, from an India lens.
                    </em>
                  </>
                )}
              </h2>
            </div>

            <div className="lg:col-span-5 flex flex-col items-start lg:items-end gap-5">
              <span className="font-plex text-[11px] tracking-[0.08em] uppercase text-white/60">
                {showMemberPanel ? 'A note to the desk' : 'Read with us'}
              </span>
              {showMemberPanel ? (
                <a
                  href="mailto:venkat@stateofplay.club?subject=A%20note%20on%20The%20State%20of%20Play"
                  data-testid="mockup-footer-feedback"
                  className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] tracking-wide h-12 px-6 transition-colors duration-200"
                  style={{ borderRadius: 0 }}
                >
                  Write to us
                </a>
              ) : (
                <Link
                  to="/signup"
                  data-testid="mockup-footer-subscribe"
                  className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] tracking-wide h-12 px-6 transition-colors duration-200"
                  style={{ borderRadius: 0 }}
                >
                  Subscribe
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Index columns */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand — Fix 15: Geist body copy, not italic */}
          <div className="col-span-2">
            <span className="font-plex text-[10px] tracking-[0.08em] uppercase text-white/50 block mb-4">
              The Publication
            </span>
            <p className="font-plex text-[14px] leading-[1.6] text-[#888888] max-w-md mb-6">
              The State of Play reports on the business of Indian sport. Money, media, ownership, and power, from Bengaluru.
            </p>
            <div className="flex flex-wrap items-center gap-3 font-plex text-[10px] tracking-[0.08em] uppercase text-white/50">
              <span>Bengaluru</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <span className="font-plex text-[10px] tracking-[0.08em] uppercase text-white/50 block mb-5 pb-3 border-b border-white/10">
              Navigation
            </span>
            <ul className="space-y-3">
              {COL_NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="font-plex text-[14px] text-white/80 hover:text-white transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Membership & Legal */}
          <div>
            <span className="font-plex text-[10px] tracking-[0.08em] uppercase text-white/50 block mb-5 pb-3 border-b border-white/10">
              Membership & Legal
            </span>
            <ul className="space-y-3">
              {COL_LEGAL.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="font-plex text-[14px] text-white/80 hover:text-white transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Colophon */}
      <div className="border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <span className="font-plex text-[10px] tracking-[0.08em] uppercase text-white/50">
            © {year} Left Field Ventures · Published as The State of Play
          </span>
          <span className="font-plex text-[10px] tracking-[0.08em] uppercase text-white/50">
            stateofplay.club
          </span>
        </div>
      </div>
    </footer>
  );
};

export default MockupFooter;
