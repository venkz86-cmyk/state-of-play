import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AlertCircle, Mail, CheckCircle2 } from 'lucide-react';

export const Signup = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { sendMagicLink } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await sendMagicLink(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center py-24 px-4 bg-gradient-to-br from-primary-50/30 via-white to-white">
        <div className="w-full max-w-md">
          <div className="bg-white border-2 border-primary/20 p-10 shadow-xl text-center">
            <div className="inline-flex items-center justify-center bg-secondary/10 p-4 rounded-full mb-6">
              <Mail className="h-10 w-10 text-secondary" />
            </div>
            
            <h1 className="text-3xl font-heading font-bold tracking-tight mb-4">Check your email</h1>
            
            <p className="text-base text-foreground/70 font-body mb-2">
              We've sent a secure login link to:
            </p>
            <p className="text-lg font-bold text-primary mb-6">{email}</p>
            
            <div className="bg-primary-50 border border-primary/20 p-4 mb-6 text-left">
              <p className="text-sm text-foreground/80 font-body leading-relaxed">
                Click the link in your email to complete signup and access your account.
              </p>
            </div>

            <button
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
              className="text-sm text-primary hover:underline font-semibold"
            >
              Didn't receive it? Try again →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-24 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Subscribe to The State of Play</h1>
          <p className="text-base text-muted-foreground font-body">Get unlimited access to premium sports business journalism</p>
        </div>

        {/* Important Email Notice */}
        <div className="bg-accent/10 border-2 border-accent/30 p-4 mb-6" data-testid="email-notice">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground mb-1">Important: Use the same email</p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                The email you enter here must match the email you'll use for Razorpay payment. This ensures your subscription activates correctly.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="signup-form">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium font-body">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white border-2 border-border focus:border-primary px-4 py-3 outline-none transition-colors w-full font-body"
              placeholder="your@email.com"
              data-testid="input-email"
            />
            <p className="text-xs text-muted-foreground">We'll send you a secure login link</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white hover:bg-primary-700 font-bold py-6 text-base transition-all hover:shadow-xl"
            data-testid="btn-signup-submit"
          >
            {loading ? 'Sending...' : 'Continue to Payment'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-start space-x-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-sm text-foreground/70">Unlimited premium stories</p>
          </div>
          <div className="flex items-start space-x-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-sm text-foreground/70">Exclusive interviews & analysis</p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
            <p className="text-sm text-foreground/70">Ad-free reading experience</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground font-body mt-6">
          Already a member?{' '}
          <button onClick={() => navigate('/login')} className="text-primary hover:underline font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
