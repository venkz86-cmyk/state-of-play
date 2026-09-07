import { useState } from 'react';
import { MockupLayout } from '../components/MockupLayout';
import { SubscriptionCheckoutButton } from '../components/SubscriptionCheckoutButton';

/* Internal-only staging harness for the real recurring-Annual checkout
   (razorpay_subscriptions.py + SubscriptionCheckoutButton.js). Not
   linked from anywhere on the live site and not part of MockupIndex's
   page list -- those are parallel routes to actual site pages, this is
   a bare test rig for Venkat to exercise the flow in Razorpay's test
   mode before it goes anywhere near a real renewal reminder.

   Only country='IN' has a real Razorpay Plan created as of this build
   -- SUBSCRIPTION_PLANS['INTL'] in razorpay_subscriptions.py still has
   an empty plan_id, so switching the country toggle below to INTL is
   expected to 503 (shown here as the button's normal error state, not
   a crash). */

export const SubscriptionCheckoutTest = () => {
  const [country, setCountry] = useState('IN');
  const [result, setResult] = useState('');

  return (
    <MockupLayout testId="subscription-checkout-test" seo={{ title: 'Subscription checkout test', path: '/internal/subscription-test', noindex: true }}>
      <div className="max-w-[800px] mx-auto px-6 py-16">
        <p className="font-editorial italic text-2xl mb-2">Subscription checkout — test rig</p>
        <p className="font-plex text-sm text-[var(--text-muted)] mb-8 max-w-[60ch]">
          Not a real page. Exercises SubscriptionCheckoutButton against razorpay_subscriptions.py directly — one Checkout step, the renewal rate, sets up real auto-renewal. Use Razorpay test-mode cards only.
        </p>

        <div className="flex flex-wrap gap-3 mb-10">
          {['IN', 'INTL'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setCountry(c); setResult(''); }}
              className={`font-plex text-[13px] px-4 py-2 border ${country === c ? 'border-[var(--accent-burgundy)] text-[var(--accent-burgundy)]' : 'border-[var(--rule)] text-[var(--text-muted)]'}`}
            >
              {c === 'IN' ? 'IN — real Plan created' : 'INTL — expect a 503'}
            </button>
          ))}
        </div>

        {result && (
          <p className="font-plex text-sm text-[var(--accent-blue)] mb-6" data-testid="subscription-test-result">
            {result}
          </p>
        )}

        <SubscriptionCheckoutButton
          key={country}
          country={country}
          buttonLabel="Renew now"
          dataTestId="subscription-test"
          disclosureText={`country=${country}`}
          onSuccess={(email) => setResult(`Verified. Ghost member labeled for ${email}.`)}
        />
      </div>
    </MockupLayout>
  );
};

export default SubscriptionCheckoutTest;
