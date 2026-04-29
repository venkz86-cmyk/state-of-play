import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export const Login = () => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // 'email', 'verifying', 'success', 'error'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { verifyMember } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setStep('verifying');
    setError('');
    
    try {
      // First check if there's a recent payment (for new subscribers)
      const paymentCheckResponse = await fetch(`${API}/api/check-recent-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (paymentCheckResponse.ok) {
        const paymentData = await paymentCheckResponse.json();
        
        if (paymentData.paid) {
          // Recent payment found - verify and login
          const result = await verifyMember(email);
          
          if (result.success && result.member) {
            const firstName = result.member?.name?.split(' ')[0] || 'there';
            toast.success(`Welcome, ${firstName}!`);
            setStep('success');
            setTimeout(() => navigate('/'), 2000);
            return;
          }
        }
      }

      // No recent payment - try direct Ghost verification
      const result = await verifyMember(email);
      
      if (result.success) {
        const firstName = result.member?.name?.split(' ')[0] || 'there';
        toast.success(`Welcome back, ${firstName}!`);
        setStep('success');
        setTimeout(() => navigate('/'), 2000);
      } else {
        setError(result.error || 'We couldn\'t find an active subscription for this email.');
        setStep('error');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
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
              Signed in as <strong className="text-primary">{email}</strong>
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
            
            <h1 className="text-3xl font-heading font-bold tracking-tight mb-4">Unable to sign in</h1>
            
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

  // Verifying state
  if (step === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="w-full max-w-md">
          <div className="bg-card border-2 border-primary/20 p-10 shadow-xl text-center">
            <div className="inline-flex items-center justify-center bg-primary/10 p-4 rounded-full mb-6">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
            
            <h1 className="text-2xl font-heading font-bold tracking-tight mb-4">Signing you in...</h1>
            
            <p className="text-base text-muted-foreground font-body">
              Verifying <strong className="text-primary">{email}</strong>
            </p>
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

          <form onSubmit={handleSubmit} className="space-y-6">
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
              disabled={loading || !email}
              className="w-full bg-primary text-white hover:bg-primary/90 font-bold py-6 text-base transition-all hover:shadow-xl"
              data-testid="btn-continue"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
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
