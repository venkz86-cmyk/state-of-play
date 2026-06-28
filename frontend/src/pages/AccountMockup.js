import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { ghostAPI } from '../services/ghostAPI';
import { useAuth } from '../contexts/AuthContext';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { InvoiceRequestModal } from '../components/InvoiceRequestModal';
import { NominateReaderBlock } from '../components/NominateReaderBlock';

const API = process.env.REACT_APP_BACKEND_URL;

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

export const AccountMockup = () => {
  const { user, isLoggedIn, loading, logout, canAccessPremium } = useAuth();
  const [recent, setRecent] = useState([]);
  const [details, setDetails] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try { setRecent(await ghostAPI.getPosts({ limit: 5 })); }
      catch (e) { console.error(e); }
    })();
  }, []);

  // Fetch real subscription dates from Ghost Admin API
  useEffect(() => {
    let active = true;
    if (!user?.email || !API) return;
    (async () => {
      try {
        const r = await axios.post(
          `${API}/api/ghost/member-details`,
          { email: user.email },
          { timeout: 8000 }
        );
        if (active && r.data) setDetails(r.data);
      } catch (e) {
        console.error('Member details failed:', e);
      }
    })();
    return () => { active = false; };
  }, [user?.email]);

  // Gate: visitors who aren't signed in are bounced to /login
  if (!loading && !isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  const memberName = (user?.name?.split(' ')[0]) || 'Reader';
  const memberEmail = user?.email || '';
  const planLabel = canAccessPremium
    ? (details?.subscription_status === 'comped' ? 'Comped' : 'Annual')
    : 'Free';

  // Razorpay annual subscriptions are one-shot — they expire, not auto-renew.
  // Stripe-billed Ghost subscriptions show as 'active' and do auto-renew.
  const autoRenews = details?.subscription_status === 'active';
  const dateLabel = autoRenews ? 'Renews' : 'Expires';
  const endDate = longDate(details?.subscription_end);
  const memberSince = longDate(details?.subscription_start || details?.created_at);
  const nextCharge = autoRenews && canAccessPremium ? '₹2,949' : '—';

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
            [dateLabel, endDate || '—'],
            ['Next charge', nextCharge],
            ['Member since', memberSince || '—'],
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
              {
                title: 'Reading list',
                desc: 'Saved articles, synced across devices.',
                cta: 'View →',
                href: '#',
              },
              {
                title: 'Notifications',
                desc: 'Weekly TSOP · Left Field briefs · New editions.',
                cta: 'Edit →',
                href: 'mailto:venkat@stateofplay.club?subject=Notification%20preferences',
              },
              {
                title: 'Billing',
                desc: canAccessPremium
                  ? `Last invoice ${memberSince || '—'} · ₹2,949 · Razorpay.`
                  : 'No active subscription.',
                cta: 'Need GST invoice? Download →',
                onClick: canAccessPremium ? () => setInvoiceOpen(true) : null,
                href: canAccessPremium ? null : '#',
              },
              {
                title: 'Insider Drops · Soon',
                desc: 'Subscriber-only feed of deal whispers and short notes.',
                cta: 'Notify me →',
                href: 'mailto:venkat@stateofplay.club?subject=Insider%20Drops%20%E2%80%94%20notify%20me',
              },
            ].map(({ title, desc, cta, href, onClick }) => (
              <li key={title} className="grid grid-cols-12 gap-4 py-5 border-b border-[#E2E8F0] dark:border-[#1E293B]">
                <div className="col-span-12 md:col-span-4">
                  <h3 className="font-editorial font-medium text-lg">{title}</h3>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">{desc}</p>
                </div>
                <div className="col-span-12 md:col-span-2 md:text-right">
                  {onClick ? (
                    <button
                      type="button"
                      onClick={onClick}
                      data-testid={`account-tool-${title.toLowerCase().split(' ')[0]}`}
                      className="font-plex text-sm text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
                    >
                      {cta}
                    </button>
                  ) : (
                    <a
                      href={href}
                      data-testid={`account-tool-${title.toLowerCase().split(' ')[0]}`}
                      className="font-plex text-sm text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
                    >
                      {cta}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {canAccessPremium && (
        <section className="max-w-[1080px] mx-auto px-6 lg:px-12 pb-20">
          <NominateReaderBlock
            subscriberName={user?.name || ''}
            subscriberEmail={memberEmail}
            subscriberGhostId={details?.id || details?.ghost_member_id || ''}
          />
        </section>
      )}

      <InvoiceRequestModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        memberEmail={memberEmail}
      />
    </MockupLayout>
  );
};

export default AccountMockup;
