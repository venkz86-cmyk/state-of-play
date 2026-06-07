import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';

/* =============================================================================
   /mockup/teams-manage  —  Editorial redesign preview for /teams/manage
   --------------------------------------------------------------------
   This is a STATIC, mock-data preview. The live route at /teams/manage
   will be cut over to this design once approved.

   Switch states via ?state=loading|invalid|expired|active|full
   ============================================================================= */

// ─── Mock fixtures ───────────────────────────────────────────────────────────
const MOCK_ACCOUNTS = {
  active: {
    account_id: 'ACC129',
    company_name: 'Acme Sports',
    company_domain: 'acmesports.in',
    admin_email: 'rohini@acmesports.in',
    plan_name: 'Team-5',
    seats: 5,
    renewal_date: '2027-04-14',
    started_at: '2026-04-14',
    last_payment_amount_inr: 11800,
    last_payment_date: '2026-04-14',
    status: 'active',
  },
  full: {
    account_id: 'ACC042',
    company_name: 'Bombay Innings',
    company_domain: 'bombayinnings.com',
    admin_email: 'priya@bombayinnings.com',
    plan_name: 'Team-5',
    seats: 5,
    renewal_date: '2026-11-02',
    started_at: '2025-11-02',
    last_payment_amount_inr: 11800,
    last_payment_date: '2025-11-02',
    status: 'active',
  },
  expired: {
    account_id: 'ACC077',
    company_name: 'Old Trafford Partners',
    company_domain: 'oldtraffordpartners.com',
    admin_email: 'admin@oldtraffordpartners.com',
    plan_name: 'Team-10',
    seats: 10,
    renewal_date: '2025-12-01',
    started_at: '2024-12-01',
    last_payment_amount_inr: 23600,
    last_payment_date: '2024-12-01',
    status: 'expired',
  },
};

const MOCK_MEMBERS = {
  active: [
    { member_id: 'MEM301', email: 'rohini@acmesports.in', added_at: '2026-04-14', last_seen_at: '2026-06-04T11:24:00Z' },
    { member_id: 'MEM302', email: 'arjun@acmesports.in',  added_at: '2026-04-21', last_seen_at: '2026-05-19T08:42:00Z' },
    { member_id: 'MEM303', email: 'kavita@acmesports.in', added_at: '2026-05-09', last_seen_at: null },
  ],
  full: [
    { member_id: 'MEM501', email: 'priya@bombayinnings.com',  added_at: '2025-11-02', last_seen_at: '2026-06-03T17:02:00Z' },
    { member_id: 'MEM502', email: 'rahul@bombayinnings.com',  added_at: '2025-11-05', last_seen_at: '2026-06-01T09:14:00Z' },
    { member_id: 'MEM503', email: 'meera@bombayinnings.com',  added_at: '2025-12-12', last_seen_at: '2026-05-20T15:30:00Z' },
    { member_id: 'MEM504', email: 'sahil@bombayinnings.com',  added_at: '2026-01-08', last_seen_at: '2026-04-09T11:00:00Z' },
    { member_id: 'MEM505', email: 'ananya@bombayinnings.com', added_at: '2026-02-17', last_seen_at: null },
  ],
  expired: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const longDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

const inrFormat = (n) => `\u20B9${(n || 0).toLocaleString('en-IN')}`;

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Member-status pill computed from Ghost's `last_seen_at`.
// active < 30d  →  burgundy "Active"
// dormant      →  grey   "Last seen Nd ago"
// never        →  grey   "Not signed in yet"
const memberStatus = (lastSeenIso) => {
  if (!lastSeenIso) return { label: 'Not signed in yet', tone: 'muted' };
  const last = new Date(lastSeenIso);
  const days = Math.floor((Date.now() - last.getTime()) / 86_400_000);
  if (days <= 30) return { label: 'Active', tone: 'accent' };
  if (days < 365) return { label: `Last seen ${days}d ago`, tone: 'muted' };
  const years = Math.floor(days / 365);
  return { label: `Last seen ${years}y ago`, tone: 'muted' };
};

// ─── Empty-state / error block (used for invalid + expired states) ───────────
const Notice = ({ title, body, ctaHref = 'https://www.stateofplay.club', ctaText = '\u2190 Back to The State of Play' }) => (
  <section className="max-w-[480px] mx-auto px-6 pt-20 pb-32 text-center">
    <Overline className="block mb-8">— The State of Play —</Overline>
    <h1 className="font-editorial font-semibold text-[1.75rem] leading-snug mb-5 text-[var(--text)]">
      {title}
    </h1>
    <p className="font-plex text-[16px] leading-[1.6] text-[var(--text-muted)] max-w-[42ch] mx-auto mb-8 whitespace-pre-line">
      {body}
    </p>
    <a
      href={ctaHref}
      className="font-plex text-[14px] text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
    >
      {ctaText}
    </a>
  </section>
);

// ─── Loading bar at the top (indeterminate, burgundy) ────────────────────────
const LoadingBar = () => (
  <div className="relative h-[2px] bg-[var(--rule)] overflow-hidden" aria-hidden="true">
    <div
      className="absolute inset-y-0 left-0 w-1/3 bg-[var(--accent-burgundy)]"
      style={{ animation: 'tm-load 1.1s linear infinite' }}
    />
    <style>{`
      @keyframes tm-load {
        0%   { left: -33%; }
        100% { left: 100%; }
      }
    `}</style>
  </div>
);

// =============================================================================
export const TeamsManageMockup = () => {
  const [searchParams] = useSearchParams();
  const stateParam = (searchParams.get('state') || 'active').toLowerCase();

  // -------- LOADING ----------
  if (stateParam === 'loading') {
    return (
      <MockupLayout testId="mockup-teams-manage-loading" hideFooterHeroCta>
        <LoadingBar />
        <div className="max-w-[480px] mx-auto px-6 py-32 text-center">
          <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading your account…</p>
        </div>
      </MockupLayout>
    );
  }

  // -------- INVALID TOKEN ----------
  if (stateParam === 'invalid') {
    return (
      <MockupLayout testId="mockup-teams-manage-invalid" hideFooterHeroCta>
        <Notice
          title="This link isn’t valid."
          body={
            "If you’ve recently subscribed, check your email for a message from venkat@stateofplay.club with your team dashboard link.\n\n" +
            "If you need help, write to prerna@stateofplay.club"
          }
        />
      </MockupLayout>
    );
  }

  // -------- EXPIRED ----------
  if (stateParam === 'expired') {
    return (
      <MockupLayout testId="mockup-teams-manage-expired" hideFooterHeroCta>
        <Notice
          title="Your team subscription has expired."
          body={"To renew your plan, write to prerna@stateofplay.club"}
        />
      </MockupLayout>
    );
  }

  // -------- ACTIVE (or FULL) ----------
  const fixtureKey = stateParam === 'full' ? 'full' : 'active';
  const account = MOCK_ACCOUNTS[fixtureKey];
  const members = MOCK_MEMBERS[fixtureKey];
  return (
    <DashboardView
      account={account}
      initialMembers={members}
    />
  );
};

// =============================================================================
//   ACTIVE DASHBOARD
// =============================================================================
const DashboardView = ({ account, initialMembers }) => {
  const [members, setMembers] = useState(initialMembers);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingRemove, setPendingRemove] = useState(null);

  const seatsUsed = members.length;
  const seatsTotal = account.seats;
  const seatsFull = seatsUsed >= seatsTotal;
  const fillPct = useMemo(
    () => (seatsTotal > 0 ? Math.min(100, (seatsUsed / seatsTotal) * 100) : 0),
    [seatsUsed, seatsTotal]
  );
  const fillColor = seatsFull ? 'var(--text)' : 'var(--accent-burgundy)';
  const memberDomain = account.company_domain;
  const nextRenewalAmount = account.last_payment_amount_inr;

  const handleAdd = (e) => {
    e.preventDefault();
    setEmailError('');
    setSuccessMessage('');
    const email = newEmail.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === email)) {
      setEmailError('This email is already a team member.');
      return;
    }
    if (memberDomain && !email.endsWith(`@${memberDomain}`)) {
      setEmailError(`Only ${memberDomain} email addresses can be added to this account.`);
      return;
    }
    if (seatsFull) {
      setEmailError(`All ${seatsTotal} seats are filled.`);
      return;
    }
    // (Mock) — append to list
    const today = new Date().toISOString().slice(0, 10);
    setMembers((prev) => [
      ...prev,
      { member_id: `MEM${Math.floor(Math.random() * 9000 + 1000)}`, email, added_at: today },
    ]);
    setNewEmail('');
    setSuccessMessage(`Invitation sent to ${email}`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const confirmRemove = (id) => {
    setMembers((prev) => prev.filter((m) => m.member_id !== id));
    setPendingRemove(null);
  };

  return (
    <MockupLayout testId="mockup-teams-manage" hideFooterHeroCta>
      <div className="max-w-[860px] mx-auto px-6 lg:px-0 pt-10 lg:pt-12">

        {/* SECTION A — Dateline + headline ───────────────────────── */}
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3 gap-4 flex-wrap">
          <span className="font-plex text-[13px] text-[var(--text-muted)] uppercase tracking-[0.06em]">
            {account.company_name}
          </span>
          <span className="font-plex text-[13px] text-[var(--text-muted)] tabular-nums">
            {account.plan_name} · {account.seats} seats · Renews {shortDate(account.renewal_date)}
          </span>
        </div>

        <section className="pt-12 lg:pt-14 pb-10">
          <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.25rem] lg:text-[2.5rem] leading-[1.1] mb-4">
            Hello, <em className="italic font-normal">{account.company_name}.</em>
          </h1>
          <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)] max-w-[55ch]">
            Your State of Play team subscription is active.
          </p>
        </section>

        {/* SECTION B — Stats bar ──────────────────────────────────── */}
        <section className="pb-12">
          <div className="border-y border-[var(--rule)] grid grid-cols-2 md:grid-cols-4">
            {[
              ['Plan', account.plan_name, false],
              ['Seats used', `${seatsUsed} of ${seatsTotal}`, false],
              ['Renews', shortDate(account.renewal_date), false],
              ['Status', 'Active', true],
            ].map(([k, v, accent], i) => (
              <div
                key={k}
                className={`py-6 px-6 ${i > 0 ? 'md:border-l border-[var(--rule)]' : ''} ${i === 2 ? 'md:border-l border-[var(--rule)]' : ''}`}
              >
                <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">{k}</Overline>
                <p
                  className="font-editorial font-medium text-lg lg:text-xl leading-tight"
                  style={{ color: accent ? 'var(--accent-burgundy)' : 'var(--text)' }}
                >
                  {v}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION C — Seat meter ─────────────────────────────────── */}
        <section className="pb-10">
          <div className="flex items-baseline justify-between mb-3">
            <Overline>Team members</Overline>
            <span className="font-plex text-[13px] text-[var(--text-muted)] tabular-nums">
              {seatsUsed} of {seatsTotal} seats used
            </span>
          </div>
          <div className="w-full h-[6px] bg-[var(--rule)]" style={{ borderRadius: 0 }}>
            <div
              className="h-[6px] transition-[width] duration-500"
              style={{
                width: `${fillPct}%`,
                backgroundColor: fillColor,
                borderRadius: 0,
              }}
            />
          </div>
        </section>

        {/* SECTION D — Add member (or seats-full message) ────────── */}
        <section className="pb-12">
          {!seatsFull ? (
            <div className="border border-[var(--rule)] bg-white dark:bg-[var(--surface)] p-6">
              <Overline className="block mb-4">Add a team member</Overline>
              <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    if (emailError) setEmailError('');
                    if (successMessage) setSuccessMessage('');
                  }}
                  placeholder={`colleague@${memberDomain}`}
                  data-testid="teams-add-email"
                  className="flex-1 h-12 px-4 bg-transparent border border-[var(--rule)] font-plex text-[15px] focus:outline-none focus:border-[var(--accent-burgundy)]"
                  style={{ borderRadius: 0 }}
                />
                <button
                  type="submit"
                  data-testid="teams-add-submit"
                  className="h-12 px-6 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] transition-colors"
                  style={{ borderRadius: 0 }}
                >
                  Add →
                </button>
              </form>
              <p className="font-plex text-[13px] text-[#999999] mt-3">
                Each person added receives a private login link by email.
              </p>
              {emailError && (
                <p className="font-plex text-[13px] text-[var(--accent-burgundy)] mt-3" data-testid="teams-add-error">
                  {emailError}
                </p>
              )}
              {successMessage && (
                <p className="font-plex text-[13px] mt-3" style={{ color: '#2B5DAC' }} data-testid="teams-add-success">
                  ✓ {successMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="border border-[var(--rule)] bg-white dark:bg-[var(--surface)] p-6">
              <Overline className="block mb-3">All seats filled</Overline>
              <p className="font-plex text-[14px] text-[var(--text-muted)] max-w-[55ch]">
                All {seatsTotal} seats are in use. Remove a member to add someone new, or write to{' '}
                <a
                  href="mailto:prerna@stateofplay.club?subject=Upgrade%20team%20plan"
                  className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1"
                >
                  prerna@stateofplay.club
                </a>{' '}
                to upgrade your plan.
              </p>
            </div>
          )}
        </section>

        {/* SECTION E — Members list ──────────────────────────────── */}
        <section className="pb-12">
          <Overline className="block mb-4">Current members</Overline>

          {members.length === 0 ? (
            <p className="font-plex text-[14px] text-[#999999]">
              No members added yet. Add your first team member above.
            </p>
          ) : (
            <ul className="border-t border-[var(--rule)]">
              {members.map((m) => {
                const isPending = pendingRemove === m.member_id;
                const status = memberStatus(m.last_seen_at);
                const statusColor =
                  status.tone === 'accent' ? 'var(--accent-burgundy)' : '#999999';
                return (
                  <li
                    key={m.member_id}
                    className="border-b border-[var(--rule)] py-4 px-1 grid grid-cols-12 gap-4 items-start"
                    data-testid={`teams-member-${m.member_id}`}
                  >
                    {!isPending ? (
                      <>
                        <div className="col-span-12 md:col-span-5 min-w-0">
                          <p className="font-plex text-[15px] text-[var(--text)] truncate">{m.email}</p>
                        </div>
                        <div className="col-span-7 md:col-span-3 self-center">
                          <p className="font-plex text-[12px] text-[#999999]">
                            Added {shortDate(m.added_at)}
                          </p>
                        </div>
                        <div className="col-span-5 md:col-span-3 self-center md:text-left">
                          <p className="font-plex text-[12px] tabular-nums" style={{ color: statusColor }}>
                            {status.label}
                          </p>
                        </div>
                        <div className="col-span-12 md:col-span-1 md:text-right self-center">
                          <button
                            type="button"
                            onClick={() => setPendingRemove(m.member_id)}
                            data-testid={`teams-remove-${m.member_id}`}
                            className="font-plex text-[12px] text-[#999999] hover:text-[var(--accent-burgundy)] hover:underline underline-offset-[4px] decoration-1 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-12">
                        <p className="font-plex text-[14px] text-[var(--text-muted)] mb-4 max-w-[55ch]">
                          Remove <span className="text-[var(--text)]">{m.email}</span> from your team?
                          This will revoke their access immediately.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            type="button"
                            onClick={() => confirmRemove(m.member_id)}
                            data-testid={`teams-remove-confirm-${m.member_id}`}
                            className="h-9 px-4 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex text-[13px] transition-colors"
                            style={{ borderRadius: 0 }}
                          >
                            Confirm removal
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingRemove(null)}
                            className="font-plex text-[13px] text-[var(--text-muted)] hover:underline underline-offset-[4px] decoration-1 self-center"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* SECTION F — Billing ───────────────────────────────────── */}
        <section className="pb-12 border-t border-[var(--rule)] pt-8">
          <Overline className="block mb-6">Billing</Overline>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            <div>
              <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">Last payment</Overline>
              <p className="font-plex text-[14px] text-[var(--text)] tabular-nums">
                {inrFormat(account.last_payment_amount_inr)} · {shortDate(account.last_payment_date)}
              </p>
            </div>
            <div>
              <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">Next renewal</Overline>
              <p className="font-plex text-[14px] text-[var(--text)] tabular-nums">
                {inrFormat(nextRenewalAmount)} · {shortDate(account.renewal_date)}
              </p>
            </div>
            <div className="md:text-right">
              <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">Invoice</Overline>
              <a
                href={`mailto:prerna@stateofplay.club?subject=GST%20invoice%20%E2%80%94%20${encodeURIComponent(account.company_name)}%20(${account.account_id})`}
                className="font-plex text-[14px] text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
                data-testid="teams-invoice-link"
              >
                Request invoice →
              </a>
            </div>
          </div>
          <p className="font-plex text-[12px] text-[#999999] mt-6 max-w-[55ch]">
            Founding partner rate locked. Team-5 plan ₹11,800 / year · Team-10 plan ₹23,600 / year (inclusive of 18% GST).
          </p>
        </section>

        {/* SECTION G — Footer contact ────────────────────────────── */}
        <section className="border-t border-[var(--rule)] py-10 text-center">
          <p className="font-plex text-[14px] text-[var(--text-muted)]">
            Questions about your subscription? Write to{' '}
            <a
              href="mailto:prerna@stateofplay.club"
              className="text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
            >
              prerna@stateofplay.club
            </a>
          </p>
        </section>
      </div>
    </MockupLayout>
  );
};

export default TeamsManageMockup;
