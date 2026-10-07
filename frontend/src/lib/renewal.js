import { daysUntil } from './format';

// When a member can renew: an annual member on a one-time payment (or a
// complimentary year) within
// RENEWAL_WINDOW_DAYS of the end of their year (or past it), or a former
// member whose grace week has passed (member-details reports 'lapsed').
// A renewal is one payment (razorpay_orders' 'renewal' plan) and its year
// starts when the current one ends (payments.renewal_access_from), so
// renewing early costs nothing; the window only keeps the offer out of
// the way until it's relevant. Shared by /account and /renew.
export const RENEWAL_WINDOW_DAYS = 30;

// `details` is POST /api/ghost/member-details. Returns null when there is
// nothing to renew, else { lapsed, paidInUsd, endIso }.
export const renewalOffer = (details) => {
  if (!details) return null;
  const days = daysUntil(details.subscription_end);
  const inWindow = details.tier === 'standard'
    && ['one_time', 'complimentary'].includes(details.subscription_status)
    && days !== null && days <= RENEWAL_WINDOW_DAYS;
  const lapsed = details.tier === 'free' && details.subscription_status === 'lapsed';
  if (!inWindow && !lapsed) return null;
  return {
    lapsed: lapsed || days < 0,
    paidInUsd: details.last_payment_currency === 'USD',
    endIso: details.subscription_end,
  };
};
