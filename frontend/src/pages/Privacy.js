import { Mail, Shield } from 'lucide-react';

export const Privacy = () => {
  return (
    <div className="min-h-screen bg-background py-24">
      <div className="container mx-auto px-4 md:px-8 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-12">
          Privacy Policy
        </h1>

        <div className="prose prose-lg max-w-none font-body">
          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Data Collection</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            We collect your name, email address, and payment confirmation details from Razorpay. This information is necessary to manage your membership, send newsletters, and authenticate access.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Data Usage</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Your data is used solely for communication related to your subscription and account access. We do not sell, rent, or share personal information with advertisers or third parties.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Payments</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            All financial transactions are handled entirely by Razorpay. The State of Play does not store card or banking details.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Security</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            We take reasonable precautions to protect your personal information. Access to member data is restricted to authorized personnel for support and billing purposes only.
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Account Deletion</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Members can request deletion of their account or associated data by writing to{' '}
            <a href="mailto:venkat@stateofplay.club" className="text-primary hover:underline">
              venkat@stateofplay.club
            </a>
            .
          </p>

          <h2 className="text-2xl font-heading font-bold mt-8 mb-4">Policy Updates</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            We may update this Privacy Policy from time to time. Any changes will be reflected on this page and, when necessary, communicated by email.
          </p>

          <div className="bg-muted border border-primary/20 p-6 mt-8 flex items-start space-x-4">
            <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <p className="text-foreground mb-2">
                <strong>Questions about your data?</strong>
              </p>
              <p className="text-muted-foreground flex items-center">
                Contact us at{' '}
                <a href="mailto:venkat@stateofplay.club" className="text-primary hover:underline ml-1">
                  venkat@stateofplay.club
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
