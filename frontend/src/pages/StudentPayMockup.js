import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';

const API = process.env.REACT_APP_BACKEND_URL;

// The link an approved Student applicant gets by email
// (student_applications.py's approve endpoint) -- a one-time token, not
// a raw Razorpay Payment Link, so this page can render the site's own
// checkout already locked to their email/country instead of bouncing
// them to a generic rzp.io page. Nothing here is a choice the visitor
// makes -- the plan, price and country were already decided when
// Venkat approved the application; this page just carries that
// decision through to a real payment.

const Notice = ({ title, body }) => (
  <div className="max-w-[480px] mx-auto px-6 py-32 text-center">
    <p className="font-editorial font-medium text-xl mb-3">{title}</p>
    <p className="font-plex text-[14px] text-[var(--text-muted)] leading-relaxed">{body}</p>
  </div>
);

export const StudentPayMockup = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(() => !!token);
  const [fatal, setFatal] = useState(() => (token ? null : 'invalid'));
  const [info, setInfo] = useState(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!token || !API) return undefined;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/students/pay-info/${encodeURIComponent(token)}`);
        if (!res.ok) {
          if (active) setFatal('invalid');
          return;
        }
        const data = await res.json();
        if (!active) return;
        setInfo(data);
        if (data.already_paid) setPaid(true);
      } catch (e) {
        console.error('students/pay load failed:', e);
        if (active) setFatal('network');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const onPaymentSuccess = async () => {
    setPaid(true);
    try {
      await fetch(`${API}/api/students/pay-info/${encodeURIComponent(token)}/mark-paid`, { method: 'POST' });
    } catch (e) {
      console.error('students/pay mark-paid failed (non-fatal):', e);
    }
  };

  if (loading) {
    return (
      <MockupLayout testId="page-students-pay-loading" hideFooterHeroCta>
        <Notice title="Loading…" body="One moment." />
      </MockupLayout>
    );
  }

  if (fatal || !info) {
    return (
      <MockupLayout testId="page-students-pay-invalid" hideFooterHeroCta>
        <Notice
          title="This link isn’t valid."
          body="If you were recently approved for the Student plan, check your email for the most recent message from Venkat. If you think this is a mistake, write to venkat@stateofplay.club."
        />
      </MockupLayout>
    );
  }

  return (
    <MockupLayout testId="page-students-pay" hideFooterHeroCta seo={{ title: 'Complete your Student membership', path: '/students/pay' }}>
      <div className="max-w-[480px] mx-auto px-6 py-20 lg:py-28">
        <Overline className="!normal-case !tracking-normal !text-sm mb-4">Student plan</Overline>
        <h1 className="font-editorial font-semibold tracking-tight text-[28px] leading-[1.1] mb-6">
          {paid ? (
            <>You’re in.</>
          ) : (
            <>{(info.name || '').split(' ')[0] || 'You'}, you’re <em className="italic font-normal">approved.</em></>
          )}
        </h1>

        {paid ? (
          <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed" data-testid="students-pay-success">
            Payment received. Every weekly story, the Left Field briefing, and the full archive are yours now — sign in with {info.email} whenever you're ready.
          </p>
        ) : (
          <>
            <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed mb-8">
              Your student ID checked out. Complete your membership below to start reading.
            </p>
            <RazorpayCheckoutButton
              plan="student"
              country={info.country}
              buttonLabel="Complete your membership"
              dataTestId="students-pay-checkout"
              lockedEmail={info.email}
              disclosureText="Annual membership at the student price. Renews at the same price each year for as long as you're studying."
              onSuccess={onPaymentSuccess}
            />
          </>
        )}
      </div>
    </MockupLayout>
  );
};

export default StudentPayMockup;
