import { MockupHeader } from './MockupHeader';
import { MockupFooter } from './MockupFooter';

// Shared overline style — used across every mockup page
export const Overline = ({ children, className = '' }) => (
  <span
    className={`section-label ${className}`}
  >
    {children}
  </span>
);

// Wrapper that gives every mockup page the editorial nav/footer + base palette
export const MockupLayout = ({ children, testId = 'mockup-page', hideFooterHeroCta = false }) => (
  <div
    data-testid={testId}
    className="theme-transition min-h-screen bg-[var(--bg)] text-[var(--text)]"
  >
    <MockupHeader />
    <main>{children}</main>
    <MockupFooter hideHeroCta={hideFooterHeroCta} />
  </div>
);

export default MockupLayout;
