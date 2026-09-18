// The new-signup rate rises at this instant: 6 October 2026, 00:00 IST
// -- 5 October runs the full day at the current rate (moved from
// 1 October -- Venkat's call, to keep pushing The Ten right through
// 5 October). Same cutoff instant as razorpay_orders.py's
// OCT_1_CUTOFF -- this is a display-only check (the backend decides
// what's actually charged), so a wrong client clock only risks briefly
// stale copy, never a wrong charge.
const OCT_1_CUTOVER = new Date('2026-10-06T00:00:00+05:30');

export const isBeforeOctoberCutover = () => new Date() < OCT_1_CUTOVER;

// What The Ten launches at (Sept 15) and the annual rate change
// (6 October) both compare against: today's real new-signup price,
// still the old ₹2,499 + GST / $120 rate (PLAN_PRICING['standard'] in
// razorpay_orders.py, unchanged) until the rate actually rises.
export const newSignupAnnualPricing = (isIndia) => {
  if (isBeforeOctoberCutover()) {
    return {
      amount: isIndia ? '₹2,499' : '$120',
      note: isIndia ? 'the rate for a new signup, billed once a year · rises to ₹3,499 + GST from 6 October' : 'the rate for a new signup, billed once a year',
    };
  }
  return {
    amount: isIndia ? '₹3,499' : '$169',
    note: 'the rate for a new signup, billed once a year',
  };
};

// Through 5 October, upgrading from The Ten costs exactly today's
// direct-signup rate -- no discount for the ₹590/$9 trial fee already
// paid (Venkat's explicit call). From 6 October, the new higher
// direct-signup rate minus that trial fee takes over instead
// (razorpay_orders.py's own PLAN_PRICING['trial-upgrade'] carries the
// same numbers): IN ₹3,499 − ₹500 = ₹2,999; INTL $169 − $9 = $160.
export const trialUpgradePricing = (isIndia) => {
  const launch = isBeforeOctoberCutover();
  if (isIndia) {
    return launch
      ? {
          blurb: 'Upgrade before 6 October for ₹2,499 + GST, thirteen months for the price of twelve.',
          disclosure: '₹2,499 + 18% GST = ₹2,949. One payment, thirteen months of access.',
        }
      : {
          blurb: 'Upgrade any time before day 30 and pay the renewal rate, not the new-signup rate: ₹2,999 + GST, thirteen months for the price of twelve.',
          disclosure: '₹2,999 + 18% GST = ₹3,539. One payment, thirteen months of access.',
        };
  }
  return launch
    ? {
        blurb: 'Upgrade before 6 October for $120, thirteen months for the price of twelve.',
        disclosure: '$120. One payment, thirteen months of access.',
      }
    : {
        blurb: 'Upgrade any time before day 30 and pay $160, thirteen months for the price of twelve.',
        disclosure: '$160. One payment, thirteen months of access.',
      };
};
