import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authHeader } from '../lib/sessionToken';
import { useAuth } from '../contexts/AuthContext';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { InvoiceRequestModal } from '../components/InvoiceRequestModal';
import { GiftArticleModal } from '../components/GiftArticleModal';
import { getReadingHistory, clearReadingHistory } from '../components/ReadingHistory';
import { getBookmarks, removeBookmark, clearBookmarks } from '../components/Bookmarks';
import { TheTenPanel } from '../components/TheTenPanel';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';
import { renewalOffer } from '../lib/renewal';


const API = process.env.REACT_APP_BACKEND_URL;

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

export const AccountMockup = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, loading, canAccessPremium } = useAuth();
  const pricing = useGeoPricing();
  const [recent, setRecent] = useState([]);
  const [saved, setSaved] = useState([]);
  const [details, setDetails] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [justRenewed, setJustRenewed] = useState(false);
  const [giftModalOpen, setGiftModalOpen] = useState(false);

  useEffect(() => {
    setRecent(getReadingHistory().slice(0, 5));
    setSaved(getBookmarks());
  }, []);

  const handleClearRecent = () => {
    clearReadingHistory();
    setRecent([]);
  };

  const handleRemoveSaved = (id) => {
    removeBookmark(id);
    setSaved((prev) => prev.filter((p) => p.id !== id));
  };

  const handleClearSaved = () => {
    clearBookmarks();
    setSaved([]);
  };

  // Fetch real subscription dates from Ghost Admin API
  useEffect(() => {
    let active = true;
    if (!user?.email || !API) return;
    (async () => {
      try {
        const r = await axios.post(
          `${API}/api/ghost/member-details`,
          {},
          { timeout: 8000, headers: authHeader() }
        );
        if (active && r.data) setDetails(r.data);
      } catch (e) {
        console.error('Member details failed:', e);
      }
    })();
    return () => { active = false; };
  }, [user?.email]);

  // Gate: visitors who aren't signed in are bounced to /login. Runs in an
  // effect, not inline during render -- a render-time redirect here would
  // depend on exact state-batching order between the auth bootstrap's
  // setUser/setLoading calls to avoid a false "signed out" flash.
  useEffect(() => {
    if (!loading && !isLoggedIn) navigate('/login', { replace: true });
  }, [loading, isLoggedIn, navigate]);

  if (loading || !isLoggedIn) {
    return null;
  }

  const memberName = (user?.name?.split(' ')[0]) || 'Reader';
  const memberEmail = user?.email || '';
  // A real Trial ("The Ten") member carries only 'tier-trial', no paid
  // label, so canAccessPremium is false for them -- checked first, or
  // they'd fall through to 'Free' despite the Trial section below.
  const planLabel = details?.tier === 'trial'
    ? 'Trial'
    : canAccessPremium
      ? (details?.tier === 'student'
          ? 'Student'
          : details?.subscription_status === 'nomination'
            ? 'Trial'
            : details?.subscription_status === 'comped' ? 'Comped'
              : details?.subscription_status === 'complimentary' ? 'Complimentary' : 'Annual')
      : 'Free';

  // A Razorpay member's own subscription_status now distinguishes a real
  // recurring Subscription ('active') from a one-time Order payment
  // ('one_time') -- server.py's get_member_details checks Razorpay's own
  // subscription_id on their last payment, not a blanket assumption.
  // Stripe-billed Ghost subscriptions still show as 'active' too.
  const autoRenews = details?.subscription_status === 'active';
  // Whether to show the Renew block (lib/renewal.js).
  const renewal = renewalOffer(details);
  const complimentary = details?.subscription_status === 'complimentary';
  const dateLabel = autoRenews ? 'Renews' : complimentary ? 'Ends' : 'Expires';
  const endDate = longDate(details?.subscription_end);
  const memberSince = longDate(details?.subscription_start || details?.created_at);
  const paidInUsd = details?.last_payment_currency === 'USD';
  const nextCharge = autoRenews && canAccessPremium ? (paidInUsd ? '$149' : '₹3,539') : '—';
  const nextChargeDetail = autoRenews && canAccessPremium && !paidInUsd ? '₹2,999 + ₹540 GST' : null;
  // Most members paid once: for them the third tile says how renewal
  // works instead of showing an empty "Next charge". The reminder timing
  // is annual_renewal.py's REMINDER_DAYS_BEFORE.
  // A complimentary year (complimentary.py) renews the same way.
  const paidOnce = canAccessPremium && (details?.subscription_status === 'one_time' || complimentary);
  // What renewing costs, in the currency the member last paid in: the
  // renewal rate (razorpay_subscriptions.SUBSCRIPTION_PLANS) or, for
  // students, the student price (razorpay_orders.PLAN_PRICING['student']).
  const isStudent = details?.tier === 'student';
  const renewalPrice = isStudent
    ? (paidInUsd ? ['$29 a year', null] : ['₹1,770 a year', '₹1,500 + ₹270 GST'])
    : (paidInUsd ? ['$149 a year', null] : ['₹3,539 a year', '₹2,999 + ₹540 GST']);
  // Students renew through a fresh ID check, not the reminder emails.
  const renewalNote = isStudent
    ? 'Not automatic. We\'ll be in touch before it ends.'
    : 'Not automatic. We email you 14 days before it ends.';
  const renewalTile = paidOnce
    ? ['Renewal', renewalPrice[0], [renewalPrice[1], renewalNote].filter(Boolean)]
    : ['Next charge', nextCharge, nextChargeDetail];

  // The member's real last payment, not a fixed price: students, renewals,
  // teams and new signups all pay different amounts.
  const formatAmount = (amount, currency) => {
    if (amount == null) return '';
    const units = amount / 100;
    return currency === 'USD'
      ? `$${units.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      : `₹${units.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };
  const billingLine = !canAccessPremium
    ? 'No active subscription.'
    : details?.last_payment_amount != null
      ? `Last payment ${longDate(details.last_payment_date)} · ${formatAmount(details.last_payment_amount, details.last_payment_currency)} · Razorpay.`
      : 'No payment on file.';

  return (
    <MockupLayout testId="page-account" seo={{ title: 'Your Account', path: '/account', noindex: true }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
          <span className="font-plex text-[14px] text-[var(--text-muted)]">{memberEmail}</span>
          <span className="font-plex text-[14px] text-[var(--text-muted)] tabular-nums">Member Lounge</span>
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
      </section>

      {/* Stat strip — Fix 22: solid 1px var(--rule) dividers */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-y border-[var(--rule)] grid grid-cols-2 md:grid-cols-4">
          {[
            ['Plan', planLabel],
            [dateLabel, endDate || '—'],
            renewalTile,
            ['Member since', memberSince || '—'],
          ].map(([k, v, detail], i) => (
            <div
              key={k}
              // Phones show two columns, desktop four: only tiles that sit
              // to the right of another get a left border, and the second
              // row on phones gets a top border instead.
              className={[
                'py-6 px-6 border-[var(--rule)]',
                i % 2 === 1 ? 'border-l' : '',
                i >= 2 ? 'border-t md:border-t-0' : '',
                i === 2 ? 'md:border-l' : '',
              ].join(' ')}
            >
              <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">{k}</Overline>
              <p className="font-editorial font-medium text-lg lg:text-xl leading-tight">{v}</p>
              {detail && [].concat(detail).map((line) => (
                <p key={line} className="font-plex text-xs text-[var(--text-muted)] mt-1">{line}</p>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Renew: see lib/renewal.js for who sees it. One payment (plan
          'renewal'), in the currency they last paid in; the new year
          starts when the current one ends. A trial/student/corporate/
          comped member never sees this: they renew through their own
          path. */}
      {renewal && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
          <div className="border-t border-[var(--text)] pt-8 max-w-[520px]">
            {justRenewed ? (
              <p className="font-plex text-[15px] text-[var(--text-muted)]">
                You've renewed. Reloading your account…
              </p>
            ) : (
              <>
                <p className="font-editorial italic text-lg mb-1">
                  {renewal.lapsed ? 'Your membership has lapsed' : 'Time to renew'}
                </p>
                <p className="font-plex text-sm text-[var(--text-muted)] mb-5">
                  {renewal.lapsed
                    ? `Your year ended on ${endDate}. Renew now and your next year starts today.`
                    : `Your year ends on ${endDate}. Renew now and your next year starts that day, so renewing early costs you nothing.`}
                </p>
                {/* Break-up, not just a total — a GST invoice is exactly
                    what the Billing tool below already offers to send, so
                    the same reader clearly wants to see base vs. tax, not
                    one bundled number. */}
                <div className="border-y border-[var(--rule)] mb-6">
                  {!paidInUsd && (<>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="font-plex text-sm text-[var(--text-muted)]">Base price</span>
                    <span className="font-plex text-sm tabular-nums">₹2,999</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 border-t border-[var(--rule)]">
                    <span className="font-plex text-sm text-[var(--text-muted)]">GST (18%)</span>
                    <span className="font-plex text-sm tabular-nums">₹540</span>
                  </div>
                  </>)}
                  <div className={`flex items-center justify-between py-2.5${paidInUsd ? '' : ' border-t border-[var(--rule)]'}`}>
                    <span className="font-plex text-sm font-medium">Total</span>
                    <span className="font-plex text-sm font-medium tabular-nums">{paidInUsd ? '$149' : '₹3,539'}</span>
                  </div>
                </div>
                <RazorpayCheckoutButton
                  plan="renewal"
                  source="account-renew"
                  country={paidInUsd ? 'INTL' : 'IN'}
                  buttonLabel="Renew for a year"
                  dataTestId="account-renew"
                  lockedEmail={memberEmail}
                  disclosureText="One payment. Nothing renews on its own."
                  onSuccess={() => {
                    setJustRenewed(true);
                    setTimeout(() => { window.location.reload(); }, 1500);
                  }}
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* The Ten — Trial members only, backs onto GET /api/trial/status */}
      {details?.tier === 'trial' && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
          <div className="border-t border-[var(--text)] pt-8">
            <p className="font-editorial italic text-lg mb-6">The Ten</p>
            <TheTenPanel email={memberEmail} country={pricing.country === 'IN' ? 'IN' : 'INTL'} />
          </div>
        </section>
      )}

      {/* Saved — deliberate bookmarks, distinct from passive reading history */}
      {saved.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
          <div className="border-t border-[var(--text)] pt-8">
            <div className="flex items-baseline justify-between mb-6">
              <p className="font-editorial italic text-lg">Saved</p>
              <button
                type="button"
                onClick={handleClearSaved}
                data-testid="account-clear-saved"
                className="font-plex text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline underline-offset-[4px] decoration-1 transition-colors duration-200"
              >
                Clear
              </button>
            </div>
            <div className="border-t border-[var(--rule)]">
              {saved.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-baseline justify-between gap-6 py-5 border-b border-[var(--rule)]"
                >
                  <Link to={`/${p.id}`} className="flex-1 min-w-0">
                    <Overline className="!normal-case !tracking-normal !text-xs block mb-1">{p.theme || 'Reportage'}</Overline>
                    <h3 className="font-editorial font-medium text-base lg:text-[1.0625rem] leading-snug text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-200">
                      {p.title}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-4 shrink-0">
                    {p.read_time ? (
                      <p className="font-plex text-xs text-[var(--text-muted)] tabular-nums">{p.read_time} min read</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleRemoveSaved(p.id)}
                      data-testid={`account-unsave-${p.id}`}
                      aria-label={`Remove ${p.title} from saved`}
                      className="font-plex text-xs text-[var(--text-muted)] hover:text-[var(--accent-burgundy)] underline underline-offset-[4px] decoration-1 transition-colors duration-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recently read — real per-browser history, not a placeholder feed */}
      {recent.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
          <div className="border-t border-[var(--text)] pt-8">
            <div className="flex items-baseline justify-between mb-6">
              <p className="font-editorial italic text-lg">Recently read</p>
              <button
                type="button"
                onClick={handleClearRecent}
                data-testid="account-clear-recent"
                className="font-plex text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline underline-offset-[4px] decoration-1 transition-colors duration-200"
              >
                Clear
              </button>
            </div>
            <div className="border-t border-[var(--rule)]">
              {recent.map((p) => (
                <Link
                  key={p.id}
                  to={`/${p.id}`}
                  className="group flex items-baseline justify-between gap-6 py-5 border-b border-[var(--rule)]"
                >
                  <div className="flex-1 min-w-0">
                    {/* Fallback only for history recorded before theme was added to addToReadingHistory */}
                    <Overline className="!normal-case !tracking-normal !text-xs block mb-1">{p.theme || 'Reportage'}</Overline>
                    <h3 className="font-editorial font-medium text-base lg:text-[1.0625rem] leading-snug text-[var(--text)] group-hover:text-[var(--accent)] transition-colors duration-200">
                      {p.title}
                    </h3>
                  </div>
                  {p.read_time ? (
                    <p className="font-plex text-xs text-[var(--text-muted)] shrink-0 tabular-nums">{p.read_time} min read</p>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tools — restrained, single column list, no dark CTA */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-6">Membership tools</p>
          <ul className="border-t border-[var(--rule)]">
            {[
              {
                title: 'Notifications',
                desc: 'Weekly TSOP · Left Field briefs · New editions.',
                cta: 'Edit',
                href: 'mailto:venkat@stateofplay.club?subject=Notification%20preferences',
              },
              {
                title: 'Billing',
                desc: billingLine,
                cta: 'Need GST invoice? Download',
                onClick: canAccessPremium ? () => setInvoiceOpen(true) : null,
                href: canAccessPremium ? null : '#',
              },
              {
                title: 'Insider Drops · Soon',
                desc: 'Subscriber-only feed of deal whispers and short notes.',
                cta: 'Notify me',
                href: 'mailto:venkat@stateofplay.club?subject=Insider%20Drops%3A%20notify%20me',
              },
            ].map(({ title, desc, cta, href, onClick }) => (
              <li key={title} className="grid grid-cols-12 gap-4 py-5 border-b border-[var(--rule)]">
                <div className="col-span-12 md:col-span-4">
                  <h3 className="font-editorial font-medium text-lg">{title}</h3>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <p className="font-plex text-sm text-[var(--text-muted)]">{desc}</p>
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
          <div className="border-t border-[var(--rule)] pt-12 lg:pt-14 pb-8">
            <Overline className="block mb-5">Reader to reader</Overline>
            <h2 className="font-editorial font-semibold text-[1.75rem] md:text-[2rem] leading-[1.15] mb-4 max-w-[24ch]">
              Know someone who should be <em className="italic font-normal">reading?</em>
            </h2>
            <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)] mb-8 max-w-[58ch]">
              Send a story their way, free, or nominate them for two weeks of full access.
            </p>
            <button
              type="button"
              onClick={() => setGiftModalOpen(true)}
              data-testid="account-gift-cta"
              className="h-12 px-8 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] transition-colors"
              style={{ borderRadius: 'var(--control-radius)' }}
            >
              Gift a story
            </button>
          </div>
        </section>
      )}

      <GiftArticleModal
        open={giftModalOpen}
        onOpenChange={setGiftModalOpen}
        isPaidSubscriber={!!canAccessPremium}
        subscriberName={user?.name || ''}
        subscriberEmail={memberEmail}
        subscriberGhostId={details?.id || details?.ghost_member_id || ''}
        postSlug=""
        articleTitle=""
      />

      <InvoiceRequestModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        memberEmail={memberEmail}
      />
    </MockupLayout>
  );
};

export default AccountMockup;
