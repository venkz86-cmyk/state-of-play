import { useState, useEffect } from 'react';

export const useGeoPricing = () => {
  const [pricing, setPricing] = useState({
    currency: 'INR',
    symbol: '₹',
    amount: '2,499',
    period: '/year',
    note: '+ GST (for Indian readers)',
    country: 'IN',
    loading: true
  });

  useEffect(() => {
    const detectLocation = async () => {
      try {
        // Try multiple free geolocation APIs for reliability
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        const countryCode = data.country_code;
        
        if (countryCode === 'IN') {
          setPricing({
            currency: 'INR',
            symbol: '₹',
            amount: '2,499',
            period: '/year',
            note: '+ GST (for Indian readers)',
            country: 'IN',
            loading: false
          });
        } else {
          setPricing({
            currency: 'USD',
            symbol: '$',
            amount: '120',
            period: '/year',
            note: 'International pricing',
            country: countryCode,
            loading: false
          });
        }
      } catch (error) {
        console.error('Failed to detect location:', error);
        // Default to USD if detection fails
        setPricing({
          currency: 'USD',
          symbol: '$',
          amount: '120',
          period: '/year',
          note: 'International pricing',
          country: 'UNKNOWN',
          loading: false
        });
      }
    };

    detectLocation();
  }, []);

  return pricing;
};
