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
}) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading
  const [error, setError] = useState('');

  const startCheckout = async () => {
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setStatus('loading');
    const trimmedEmail = email.trim().toLowerCase();

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
        theme: { color: '#A0291C' },
        modal: {
          ondismiss: () => setStatus('idle'),
        },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API}/api/razorpay/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                email: trimmedEmail,
                plan,
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
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          placeholder="you@email.com"
          disabled={status === 'loading'}
          data-testid={`${dataTestId}-email`}
          className="flex-1 h-12 px-4 bg-transparent border border-[var(--rule)] font-plex text-[15px] focus:outline-none focus:border-[var(--accent-burgundy)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={startCheckout}
          disabled={status === 'loading'}
          data-testid={`${dataTestId}-submit`}
          className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200 disabled:opacity-60 shrink-0"
        >
          {status === 'loading' ? 'Opening…' : buttonLabel}
        </button>
      </div>
      {error && (
        <p className="font-plex text-sm text-[var(--accent-burgundy)] mt-3 max-w-[50ch]" data-testid={`${dataTestId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
};

export default RazorpayCheckoutButton;
