import { useEffect, useRef, useState } from 'react';
import { useGeoPricing } from '../hooks/useGeoPricing';

/* Razorpay Payment Button — TSOP-styled proxy.

   Razorpay's checkout script injects a default blue button inside a
   <form> we provide. We render that <form> off-screen and surface our
   own DM-Sans / burgundy / sharp-corner button that programmatically
   clicks the injected Razorpay button. Razorpay's checkout session,
   analytics and click handler are preserved as-is — only the visual
   chrome is replaced.                                                 */
export const RazorpayButton = ({
  className = '',
  dataTestId = 'razorpay-cta',
  showSecuredBy = true,
}) => {
  const hiddenFormRef = useRef(null);
  const pricing = useGeoPricing();
  const [ready, setReady] = useState(false);

  // Two Razorpay payment buttons supplied by the publisher
  //   pl_ROAFZZjAvjHhfQ  → India   (₹2,499 + GST ≈ ₹2,949)
  //   pl_ROAIM0inFWbpC2  → World   ($120)
  const isIndia = pricing.country === 'IN';
  const buttonId = isIndia ? 'pl_ROAFZZjAvjHhfQ' : 'pl_ROAIM0inFWbpC2';
  const label = isIndia
    ? 'Subscribe — ₹2,499 + GST / year'
    : 'Subscribe — $120 / year';

  useEffect(() => {
    if (pricing.loading) return;
    const form = hiddenFormRef.current;
    if (!form) return;

    // Replace any previously injected script (e.g. country flipped)
    form.innerHTML = '';
    setReady(false);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.async = true;
    script.setAttribute('data-payment_button_id', buttonId);
    form.appendChild(script);

    // Razorpay injects its own <button.razorpay-payment-button> after
    // the script loads. Poll briefly until it shows up.
    const start = Date.now();
    const t = setInterval(() => {
      if (form.querySelector('.razorpay-payment-button')) {
        setReady(true);
        clearInterval(t);
      } else if (Date.now() - start > 15000) {
        clearInterval(t);
      }
    }, 200);

    return () => clearInterval(t);
  }, [pricing.loading, buttonId]);

  const handleClick = () => {
    const btn = hiddenFormRef.current?.querySelector('.razorpay-payment-button');
    if (btn) btn.click();
  };

  return (
    <div className={className} data-testid="razorpay-button-container">
      <button
        type="button"
        onClick={handleClick}
        disabled={!ready || pricing.loading}
        data-testid={dataTestId}
        aria-label={label}
        className="tsop-subscribe-btn inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] h-12 transition-colors duration-200 disabled:opacity-70"
        style={{ borderRadius: 0, padding: '0 32px', cursor: ready ? 'pointer' : 'wait' }}
      >
        {label}
      </button>

      {showSecuredBy && (
        <p className="font-plex text-[11px] text-[#999999] mt-3">
          Payments secured by Razorpay
        </p>
      )}

      {/* Hidden Razorpay form — present in DOM so the injected button
          remains clickable from our proxy button. Off-screen, never
          visible to the user. */}
      <form
        ref={hiddenFormRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: 0,
          height: 0,
          overflow: 'hidden',
        }}
      />
    </div>
  );
};

export default RazorpayButton;
