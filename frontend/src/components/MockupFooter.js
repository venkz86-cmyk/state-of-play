import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const FOOTER_LINKS = [
  { label: 'The State of Play', to: '/state-of-play' },
  { label: 'The Left Field', to: '/left-field' },
  { label: 'The Outfield', to: '/outfield' },
  { label: 'Archive', to: '/archive' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
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
      {/* Editorial sign-off — logged-out readers only. Members already converted,
          so no banner pitch; their feedback link lives in the colophon instead. */}
      {!hideHeroCta && !showMemberPanel && (
        <div className="border-t border-b border-white/10">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="font-editorial italic text-lg md:text-xl leading-snug text-white/90 max-w-xl">
              The State of Play. The business of sport, from an India lens.
            </p>
            <Link
              to="/signup"
              data-testid="mockup-footer-subscribe"
              className="font-plex text-sm text-white underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all whitespace-nowrap"
            >
              Subscribe
            </Link>
          </div>
        </div>
      )}

      {/* Index */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
        <div className="flex flex-col md:flex-row md:items-start gap-10 lg:gap-20">
          {/* Brand — Fix 15: Schibsted Grotesk body copy, not italic */}
          <div className="md:max-w-sm shrink-0">
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

          {/* Links — one plain list, two compact columns instead of one long list */}
          <ul className="columns-2 gap-x-10 font-plex text-[14px]">
            {FOOTER_LINKS.map((item) => (
              <li key={item.to} className="mb-3 break-inside-avoid">
                <Link
                  to={item.to}
                  className="text-white/80 hover:text-white transition-colors duration-200"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Colophon */}
      <div className="border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <span className="font-plex text-[10px] tracking-[0.08em] uppercase text-white/50">
            © {year} Left Field Ventures · Published as The State of Play
          </span>
          <div className="flex items-center gap-6">
            {showMemberPanel && (
              <a
                href="mailto:venkat@stateofplay.club?subject=A%20note%20on%20The%20State%20of%20Play"
                data-testid="mockup-footer-feedback"
                className="font-plex text-[10px] tracking-[0.08em] uppercase text-white/50 hover:text-white transition-colors duration-200"
              >
                Write to us
              </a>
            )}
            <span className="font-plex text-[10px] tracking-[0.08em] uppercase text-white/50">
              stateofplay.club
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default MockupFooter;
