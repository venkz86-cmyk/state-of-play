// The new-signup rate rises at this instant: 5 October 2026, 00:00 IST
// (moved from 1 October -- Venkat's call, to keep pushing The Ten right
// up to that date). Same cutoff instant as razorpay_orders.py's
// OCT_1_CUTOFF -- this is a display-only check (the backend decides
// what's actually charged), so a wrong client clock only risks briefly
// stale copy, never a wrong charge.
const OCT_1_CUTOVER = new Date('2026-10-05T00:00:00+05:30');

export const isBeforeOctoberCutover = () => new Date() < OCT_1_CUTOVER;

// What The Ten launches at (Sept 15) and the annual rate change
// (5 October) both compare against: today's real new-signup price,
// still the old ₹2,499 + GST / $120 rate (PLAN_PRICING['standard'] in
// razorpay_orders.py, unchanged) until the rate actually rises.
export const newSignupAnnualPricing = (isIndia) => {
  if (isBeforeOctoberCutover()) {
    return {
      amount: isIndia ? '₹2,499' : '$120',
      note: isIndia ? 'the rate for a new signup, billed once a year · rises to ₹3,499 + GST from 5 October' : 'the rate for a new signup, billed once a year',
    };
  }
  return {
    amount: isIndia ? '₹3,499' : '$169',
    note: 'the rate for a new signup, billed once a year',
  };
};

// The Ten's own upgrade price is flat -- deliberately never rises, to
// keep the case for buying into The Ten simple while it's being pushed
// hard right up to 5 October (razorpay_orders.py's own
// PLAN_PRICING['trial-upgrade'] carries the same, permanent numbers).
// Same "new-signup launch rate minus the trial fee already paid" logic
// both geos: IN ₹2,499 − ₹500 = ₹1,999; INTL $120 − $9 = $111.
export const trialUpgradePricing = (isIndia) => {
  if (isIndia) {
    return {
      blurb: 'Upgrade any time before day 30: ₹1,999 + GST, thirteen months for the price of twelve.',
      disclosure: '₹1,999 + 18% GST = ₹2,359. One payment, thirteen months of access.',
    };
  }
  return {
    blurb: 'Upgrade any time before day 30: $111, thirteen months for the price of twelve.',
    disclosure: '$111. One payment, thirteen months of access.',
  };
};
