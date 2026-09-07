import { useState } from 'react';

/* SubscriptionCheckoutButton -- the real recurring-Annual checkout
   razorpay_subscriptions.py has had a backend for since before this
   session, never wired to any UI. Distinct from RazorpayCheckoutButton
   (one-time Orders, used by Trial/Student/trial-upgrade): this opens
   Razorpay Checkout in SUBSCRIPTION mode, which auto-charges on its own
   recurring schedule rather than charging once.

   Two shapes, driven by whether `bridgeOrderPlan` is passed:

   - No bridgeOrderPlan (Y/Z: an existing subscriber renewing right now,
     or a brand-new post-rate-change signup): ONE Checkout modal, in
     subscription mode, `deferred: false` -- the checkout payment IS the
     subscription's first charge, and it recurs from there.

   - bridgeOrderPlan given (X: signing up before the rate changes): TWO
     Checkout modals in sequence. First, a normal one-time Order (the
     existing razorpay_orders.py flow, same as RazorpayCheckoutButton)
     for today's bridge price. Once that's verified, a second Checkout
     opens in subscription mode with `deferred: true` -- the mandate is
     authorised today, but start_at is ~1 year out
     (razorpay_subscriptions.py's create_subscription already sets this
     server-side), so the subscription's own first auto-charge only
     happens at the real renewal, at the grandfathered rate. Nothing is
     double-charged: the bridge Order is the only payment taken today.

   Only tier='existing'/country='IN' has a real Razorpay Plan wired up
   as of this build (SUBSCRIPTION_PLANS in razorpay_subscriptions.py --
   the other three are empty plan_id placeholders pending Venkat
   creating them in the Razorpay dashboard). create-subscription 503s
   cleanly for those; this component surfaces that as its normal error
   state rather than crashing. */

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

// Opens one Razorpay Checkout instance and resolves/rejects based on its
// outcome -- shared shape for both the bridge Order and the Subscription
// steps below, which otherwise duplicate the same open/handler/failed
// wiring RazorpayCheckoutButton already has for the Order-only case.
const openCheckout = (options) => new Promise((resolve, reject) => {
  const rzp = new window.Razorpay({
    ...options,
    name: 'The State of Play',
    theme: { color: '#2B5DAC' },
    modal: { ondismiss: () => reject(new Error('dismissed')) },
    handler: (response) => resolve(response),
  });
  rzp.on('payment.failed', () => reject(new Error('Payment failed. Nothing was charged.')));
  rzp.open();
});

export const SubscriptionCheckoutButton = ({
  tier,                    // 'existing' | 'new'
  country = 'IN',
  bridgeOrderPlan,          // e.g. 'standard' -- set only for the X case
  buttonLabel = 'Subscribe',
  dataTestId = 'subscription-checkout',
  onSuccess,
  className = '',
  lockedEmail,
  disclosureText,
}) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | bridge | subscription
  const [error, setError] = useState('');

  const startCheckout = async () => {
    const trimmedEmail = lockedEmail ? lockedEmail.trim().toLowerCase() : email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');

    try {
      await loadCheckoutScript();

      if (bridgeOrderPlan) {
        setStatus('bridge');
        const orderRes = await fetch(`${API}/api/razorpay/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: bridgeOrderPlan, country }),
        });
        if (!orderRes.ok) {
          const body = await orderRes.json().catch(() => ({}));
          throw new Error(body.detail || 'Could not start checkout. Please try again.');
        }
        const order = await orderRes.json();
        const bridgeResponse = await openCheckout({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          description: order.label,
          order_id: order.order_id,
          prefill: { email: trimmedEmail },
        });
        const verifyRes = await fetch(`${API}/api/razorpay/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: bridgeResponse.razorpay_order_id,
            razorpay_payment_id: bridgeResponse.razorpay_payment_id,
            razorpay_signature: bridgeResponse.razorpay_signature,
            email: trimmedEmail,
            plan: bridgeOrderPlan,
          }),
        });
        if (!verifyRes.ok) {
          throw new Error('Payment went through, but activation failed. Email venkat@stateofplay.club with your payment ID and we’ll sort it out.');
        }
      }

      setStatus('subscription');
      const subRes = await fetch(`${API}/api/razorpay/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, country, deferred: !!bridgeOrderPlan }),
      });
      if (!subRes.ok) {
        const body = await subRes.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not set up the subscription. Please try again.');
      }
      const sub = await subRes.json();
      const subResponse = await openCheckout({
        key: sub.key_id,
        subscription_id: sub.subscription_id,
        description: sub.label,
        prefill: { email: trimmedEmail },
      });
      const verifySubRes = await fetch(`${API}/api/razorpay/verify-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_subscription_id: subResponse.razorpay_subscription_id,
          razorpay_payment_id: subResponse.razorpay_payment_id,
          razorpay_signature: subResponse.razorpay_signature,
          email: trimmedEmail,
        }),
      });
      if (!verifySubRes.ok) {
        throw new Error('Payment went through, but activation failed. Email venkat@stateofplay.club with your payment ID and we’ll sort it out.');
      }

      setStatus('idle');
      onSuccess?.(trimmedEmail);
    } catch (e) {
      // A dismissed modal isn't a real error -- just reset silently,
      // matching RazorpayCheckoutButton's own ondismiss behaviour.
      if (e.message !== 'dismissed') {
        setError(e.message || 'Something went wrong. Please try again.');
      }
      setStatus('idle');
    }
  };

  const loading = status !== 'idle';
  const loadingLabel = status === 'bridge' ? 'Opening…' : status === 'subscription' ? 'Almost there…' : buttonLabel;

  return (
    <div className={className} data-testid={dataTestId}>
      {!lockedEmail && (
        <div className="mb-5">
          <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Email</p>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            placeholder="you@yourdomain.com"
            disabled={loading}
            data-testid={`${dataTestId}-email`}
            className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
          />
        </div>
      )}
      {lockedEmail && (
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
        disabled={loading}
        data-testid={`${dataTestId}-submit`}
        className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200 disabled:opacity-60"
        style={{ borderRadius: 'var(--control-radius)' }}
      >
        {loadingLabel}
      </button>
      {bridgeOrderPlan && (
        <p className="font-plex text-[13px] text-[var(--text-muted)] mt-3 max-w-[50ch]">
          Two steps: today's payment, then a card authorisation for next year's renewal. Nothing else is charged now.
        </p>
      )}
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
