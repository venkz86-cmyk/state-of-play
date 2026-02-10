import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Mail, ExternalLink, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const GHOST_URL = process.env.REACT_APP_GHOST_URL;

export const Login = () => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // 'email', 'verify', 'success', 'error'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { verifyMember } = useAuth();
  const navigate = useNavigate();

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setStep('verify');
  };

  const handleVerifyMembership = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await verifyMember(email);
      
      if (result.success) {
        setStep('success');
        // Redirect after 2 seconds
        setTimeout(() => navigate('/'), 2000);
      } else {
        setError(result.error);
        setStep('error');
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="w-full max-w-md">
          <div className="bg-card border-2 border-green-500/20 p-10 shadow-xl text-center">
            <div className="inline-flex items-center justify-center bg-green-500/10 p-4 rounded-full mb-6">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            
            <h1 className="text-3xl font-heading font-bold tracking-tight mb-4">Welcome back!</h1>
            
            <p className="text-base text-muted-foreground font-body mb-6">
              You're now signed in as <strong className="text-primary">{email}</strong>
            </p>
            
            <p className="text-sm text-muted-foreground">Redirecting to articles...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="w-full max-w-md">
          <div className="bg-card border-2 border-red-500/20 p-10 shadow-xl text-center">
            <div className="inline-flex items-center justify-center bg-red-500/10 p-4 rounded-full mb-6">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            
            <h1 className="text-3xl font-heading font-bold tracking-tight mb-4">Unable to verify</h1>
            
            <p className="text-base text-muted-foreground font-body mb-6">{error}</p>
            
            <div className="space-y-3">
              <Link to="/signup">
                <Button className="w-full bg-primary text-white hover:bg-primary/90 font-semibold">
                  Subscribe Now
                </Button>
              </Link>
              
              <button
                onClick={() => {
                  setStep('email');
                  setEmail('');
                  setError('');
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

  // Verification step
  if (step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="w-full max-w-md">
          <div className="bg-card border-2 border-primary/20 p-10 shadow-xl text-center">
            <div className="inline-flex items-center justify-center bg-primary/10 p-4 rounded-full mb-6">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            
            <h1 className="text-3xl font-heading font-bold tracking-tight mb-4">Verify Your Membership</h1>
            
            <p className="text-base text-muted-foreground font-body mb-6">
              Signing in as <strong className="text-primary">{email}</strong>
            </p>
            
            <div className="bg-muted border border-primary/20 p-5 mb-6 text-left space-y-4">
              <div>
                <p className="text-sm font-bold mb-2">Step 1: Complete Ghost sign-in</p>
                <a 
                  href={`${GHOST_URL}/#/portal/signin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full bg-primary text-white px-4 py-3 font-semibold hover:bg-primary/90 transition-colors"
                >
                  Open Sign-in Portal <ExternalLink className="h-4 w-4 ml-2" />
                </a>
                <p className="text-xs text-muted-foreground mt-2">
                  Enter your email and the 6-digit code sent to your inbox.
                </p>
              </div>
              
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-bold mb-2">Step 2: Verify on this site</p>
                <p className="text-xs text-muted-foreground mb-3">
                  After signing in on Ghost, click below to verify your membership here.
                </p>
                <Button
                  onClick={handleVerifyMembership}
                  disabled={loading}
                  className="w-full bg-secondary text-white hover:bg-secondary/90 font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "I've signed in — Verify my membership"
                  )}
                </Button>
              </div>
            </div>

            <button
              onClick={() => {
                setStep('email');
                setEmail('');
              }}
              className="text-sm text-primary hover:underline font-semibold"
            >
              ← Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Email entry step (default)
  return (
    <div className="min-h-screen flex items-center justify-center py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="w-full max-w-md">
        <div className="bg-card border-2 border-primary/20 p-10 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-bold tracking-tight mb-2">Welcome back</h1>
            <p className="text-muted-foreground font-body">
              Sign in to access premium content
            </p>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold font-body">Email address</label>
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
              size="lg"
              className="w-full bg-primary text-white hover:bg-primary/90 font-bold py-6 text-base transition-all hover:shadow-xl"
              data-testid="btn-continue"
            >
              Continue
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground font-body mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline font-semibold">
              Subscribe now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
