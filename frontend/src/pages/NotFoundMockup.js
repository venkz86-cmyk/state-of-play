import { Link } from 'react-router-dom';
import { MockupLayout } from '../components/MockupLayout';

export const NotFoundMockup = () => (
  <MockupLayout testId="mockup-404" seo={{ title: '404 — Page not found', path: '', noindex: true }}>
    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 py-32 lg:py-40">
      <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-[3.5rem] lg:text-[5rem] leading-[1.05] text-[var(--text)] mb-6 max-w-[18ch]">
        This URL didn’t survive the edit.
      </h1>
      <p className="font-plex text-[18px] lg:text-[20px] text-[var(--text-muted)] mb-10 max-w-[42ch]">
        Nothing’s filed under this address. The reporting lives elsewhere on the site.
      </p>
      <Link
        to="/"
        data-testid="notfound-cta"
        className="inline-flex items-center font-plex text-[15px] text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
      >
        Back to The State of Play
      </Link>
    </section>
  </MockupLayout>
);

export default NotFoundMockup;
