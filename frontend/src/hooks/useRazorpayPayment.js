import { useGeoPricing } from './useGeoPricing';
import { useState, useCallback, useRef } from 'react';

export const useRazorpayPayment = () => {
  const pricing = useGeoPricing();
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);

  const openPayment = useCallback((returnUrl = window.location.href) => {
    // Don't proceed if pricing is still loading
    if (pricing.loading) {
      console.log('Waiting for pricing to load...');
      return;
    }

    setIsLoading(true);

    // Payment button IDs based on location
    const paymentButtonId = pricing.country === 'IN' 
      ? 'pl_ROAFZZjAvjHhfQ'  // India: ₹2,499
      : 'pl_ROAIM0inFWbpC2';  // International: $120

    console.log('Opening Razorpay payment for country:', pricing.country, 'Button ID:', paymentButtonId);

    // Remove any existing Razorpay forms
    const existingForms = document.querySelectorAll('.razorpay-payment-form');
    existingForms.forEach(form => form.remove());

    // Create form and load Razorpay button
    const form = document.createElement('form');
    form.className = 'razorpay-payment-form';
    form.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; opacity: 0;';
    
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.setAttribute('data-payment_button_id', paymentButtonId);
    script.async = true;
    
    form.appendChild(script);
    document.body.appendChild(form);
    
    // Wait for script to load, then trigger click
    script.onload = () => {
      setTimeout(() => {
        const button = form.querySelector('button');
        if (button) {
          console.log('Razorpay button found, triggering click');
          button.click();
        } else {
          console.error('Razorpay button not found in form');
        }
        setIsLoading(false);
      }, 800);
    };

    script.onerror = () => {
      console.error('Failed to load Razorpay script');
      setIsLoading(false);
    };
  }, [pricing.country, pricing.loading]);

  return { openPayment, pricing, isLoading };
};
