import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';
import { useAuth } from '../contexts/AuthContext';
import { authHeader } from '../lib/sessionToken';
import { renewalOffer } from '../lib/renewal';

const API = process.env.REACT_APP_BACKEND_URL;

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const P = ({ children }) => (
  <p className="font-plex text-base lg:text-lg leading-relaxed text-[var(--text-muted)]">{children}</p>
);

const linkClass = 'text-[var(--text)] underline underline-offset-4 hover:text-[var(--accent-burgundy)] transition-colors';

/* Venkat's letter to members at the end of their first year, laid out
   like /teams. annual_renewal.py's reminder and grace emails link here
   with ?t=<token>, which signs the member in (AuthContext's
   completeRenewalLink) and keeps them on this page. The renew button
   shows only to someone who can renew now (lib/renewal.js); anyone
   signed out is asked to sign in and comes back here. */
export const RenewMockup = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const { user, loading, completeRenewalLink } = useAuth();
  const navigate = useNavigate();
  const [linkStatus, setLinkStatus] = useState(token ? 'loading' : 'none');
  const [linkError, setLinkError] = useState('');
  const [details, setDetails] = useState(null);
  const [renewed, setRenewed] = useState(false);

  // Exchange the emailed token for a session.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await completeRenewalLink(token);
        if (cancelled) return;
        if (result.success) {
          setLinkStatus('done');
          // The complimentary-year letter links here with next=account:
          // the renewal offer is on their account page, not this letter.
          if (searchParams.get('next') === 'account') navigate('/account', { replace: true });
        } else {
          setLinkError(result.error);
          setLinkStatus('failed');
        }
      } catch (e) {
        if (!cancelled) {
          setLinkError(e.message || 'Could not reach the server. Please try again.');
          setLinkStatus('failed');
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // The member's dates and currency, from the same source /account uses.
  useEffect(() => {
    let active = true;
    if (!user?.email || !API) return;
    (async () => {
      try {
        const r = await axios.post(`${API}/api/ghost/member-details`, {}, { timeout: 8000, headers: authHeader() });
        if (active && r.data) setDetails(r.data);
      } catch (e) {
        console.error('Member details failed:', e);
      }
    })();
    return () => { active = false; };
  }, [user?.email]);

  const offer = renewalOffer(details, { anyTime: true });
  const waiting = loading || linkStatus === 'loading' || (user && !details);

  const renewBlock = () => {
    if (waiting) {
      return <p className="font-plex text-sm text-[var(--text-muted)]">Checking your membership…</p>;
    }
    if (renewed) {
      return (
        <p data-testid="renew-done" className="font-plex text-base text-[var(--text)] border-b border-[var(--rule)] py-3 max-w-[480px]">
          Thank you. You've renewed, and a confirmation is on its way to your inbox.
        </p>
      );
    }
    if (!user) {
      return (
        <div>
          {linkStatus === 'failed' && (
            <p data-testid="renew-error" className="font-plex text-sm text-[var(--accent-burgundy)] mb-4">{linkError}</p>
          )}
          <Link
            to="/login?next=/renew"
            data-testid="renew-signin"
            className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200"
            style={{ borderRadius: 'var(--control-radius)' }}
          >
            Sign in to renew
          </Link>
        </div>
      );
    }
    if (offer) {
      return (
        <RazorpayCheckoutButton
          plan="renewal"
          source="renew-page"
          country={offer.paidInUsd ? 'INTL' : 'IN'}
          buttonLabel="Renew for another year"
          dataTestId="renew-page"
          lockedEmail={user.email}
          disclosureText="₹2,999 + GST. Overseas readers: $149."
          onSuccess={() => setRenewed(true)}
        />
      );
    }
    if (details?.subscription_status === 'active') {
      return <p className="font-plex text-sm text-[var(--text-muted)]">Your membership renews automatically.</p>;
    }
    if (details?.subscription_end) {
      return (
        <p data-testid="renew-not-yet" className="font-plex text-sm text-[var(--text-muted)]">
          Your membership runs until {longDate(details.subscription_end)}.{' '}
          <Link to="/account" className={linkClass}>Go to your account</Link>
        </p>
      );
    }
    return (
      <p className="font-plex text-sm text-[var(--text-muted)]">
        <Link to="/account" className={linkClass}>Go to your account</Link>
      </p>
    );
  };

  return (
    <MockupLayout
      testId="page-renew"
      hideFooterHeroCta
      seo={{ title: 'Renew Your Membership', path: '/renew', description: 'A note from Venkat Ananth to members of The State of Play at the end of their first year.' }}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Renewal</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)]">For members</span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-16">
        <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[2.75rem] leading-[1.1] mb-8 max-w-[24ch]">
          Thank you for the first year. <em className="italic font-normal">I'd like to earn a second.</em>
        </h1>
        <div className="max-w-[65ch] space-y-5">
          <P>Dear reader,</P>
          <P>
            You paid for a promise before there was any work to judge. Independent reporting on the business of Indian sport, one deeply reported story at a time. You gave me the chance to find out what I could make of it.
          </P>
          <P>
            Now there is a year of work to look at. The money behind the RCB and Rajasthan Royals sale processes. The BCCI's title-rights economy. How Agilitas is building a sportswear business. What growth looks like for kabaddi and volleyball. Different stories, same questions underneath: who is paying for what, and what changes because of it.
          </P>
          <P>
            Your subscription paid for the time to keep asking them. To make another call, and to stay with a story when the first explanation did not hold up.
          </P>
          <P>
            It wasn't a perfect year. I set out to reach 500 paying members. I reached more than 375. There were Fridays with no story, because I was unwell or the reporting wasn't ready. I want more sources on the record and clearer writing. I also want more support around the publication, so that it does not all rest on one person's bandwidth. That is my work to do.
          </P>
          <P>If you decide it's worth another year, that will mean more to me than the renewal itself.</P>
          <P>
            Renewing costs ₹2,999 + GST for the year. That is ₹500 more than the introductory price you paid, and ₹500 less than what new readers now pay. I wanted the readers who backed this early to be recognised for it.
          </P>
          <P>
            You get the same things as before: the reported story every Friday, The Left Field on Mondays and Wednesdays, the full archive, and a direct line to me. Write back any time. I read everything.
          </P>
          <div data-testid="renew-cta" className="pt-3">{renewBlock()}</div>
          <P>Thank you for another year.</P>
        </div>
        <p className="font-editorial italic text-lg mt-10">Venkat</p>
      </section>
    </MockupLayout>
  );
};

export default RenewMockup;
