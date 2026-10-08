import { LegalLayout } from '../components/LegalLayout';

const SECTIONS = [
  {
    id: 'membership',
    heading: 'Membership',
    body: [
      'The State of Play offers annual memberships, paid through Razorpay. Each membership gives one reader access to all paid stories and the full archive. A new membership is a single payment for twelve months and does not renew on its own. If you renew from your account, you are charged automatically each year until you cancel. The Ten is a one-time payment for thirty days and never renews.',
    ],
  },
  {
    id: 'payments-and-refunds',
    heading: 'Payments and refunds',
    body: [
      'All payments are processed via Razorpay. We do not store or process payment information directly. Annual plans are non-refundable once payment is completed.',
    ],
  },
  {
    id: 'content-usage',
    heading: 'Content usage',
    body: [
      'All editorial material, including stories and briefings, is owned by The State of Play. Redistribution, reproduction, or sharing of paid content is not permitted without written consent. Members may share free or public posts with attribution.',
    ],
  },
  {
    id: 'cancellation',
    heading: 'Cancellation',
    body: [
      'You can cancel your membership anytime by contacting venkat@stateofplay.club. Cancellation stops future renewals but does not trigger a refund for the current billing cycle.',
    ],
  },
  {
    id: 'changes-to-terms',
    heading: 'Changes to terms',
    body: [
      'We may revise these terms periodically to reflect updates in policy, pricing, or functionality. Continued use of the service after such updates implies acceptance of the new terms.',
    ],
  },
  {
    id: 'contact',
    heading: 'Contact',
    body: [
      'For questions about subscriptions, privacy, or terms of use:',
      'Legal entity name: Left Field Ventures',
      'Registered Address: Ground Floor, 36, Infantry Road, Tasker Town, Shivaji Nagar, Bengaluru, Karnataka 560001',
      'Operational Address: Ground Floor, 36, Infantry Road, Tasker Town, Shivaji Nagar, Bengaluru, Karnataka 560001',
      'Email: venkat@stateofplay.club',
    ],
  },
];

export const TermsMockup = () => (
  <LegalLayout
    seo={{ title: 'Terms', path: '/terms', description: 'The State of Play: terms of use, subscription terms, and refund policy.' }}
    testId="mockup-terms"
    kicker="Terms of Service"
    updated="October 4, 2026"
    title="The terms we operate under."
    subtitle="A short, readable contract between The State of Play and the people who read us."
    sections={SECTIONS}
  />
);

export default TermsMockup;
