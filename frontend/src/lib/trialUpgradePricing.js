// The Ten launches 15 September; upgraders before the 1 October rate
// change pay a cheaper launch price than the steady-state ₹2,999 rate,
// reverting automatically at the same instant the new-signup rate goes
// live. Same cutoff instant as razorpay_orders.py's
// TRIAL_UPGRADE_LAUNCH_CUTOFF -- this is a display-only check (the
// backend is what actually decides the charged amount), so a wrong
// client clock only risks briefly wrong copy, never a wrong charge.
const LAUNCH_CUTOFF = new Date('2026-10-01T00:00:00+05:30');

export const trialUpgradePricing = () => {
  const launch = new Date() < LAUNCH_CUTOFF;
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
