import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { CheckCircle, Loader2, AlertCircle, Mail, ArrowRight, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

const API = process.env.REACT_APP_BACKEND_URL;

export const Welcome = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyMember } = useAuth();
  
  const [status, setStatus] = useState('idle'); // idle, verifying, success, error
  const [email, setEmail] = useState('');
  const [memberData, setMemberData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
  
  const emailFromUrl = searchParams.get('email');
  const maxAttempts = 8;
  const retryDelay = 3000;

  // If email is in URL, start verification immediately
  useEffect(() => {
    if (emailFromUrl) {
      setEmail(emailFromUrl);
      setStatus('verifying');
    }
  }, [emailFromUrl]);

  const doVerification = useCallback(async (emailToVerify) => {
    if (!emailToVerify) return;

    try {
      // First check if there's a recent payment via webhook
      const paymentCheckResponse = await fetch(`${API}/api/check-recent-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToVerify })
      });

      if (paymentCheckResponse.ok) {
        const paymentData = await paymentCheckResponse.json();
        
        if (paymentData.paid) {
          // Payment confirmed! Now verify with Ghost for full member data
          const result = await verifyMember(emailToVerify);
          
          if (result.success && result.member) {
            setMemberData(result.member);
            setStatus('success');
            
            // Celebrate!
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });

            // Redirect after celebration
            setTimeout(() => {
              navigate('/');
            }, 3500);
            return;
          }
        }
      }

      // If no recent payment, try direct Ghost verification
      const result = await verifyMember(emailToVerify);

      if (result.success && result.member.is_paid) {
        setMemberData(result.member);
        setStatus('success');
        
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        setTimeout(() => {
          navigate('/');
        }, 3500);
      } else if (attempts < maxAttempts) {
        // Payment might still be processing
        setAttempts(prev => prev + 1);
        setTimeout(() => doVerification(emailToVerify), retryDelay);
      } else {
        setStatus('error');
        setErrorMessage('We couldn\'t verify your subscription yet. It may take a few minutes for payment to process. Please try again or check your email.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      if (attempts < maxAttempts) {
        setAttempts(prev => prev + 1);
        setTimeout(() => doVerification(emailToVerify), retryDelay);
      } else {
        setStatus('error');
        setErrorMessage('Something went wrong. Please try again or contact support.');
      }
    }
  }, [attempts, verifyMember, navigate]);

  // Auto-verify when status changes to verifying
  useEffect(() => {
    if (status === 'verifying' && email) {
      doVerification(email);
    }
  }, [status, email, doVerification]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setStatus('verifying');
      setAttempts(0);
      setErrorMessage('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        
        {/* Idle State - Email Input Form */}
        {status === 'idle' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">Activate Your Subscription</h1>
            <p className="text-muted-foreground mb-8">
              Enter the email you used during payment to get instant access.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-center text-lg py-6"
                required
                autoFocus
              />
              <Button type="submit" className="w-full py-6 text-lg" disabled={!email}>
                Activate Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>

            <p className="text-sm text-muted-foreground mt-6">
              Already have an account?{' '}
              <button 
                onClick={() => navigate('/login')}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        )}

        {/* Verifying State */}
        {status === 'verifying' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Activating your account...</h1>
            <p className="text-muted-foreground mb-4">
              Just a moment while we verify your subscription.
            </p>
            <div className="flex justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i < Math.min(attempts, 5) ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && memberData && (
          <div className="text-center">
            <div className="mb-6">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">Welcome aboard! 🎉</h1>
            <p className="text-xl text-muted-foreground mb-6">
              {memberData.name ? `Great to have you, ${memberData.name.split(' ')[0]}!` : 'Your subscription is now active!'}
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-1">Subscribed as</p>
              <p className="font-medium">{memberData.email}</p>
              <span className="inline-block mt-2 text-xs bg-primary text-white px-2 py-1 rounded font-bold">
                PRO MEMBER
              </span>
            </div>

            <p className="text-muted-foreground mb-6">
              Redirecting you to the latest stories...
            </p>

            <Button onClick={() => navigate('/')} className="w-full">
              Start Reading
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="h-20 w-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto">
                <Mail className="h-10 w-10 text-yellow-600 dark:text-yellow-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Almost there!</h1>
            <p className="text-muted-foreground mb-6">{errorMessage}</p>
            
            <div className="space-y-3">
              <Button 
                className="w-full"
                onClick={() => {
                  setStatus('verifying');
                  setAttempts(0);
                }}
              >
                Try Again
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStatus('idle');
                  setAttempts(0);
                  setErrorMessage('');
                }}
              >
                Use Different Email
              </Button>
              <Button 
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-6">
              Need help?{' '}
              <a href="mailto:hello@stateofplay.club" className="text-primary hover:underline">
                Contact support
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Welcome;
