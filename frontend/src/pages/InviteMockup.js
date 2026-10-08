import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';

const API = process.env.REACT_APP_BACKEND_URL;

const deadline = (iso) =>
  new Date(iso).toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    .replace(' AM', ' am').replace(' PM', ' pm');

const linkClass = 'text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors';

const CLOSED_LINE = {
  expired: 'This invitation has closed.',
  full: 'This invitation has already been used.',
  closed: 'This invitation has closed.',
  unknown: 'This invitation has closed.',
};

/* A private invite link (backend invite_links.py): a first year at the
   old price for whoever holds the link, or for one named address. Not
   linked from anywhere on the site and kept out of search. The server
   decides the price; this page only shows it. */
export const InviteMockup = () => {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const pricing = useGeoPricing();
  const isIndia = pricing.country === 'IN';
  const [invite, setInvite] = useState(null);
  const [paidEmail, setPaidEmail] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/invites/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : { state: r.status === 429 ? 'busy' : 'unknown' }))
      .then((data) => { if (active) setInvite(data); })
      .catch(() => { if (active) setInvite({ state: 'error' }); });
    return () => { active = false; };
  }, [code]);

  // A one-person link is bought under its own address, whoever is signed in.
  const lockedEmail = invite?.email || user?.email || undefined;

  const body = () => {
    if (!invite) return <p className="font-plex text-sm text-[var(--text-muted)]">Opening your invitation…</p>;
    if (paidEmail) {
      return (
        <div data-testid="invite-done" className="max-w-[480px] border border-[var(--rule)] p-6">
          <p className="font-editorial font-medium text-lg mb-2">You're in.</p>
          <p className="font-plex text-[15px] text-[var(--text-muted)] leading-relaxed">
            A welcome note is on its way to {paidEmail}. Sign in with that email to start reading.
          </p>
          <a href="/login" className="inline-block mt-4 font-plex text-sm text-[var(--accent-burgundy)] underline underline-offset-4">Sign in</a>
        </div>
      );
    }
    if (invite.state === 'busy' || invite.state === 'error') {
      return <p className="font-plex text-base text-[var(--text-muted)]">The invitation didn't load. Please refresh the page in a minute.</p>;
    }
    if (invite.state !== 'open') {
      return (
        <div data-testid="invite-closed" className="space-y-2">
          <p className="font-plex text-lg text-[var(--text)]">{CLOSED_LINE[invite.state] || CLOSED_LINE.unknown}</p>
          <p className="font-plex text-base text-[var(--text-muted)]">
            The membership page has the regular price.{' '}
            <Link to="/signup?ref=invite-closed" className={linkClass}>See membership</Link>
          </p>
        </div>
      );
    }
    return (
      <div data-testid="invite-open">
        <div className="flex items-end gap-3 mb-2">
          <span className="font-editorial font-semibold text-[2.75rem] leading-[0.9] text-[var(--text)]">{isIndia ? '₹2,499' : '$120'}</span>
          <span className="font-plex text-base text-[var(--text-muted)] pb-1">{isIndia ? '+ 18% GST' : 'for the year'}</span>
        </div>
        <p className={`font-plex text-[13px] text-[var(--text-label)] ${invite.personal && invite.expires_at ? 'mb-2' : 'mb-6'}`}>
          {isIndia ? '₹2,949 total. New readers pay ₹3,499 + GST.' : 'New readers pay $169.'}
        </p>
        {invite.personal && invite.expires_at && (
          <p data-testid="invite-deadline" className="font-plex text-[14px] text-[var(--text)] mb-6">
            Your invitation is open until {deadline(invite.expires_at)}.
          </p>
        )}
        <RazorpayCheckoutButton
          plan="standard"
          source="invite"
          country={isIndia ? 'IN' : 'INTL'}
          buttonLabel="Accept the invitation"
          dataTestId="invite-checkout"
          className="max-w-[520px] mb-4"
          lockedEmail={lockedEmail}
          extraOrderFields={{ invite: code }}
          disclosureText={`One payment for the year. Nothing renews on its own. A year from now, you can renew at ${isIndia ? '₹2,999 + GST' : '$149'}.`}
          onSuccess={(email) => setPaidEmail(email || lockedEmail || '')}
        />
      </div>
    );
  };

  return (
    <MockupLayout
      testId="page-invite"
      hideFooterHeroCta
      seo={{ title: 'An invitation', path: `/invite/${code}`, description: 'An invitation to The State of Play.', noindex: true }}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">An invitation</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)]">From Venkat Ananth</span>
        </div>
      </div>
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-16 pb-20">
        <h1 className="font-editorial font-semibold tracking-tight text-[2.2rem] md:text-[3.25rem] leading-[1.05] mb-6 max-w-[18ch]">
          A year of The State of Play, <em className="italic font-normal">at the price our first readers paid.</em>
        </h1>
        <p className="font-plex text-lg text-[var(--text-muted)] leading-relaxed max-w-[54ch] mb-10">
          I've invited you to read The State of Play: one reported story a week on the business of Indian sport, and the full archive from the first day.
        </p>
        {body()}
      </section>
    </MockupLayout>
  );
};

export default InviteMockup;
