import { daysUntil } from './format';

// When to offer a member the renewal. A renewal is one payment (razorpay_orders' 'renewal' plan) and its year
// starts when the current one ends (payments.renewal_access_from), so
// renewing early costs nothing; the window only keeps the offer out of
// the way until it's relevant. Shared by /account and /renew.
export const RENEWAL_WINDOW_DAYS = 30;

// `details` is POST /api/ghost/member-details. Returns null when there is
// nothing to renew, else { lapsed, paidInUsd, endIso }.
//
// Who can renew is the server's call (details.can_renew, the same rule
// checkout uses), so a page never hides the button from someone checkout
// would take. The account page still keeps the offer out of the way until
// RENEWAL_WINDOW_DAYS before the end; the /renew letter passes
// { anyTime: true } and shows it whenever the member can renew, since
// renewing early costs nothing.
export const renewalOffer = (details, { anyTime = false } = {}) => {
  if (!details) return null;
  const days = daysUntil(details.subscription_end);
  let canRenew = details.can_renew;
  if (canRenew === undefined) {
    // A server from before can_renew: its old, narrower rule.
    canRenew = (details.tier === 'standard'
      && ['one_time', 'complimentary'].includes(details.subscription_status))
      || (details.tier === 'free' && details.subscription_status === 'lapsed');
  }
  if (!canRenew) return null;
  if (!anyTime && days !== null && days > RENEWAL_WINDOW_DAYS) return null;
  return {
    lapsed: details.subscription_status === 'lapsed' || (days !== null && days < 0),
    paidInUsd: details.last_payment_currency === 'USD',
    endIso: details.subscription_end,
  };
};
