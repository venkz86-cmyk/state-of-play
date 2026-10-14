import { Overline } from './MockupLayout';
import { IS_APP_MODE } from '../lib/appMode';

/* App-only page label, the same opening as the You and The Left Field
   tabs. Pages show it in place of their website strip (which gets
   `app-hide`), and mark their headline `app-title` so it takes the app's
   headline style (index.css). Nothing changes on the website. */
export const AppStrip = ({ label }) => (IS_APP_MODE ? (
  <div className="max-w-[720px] mx-auto px-6 lg:px-0 pt-10" data-testid="app-strip">
    <div className="border-b border-[var(--rule)] pb-3"><Overline>{label}</Overline></div>
  </div>
) : null);

export default AppStrip;
