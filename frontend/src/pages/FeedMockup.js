import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { ArrowUpRight } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';

const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
};

export const FeedMockup = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await ghostAPI.getPosts({ limit: 20 });
        setPosts(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <MockupLayout testId="mockup-feed">
        <div className="min-h-[60vh] flex items-center justify-center">
          <Overline>Loading desk…</Overline>
        </div>
      </MockupLayout>
    );
  }

  const lead = posts[0];
  const grid = posts.slice(1, 5);
  const list = posts.slice(5);

  return (
    <MockupLayout testId="mockup-feed">
      {/* Section header */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <Overline className="text-[#234ba0] mb-5 block">— The State of Play —</Overline>
          <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[4.5rem] leading-[1] max-w-4xl">
            The week, <em className="italic font-normal text-[#234ba0]">on the record.</em>
          </h1>
          <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] mt-6 max-w-2xl leading-relaxed">
            Long-form reportage and analysis on the businesses, deals and people moving Indian sport. Updated each Friday — read in any order.
          </p>
        </div>
      </section>

      {/* Lead story — full bleed split */}
      {lead && (
        <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            <Link
              to={`/mockup/article/${lead.id}`}
              data-testid="feed-lead"
              className="group lg:col-span-7"
            >
              {lead.image_url && (
                <div className="aspect-[16/10] overflow-hidden bg-[#F1F1EE] mb-6">
                  <img
                    src={lead.image_url}
                    alt={lead.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover saturate-[0.85] group-hover:saturate-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
                  />
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                {lead.theme && <Overline className="text-[#234ba0]">{lead.theme}</Overline>}
                <span className="h-px w-6 bg-[#234ba0]/40" />
                <Overline>Lead Story</Overline>
              </div>
              <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-[3rem] leading-[1.05] mb-5 group-hover:text-[#234ba0] transition-colors duration-200">
                {lead.title}
              </h2>
              {lead.subtitle && (
                <p className="font-plex text-lg text-[#475569] dark:text-[#94A3B8] max-w-[60ch] leading-relaxed">
                  {lead.subtitle}
                </p>
              )}
            </Link>

            <aside className="lg:col-span-5 lg:pl-10 lg:border-l lg:border-[#E2E8F0] lg:dark:border-[#1E293B]">
              <Overline className="text-[var(--accent)] mb-8 block">Also in this edition</Overline>
              <ul>
                {grid.map((p, i) => (
                  <li
                    key={p.id}
                    className={i === grid.length - 1 ? '' : 'pb-8 mb-8 border-b border-[#E2E8F0] dark:border-[#1E293B]'}
                  >
                    <Link
                      to={`/mockup/article/${p.id}`}
                      className="group block"
                      data-testid={`feed-side-${p.id}`}
                    >
                      <Overline className="text-[#234ba0] mb-2 block">{p.theme || 'Analysis'}</Overline>
                      <h3 className="font-editorial font-semibold text-xl lg:text-[1.5rem] leading-[1.2] mb-2 group-hover:text-[#234ba0] transition-colors duration-200">
                        {p.title}
                      </h3>
                      <Overline>{fmtDate(p.created_at)} · {p.read_time} MIN</Overline>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>
      )}

      {/* List of remaining posts */}
      {list.length > 0 && (
        <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
            <div className="flex items-end justify-between mb-12">
              <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                The Index.
              </h2>
              <Overline className="hidden md:block">{list.length.toString().padStart(2, '0')} stories</Overline>
            </div>

            <ul className="border-t border-[#0F172A] dark:border-[#F8FAFC]">
              {list.map((p, i) => (
                <li key={p.id}>
                  <Link
                    to={`/mockup/article/${p.id}`}
                    data-testid={`feed-row-${p.id}`}
                    className="group grid grid-cols-12 gap-6 lg:gap-10 items-baseline py-7 border-b border-[#E2E8F0] dark:border-[#1E293B] hover:bg-[#F1F1EE] dark:hover:bg-[#0F172A] -mx-3 px-3 transition-colors duration-200"
                  >
                    <span className="hidden md:block col-span-1 font-plex-mono text-[11px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="col-span-12 md:col-span-2">
                      <Overline className="text-[#234ba0]">{p.theme || 'Analysis'}</Overline>
                    </div>
                    <h3 className="col-span-12 md:col-span-7 font-editorial font-semibold text-xl lg:text-[1.5rem] leading-[1.2] group-hover:text-[#234ba0] transition-colors duration-200">
                      {p.title}
                    </h3>
                    <div className="hidden md:flex col-span-2 items-center justify-end gap-3">
                      <Overline>{fmtDate(p.created_at)}</Overline>
                      <ArrowUpRight className="h-4 w-4 text-[#94A3B8] group-hover:text-[#234ba0] transition-colors duration-200" strokeWidth={1.5} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </MockupLayout>
  );
};

export default FeedMockup;
