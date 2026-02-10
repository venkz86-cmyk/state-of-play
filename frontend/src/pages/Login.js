import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Mail, AlertCircle, ExternalLink } from 'lucide-react';

const GHOST_URL = process.env.REACT_APP_GHOST_URL;

export const Login = () => {
  const [email, setEmail] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Show instructions for using Ghost's native login
    setShowInstructions(true);
  };

  if (showInstructions) {
    return (
      <div className="min-h-screen flex items-center justify-center py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="w-full max-w-md">
          <div className="bg-card border-2 border-primary/20 p-10 shadow-xl text-center">
            <div className="inline-flex items-center justify-center bg-primary/10 p-4 rounded-full mb-6">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            
            <h1 className="text-3xl font-heading font-bold tracking-tight mb-4">Sign In</h1>
            
            <p className="text-base text-muted-foreground font-body mb-6">
              To access your account at <strong className="text-primary">{email}</strong>:
            </p>
            
            <div className="bg-muted border border-primary/20 p-5 mb-6 text-left space-y-4">
              <div>
                <p className="text-sm font-bold mb-2">Step 1: Open the sign-in portal</p>
                <a 
                  href={`${GHOST_URL}/#/portal/signin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full bg-primary text-white px-4 py-3 font-semibold hover:bg-primary/90 transition-colors"
                >
                  Open Sign-in Portal <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </div>
              
              <div>
                <p className="text-sm font-bold mb-1">Step 2: Enter your email & verification code</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter <strong>{email}</strong>, then check your inbox for a 6-digit code.
                </p>
              </div>
              
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-bold mb-1">Step 3: Return here after signing in</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Once you've entered the code, come back to this site to read premium content.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Link 
                to="/"
                className="inline-flex items-center justify-center w-full bg-secondary text-white px-4 py-3 font-semibold hover:bg-secondary/90 transition-colors"
              >
                I've signed in — Take me to articles
              </Link>
              
              <button
                onClick={() => {
                  setShowInstructions(false);
                  setEmail('');
                }}
                className="text-sm text-primary hover:underline font-semibold"
              >
                ← Try a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-24 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Welcome back</h1>
          <p className="text-base text-muted-foreground font-body">Sign in to your account</p>
        </div>

        {/* Important Email Notice */}
        <div className="bg-accent/10 border-2 border-accent/30 p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground mb-1">Use your payment email</p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                Sign in with the same email you used for your Razorpay subscription.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium font-body">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background border-2 border-border focus:border-primary px-4 py-3 outline-none transition-colors w-full font-body"
              placeholder="your@email.com"
              data-testid="input-email"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-white hover:bg-primary-700 font-bold py-6 text-base transition-all hover:shadow-xl"
            data-testid="btn-login-submit"
          >
            Continue
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground font-body mt-6">
          New to The State of Play?{' '}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            Subscribe now
          </Link>
        </p>
      </div>
    </div>
  );
};
