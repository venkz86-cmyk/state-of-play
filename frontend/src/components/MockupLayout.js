import { MockupHeader } from './MockupHeader';
import { MockupFooter } from './MockupFooter';

// Shared overline style — used across every mockup page
export const Overline = ({ children, className = '' }) => (
  <span
    className={`font-plex text-[10px] md:text-[11px] font-medium tracking-[0.22em] uppercase tabular-nums text-[#475569] ${className}`}
  >
    {children}
  </span>
);

// Wrapper that gives every mockup page the editorial nav/footer + base palette
export const MockupLayout = ({ children, testId = 'mockup-page' }) => (
  <div
    data-testid={testId}
    className="min-h-screen bg-[#F7F7F5] dark:bg-[#090E17] text-[#0F172A] dark:text-[#F8FAFC]"
  >
    <MockupHeader />
    <main>{children}</main>
    <MockupFooter />
  </div>
);

export default MockupLayout;
