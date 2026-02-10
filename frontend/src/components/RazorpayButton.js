import { useEffect, useRef } from 'react';
import { useGeoPricing } from '../hooks/useGeoPricing';

export const RazorpayButton = ({ className }) => {
  const containerRef = useRef(null);
  const pricing = useGeoPricing();
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || pricing.loading || scriptLoadedRef.current) return;

    // Payment button IDs based on location
    const paymentButtonId = pricing.country === 'IN' 
      ? 'pl_ROAFZZjAvjHhfQ'  // India: ₹2,499
      : 'pl_ROAIM0inFWbpC2';  // International: $120

    console.log('Loading Razorpay button for country:', pricing.country, 'Button ID:', paymentButtonId);

    // Clear the container
    container.innerHTML = '';

    // Create form
    const form = document.createElement('form');
    
    // Create script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.setAttribute('data-payment_button_id', paymentButtonId);
    script.async = true;

    script.onload = () => {
      console.log('Razorpay script loaded successfully');
      scriptLoadedRef.current = true;
    };

    script.onerror = () => {
      console.error('Failed to load Razorpay script');
    };

    form.appendChild(script);
    container.appendChild(form);

    // Cleanup
    return () => {
      if (container) {
        container.innerHTML = '';
      }
      scriptLoadedRef.current = false;
    };
  }, [pricing.loading, pricing.country]);

  if (pricing.loading) {
    return (
      <div className={`flex justify-center py-4 ${className || ''}`}>
        <div className="animate-pulse bg-gray-200 h-12 w-48 rounded"></div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`razorpay-button-container flex justify-center ${className || ''}`}
      data-testid="razorpay-button-container"
    />
  );
};
