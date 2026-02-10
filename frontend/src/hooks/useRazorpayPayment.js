import { useGeoPricing } from './useGeoPricing';

export const useRazorpayPayment = () => {
  const pricing = useGeoPricing();

  const openPayment = (returnUrl = window.location.href) => {
    // Payment button IDs based on location
    const paymentButtonId = pricing.country === 'IN' 
      ? 'pl_ROAFZZjAvjHhfQ'  // India: ₹2,499
      : 'pl_ROAIM0inFWbpC2';  // International: $120

    // Check if script already loaded
    const existingScript = document.querySelector(`script[data-payment_button_id="${paymentButtonId}"]`);
    
    if (existingScript) {
      // Script exists, trigger it
      existingScript.click();
      return;
    }

    // Create form and load Razorpay button
    const form = document.createElement('form');
    form.style.display = 'none';
    
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.setAttribute('data-payment_button_id', paymentButtonId);
    script.async = true;
    
    // Add return URL as data attribute (Razorpay will use this)
    script.setAttribute('data-redirect_url', returnUrl);
    
    form.appendChild(script);
    document.body.appendChild(form);
    
    // Wait for script to load, then trigger click
    script.onload = () => {
      setTimeout(() => {
        const button = form.querySelector('button');
        if (button) {
          button.click();
        }
      }, 500);
    };
  };

  return { openPayment, pricing };
};
