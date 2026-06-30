import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { TeamInvoiceRequestModal } from '../components/TeamInvoiceRequestModal';

/* =============================================================================
   /teams/manage — Corporate team dashboard
   --------------------------------------------------------------------
   Token-authenticated. The token arrives as ?token=… in the URL and is
   passed with every Apps Script call. No session, no localStorage.

   Backend: Google Apps Script
     GET  ?token=…                     → account + members
     POST { action, token, … }         → add_member | remove_member
   ============================================================================= */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxuRQHvQZfZFYCxLirt8ry2mbiwYGlVKm7N3oe-Oy4-GuosggZZU1t5AV1Q97HmyIZ6Pg/exec';

// Founding-rate billing — hard-coded by plan name (Apps Script doesn't return amounts).
const PLAN_PRICE_INR = {
  'Team-5': 11800,
  'Team-10': 23600,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

const inrFormat = (n) => `\u20B9${(n || 0).toLocaleString('en-IN')}`;

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const memberStatus = (lastSeenIso) => {
  if (!lastSeenIso) return { label: 'Not signed in yet', tone: 'muted' };
  const last = new Date(lastSeenIso);
  const days = Math.floor((Date.now() - last.getTime()) / 86_400_000);
  if (days <= 30) return { label: 'Active', tone: 'accent' };
  if (days < 365) return { label: `Last seen ${days}d ago`, tone: 'muted' };
  const years = Math.floor(days / 365);
  return { label: `Last seen ${years}y ago`, tone: 'muted' };
};

// Map Apps Script error strings → user-friendly copy.
const friendlyError = (raw) => {
  const m = (raw || '').toLowerCase();
  if (m.includes('invalid access link')) return null;            // handled by INVALID state
  if (m.includes('no longer active')) return null;               // handled by EXPIRED state
  if (m.includes('only emails from')) return raw;                // already friendly
  if (m.includes('seats are filled')) return raw;                // already friendly
  if (m.includes('already a team member')) return raw;           // already friendly
  if (m.includes('missing access token')) return 'Your dashboard link is incomplete. Please use the link in your welcome email.';
  return 'Something went wrong. Please try again.';
};

// ─── Empty-state / error block ───────────────────────────────────────────────
const Notice = ({ title, body }) => (
  <section className="max-w-[480px] mx-auto px-6 pt-20 pb-32 text-center">
    <Overline className="block mb-8">— The State of Play —</Overline>
    <h1 className="font-editorial font-semibold text-[1.75rem] leading-snug mb-5 text-[var(--text)]">
      {title}
    </h1>
    <p className="font-plex text-[16px] leading-[1.6] text-[var(--text-muted)] max-w-[42ch] mx-auto mb-8 whitespace-pre-line">
      {body}
    </p>
    <a
      href="https://www.stateofplay.club"
      className="font-plex text-[14px] text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
    >
      ← Back to The State of Play
    </a>
  </section>
);

// ─── Loading bar (indeterminate, burgundy) ───────────────────────────────────
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
export const TeamsManage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(() => !!token);
  const [fatal, setFatal] = useState(() => (token ? null : 'invalid'));
  const [account, setAccount] = useState(null);
  const [members, setMembers] = useState([]);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // ─── Load account + members ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) return undefined;
    let active = true;

    (async () => {
      try {
        const res = await fetch(`${APPS_SCRIPT_URL}?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!active) return;
        if (!data.success) {
          const err = (data.error || '').toLowerCase();
          setFatal(err.includes('no longer active') ? 'expired' : 'invalid');
          return;
        }
        setAccount(data.data.account);
        setMembers(data.data.members || []);
        setFatal(null);
      } catch (e) {
        console.error('teams/manage load failed:', e);
        if (active) setFatal('network');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, refreshNonce]);

  const refresh = () => setRefreshNonce((n) => n + 1);

  // ─── State branches ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <MockupLayout testId="page-teams-manage-loading" hideFooterHeroCta>
        <LoadingBar />
        <div className="max-w-[480px] mx-auto px-6 py-32 text-center">
          <p className="font-plex text-[14px] text-[var(--text-muted)]">Loading your account…</p>
        </div>
      </MockupLayout>
    );
  }

  if (fatal === 'invalid') {
    return (
      <MockupLayout testId="page-teams-manage-invalid" hideFooterHeroCta>
        <Notice
          title="This link isn’t valid."
          body={
            "If you’ve recently subscribed, check your email for a message from venkat@stateofplay.club with your team dashboard link.\n\n" +
            'If you need help, write to prerna@stateofplay.club'
          }
        />
      </MockupLayout>
    );
  }

  if (fatal === 'expired') {
    return (
      <MockupLayout testId="page-teams-manage-expired" hideFooterHeroCta>
        <Notice
          title="Your team subscription has expired."
          body="To renew your plan, write to prerna@stateofplay.club"
        />
      </MockupLayout>
    );
  }

  if (fatal === 'network' || !account) {
    return (
      <MockupLayout testId="page-teams-manage-network" hideFooterHeroCta>
        <Notice
          title="Couldn’t load your dashboard."
          body="Refresh the page, or write to prerna@stateofplay.club if it keeps failing."
        />
      </MockupLayout>
    );
  }

  return (
    <DashboardView
      token={token}
      account={account}
      members={members}
      onChange={refresh}
    />
  );
};

// =============================================================================
//   ACTIVE DASHBOARD
// =============================================================================
const DashboardView = ({ token, account, members, onChange }) => {
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [removeError, setRemoveError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const seatsUsed = members.length;
  const seatsTotal = account.seats;
  const seatsFull = seatsUsed >= seatsTotal;
  const fillPct = useMemo(
    () => (seatsTotal > 0 ? Math.min(100, (seatsUsed / seatsTotal) * 100) : 0),
    [seatsUsed, seatsTotal]
  );
  const fillColor = seatsFull ? 'var(--text)' : 'var(--accent-burgundy)';
  // company_domain may be a single domain ("acme.in") OR a comma/whitespace
  // separated list ("sportzinteractive.net, marathon-edge.com") for bespoke
  // clients that span multiple corporate domains.
  const memberDomains = useMemo(() => (
    String(account.company_domain || '')
      .toLowerCase()
      .split(/[,\s;]+/)
      .map((d) => d.trim())
      .filter(Boolean)
  ), [account.company_domain]);
  const primaryDomain = memberDomains[0] || '';
  const domainHint = memberDomains.length > 1
    ? memberDomains.slice(0, -1).join(', ') + ' or ' + memberDomains.slice(-1)
    : (memberDomains[0] || 'your company');
  const planPrice = PLAN_PRICE_INR[account.plan_name] || 0;

  // ─── Add member ───────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
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
    if (memberDomains.length > 0) {
      const emailDomain = email.split('@')[1] || '';
      if (!memberDomains.includes(emailDomain)) {
        setEmailError(`Only ${domainHint} email addresses can be added to this account.`);
        return;
      }
    }
    if (seatsFull) {
      setEmailError(`All ${seatsTotal} seats are filled. Remove a member to add someone new.`);
      return;
    }

    setSubmitting(true);
    try {
      // Apps Script is a Google web app — POST with text/plain to avoid the
      // CORS preflight that application/json triggers (Google strips custom
      // headers from the OPTIONS pre-flight).
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'add_member', token, email }),
      });
      const data = await res.json();
      if (!data.success) {
        setEmailError(friendlyError(data.error) || 'Something went wrong. Please try again.');
        return;
      }
      setNewEmail('');
      setSuccessMessage(`Invitation sent to ${email}`);
      setTimeout(() => setSuccessMessage(''), 4000);
      await onChange();
    } catch (err) {
      console.error('add_member failed:', err);
      setEmailError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Remove member ────────────────────────────────────────────────────────
  const confirmRemove = async (member_id) => {
    setRemoveError('');
    setRemoving(true);
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'remove_member', token, member_id }),
      });
      const data = await res.json();
      if (!data.success) {
        setRemoveError(friendlyError(data.error) || 'Something went wrong. Please try again.');
        return;
      }
      setPendingRemove(null);
      await onChange();
    } catch (err) {
      console.error('remove_member failed:', err);
      setRemoveError('Something went wrong. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <MockupLayout testId="page-teams-manage" hideFooterHeroCta seo={{ title: 'Team Dashboard', path: '/teams/manage', noindex: true }}>
      <div className="max-w-[860px] mx-auto px-6 lg:px-0 pt-10 lg:pt-12">
        {/* SECTION A — Dateline + headline */}
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

        {/* SECTION B — Stats bar */}
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
                className={`py-6 px-6 ${i > 0 ? 'md:border-l border-[var(--rule)]' : ''}`}
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

        {/* SECTION C — Seat meter */}
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
              style={{ width: `${fillPct}%`, backgroundColor: fillColor, borderRadius: 0 }}
            />
          </div>
        </section>

        {/* SECTION D — Add member (or seats-full message) */}
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
                  placeholder={primaryDomain ? `colleague@${primaryDomain}` : 'colleague@yourcompany.com'}
                  disabled={submitting}
                  data-testid="teams-add-email"
                  className="flex-1 h-12 px-4 bg-transparent border border-[var(--rule)] font-plex text-[15px] focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60"
                  style={{ borderRadius: 0 }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="teams-add-submit"
                  className="h-12 px-6 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] transition-colors disabled:opacity-70"
                  style={{ borderRadius: 0 }}
                >
                  {submitting ? 'Adding…' : 'Add →'}
                </button>
              </form>
              <p className="font-plex text-[13px] text-[#999999] mt-3">
                Once added, your colleague can sign in at stateofplay.club using their work email.
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

        {/* SECTION E — Members list */}
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
                            onClick={() => { setRemoveError(''); setPendingRemove(m.member_id); }}
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
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          <button
                            type="button"
                            onClick={() => confirmRemove(m.member_id)}
                            disabled={removing}
                            data-testid={`teams-remove-confirm-${m.member_id}`}
                            className="h-9 px-4 bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex text-[13px] transition-colors disabled:opacity-70"
                            style={{ borderRadius: 0 }}
                          >
                            {removing ? 'Removing…' : 'Confirm removal'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPendingRemove(null); setRemoveError(''); }}
                            disabled={removing}
                            className="font-plex text-[13px] text-[var(--text-muted)] hover:underline underline-offset-[4px] decoration-1"
                          >
                            Cancel
                          </button>
                          {removeError && (
                            <span className="font-plex text-[13px] text-[var(--accent-burgundy)] sm:ml-3" data-testid="teams-remove-error">
                              {removeError}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* SECTION F — Billing */}
        <section className="pb-12 border-t border-[var(--rule)] pt-8">
          <Overline className="block mb-6">Billing</Overline>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            <div>
              <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">Plan</Overline>
              <p className="font-plex text-[14px] text-[var(--text)] tabular-nums">
                {account.plan_name} · {inrFormat(planPrice)} / year
              </p>
            </div>
            <div>
              <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">Next renewal</Overline>
              <p className="font-plex text-[14px] text-[var(--text)] tabular-nums">
                {inrFormat(planPrice)} · {shortDate(account.renewal_date)}
              </p>
            </div>
            <div className="md:text-right">
              <Overline className="!normal-case !tracking-normal !text-xs block mb-1.5">Invoice</Overline>
              <button
                type="button"
                onClick={() => setInvoiceOpen(true)}
                className="font-plex text-[14px] text-[var(--accent-burgundy)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
                data-testid="teams-invoice-link"
              >
                Download invoice →
              </button>
            </div>
          </div>
          <p className="font-plex text-[12px] text-[#999999] mt-6 max-w-[55ch]">
            Founding-partner rate locked. Team-5 plan ₹11,800 / year · Team-10 plan ₹23,600 / year (inclusive of 18% GST).
          </p>
        </section>

        {/* SECTION G — Footer contact */}
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

      <TeamInvoiceRequestModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        token={token}
        companyName={account.company_name}
        planName={account.plan_name}
      />
    </MockupLayout>
  );
};

export default TeamsManage;
