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
      // GST-inclusive figure actually charged (INTL has no separate total).
      total: isIndia ? '₹2,949' : '$120',
      note: isIndia ? 'the rate for a new signup, billed once a year · rises to ₹3,499 + GST from 6 October' : 'the rate for a new signup, billed once a year',
    };
  }
  return {
    amount: isIndia ? '₹3,499' : '$169',
    total: isIndia ? '₹4,129' : '$169',
    note: 'the rate for a new signup, billed once a year',
  };
};

// The existing-reader rate: free members who joined before 6 October
// can still buy the annual membership at ₹2,499 + GST / $120 until
// 31 October, once signed in. The backend decides who qualifies and
// sends it as early_rate_until on /api/auth/me (session_auth.py's
// existing_reader_rate_until); create_order charges the same rule.
const EXISTING_READER_RATE_ENDS = new Date('2026-11-01T00:00:00+05:30');

// Between the rate rise and the end of 31 October.
export const isExistingReaderWindow = () => {
  const now = new Date();
  return now >= OCT_1_CUTOVER && now < EXISTING_READER_RATE_ENDS;
};

export const annualPricingFor = (isIndia, user) => {
  if (user?.early_rate_until && isExistingReaderWindow()) {
    return {
      amount: isIndia ? '₹2,499' : '$120',
      total: isIndia ? '₹2,949' : '$120',
      note: 'Your rate as an existing reader, until 31 October.',
      existingReader: true,
    };
  }
  return newSignupAnnualPricing(isIndia);
};

// The same rate for Left Field readers on Substack who signed up before
// 6 October, shown only on /signup?offer=left-field. The backend checks
// the email typed at checkout against the uploaded Substack list
// (session_auth.early_rate_for_email) and charges the rate only then.
export const leftFieldOfferPricing = (isIndia) => ({
  amount: isIndia ? '₹2,499' : '$120',
  total: isIndia ? '₹2,949' : '$120',
  note: 'Your rate as a Left Field reader, until 31 October. Use the email The Left Field comes to.',
  existingReader: true,
});

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
