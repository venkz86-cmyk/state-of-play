import { LegalLayout } from '../components/LegalLayout';

const SECTIONS = [
  {
    id: 'principles',
    heading: 'What we believe',
    body: [
      'A publication should know less about its readers than its readers know about it. The State of Play collects the minimum data needed to run a subscription business, and nothing else.',
      'We don’t sell reader data. We don’t share it with advertisers. We never will.',
    ],
  },
  {
    id: 'what-we-collect',
    heading: 'What we collect, and why',
    body: [
      'Account: your name, email and password hash, so you can sign in and we can send you the edition.',
      'Billing: payment is handled by Razorpay (India) or our international processor. We see only the transaction status, last four digits of your card, and an invoice. Full card details never reach our servers.',
      'Reading: which editions you’ve opened and how long you spent, so we can show "continue reading" and improve coverage. This is keyed to your account and not shared with any third party.',
      'Logs: IP, user agent, referrer and a request timestamp are kept for thirty days to detect abuse and debug errors. They are deleted after that.',
    ],
  },
  {
    id: 'cookies',
    heading: 'Cookies',
    body: [
      'We use a small number of first-party cookies for login state, theme preference and font-size choice. We do not use cross-site tracking cookies.',
      'Analytics, where used, is configured to anonymise IPs and not store identifying user-level data. You can opt out from any page.',
    ],
  },
  {
    id: 'who-sees-it',
    heading: 'Who sees your data',
    body: [
      'Two people: the editor and the engineer responsible for site operations. No one else.',
      'We use a small set of vendors to run the publication: a hosting provider, an email provider, Razorpay for India payments, and an international payment processor. Each receives only the data needed to do its job, under a data-processing contract.',
    ],
  },
  {
    id: 'your-rights',
    heading: 'Your rights',
    body: [
      'You can ask us at any time for a copy of the data we hold about you, request a correction, or ask us to delete your account.',
      'Write to support@stateofplay.club. We aim to respond within seven days.',
    ],
  },
  {
    id: 'retention',
    heading: 'Retention',
    body: [
      'Account and billing records are kept for the duration of your subscription and for seven years after the last payment, as required by Indian tax law.',
      'After cancellation, you can ask us to anonymise the account, in which case we keep only the minimum invoicing trail required by law.',
    ],
  },
  {
    id: 'security',
    heading: 'Security',
    body: [
      'Passwords are stored as hashed values; we never see them in cleartext. Data in transit is encrypted (TLS). Backups are encrypted at rest.',
      'If we ever detect a breach affecting your data, we will notify you within seventy-two hours and tell you exactly what was exposed.',
    ],
  },
  {
    id: 'children',
    heading: 'Children',
    body: [
      'This site is for adults reading about a professional industry. We do not knowingly collect data from anyone under sixteen, and we do not target the publication at children.',
    ],
  },
  {
    id: 'contact',
    heading: 'Contact',
    body: [
      'Questions about this policy? Write to venkat@stateofplay.club. The owner is the responsible point of contact for privacy matters.',
    ],
  },
];

export const PrivacyMockup = () => (
  <LegalLayout
    testId="mockup-privacy"
    kicker="Privacy Policy"
    updated="06 February 2026"
    title="Less data, kept carefully."
    subtitle="The shortest version we could write while still being honest about what we collect, and why."
    sections={SECTIONS}
  />
);

export default PrivacyMockup;
