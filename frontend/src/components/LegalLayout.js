import { MockupLayout, Overline } from '../components/MockupLayout';

/* A shared "legal document" layout used by both Terms and Privacy mockups.
   Designed to feel like a serious masthead, not a generic SaaS legal page. */
export const LegalLayout = ({ testId, title, subtitle, kicker, updated, sections, seo = null }) => (
  <MockupLayout testId={testId} seo={seo}>
    <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 md:gap-0 border-b border-[var(--rule)] pb-3">
        <Overline className="!normal-case !tracking-normal !text-sm">{kicker}</Overline>
        <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888]">
          Last updated · {updated}
        </span>
      </div>
    </div>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-10">
      <h1 className="font-editorial font-semibold tracking-tight text-[2.25rem] sm:text-[3rem] lg:text-[3.75rem] leading-[1.05] mb-7 max-w-[20ch]">
        {title}
      </h1>
      <p className="font-reading italic text-[20px] leading-[1.6] text-[var(--text-muted)] max-w-[60ch]">
        {subtitle}
      </p>
    </section>

    <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <aside className="lg:col-span-3">
          <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-3">
            Contents
          </p>
          <ol className="space-y-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="font-plex text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  <span className="tabular-nums mr-3">{String(i + 1).padStart(2, '0')}</span>
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="lg:col-span-9 max-w-[680px]">
          {sections.map((s, i) => (
            <div key={s.id} id={s.id} className="mb-12 last:mb-0 pt-2 first:pt-0 scroll-mt-24">
              <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-3">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h2 className="font-editorial font-semibold text-[26px] leading-snug mb-4">
                {s.heading}
              </h2>
              <div className="font-reading text-[17px] leading-[1.75] text-[var(--text)] space-y-4">
                {s.body.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </div>
          ))}
        </article>
      </div>
    </section>
  </MockupLayout>
);

export default LegalLayout;
