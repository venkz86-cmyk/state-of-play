import { useEffect, useRef } from 'react';
import { useGeoPricing } from '../hooks/useGeoPricing';

/* Razorpay Payment/Subscription Button — native Razorpay rendering.

   PAUSED (Sept 2 2026): India briefly pointed at a native Razorpay
   Subscription Button (pl_TX1mf8ClQojsek) for the pre-Nov-1 ₹2,499+GST
   rate, but that button bills a flat amount forever — it can't express
   "₹2,499 now, ₹2,999 from year 2," which is the actual intended pricing
   (the "X" case in razorpay_subscriptions.py's docstring: one-time order
   now + a deferred Subscription that only starts auto-charging at the
   grandfathered rate next year). Reverted to the plain one-time Payment
   Button here until that custom flow is built and verified in test mode
   — see memory/HANDOVER.md. Do not re-point IN_BUTTON at a native
   Subscription Button without re-confirming the pricing model first.

   We let Razorpay's own script render the button exactly as their
   dashboard configured it (no style/click overrides), and route by geo.
   The two button types (payment vs. subscription) use different embed
   scripts/attributes — Razorpay doesn't treat them interchangeably,
   which is why this still branches on `type` even though both geos are
   `payment` again for now. */
const IN_BUTTON = { id: 'pl_ROAFZZjAvjHhfQ', type: 'payment' };
const INTL_BUTTON = { id: 'pl_ROAIM0inFWbpC2', type: 'payment' };

const BUTTON_SCRIPT_SRC = {
  subscription: 'https://cdn.razorpay.com/static/widget/subscription-button.js',
  payment: 'https://checkout.razorpay.com/v1/payment-button.js',
};
const BUTTON_ID_ATTR = {
  subscription: 'data-subscription_button_id',
  payment: 'data-payment_button_id',
};

export const RazorpayButton = ({
  className = '',
  dataTestId = 'razorpay-cta',
}) => {
  const formRef = useRef(null);
  const pricing = useGeoPricing();

  const button = pricing.country === 'IN' ? IN_BUTTON : INTL_BUTTON;

  useEffect(() => {
    if (pricing.loading) return;
    const form = formRef.current;
    if (!form) return;

    form.innerHTML = '';
    const script = document.createElement('script');
    script.src = BUTTON_SCRIPT_SRC[button.type];
    script.async = true;
    if (button.type === 'subscription') {
      script.setAttribute('data-button_theme', 'brand-color');
    }
    script.setAttribute(BUTTON_ID_ATTR[button.type], button.id);
    form.appendChild(script);
  }, [pricing.loading, button.id, button.type]);

  return (
    <div className={className} data-testid="razorpay-button-container">
      <form ref={formRef} data-testid={dataTestId} />
    </div>
  );
};

export default RazorpayButton;
