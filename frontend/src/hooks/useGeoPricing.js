import { useState, useEffect } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;

// Country detection only. Prices come from lib/octoberPricing.js, which
// switches at the October 6 cutover; keeping a price here as well is how
// stale figures crept onto pages before.
// The detected country is remembered for a day, so a returning reader
// sees their own prices straight away instead of ₹ flashing before $.
// One lookup per page load is shared by every component that asks.
const COUNTRY_KEY = 'tsop_country';
const COUNTRY_TTL_MS = 24 * 60 * 60 * 1000;
let detected = null;
let pending = null;

const readCachedCountry = () => {
  if (detected) return detected;
  try {
    const { country, at } = JSON.parse(window.localStorage.getItem(COUNTRY_KEY) || '{}');
    if (country && at && Date.now() - at < COUNTRY_TTL_MS) return country;
  } catch (_e) { /* storage blocked: detect fresh */ }
  return null;
};

const rememberCountry = (country) => {
  detected = country;
  try {
    window.localStorage.setItem(COUNTRY_KEY, JSON.stringify({ country, at: Date.now() }));
  } catch (_e) { /* storage blocked */ }
};

export const useGeoPricing = () => {
  const cached = readCachedCountry();
  const [pricing, setPricing] = useState(
    cached ? { country: cached, loading: false } : { country: 'IN', loading: true }
  );

  useEffect(() => {
    if (cached) return undefined;
    let active = true;
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
        
        countryCode = (countryCode || 'IN').trim().toUpperCase() || 'IN';
        rememberCountry(countryCode);
        if (active) setPricing({ country: countryCode, loading: false });
      } catch (error) {
        console.error('Failed to detect location:', error);
        // Default to India pricing if detection fails
        if (active) setPricing({ country: 'IN', loading: false });
      }
    };

    if (!pending) pending = detectLocation().finally(() => { pending = null; });
    else pending.then(() => { if (active && detected) setPricing({ country: detected, loading: false }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return pricing;
};
