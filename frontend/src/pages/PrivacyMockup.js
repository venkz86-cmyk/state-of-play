import { LegalLayout } from '../components/LegalLayout';

const SECTIONS = [
  {
    id: 'data-collection',
    heading: 'Data collection',
    body: [
      'We collect your name, email address, and payment confirmation details from Razorpay. This information is necessary to manage your membership, send newsletters, and authenticate access.',
    ],
  },
  {
    id: 'data-usage',
    heading: 'Data usage',
    body: [
      'Your data is used solely for communication related to your subscription and account access. We do not sell, rent, or share personal information with advertisers or third parties.',
    ],
  },
  {
    id: 'payments',
    heading: 'Payments',
    body: [
      'All financial transactions are handled entirely by Razorpay. The State of Play does not store card or banking details.',
    ],
  },
  {
    id: 'security',
    heading: 'Security',
    body: [
      'We take reasonable precautions to protect your personal information. Access to member data is restricted to authorized personnel for support and billing purposes only.',
    ],
  },
  {
    id: 'account-deletion',
    heading: 'Account deletion',
    body: [
      'Members can request deletion of their account or associated data by writing to venkat@stateofplay.club.',
    ],
  },
  {
    id: 'policy-updates',
    heading: 'Policy updates',
    body: [
      'We may update this Privacy Policy from time to time. Any changes will be reflected on this page and, when necessary, communicated by email.',
    ],
  },
];

export const PrivacyMockup = () => (
  <LegalLayout
    seo={{ title: 'Privacy', path: '/privacy', description: 'How The State of Play collects, stores, and uses information about its readers and subscribers.' }}
    testId="mockup-privacy"
    kicker="Privacy Policy"
    updated="04 June 2026"
    title="Less data, kept carefully."
    subtitle="What we collect, what we don't, and how we use it."
    sections={SECTIONS}
  />
);

export default PrivacyMockup;
