import { useState, useEffect } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;

// Country detection only. Prices come from lib/octoberPricing.js, which
// switches at the 6 October cutover; keeping a price here as well is how
// stale figures crept onto pages before.
export const useGeoPricing = () => {
  const [pricing, setPricing] = useState({
    country: 'IN',
    loading: true
  });

  useEffect(() => {
    const detectLocation = async () => {
      try {
        let countryCode = 'IN'; // Default to India
        
        // Try backend proxy first (if available)
        if (API) {
          try {
            const response = await fetch(`${API}/api/geo/location`, { timeout: 3000 });
            if (response.ok) {
              const data = await response.json();
              countryCode = data.country_code || 'IN';
            }
          } catch (e) {
            // Backend not available, try public API
            try {
              const response = await fetch('https://ipapi.co/country_code/', { timeout: 3000 });
              if (response.ok) {
                countryCode = await response.text();
              }
            } catch (e2) {
              console.log('Geo detection failed, defaulting to India');
            }
          }
        } else {
          // No backend, try public API directly
          try {
            const response = await fetch('https://ipapi.co/country_code/');
            if (response.ok) {
              countryCode = await response.text();
            }
          } catch (e) {
            console.log('Geo detection failed, defaulting to India');
          }
        }
        
        if (countryCode === 'IN') {
          setPricing({
            country: 'IN',
            loading: false
          });
        } else {
          setPricing({
            country: countryCode,
            loading: false
          });
        }
      } catch (error) {
        console.error('Failed to detect location:', error);
        // Default to India pricing if detection fails
        setPricing({
          country: 'IN',
          loading: false
        });
      }
    };

    detectLocation();
  }, []);

  return pricing;
};
