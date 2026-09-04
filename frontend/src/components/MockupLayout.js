import { MockupHeader } from './MockupHeader';
import { MockupFooter } from './MockupFooter';
import { SEO } from './SEO';

// Shared overline style — used across every mockup page
export const Overline = ({ children, className = '' }) => (
  <span
    className={`section-label ${className}`}
  >
    {children}
  </span>
);

// A bespoke FAQ-disclosure marker -- a serif "+" that rotates 45° into
// an "×" on open. Replaces lucide-react's generic Plus/Minus icon pair,
// which is the exact off-the-shelf component every AI-templated pricing
// page reaches for; this ties the mark to the same Gloock/editorial
// system as the rest of the page instead of a stock icon library.
export const FaqMark = ({ open }) => (
  <span
    aria-hidden="true"
    className="font-editorial font-normal text-2xl leading-none shrink-0 mt-0.5 inline-block transition-transform duration-300"
    style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
  >
    +
  </span>
);

// Wrapper that gives every mockup page the editorial nav/footer + base palette
export const MockupLayout = ({
  children,
  testId = 'mockup-page',
  hideFooterHeroCta = false,
  seo = null, // { title, description, path, image, noindex }
}) => (
  <div
    data-testid={testId}
    className="theme-transition min-h-screen bg-[var(--bg)] text-[var(--text)]"
  >
    {seo && <SEO {...seo} />}
    <MockupHeader />
    <main>{children}</main>
    <MockupFooter hideHeroCta={hideFooterHeroCta} />
  </div>
);

export default MockupLayout;
