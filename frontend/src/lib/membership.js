import { renewalOffer } from './renewal';

// What a member's membership looks like, in words: plan, end date, how
// renewal works, last payment. `details` is POST /api/ghost/member-details.
// Shared by the website's /account and the app's You tab, so the two never
// say different things.
export const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const describeMembership = (details, canAccessPremium) => {
  // A real Trial ("The Ten") member carries only 'tier-trial', no paid
  // label, so canAccessPremium is false for them -- checked first, or
  // they'd fall through to 'Free' despite the Trial section below.
  const planLabel = details?.tier === 'trial'
    ? 'Trial'
    : canAccessPremium
      ? (details?.tier === 'student'
          ? 'Student'
          : details?.subscription_status === 'nomination'
            ? 'Trial'
            : details?.subscription_status === 'comped' ? 'Comped'
              : ['complimentary', 'complimentary_short'].includes(details?.subscription_status) ? 'Complimentary' : 'Annual')
      : 'Free';

  // A Razorpay member's own subscription_status now distinguishes a real
  // recurring Subscription ('active') from a one-time Order payment
  // ('one_time') -- server.py's get_member_details checks Razorpay's own
  // subscription_id on their last payment, not a blanket assumption.
  // Stripe-billed Ghost subscriptions still show as 'active' too.
  const autoRenews = details?.subscription_status === 'active';
  // Whether to show the Renew block (lib/renewal.js).
  const renewal = renewalOffer(details);
  const complimentary = details?.subscription_status === 'complimentary';
  // A shorter complimentary membership (a month to six months) ends with
  // a year at the new-reader price, not the renewal rate.
  const complimentaryShort = details?.subscription_status === 'complimentary_short';
  const dateLabel = autoRenews ? 'Renews' : (complimentary || complimentaryShort) ? 'Ends' : 'Expires';
  const endDate = longDate(details?.subscription_end);
  const memberSince = longDate(details?.subscription_start || details?.created_at);
  const paidInUsd = details?.last_payment_currency === 'USD';
  const nextCharge = autoRenews && canAccessPremium ? (paidInUsd ? '$149' : '₹3,539') : '—';
  const nextChargeDetail = autoRenews && canAccessPremium && !paidInUsd ? '₹2,999 + ₹540 GST' : null;
  // Most members paid once: for them the third tile says how renewal
  // works instead of showing an empty "Next charge". The reminder timing
  // is annual_renewal.py's REMINDER_DAYS_BEFORE.
  // A complimentary year (complimentary.py) renews the same way.
  const paidOnce = canAccessPremium && (details?.subscription_status === 'one_time' || complimentary);
  // What renewing costs, in the currency the member last paid in: the
  // renewal rate (razorpay_subscriptions.SUBSCRIPTION_PLANS) or, for
  // students, the student price (razorpay_orders.PLAN_PRICING['student']).
  const isStudent = details?.tier === 'student';
  const renewalPrice = isStudent
    ? (paidInUsd ? ['$29 a year', null] : ['₹1,770 a year', '₹1,500 + ₹270 GST'])
    : (paidInUsd ? ['$149 a year', null] : ['₹3,539 a year', '₹2,999 + ₹540 GST']);
  // Students renew through a fresh ID check, not the reminder emails.
  const renewalNote = isStudent
    ? 'Not automatic. We\'ll be in touch before it ends.'
    : 'Not automatic. We email you 14 days before it ends.';
  const renewalTile = complimentaryShort
    ? ['Then', paidInUsd ? '$169 a year' : '₹4,129 a year', [paidInUsd ? null : '₹3,499 + ₹630 GST', 'Not automatic. We email you before it ends.'].filter(Boolean)]
    : paidOnce
      ? ['Renewal', renewalPrice[0], [renewalPrice[1], renewalNote].filter(Boolean)]
      : ['Next charge', nextCharge, nextChargeDetail];

  // The member's real last payment, not a fixed price: students, renewals,
  // teams and new signups all pay different amounts.
  const formatAmount = (amount, currency) => {
    if (amount == null) return '';
    const units = amount / 100;
    return currency === 'USD'
      ? `$${units.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      : `₹${units.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };
  const billingLine = !canAccessPremium
    ? 'No active subscription.'
    : details?.last_payment_amount != null
      ? `Last payment ${longDate(details.last_payment_date)} · ${formatAmount(details.last_payment_amount, details.last_payment_currency)} · Razorpay.`
      : 'No payment on file.';

  return {
    planLabel, autoRenews, renewal, complimentary, complimentaryShort, dateLabel, endDate,
    memberSince, paidInUsd, isStudent, renewalTile, billingLine, formatAmount,
  };
};
