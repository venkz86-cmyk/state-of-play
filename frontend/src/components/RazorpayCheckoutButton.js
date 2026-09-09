import { useState } from 'react';

/* RazorpayCheckoutButton -- the dynamic Orders API checkout
   (razorpay_orders.py's create-order / verify-payment), opened via
   Razorpay's Checkout.js modal. Distinct from RazorpayButton.js, which
   embeds Razorpay's own static Payment Button widget for a single fixed
   price/geo pair -- this one asks the backend to price an order for
   whatever {plan, country} it's given, so a single component covers any
   plan PLAN_PRICING knows about, not just the two dashboard-configured
   buttons.

   Collects only an email up front (Checkout's own modal handles payment
   details) -- prefilled into Razorpay's own form, then reused unchanged
   in the verify-payment call afterward, since Checkout's success
   callback returns the payment/order ids and signature, not the payer's
   email. */

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

export const RazorpayCheckoutButton = ({
  plan,
  country = 'IN',
  buttonLabel = 'Pay now',
  dataTestId = 'razorpay-checkout',
  onSuccess,
  className = '',
  // Set when the visitor already has a session: skips the editable email
  // input entirely and uses this instead, everywhere an email is needed.
  // The backend now derives identity from the session anyway (never
  // trusts a client-supplied email once a session exists), so offering
  // an editable box here would just be an out-of-sync field the backend
  // silently overrides -- its own confusing surprise.
  lockedEmail,
  // Suppresses this component's own email UI entirely (neither the
  // editable input nor the locked "Using your account" line) --
  // for a caller like GiftMockup.js that already collects the
  // buyer's email itself, live, as the visitor types (so lockedEmail
  // is '' before they've typed anything -- a plain truthy check on
  // lockedEmail would render the editable input in that gap, giving
  // two email fields on screen at once). trimmedEmail below still
  // comes from lockedEmail either way; this only controls what's
  // rendered.
  hideEmailField = false,
  // Optional one-line disclosure rendered directly under the button --
  // e.g. making explicit that a plan is a one-time trial, not a
  // subscription, right at the point of payment itself, not just
  // somewhere else on the page.
  disclosureText,
  // Extra fields merged into the verify-payment request body -- e.g.
  // Team-5/10's company_name, which razorpay_orders.py's verify_payment
  // needs to auto-create the corporate account. Generic on purpose, so
  // this stays a passthrough rather than hardcoding one plan's concerns
  // into a shared component every checkout on the site uses.
  extraVerifyFields,
  // Overrides where the post-payment verify call goes -- e.g.
  // gift_subscriptions.py's own verify-payment, which needs the same
  // Checkout.js wiring this component already has but a different
  // Ghost-labeling target (the recipient, not the payer). create-order
  // stays the shared endpoint either way -- pricing a 'standard' plan
  // is identical regardless of who ends up with the access.
  verifyEndpoint = '/api/razorpay/verify-payment',
}) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading
  const [error, setError] = useState('');

  const startCheckout = async () => {
    const trimmedEmail = (hideEmailField || lockedEmail) ? (lockedEmail || '').trim().toLowerCase() : email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setStatus('loading');

    try {
      await loadCheckoutScript();

      const orderRes = await fetch(`${API}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, country }),
      });
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not start checkout. Please try again.');
      }
      const order = await orderRes.json();

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'The State of Play',
        description: order.label,
        order_id: order.order_id,
        prefill: { email: trimmedEmail },
        theme: { color: '#2B5DAC' },
        modal: {
          ondismiss: () => setStatus('idle'),
        },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API}${verifyEndpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                email: trimmedEmail,
                plan,
                ...extraVerifyFields,
              }),
            });
            if (!verifyRes.ok) {
              throw new Error('Payment went through, but activation failed. Email venkat@stateofplay.club with your payment ID and we’ll sort it out.');
            }
            // Most callers only need to know it worked (trimmedEmail is
            // enough); gift_subscriptions.py's verify-payment returns
            // extra fields (delivery type, redeem_url) a caller like
            // GiftMockup.js needs to render its own result -- passed as
            // a second, optional argument so every existing single-arg
            // onSuccess(email) caller keeps working unchanged.
            const verifyBody = await verifyRes.json().catch(() => ({}));
            setStatus('idle');
            onSuccess?.(trimmedEmail, verifyBody);
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
      {!hideEmailField && (
        <div className="mb-5">
          <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Email</p>
          {lockedEmail ? (
            <p className="font-plex text-lg text-[var(--text-muted)] border-b border-[var(--rule)] py-3">
              Using your account: <span className="text-[var(--text)]">{lockedEmail}</span>
            </p>
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              placeholder="you@yourdomain.com"
              disabled={status === 'loading'}
              data-testid={`${dataTestId}-email`}
              className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
            />
          )}
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

export default RazorpayCheckoutButton;
