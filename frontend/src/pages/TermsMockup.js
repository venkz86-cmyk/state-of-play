import { LegalLayout } from '../components/LegalLayout';

const SECTIONS = [
  {
    id: 'who-we-are',
    heading: 'Who we are',
    body: [
      'The State of Play is published by Left Field Ventures, an editorial company registered in Bengaluru, India. These terms govern access to stateofplay.club and to any membership product we operate under that name.',
      'By creating an account, subscribing, or otherwise using the site, you accept these terms. If you don’t, please don’t use the service.',
    ],
  },
  {
    id: 'membership',
    heading: 'Membership and billing',
    body: [
      'Individual membership is sold as an annual subscription priced at ₹2,499 plus 18% GST (₹2,949 total). International membership is $120 per year. Prices may change for future renewals; existing terms will be honoured for the duration of any active period you’ve paid for.',
      'Team plans (Team-5, Team-10) are sold as fixed seat counts. Adding seats beyond the purchased plan requires upgrading. Payment is taken via Razorpay (India) or our international processor; cards are not stored by us.',
      'Memberships renew automatically. You may cancel at any time from the member dashboard. Cancellations take effect at the end of the current paid period.',
    ],
  },
  {
    id: 'access',
    heading: 'Use of the service',
    body: [
      'Membership grants you one personal, non-transferable account. You may not share login credentials, publish paid content in full, or syndicate our reporting without permission.',
      'For team plans, each seat is associated with a single named individual. Bulk forwarding of issues outside the seat list is a breach of these terms.',
    ],
  },
  {
    id: 'refunds',
    heading: 'Refunds',
    body: [
      'If you change your mind within fourteen days of first paying and have read three or fewer subscriber editions, write to support@stateofplay.club for a full refund.',
      'After that window, we don’t offer partial refunds, but you’ll keep access until the end of the period you paid for.',
    ],
  },
  {
    id: 'editorial',
    heading: 'Editorial independence',
    body: [
      'Our reporting is independent of advertisers, partners, sources and subscribers. Partner relationships are disclosed where they intersect with coverage. No partner has ever been promised favourable coverage, and never will be.',
      'We publish corrections promptly and visibly. If you believe something we’ve published is wrong, write to venkat@stateofplay.club.',
    ],
  },
  {
    id: 'liability',
    heading: 'Liability',
    body: [
      'We work hard to make sure the site is available, accurate, and useful. We do not warrant that it will be uninterrupted or error-free. Our liability is limited to the amount you’ve paid for your active subscription period.',
      'The site is published on a best-efforts basis. Investment, legal or other decisions you make based on our reporting are yours alone.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    body: [
      'If we change these terms in a material way, we’ll notify active members by email and post a dated note on this page at least seven days before the new terms take effect.',
    ],
  },
  {
    id: 'governing',
    heading: 'Governing law',
    body: [
      'These terms are governed by the laws of India. Any dispute will be heard in the courts of Bengaluru, Karnataka.',
    ],
  },
];

export const TermsMockup = () => (
  <LegalLayout
    testId="mockup-terms"
    kicker="Terms of Service"
    updated="06 February 2026"
    title="The terms we operate under."
    subtitle="A short, readable contract between The State of Play and the people who read us."
    sections={SECTIONS}
  />
);

export default TermsMockup;
