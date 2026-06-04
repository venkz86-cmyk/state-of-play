import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

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

export const MockupFooter = () => {
  const year = new Date().getFullYear();
  return (
    <footer
      data-testid="mockup-footer"
      className="bg-[#090E17] text-white border-t border-white/10"
    >
      {/* Editorial masthead row */}
      <div className="border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <h2 className="font-editorial font-semibold tracking-tight text-3xl md:text-5xl lg:text-[3.5rem] leading-[1.05] max-w-3xl">
              The State of Play.
              <br />
              <em className="italic font-normal text-[#AAAAAA]">
                The business of sport, from an India lens.
              </em>
            </h2>
          </div>

          <div className="lg:col-span-5 flex flex-col items-start lg:items-end gap-5">
            <span className="font-plex tabular-nums text-[11px] tracking-[0.22em] uppercase text-white/60">
              Read with us
            </span>
            <Link
              to="/signup"
              data-testid="mockup-footer-subscribe"
              className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-plex font-semibold px-8 py-4 text-sm tracking-wide transition-colors duration-200"
            >
              Subscribe
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>

      {/* Index columns — newspaper masthead style */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2">
            <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase text-white/50 block mb-4">
              The Publication
            </span>
            <p className="font-editorial italic text-xl lg:text-2xl leading-snug text-white/85 max-w-md mb-6">
              The State of Play covers the business of Indian sport. Money, media, ownership, and power — reported from Bengaluru.
            </p>
            <div className="flex flex-wrap items-center gap-3 font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase text-white/50">
              <span>Bengaluru</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase text-white/50 block mb-5 pb-3 border-b border-white/10">
              Navigation
            </span>
            <ul className="space-y-3">
              {COL_NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="font-plex text-sm text-white/80 hover:text-white transition-colors duration-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Membership & Legal */}
          <div>
            <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase text-white/50 block mb-5 pb-3 border-b border-white/10">
              Membership & Legal
            </span>
            <ul className="space-y-3">
              {COL_LEGAL.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="font-plex text-sm text-white/80 hover:text-white transition-colors duration-200"
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
          <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase text-white/50">
            © {year} Left Field Ventures · Published as The State of Play
          </span>
          <span className="font-plex tabular-nums text-[10px] tracking-[0.22em] uppercase text-white/50">
            stateofplay.club
          </span>
        </div>
      </div>
    </footer>
  );
};

export default MockupFooter;
