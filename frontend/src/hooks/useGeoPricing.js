import { useState, useEffect } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;

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
        // Use our backend proxy to detect location (avoids CORS issues)
        const response = await fetch(`${API}/api/geo/location`);
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
