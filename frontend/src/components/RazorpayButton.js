import { useEffect, useRef } from 'react';
import { useGeoPricing } from '../hooks/useGeoPricing';

/* Razorpay Payment Button — native Razorpay rendering.

   We let Razorpay's payment-button.js script render its own button
   exactly as their dashboard configured it (no style/click overrides),
   and route by geo:
     India        → pl_ROAFZZjAvjHhfQ  (₹2,499 + GST ≈ ₹2,949)
     International → pl_ROAIM0inFWbpC2  ($120)                          */
export const RazorpayButton = ({
  className = '',
  dataTestId = 'razorpay-cta',
}) => {
  const formRef = useRef(null);
  const pricing = useGeoPricing();

  const buttonId = pricing.country === 'IN'
    ? 'pl_ROAFZZjAvjHhfQ'
    : 'pl_ROAIM0inFWbpC2';

  useEffect(() => {
    if (pricing.loading) return;
    const form = formRef.current;
    if (!form) return;

    form.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.async = true;
    script.setAttribute('data-payment_button_id', buttonId);
    form.appendChild(script);
  }, [pricing.loading, buttonId]);

  return (
    <div className={className} data-testid="razorpay-button-container">
      <form ref={formRef} data-testid={dataTestId} />
    </div>
  );
};

export default RazorpayButton;
