import { useState } from 'react';

/* SubscriptionCheckoutButton -- the real recurring-Annual checkout
   razorpay_subscriptions.py has had a backend for since before this
   session, never wired to any UI. Distinct from RazorpayCheckoutButton
   (one-time Orders, used by a brand-new signup, Trial, Student and
   trial-upgrade): this opens Razorpay Checkout in SUBSCRIPTION mode,
   which auto-charges on its own recurring schedule rather than once.

   Deliberately ONE simple case: an existing subscriber renewing right
   now. One Checkout modal, one payment, and that payment is both the
   renewal charge and the mandate that sets up real auto-renewal from
   this point forward. A brand-new signup never touches this component
   at all -- they use RazorpayCheckoutButton's plain one-time Orders
   flow instead, and only meet this button once, a year later, when
   they're renewing. See razorpay_subscriptions.py's own module
   docstring for why an earlier, two-step version of this (pre-
   authorising a new signup today for a *different* price a year out)
   was cut.

   Only country='IN' has a real Razorpay Plan created as of this build
   (SUBSCRIPTION_PLANS in razorpay_subscriptions.py -- INTL is still an
   empty plan_id placeholder). create-subscription 503s cleanly for
   INTL; this component surfaces that as its normal error state rather
   than crashing. */

const API = process.env.REACT_APP_BACKEND_URL;
const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let checkoutScriptPromise = null;
const loadCheckoutScript = () => {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScriptPromise) {
    checkoutScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHECKOUT_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the payment form. Check your connection and try again.'));
      document.body.appendChild(script);
    });
  }
  return checkoutScriptPromise;
};

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

export const SubscriptionCheckoutButton = ({
  country = 'IN',
  buttonLabel = 'Renew now',
  dataTestId = 'subscription-checkout',
  onSuccess,
  className = '',
  lockedEmail,
  disclosureText,
}) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading
  const [error, setError] = useState('');

  const startCheckout = async () => {
    const trimmedEmail = lockedEmail ? lockedEmail.trim().toLowerCase() : email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setStatus('loading');

    try {
      await loadCheckoutScript();

      const subRes = await fetch(`${API}/api/razorpay/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country }),
      });
      if (!subRes.ok) {
        const body = await subRes.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not set up the subscription. Please try again.');
      }
      const sub = await subRes.json();

      const rzp = new window.Razorpay({
        key: sub.key_id,
        subscription_id: sub.subscription_id,
        name: 'The State of Play',
        description: sub.label,
        prefill: { email: trimmedEmail },
        theme: { color: '#2B5DAC' },
        modal: {
          ondismiss: () => setStatus('idle'),
        },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API}/api/razorpay/verify-subscription`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                email: trimmedEmail,
              }),
            });
            if (!verifyRes.ok) {
              throw new Error('Payment went through, but activation failed. Email venkat@stateofplay.club with your payment ID and we’ll sort it out.');
            }
            setStatus('idle');
            onSuccess?.(trimmedEmail);
          } catch (e) {
            setError(e.message);
            setStatus('idle');
          }
        },
      });
      rzp.on('payment.failed', () => {
        setError('Payment failed. Nothing was charged.');
        setStatus('idle');
      });
      rzp.open();
      setStatus('idle');
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <div className={className} data-testid={dataTestId}>
      {!lockedEmail ? (
        <div className="mb-5">
          <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Email</p>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            placeholder="you@yourdomain.com"
            disabled={status === 'loading'}
            data-testid={`${dataTestId}-email`}
            className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
          />
        </div>
      ) : (
        <div className="mb-5">
          <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Email</p>
          <p className="font-plex text-lg text-[var(--text-muted)] border-b border-[var(--rule)] py-3">
            Using your account: <span className="text-[var(--text)]">{lockedEmail}</span>
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={startCheckout}
        disabled={status === 'loading'}
        data-testid={`${dataTestId}-submit`}
        className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200 disabled:opacity-60"
        style={{ borderRadius: 'var(--control-radius)' }}
      >
        {status === 'loading' ? 'Opening…' : buttonLabel}
      </button>
      {disclosureText && (
        <p className="font-plex text-[13px] text-[var(--text-muted)] mt-3 max-w-[50ch]">
          {disclosureText}
        </p>
      )}
      {error && (
        <p className="font-plex text-sm text-[var(--accent-burgundy)] mt-3 max-w-[50ch]" data-testid={`${dataTestId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
};

export default SubscriptionCheckoutButton;
