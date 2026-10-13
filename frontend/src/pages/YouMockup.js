import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { getBookmarks, removeBookmark } from '../components/Bookmarks';
import { getReadingHistory } from '../components/ReadingHistory';
import { TheTenPanel } from '../components/TheTenPanel';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';
import { authHeader } from '../lib/sessionToken';
import { describeMembership } from '../lib/membership';
const InvoiceRequestModal = lazy(() => import('../components/InvoiceRequestModal').then((m) => ({ default: m.InvoiceRequestModal })));
const GiftArticleModal = lazy(() => import('../components/GiftArticleModal').then((m) => ({ default: m.GiftArticleModal })));

/* /you: the app's You tab, and the app's account page (/account opens it
   in the app, so links in emails, ?invoice=1 included, land here).
   Order follows use: who you are and where your membership stands, then
   saved stories (the frequent thing), recently read, and the membership
   tools needed a few times a year. Settings and signing out are in the
   menu. The membership wording is shared with the website's /account
   (lib/membership.js). Saved and recently read live in this browser
   (components/Bookmarks.js, ReadingHistory.js), so they work signed out. */
const API = process.env.REACT_APP_BACKEND_URL;
const label = 'font-plex text-[11px] uppercase tracking-[0.1em] text-[var(--text-label)]';

const SectionHead = ({ children, count }) => (
  <div className="flex items-baseline justify-between border-b border-[var(--text)] pb-3">
    <p className={label}>{children}</p>
    {count > 0 && <span className="font-plex text-[12px] text-[var(--text-muted)] tabular-nums">{count}</span>}
  </div>
);

const StoryRow = ({ item, onRemove }) => (
  <li className="border-b border-[var(--rule)] flex items-start gap-3">
    <Link to={`/${item.id}`} className="group flex-1 min-w-0 py-4">
      <p className="font-editorial text-[19px] leading-snug group-hover:text-[var(--text-muted)] transition-colors">{item.title}</p>
      {(item.theme || item.read_time) && (
        <p className="font-plex text-[12px] text-[var(--text-muted)] mt-1.5">
          {[item.theme, item.read_time ? `${item.read_time} min read` : null].filter(Boolean).join(' · ')}
        </p>
      )}
    </Link>
    {onRemove && (
      <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title} from saved`}
        className="mt-3 h-10 w-10 -mr-2 shrink-0 inline-flex items-center justify-center text-[var(--text-label)] hover:text-[var(--text)]">
        <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
    )}
  </li>
);

// A row that goes somewhere (to) or does something (onClick).
const Row = ({ to, onClick, title, desc, testId, badge }) => {
  const inner = (
    <>
      <span className="text-left">
        <span className={`block font-plex ${desc ? 'text-[16px] font-medium' : 'text-[15px]'}`}>
          {title}
          {badge && <span className="ml-2 align-middle font-plex text-[10px] uppercase tracking-[0.12em] font-semibold text-white bg-[var(--accent-blue)] px-1.5 py-[3px] leading-none">{badge}</span>}
        </span>
        {desc && <span className="block font-plex text-[13px] text-[var(--text-muted)] mt-0.5">{desc}</span>}
      </span>
      <span className="font-plex text-[18px] text-[var(--text-label)] group-hover:text-[var(--text)]" aria-hidden="true">›</span>
    </>
  );
  const cls = `group w-full flex items-center justify-between gap-4 ${desc ? 'py-4' : 'py-3.5'}`;
  return (
    <li className="border-b border-[var(--rule)]">
      {onClick
        ? <button type="button" onClick={onClick} data-testid={testId} className={cls}>{inner}</button>
        : <Link to={to} data-testid={testId} className={cls}>{inner}</Link>}
    </li>
  );
};

const PLAN_TITLE = {
  Annual: 'Annual membership',
  Student: 'Student membership',
  Trial: 'The Ten',
  Comped: 'Complimentary membership',
  Complimentary: 'Complimentary membership',
  Free: 'Free reader',
};

// Where the membership stands, with the top corner of the logo's frame.
const MembershipCard = ({ m, details, canAccessPremium }) => {
  const [k, v, lines] = m.renewalTile;
  const all = [].concat(lines || []).filter(Boolean);
  const breakdown = all.find((l) => l.includes('GST'));
  // The renewal note says how renewing works; with the Renew box showing,
  // it would repeat it.
  const notes = m.renewal ? [] : all.filter((l) => l !== breakdown);
  return (
    <section className="relative border-t-2 border-[var(--text)] pt-5" data-testid="you-membership-card">
      <span aria-hidden="true" className="absolute -top-[2px] right-0 h-3 w-12 border-t-2 border-r-2 border-[var(--accent-blue)]" />
      <p className={label}>Your membership</p>
      <p className="font-editorial text-[28px] leading-[1.1] mt-2">{details ? PLAN_TITLE[m.planLabel] || m.planLabel : '…'}</p>
      {details && canAccessPremium && (
        <dl className="mt-4 font-plex text-[14px] leading-[1.5] space-y-2">
          {m.endDate && (
            <div className="flex justify-between gap-4"><dt className="text-[var(--text-muted)]">{m.dateLabel}</dt><dd className="text-right tabular-nums">{m.endDate}</dd></div>
          )}
          {v && v !== '—' && (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-muted)]">{k}</dt>
              <dd className="text-right tabular-nums">{v}{breakdown && <span className="block text-[12px] text-[var(--text-muted)]">{breakdown}</span>}</dd>
            </div>
          )}
          {m.memberSince && (
            <div className="flex justify-between gap-4"><dt className="text-[var(--text-muted)]">Member since</dt><dd className="text-right tabular-nums">{m.memberSince}</dd></div>
          )}
          {notes.map((line) => (
            <p key={line} className="text-[13px] text-[var(--text-muted)] pt-1">{line}</p>
          ))}
        </dl>
      )}
      {details && !canAccessPremium && details.tier !== 'trial' && (
        <div className="mt-4">
          <p className="font-plex text-[14px] text-[var(--text-muted)] mb-4">Membership opens every story, and the archive.</p>
          <Link to="/signup" className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-12 px-8 transition-colors">
            Become a member
          </Link>
        </div>
      )}
    </section>
  );
};

const Renew = ({ m, email }) => {
  const [done, setDone] = useState(false);
  const { renewal, paidInUsd, endDate } = m;
  return (
    <section className="mt-8 border border-[var(--rule)] p-5" data-testid="you-renew">
      {done ? (
        <p className="font-plex text-[15px] text-[var(--text-muted)]">You've renewed. Reloading…</p>
      ) : (
        <>
          <p className="font-editorial text-[22px] leading-snug">{renewal.lapsed ? 'Your membership has lapsed' : 'Time to renew'}</p>
          <p className="font-plex text-[14px] text-[var(--text-muted)] mt-2 mb-5">
            {renewal.lapsed
              ? `Your year ended on ${endDate}. Renew now and your next year starts today.`
              : `Your year ends on ${endDate}. Renew now and your next year starts that day, so renewing early costs you nothing.`}
          </p>
          <RazorpayCheckoutButton
            plan="renewal"
            source="app-you-renew"
            country={paidInUsd ? 'INTL' : 'IN'}
            buttonLabel={paidInUsd ? 'Renew for $149' : 'Renew for ₹3,539'}
            dataTestId="you-renew-button"
            lockedEmail={email}
            disclosureText={paidInUsd ? 'One payment. Nothing renews on its own.' : '₹2,999 + ₹540 GST. One payment. Nothing renews on its own.'}
            onSuccess={() => { setDone(true); setTimeout(() => window.location.reload(), 1500); }}
          />
        </>
      )}
    </section>
  );
};

export const YouMockup = () => {
  const { user, isLoggedIn, loading, canAccessPremium } = useAuth();
  const pricing = useGeoPricing();
  const [saved, setSaved] = useState([]);
  const [recent, setRecent] = useState([]);
  const [details, setDetails] = useState(null);
  const [mixedZone, setMixedZone] = useState({ eligible: false, count: 0 });
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setSaved(getBookmarks());
    const savedIds = new Set(getBookmarks().map((s) => s.id));
    setRecent(getReadingHistory().filter((r) => !savedIds.has(r.id)).slice(0, 5));
  }, []);

  useEffect(() => {
    if (!user?.email || !API) return undefined;
    let live = true;
    fetch(`${API}/api/ghost/member-details`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: '{}' })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setDetails(d); }).catch(() => {});
    fetch(`${API}/api/mixed-zone/new-count`, { headers: authHeader() })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setMixedZone(d); }).catch(() => {});
    return () => { live = false; };
  }, [user?.email]);

  // ?invoice=1 (the link in payment emails) opens the invoices.
  useEffect(() => {
    if (searchParams.get('invoice') === '1' && !loading && isLoggedIn) setInvoiceOpen(true);
  }, [searchParams, loading, isLoggedIn]);

  const remove = (id) => { removeBookmark(id); setSaved(getBookmarks()); };
  const first = (user?.name || '').trim().split(/\s+/)[0];
  const m = describeMembership(details, canAccessPremium);

  return (
    <MockupLayout testId="page-you" seo={{ title: 'You', path: '/you', noindex: true }}>
      <div className="max-w-[720px] mx-auto px-6 lg:px-0 pt-10 lg:pt-16 pb-16">
        <div className="border-b border-[var(--rule)] pb-3 mb-8"><Overline>You</Overline></div>
        <h1 className="font-editorial text-[34px] md:text-[44px] leading-[1.1]" data-testid="you-heading">
          {isLoggedIn && first ? `Hello, ${first}.` : 'Your reading.'}
        </h1>
        {isLoggedIn && <p className="font-plex text-[14px] text-[var(--text-muted)] mt-2 truncate">{user?.email}</p>}

        {!loading && isLoggedIn && (
          <div className="mt-10">
            <MembershipCard m={m} details={details} canAccessPremium={canAccessPremium} />
            {m.renewal && <Renew m={m} email={user?.email} />}
            {details?.tier === 'trial' && (
              <div className="mt-8"><TheTenPanel email={user?.email} country={pricing.country === 'IN' ? 'IN' : 'INTL'} /></div>
            )}
          </div>
        )}

        {!loading && !isLoggedIn && (
          <section className="mt-8" data-testid="you-membership">
            <p className="font-plex text-[15px] text-[var(--text-muted)] mb-5 max-w-[48ch]">
              Sign in with your subscription email to read every story.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Link to="/login" data-testid="you-sign-in"
                className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex btn-type h-12 px-8 transition-colors">
                Sign in
              </Link>
              <Link to="/signup" className="font-plex text-[15px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)]">
                Become a member
              </Link>
            </div>
          </section>
        )}

        <section className="mt-12" data-testid="you-saved">
          <SectionHead count={saved.length}>Saved for later</SectionHead>
          {saved.length ? (
            <ul>{saved.map((s) => <StoryRow key={s.id} item={s} onRemove={remove} />)}</ul>
          ) : (
            <p className="font-plex text-[15px] text-[var(--text-muted)] py-5 max-w-[48ch]">
              Nothing saved yet. Tap Save on any story and it waits for you here.
            </p>
          )}
        </section>

        {recent.length > 0 && (
          <section className="mt-12" data-testid="you-recent">
            <SectionHead>Recently read</SectionHead>
            <ul>{recent.map((r) => <StoryRow key={r.id} item={r} />)}</ul>
          </section>
        )}

        {isLoggedIn && (
          <section className="mt-12" data-testid="you-tools">
            <SectionHead>Membership</SectionHead>
            <ul>
              {canAccessPremium && (
                <Row onClick={() => setInvoiceOpen(true)} title="GST invoices" desc={m.billingLine} testId="you-invoices" />
              )}
              {mixedZone.eligible && (
                <Row to="/mixed-zone" title="Mixed Zone" desc="Short notes before they are stories"
                  badge={mixedZone.count > 0 ? `${mixedZone.count} new` : null} testId="you-mixed-zone" />
              )}
              <Row to="/gift?ref=app" title="Give a year" desc="A year of The State of Play for someone else" testId="you-gift" />
              {canAccessPremium && (
                <Row onClick={() => setGiftOpen(true)} title="Gift a story" desc="Send a story free, or nominate someone for two weeks" testId="you-gift-story" />
              )}
            </ul>
          </section>
        )}

        <section className="mt-12" data-testid="you-links">
          <SectionHead>The State of Play</SectionHead>
          <ul>
            <Row to="/about" title="About" />
            <Row to="/contact" title="Contact" />
            <Row to="/terms" title="Terms" />
            <Row to="/privacy" title="Privacy" />
          </ul>
        </section>
      </div>

      {invoiceOpen && (
        <Suspense fallback={null}>
          <InvoiceRequestModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} memberEmail={user?.email || ''} />
        </Suspense>
      )}
      {giftOpen && (
        <Suspense fallback={null}>
          <GiftArticleModal
            open={giftOpen}
            onOpenChange={setGiftOpen}
            isPaidSubscriber={!!canAccessPremium}
            subscriberName={user?.name || ''}
            subscriberEmail={user?.email || ''}
            subscriberGhostId={details?.id || details?.ghost_member_id || ''}
            postSlug=""
            articleTitle=""
          />
        </Suspense>
      )}
    </MockupLayout>
  );
};

export default YouMockup;
