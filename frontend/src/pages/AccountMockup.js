import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupLayout, Overline } from '../components/MockupLayout';

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

export const AccountMockup = () => {
  const { user, isLoggedIn, loading, logout, canAccessPremium } = useAuth();
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    (async () => {
      try { setRecent(await ghostAPI.getPosts({ limit: 5 })); }
      catch (e) { console.error(e); }
    })();
  }, []);

  // Gate: visitors who aren't signed in are bounced to /login
  if (!loading && !isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  const memberName = (user?.name?.split(' ')[0]) || 'Reader';
  const memberEmail = user?.email || '';
  const planLabel = canAccessPremium ? 'Annual' : 'Free';

  return (
    <MockupLayout testId="page-account">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
          <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888]">{memberEmail}</span>
          <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888] tabular-nums">Member Lounge</span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-8">
          <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3rem] leading-[1.06] mb-5">
            Hello, <em className="italic font-normal">{memberName}.</em>
          </h1>
          <p className="font-plex text-base lg:text-lg text-[var(--text-muted)] max-w-[55ch] leading-relaxed">
            Your reading list, billing and preferences live here.
          </p>
        </div>
        <div className="lg:col-span-4 lg:text-right">
          <button
            type="button"
            onClick={logout}
            data-testid="account-signout"
            className="font-plex text-sm text-[var(--text-muted)] hover:text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 transition-all"
          >
            Sign out →
          </button>
        </div>
      </section>

      {/* Stat strip — Fix 22: solid 1px #E5E2DC dividers */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-y border-[var(--rule)] grid grid-cols-2 md:grid-cols-4">
          {[
            ['Plan', planLabel],
            ['Renews', '—'],
            ['Next charge', canAccessPremium ? '₹2,949' : '—'],
            ['Member since', '—'],
          ].map(([k, v], i) => (
            <div
              key={k}
              className={`py-6 px-6 ${i > 0 ? 'border-l border-[var(--rule)]' : ''}`}
              style={{ borderLeftWidth: i > 0 ? '1px' : 0 }}
            >
              <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">{k}</Overline>
              <p className="font-editorial font-medium text-lg lg:text-xl leading-tight">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Continue reading */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
          <p className="font-editorial italic text-lg mb-6">Continue reading</p>
          <div className="border-t border-[#E2E8F0] dark:border-[#1E293B]">
            {recent.map((p) => (
              <Link
                key={p.id}
                to={`/${p.id}`}
                className="group flex items-baseline justify-between gap-6 py-5 border-b border-[#E2E8F0] dark:border-[#1E293B]"
              >
                <div className="flex-1 min-w-0">
                  <Overline className="!normal-case !tracking-normal !text-xs block mb-1">{p.theme || 'Analysis'}</Overline>
                  <h3 className="font-editorial font-medium text-base lg:text-[1.0625rem] leading-snug text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[var(--accent)] transition-colors duration-200">
                    {p.title}
                  </h3>
                </div>
                <p className="font-plex text-xs text-[#475569] dark:text-[#94A3B8] shrink-0 tabular-nums">{longDate(p.created_at)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tools — restrained, single column list, no dark CTA */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
        <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
          <p className="font-editorial italic text-lg mb-6">Membership tools</p>
          <ul className="border-t border-[#E2E8F0] dark:border-[#1E293B]">
            {[
              ['Reading list', 'Saved articles, synced across devices.', 'View →'],
              ['Notifications', 'Weekly TSOP · Left Field briefs · New editions.', 'Edit →'],
              ['Billing', 'Last invoice 12 Feb 2026 · ₹2,949 · Razorpay.', 'Download invoice →'],
              ['Insider Drops · Soon', 'Subscriber-only feed of deal whispers and short notes.', 'Notify me →'],
            ].map(([title, desc, cta]) => (
              <li key={title} className="grid grid-cols-12 gap-4 py-5 border-b border-[#E2E8F0] dark:border-[#1E293B]">
                <div className="col-span-12 md:col-span-4">
                  <h3 className="font-editorial font-medium text-lg">{title}</h3>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">{desc}</p>
                </div>
                <div className="col-span-12 md:col-span-2 md:text-right">
                  <span className="font-plex text-sm text-[var(--accent)] underline underline-offset-[6px] decoration-1">{cta}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MockupLayout>
  );
};

export default AccountMockup;
