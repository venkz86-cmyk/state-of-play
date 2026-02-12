import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { CheckCircle, Loader2, AlertCircle, Mail, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

export const Welcome = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyMember } = useAuth();
  
  const [status, setStatus] = useState('verifying'); // verifying, success, pending, error
  const [attempts, setAttempts] = useState(0);
  const [memberData, setMemberData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  const email = searchParams.get('email');
  const maxAttempts = 10; // Try for ~30 seconds
  const retryDelay = 3000; // 3 seconds between retries

  const doVerification = useCallback(async () => {
    if (!email) {
      setStatus('error');
      setErrorMessage('No email provided');
      return;
    }

    try {
      const result = await verifyMember(email);

      if (result.success && result.member.is_paid) {
        // Success! Member found and is paid
        setMemberData(result.member);
        setStatus('success');

        // Celebrate!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Redirect after a moment
        setTimeout(() => {
          navigate('/');
        }, 3000);

      } else if (result.success && !result.member.is_paid) {
        // Member exists but not paid yet - might be processing
        if (attempts < maxAttempts) {
          setStatus('pending');
          setAttempts(prev => prev + 1);
        } else {
          setStatus('error');
          setErrorMessage('Payment is still processing. Please check your email for confirmation.');
        }
      } else {
        // Not a member yet - payment might still be processing
        if (attempts < maxAttempts) {
          setStatus('pending');
          setAttempts(prev => prev + 1);
        } else {
          setStatus('error');
          setErrorMessage(result.error || 'We couldn\'t find your subscription. Please check your email or contact support.');
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
      if (attempts < maxAttempts) {
        setStatus('pending');
        setAttempts(prev => prev + 1);
      } else {
        setStatus('error');
        setErrorMessage('Something went wrong. Please try logging in manually.');
      }
    }
  }, [email, attempts, verifyMember, navigate]);

  // Initial verification and retries
  useEffect(() => {
    if (status === 'verifying' || status === 'pending') {
      const timer = setTimeout(() => {
        doVerification();
      }, status === 'verifying' ? 0 : retryDelay);

      return () => clearTimeout(timer);
    }
  }, [status, doVerification]);

  // No email provided
  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
          <p className="text-muted-foreground mb-6">
            This link appears to be invalid. Please try subscribing again.
          </p>
          <Button onClick={() => navigate('/signup')}>
            Go to Subscribe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        
        {/* Verifying / Pending State */}
        {(status === 'verifying' || status === 'pending') && (
          <div className="text-center">
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Setting up your account...</h1>
            <p className="text-muted-foreground mb-4">
              Just a moment while we activate your subscription.
            </p>
            <div className="flex justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < Math.min(attempts, 5) ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {email}
            </p>
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
              {memberData.name ? `Great to have you, ${memberData.name.split(' ')[0]}!` : 'Your subscription is active!'}
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
            <p className="text-muted-foreground mb-6">
              {errorMessage}
            </p>
            
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setStatus('verifying');
                  setAttempts(0);
                }}
              >
                Try Again
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
              Need help? Contact us at{' '}
              <a href="mailto:hello@stateofplay.club" className="text-primary hover:underline">
                hello@stateofplay.club
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Welcome;
