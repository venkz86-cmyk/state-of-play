import { useSearchParams } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';

/* =============================================================================
   /mockup/teams-emails — Visual preview of the two transactional emails
   that go out for corporate team accounts.

     1. Admin onboarding email — sent right after a Team-5 / Team-10 payment.
     2. Team-member invitation — sent when the admin adds a colleague.

   Tabs via ?email=admin|member
   ============================================================================= */

const ADMIN_EMAIL = {
  from: 'Venkat Ananth <venkat@stateofplay.club>',
  to: 'rohini@acmesports.in',
  subject: 'Your State of Play team subscription — Acme Sports',
  preheader:
    'Welcome aboard. Your dashboard link is inside — and a quick word on how the seats work.',
};

const MEMBER_EMAIL = {
  from: 'Venkat Ananth <venkat@stateofplay.club>',
  to: 'arjun@acmesports.in',
  subject: 'Acme Sports has added you to The State of Play',
  preheader:
    'A one-time sign-in link inside. Single use, 24-hour expiry, no password needed.',
};

const EmailFrame = ({ children, meta }) => (
  <div className="bg-white border border-[var(--rule)]" style={{ borderRadius: 0 }}>
    {/* Mail-client header strip */}
    <div className="border-b border-[var(--rule)] px-6 py-4 text-[12px] font-plex text-[var(--text-muted)] space-y-1">
      <div className="flex flex-wrap gap-x-3">
        <span className="uppercase tracking-[0.06em] text-[#999999]">From</span>
        <span className="text-[var(--text)]">{meta.from}</span>
      </div>
      <div className="flex flex-wrap gap-x-3">
        <span className="uppercase tracking-[0.06em] text-[#999999]">To</span>
        <span className="text-[var(--text)]">{meta.to}</span>
      </div>
      <div className="flex flex-wrap gap-x-3">
        <span className="uppercase tracking-[0.06em] text-[#999999]">Subject</span>
        <span className="text-[var(--text)] font-medium">{meta.subject}</span>
      </div>
      <p className="pt-1 italic text-[#999999]">{meta.preheader}</p>
    </div>

    {/* Email body */}
    <div className="px-8 lg:px-12 py-10 lg:py-14 max-w-[640px] mx-auto text-[var(--text)]">
      {children}
    </div>

    {/* Email footer (signature block + colophon) */}
    <div className="border-t border-[var(--rule)] px-8 lg:px-12 py-8 max-w-[640px] mx-auto text-[12px] font-plex text-[var(--text-muted)] leading-[1.7]">
      <p>
        The State of Play · Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001
      </p>
      <p className="mt-2">
        You’re receiving this because your organisation subscribed to The State of Play. For
        anything you need on this account, write to{' '}
        <a href="mailto:prerna@stateofplay.club" className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1">
          prerna@stateofplay.club
        </a>.
      </p>
    </div>
  </div>
);

const Body = ({ children }) => (
  <div className="font-reading text-[16px] leading-[1.7] text-[var(--text)] space-y-5">
    {children}
  </div>
);

// ─── Admin onboarding ────────────────────────────────────────────────────────
const AdminEmail = () => (
  <EmailFrame meta={ADMIN_EMAIL}>
    <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[#999999] mb-3">
      — The State of Play —
    </p>
    <h1 className="font-editorial font-semibold text-[2rem] leading-[1.15] mb-6">
      Welcome, <em className="italic font-normal">Acme Sports.</em>
    </h1>

    <Body>
      <p>Rohini —</p>

      <p>
        Your <strong className="font-semibold">Team-5 subscription</strong> to The State of Play
        is set up. Thank you. The plan runs from <strong className="font-semibold">14 April 2026
        to 14 April 2027</strong>.
      </p>

      <p>
        Your team dashboard lives at the link below. Bookmark it — it’s how you’ll add or remove
        colleagues, see who has access, and pull invoices when you need them.
      </p>

      {/* CTA */}
      <p className="!my-8">
        <a
          href="https://www.stateofplay.club/teams/manage?token=ACC129-d4e6f8a9-b2c1-mock"
          style={{ borderRadius: 0 }}
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] h-12 px-8 no-underline transition-colors"
        >
          Open your dashboard →
        </a>
      </p>

      <p className="font-plex text-[13px] text-[var(--text-muted)] !mt-3">
        Or paste this into your browser:<br />
        <span className="text-[var(--accent-burgundy)] break-all">
          https://www.stateofplay.club/teams/manage?token=ACC129-d4e6f8a9-b2c1-mock
        </span>
      </p>

      <p className="pt-3"><strong className="font-semibold">A few notes:</strong></p>

      <ul className="list-disc pl-5 space-y-2 font-reading">
        <li>You have <strong className="font-semibold">5 seats</strong>. Add colleagues from the dashboard — they’ll get a private sign-in link by email, no password required.</li>
        <li>Only <strong className="font-semibold">@acmesports.in</strong> email addresses can be added. If you need a different domain, write to Prerna.</li>
        <li>The link in this email is unique to your account. Don’t forward it — share the dashboard with colleagues by adding them to the seats instead.</li>
        <li>For a GST tax invoice, write to <a href="mailto:prerna@stateofplay.club" className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1">prerna@stateofplay.club</a>.</li>
      </ul>

      <p className="pt-3">
        We publish on the business of Indian sport — money, media, ownership, and power. What
        you’ll get next is the weekly briefing, every long-read as it lands, and the occasional
        note from the desk that doesn’t go anywhere else.
      </p>

      <p>Glad to have your team along.</p>

      <p className="pt-2">
        Venkat<br />
        <span className="font-plex text-[13px] text-[var(--text-muted)]">
          Editor, The State of Play
        </span>
      </p>
    </Body>
  </EmailFrame>
);

// ─── Member invitation ───────────────────────────────────────────────────────
const MemberEmail = () => (
  <EmailFrame meta={MEMBER_EMAIL}>
    <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[#999999] mb-3">
      — The State of Play —
    </p>
    <h1 className="font-editorial font-semibold text-[2rem] leading-[1.15] mb-6">
      You’re in, <em className="italic font-normal">Arjun.</em>
    </h1>

    <Body>
      <p>
        <strong className="font-semibold">rohini@acmesports.in at Acme Sports</strong> has added
        you to your team’s State of Play subscription.
      </p>

      <p>
        Sign in with the one-time link below. It works once, expires in 24 hours, and signs you
        in across every device you open it on.
      </p>

      <p className="!my-8">
        <a
          href="https://www.stateofplay.club/members/auth?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW1iZXItc2lnbmluLXVybCJ9.MOCK_TOKEN"
          style={{ borderRadius: 0 }}
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] h-12 px-8 no-underline transition-colors"
        >
          Sign in to read →
        </a>
      </p>

      <p className="font-plex text-[13px] text-[var(--text-muted)] !mt-3">
        Or paste this into your browser:<br />
        <span className="text-[var(--accent-burgundy)] break-all">
          https://www.stateofplay.club/members/auth?token=eyJhbGc…
        </span>
      </p>

      <p className="pt-2">
        Once you’re in, you’ll have full access to everything we publish — the long-reads, the
        weekly <a href="https://www.stateofplay.club/left-field" className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1">Left Field</a> briefing,
        and the subscriber-only notes from the desk.
      </p>

      <p className="text-[var(--text-muted)]">
        If you weren’t expecting this, or you’re not the right person at Acme Sports, write to{' '}
        <a href="mailto:prerna@stateofplay.club" className="text-[var(--accent-burgundy)] underline underline-offset-[5px] decoration-1">
          prerna@stateofplay.club
        </a>{' '}
        and we’ll sort it out.
      </p>

      <p>Welcome aboard.</p>

      <p className="pt-2">
        Venkat<br />
        <span className="font-plex text-[13px] text-[var(--text-muted)]">
          Editor, The State of Play
        </span>
      </p>
    </Body>
  </EmailFrame>
);

// ─── Page ────────────────────────────────────────────────────────────────────
export const TeamsEmailsMockup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = (searchParams.get('email') || 'admin').toLowerCase();

  return (
    <MockupLayout testId="mockup-teams-emails" hideFooterHeroCta>
      <div className="max-w-[860px] mx-auto px-6 lg:px-0 pt-10 lg:pt-12 pb-24">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3 gap-4 flex-wrap">
          <Overline className="!normal-case !tracking-normal !text-sm">Teams · transactional emails</Overline>
          <span className="font-plex text-[13px] text-[var(--text-muted)]">
            Sent from venkat@stateofplay.club
          </span>
        </div>

        <section className="pt-12 lg:pt-14 pb-8">
          <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.25rem] lg:text-[2.5rem] leading-[1.1] mb-4">
            What people receive.
          </h1>
          <p className="font-plex text-[15px] lg:text-base text-[var(--text-muted)] max-w-[55ch]">
            Two emails go out for any team subscription — one to the admin who paid, one to each
            colleague they later add through the dashboard.
          </p>
        </section>

        {/* Tabs */}
        <div className="border-y border-[var(--rule)] flex">
          {[
            ['admin', 'Admin onboarding'],
            ['member', 'Member invitation'],
          ].map(([key, label]) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSearchParams({ email: key })}
                data-testid={`tab-${key}`}
                className="flex-1 py-4 px-6 text-left font-plex text-[13px] uppercase tracking-[0.06em] transition-colors"
                style={{
                  color: isActive ? 'var(--accent-burgundy)' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid var(--accent-burgundy)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-12">{active === 'member' ? <MemberEmail /> : <AdminEmail />}</div>

        <p className="font-plex text-[12px] text-[#999999] mt-10 text-center max-w-[55ch] mx-auto">
          These are templates for Zapier (or wherever you trigger the send). The dashboard token
          shown here is mock — Apps Script generates a real UUID per account.
        </p>
      </div>
    </MockupLayout>
  );
};

export default TeamsEmailsMockup;
