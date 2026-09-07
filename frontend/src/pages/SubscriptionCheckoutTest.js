import { useState } from 'react';
import { MockupLayout } from '../components/MockupLayout';
import { SubscriptionCheckoutButton } from '../components/SubscriptionCheckoutButton';

/* Internal-only staging harness for the real recurring-Annual checkout
   (razorpay_subscriptions.py + SubscriptionCheckoutButton.js). Not
   linked from anywhere on the live site and not part of MockupIndex's
   page list -- those are parallel routes to actual site pages, this is
   a bare test rig for Venkat to exercise the flow in Razorpay's test
   mode before it goes anywhere near /signup's live button.

   Only tier='existing'/country='IN' has a real Razorpay Plan created
   as of this build -- the other three SUBSCRIPTION_PLANS entries in
   razorpay_subscriptions.py still have empty plan_ids, so
   create-subscription will 503 for them (shown here as the button's
   normal error state, not a crash). */

const SCENARIOS = [
  { key: 'y', label: 'Y — renew now (immediate charge)', tier: 'existing', country: 'IN', bridgeOrderPlan: null },
  { key: 'x', label: 'X — sign up now, bridge + deferred mandate', tier: 'existing', country: 'IN', bridgeOrderPlan: 'standard' },
  { key: 'z', label: 'Z — new-rate signup (no real Plan yet — expect a 503)', tier: 'new', country: 'IN', bridgeOrderPlan: null },
];

export const SubscriptionCheckoutTest = () => {
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [result, setResult] = useState('');

  return (
    <MockupLayout testId="subscription-checkout-test" seo={{ title: 'Subscription checkout test', path: '/internal/subscription-test', noindex: true }}>
      <div className="max-w-[800px] mx-auto px-6 py-16">
        <p className="font-editorial italic text-2xl mb-2">Subscription checkout — test rig</p>
        <p className="font-plex text-sm text-[var(--text-muted)] mb-8 max-w-[60ch]">
          Not a real page. Exercises SubscriptionCheckoutButton against razorpay_subscriptions.py directly. Use Razorpay test-mode cards only.
        </p>

        <div className="flex flex-wrap gap-3 mb-10">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => { setScenario(s); setResult(''); }}
              className={`font-plex text-[13px] px-4 py-2 border ${scenario.key === s.key ? 'border-[var(--accent-burgundy)] text-[var(--accent-burgundy)]' : 'border-[var(--rule)] text-[var(--text-muted)]'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {result && (
          <p className="font-plex text-sm text-[var(--accent-blue)] mb-6" data-testid="subscription-test-result">
            {result}
          </p>
        )}

        <SubscriptionCheckoutButton
          key={scenario.key}
          tier={scenario.tier}
          country={scenario.country}
          bridgeOrderPlan={scenario.bridgeOrderPlan}
          buttonLabel="Run this scenario"
          dataTestId="subscription-test"
          disclosureText={`tier=${scenario.tier} country=${scenario.country} bridgeOrderPlan=${scenario.bridgeOrderPlan || 'none'}`}
          onSuccess={(email) => setResult(`Verified. Ghost member labeled for ${email}.`)}
        />
      </div>
    </MockupLayout>
  );
};

export default SubscriptionCheckoutTest;
