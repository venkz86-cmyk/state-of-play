import { useEffect, useRef } from 'react';
import { useGeoPricing } from '../hooks/useGeoPricing';

/* Razorpay Payment/Subscription Button — native Razorpay rendering.

   We let Razorpay's own script render the button exactly as their
   dashboard configured it (no style/click overrides), and route by geo.
   India now uses a true auto-renewing Subscription Button (locks in the
   pre-Nov-1 ₹2,499 + GST ≈ ₹2,949 rate for whoever signs up before then —
   retire this one Oct 31, see memory/HANDOVER.md); International is
   still the older one-time Payment Button ($120), unchanged so far.
   The two button types use different embed scripts/attributes —
   Razorpay doesn't treat them interchangeably. */
const IN_BUTTON = { id: 'pl_TX1mf8ClQojsek', type: 'subscription' };
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
