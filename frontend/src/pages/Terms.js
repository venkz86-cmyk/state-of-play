import { Mail } from 'lucide-react';

export const Terms = () => {
  return (
    <div className="min-h-screen bg-white py-24">
      <div className="container mx-auto px-4 md:px-8 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-12">
          Terms of Service
        </h1>

        <div className="prose prose-lg max-w-none font-body">
          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Membership</h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            The State of Play offers annual memberships billed securely through Razorpay. Each membership grants one user access to all paid content, archives, and newsletters. Memberships renew automatically unless cancelled before the renewal date.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Payments and Refunds</h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            All payments are processed via Razorpay. We do not store or process payment information directly. Annual plans are non-refundable once payment is completed.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Content Usage</h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            All editorial material, including newsletters, analysis, and reports, is owned by The State of Play. Redistribution, reproduction, or sharing of paid content is not permitted without written consent. Members may share free or public posts with attribution.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Cancellation</h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            You can cancel your membership anytime by contacting{' '}
            <a href="mailto:venkat@stateofplay.club" className="text-primary hover:underline">
              venkat@stateofplay.club
            </a>
            . Cancellation stops future renewals but does not trigger a refund for the current billing cycle.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Changes to Terms</h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            We may revise these terms periodically to reflect updates in policy, pricing, or functionality. Continued use of the service after such updates implies acceptance of the new terms.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Contact</h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            For questions about subscriptions, privacy, or terms of use:
          </p>
          
          <div className="bg-primary-50 border border-primary/20 p-6 mt-4">
            <p className="text-foreground/80 mb-2">
              <strong>Legal entity name:</strong> Left Field Ventures
            </p>
            <p className="text-foreground/80 mb-2">
              <strong>Registered Address:</strong> Ground Floor, 36, Infantry Road, Tasker Town, Shivaji Nagar, Bengaluru, Karnataka 560001, India
            </p>
            <p className="text-foreground/80 mb-2">
              <strong>Operational Address:</strong> Ground Floor, 36, Infantry Road, Tasker Town, Shivaji Nagar, Bengaluru, Karnataka 560001, India
            </p>
            <p className="text-foreground/80 flex items-center">
              <Mail className="h-4 w-4 mr-2 text-primary" />
              <strong>Email:</strong>{' '}
              <a href="mailto:venkat@stateofplay.club" className="text-primary hover:underline ml-1">
                venkat@stateofplay.club
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
