// Two separate prices both change at the same instant: 1 October 2026,
// 00:00 IST, when new signups stop paying the old rate and the
// trial-upgrade launch discount ends. Same cutoff instant as
// razorpay_orders.py's TRIAL_UPGRADE_LAUNCH_CUTOFF -- these are
// display-only checks (the backend decides what's actually charged), so
// a wrong client clock only risks briefly stale copy, never a wrong
// charge.
const OCT_1_CUTOVER = new Date('2026-10-01T00:00:00+05:30');

export const isBeforeOctoberCutover = () => new Date() < OCT_1_CUTOVER;

// What The Ten launches at (Sept 15) and the annual rate change (Oct 1)
// both compare against: today's real new-signup price, still the old
// ₹2,499 + GST / $120 rate (PLAN_PRICING['standard'] in
// razorpay_orders.py, unchanged) until the rate actually rises.
export const newSignupAnnualPricing = (isIndia) => {
  if (isBeforeOctoberCutover()) {
    return {
      amount: isIndia ? '₹2,499' : '$120',
      note: isIndia ? 'the rate for a new signup, billed once a year · rises to ₹3,499 + GST from 1 October' : 'the rate for a new signup, billed once a year',
    };
  }
  return {
    amount: isIndia ? '₹3,499' : '$169',
    note: 'the rate for a new signup, billed once a year',
  };
};

export const trialUpgradePricing = () => {
  const launch = isBeforeOctoberCutover();
  return launch
    ? {
        blurb: 'Upgrade before 1 October for the launch price: ₹1,999 + GST, thirteen months for the price of twelve.',
        disclosure: '₹1,999 + 18% GST = ₹2,359. One payment, thirteen months of access.',
      }
    : {
        blurb: 'Upgrade any time before day 30 and pay the renewal rate, not the new-signup rate: ₹2,999 + GST, thirteen months for the price of twelve.',
        disclosure: '₹2,999 + 18% GST = ₹3,539. One payment, thirteen months of access.',
      };
};
