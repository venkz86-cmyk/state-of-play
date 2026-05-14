import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bell, Bookmark, Receipt, LogOut } from 'lucide-react';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { ghostAPI } from '../services/ghostAPI';

const fmtDate = (iso) =>
  iso
    ? new Date(iso)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        .toUpperCase()
    : '';

export const AccountMockup = () => {
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await ghostAPI.getPosts({ limit: 4 });
        setRecent(list);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const memberName = 'Venkatesh';
  const memberEmail = 'venkz86@gmail.com';
  const planRenews = '12 February 2027';
  const billingNext = '₹2,495';

  return (
    <MockupLayout testId="mockup-account">
      {/* Greeting strip */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-8">
            <Overline className="text-[#234ba0] mb-5 block">— Member Lounge —</Overline>
            <h1 className="font-editorial font-semibold tracking-tight text-[2.5rem] sm:text-5xl lg:text-[4rem] leading-[1.02]">
              Hello, <em className="italic font-normal text-[#234ba0]">{memberName}.</em>
            </h1>
            <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] mt-5 max-w-[55ch]">
              Your reading list, billing and preferences live here. Plan renews <span className="text-[#0F172A] dark:text-[#F8FAFC]">{planRenews}</span>.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col lg:items-end gap-3">
            <Overline>{memberEmail}</Overline>
            <button
              type="button"
              data-testid="account-signout"
              className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#475569] hover:text-[#234ba0] transition-colors duration-200"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
              Sign out
            </button>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F1EE] dark:bg-[#0F172A]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 grid grid-cols-2 lg:grid-cols-4 divide-x divide-[#E2E8F0] dark:divide-[#1E293B] border-x border-[#E2E8F0] dark:border-[#1E293B]">
          {[
            ['Plan', 'Annual'],
            ['Renews', planRenews],
            ['Next charge', billingNext],
            ['Member since', '12 Feb 2026'],
          ].map(([label, value]) => (
            <div key={label} className="py-8 px-6 lg:py-10 lg:px-8">
              <Overline className="block mb-3">{label}</Overline>
              <div className="font-editorial font-semibold text-xl lg:text-[1.5rem] leading-tight text-[#0F172A] dark:text-[#F8FAFC]">
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Continue Reading + Reading List */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <Overline className="text-[var(--accent)] mb-3 block">— Continue Reading —</Overline>
            <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-[2.5rem] leading-tight mb-8">
              Pick up where you left off.
            </h2>

            <ul className="border-t border-[#0F172A] dark:border-[#F8FAFC]">
              {recent.slice(0, 3).map((p, i) => (
                <li key={p.id}>
                  <Link
                    to={`/mockup/article/${p.id}`}
                    className="group grid grid-cols-12 gap-4 lg:gap-6 items-baseline py-6 border-b border-[#E2E8F0] dark:border-[#1E293B] hover:bg-[#F1F1EE] dark:hover:bg-[#0F172A] -mx-3 px-3 transition-colors duration-200"
                  >
                    <span className="hidden md:block col-span-1 font-plex-mono text-[11px] tracking-[0.22em] text-[#94A3B8] tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="col-span-12 md:col-span-2">
                      <Overline className="text-[#234ba0]">{p.theme || 'Reportage'}</Overline>
                    </div>
                    <h3 className="col-span-12 md:col-span-7 font-editorial font-semibold text-xl leading-snug group-hover:text-[#234ba0] transition-colors duration-200">
                      {p.title}
                    </h3>
                    <div className="hidden md:flex col-span-2 items-center justify-end gap-3">
                      <Overline>{p.read_time} MIN</Overline>
                      <ArrowUpRight className="h-4 w-4 text-[#94A3B8] group-hover:text-[#234ba0] transition-colors duration-200" strokeWidth={1.5} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <aside className="lg:col-span-5 lg:pl-10 lg:border-l lg:border-[#E2E8F0] dark:lg:border-[#1E293B]">
            <Overline className="text-[#234ba0] mb-3 block">— Reading List —</Overline>
            <h2 className="font-editorial font-semibold tracking-tight text-3xl leading-tight mb-6">
              Saved for later.
            </h2>
            <ul>
              {recent.slice(0, 2).map((p) => (
                <li
                  key={p.id}
                  className="py-5 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-start justify-between gap-4"
                >
                  <Link to={`/mockup/article/${p.id}`} className="group flex-1">
                    <Overline className="text-[#234ba0] mb-2 block">{p.theme || 'Saved'}</Overline>
                    <h3 className="font-editorial font-semibold text-lg leading-snug group-hover:text-[#234ba0] transition-colors duration-200">
                      {p.title}
                    </h3>
                    <Overline className="block mt-2">{fmtDate(p.created_at)}</Overline>
                  </Link>
                  <button
                    type="button"
                    aria-label="Remove from reading list"
                    className="text-[#94A3B8] hover:text-[var(--accent)] transition-colors duration-200"
                  >
                    <Bookmark className="h-4 w-4 fill-current" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="font-plex-mono text-[10px] tracking-[0.22em] uppercase text-[#94A3B8] mt-6">
              Bookmarks sync across devices · Coming soon
            </p>
          </aside>
        </div>
      </section>

      {/* Tools row — Insider Drops, Notifications, Billing */}
      <section className="border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#0F172A] text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-20 lg:py-24">
          <div className="flex items-end justify-between mb-12">
            <div>
              <Overline className="!text-[var(--accent)] mb-3 block">— Membership Tools —</Overline>
              <h2 className="font-editorial font-semibold tracking-tight text-3xl lg:text-5xl leading-[1.05]">
                Yours to run.
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/15 border-y border-white/15">
            {/* Insider Drops */}
            <div className="py-10 md:py-12 md:px-10 first:md:pl-0 last:md:pr-0">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-plex-mono text-[10px] tracking-[0.22em] text-white/40 tabular-nums">01</span>
                <span className="h-px w-6 bg-white/30" />
                <Overline className="!text-[var(--accent)]">Insider Drops · Soon</Overline>
              </div>
              <Bell className="h-5 w-5 text-white/60 mb-4" strokeWidth={1.5} />
              <h3 className="font-editorial font-semibold text-2xl leading-tight mb-3">
                Private intel, off the record.
              </h3>
              <p className="font-plex text-sm text-white/60 leading-relaxed mb-5 max-w-[35ch]">
                Subscriber-only feed of deal whispers, tip-offs and short notes — published as they break.
              </p>
              <button
                type="button"
                data-testid="account-notify-drops"
                className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors duration-200"
              >
                Notify me
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Preferences */}
            <div className="py-10 md:py-12 md:px-10">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-plex-mono text-[10px] tracking-[0.22em] text-white/40 tabular-nums">02</span>
                <span className="h-px w-6 bg-white/30" />
                <Overline className="!text-white/70">Notifications</Overline>
              </div>
              <Bookmark className="h-5 w-5 text-white/60 mb-4" strokeWidth={1.5} />
              <h3 className="font-editorial font-semibold text-2xl leading-tight mb-3">
                Tune the cadence.
              </h3>
              <ul className="space-y-3 mb-5">
                {[
                  ['Weekly TSOP', true],
                  ['Left Field briefs', true],
                  ['Breaking news alerts', false],
                ].map(([label, on]) => (
                  <li key={label} className="flex items-center justify-between">
                    <span className="font-plex text-sm text-white/80">{label}</span>
                    <span
                      className={`inline-flex items-center justify-center h-5 w-9 ${on ? 'bg-[var(--accent)]' : 'bg-white/15'} relative`}
                    >
                      <span className={`absolute h-4 w-4 bg-white ${on ? 'right-0.5' : 'left-0.5'}`} />
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors duration-200"
              >
                Save
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Billing */}
            <div className="py-10 md:py-12 md:px-10 first:md:pl-0 last:md:pr-0">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-plex-mono text-[10px] tracking-[0.22em] text-white/40 tabular-nums">03</span>
                <span className="h-px w-6 bg-white/30" />
                <Overline className="!text-white/70">Billing</Overline>
              </div>
              <Receipt className="h-5 w-5 text-white/60 mb-4" strokeWidth={1.5} />
              <h3 className="font-editorial font-semibold text-2xl leading-tight mb-3">
                Invoices & receipts.
              </h3>
              <p className="font-plex text-sm text-white/60 leading-relaxed mb-5 max-w-[35ch]">
                Last invoice issued <span className="text-white">12 Feb 2026</span> · ₹2,495 · Razorpay.
              </p>
              <a
                href="#billing"
                className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-white/80 border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors duration-200"
              >
                Download GST invoice
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default AccountMockup;
