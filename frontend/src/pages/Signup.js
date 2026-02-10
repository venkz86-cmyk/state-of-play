import { useGeoPricing } from '../hooks/useGeoPricing';
import { RazorpayButton } from '../components/RazorpayButton';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Signup = () => {
  const pricing = useGeoPricing();

  return (
    <div className="min-h-screen flex items-center justify-center py-24 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Subscribe to The State of Play</h1>
          <p className="text-base text-muted-foreground font-body">Get unlimited access to premium sports business journalism</p>
        </div>

        {/* Important Email Notice */}
        <div className="bg-accent/10 border-2 border-accent/30 p-5 mb-6" data-testid="email-notice">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground mb-1">Important: Email Matching</p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                Use the same email in the Razorpay payment form that you want to use for accessing premium content. Your subscription will be linked to this email.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Display */}
        <div className="bg-white border-2 border-primary/20 p-8 mb-6 text-center">
          {pricing.loading ? (
            <div className="py-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Loading pricing...</p>
            </div>
          ) : (
            <>
              <div className="text-5xl font-heading font-black text-primary mb-2">
                {pricing.symbol}{pricing.amount}
                <span className="text-xl font-body text-muted-foreground font-normal">/year</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{pricing.note}</p>
            </>
          )}
          
          {/* Razorpay Payment Button */}
          <RazorpayButton className="mb-4" />
          
          <p className="text-xs text-muted-foreground">
            Secured by Razorpay • Annual subscription
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-sm text-foreground/70">Unlimited premium stories</p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-sm text-foreground/70">Exclusive interviews & analysis</p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-sm text-foreground/70">Ad-free reading experience</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground font-body">
          Already a subscriber?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>

        {/* How it works */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-sm font-bold mb-3">What happens next?</h3>
          <ol className="space-y-2 text-xs text-foreground/70">
            <li>1. Complete payment via Razorpay</li>
            <li>2. Your account is created automatically</li>
            <li>3. Check your email for a verification link</li>
            <li>4. Click the link to access premium content</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
