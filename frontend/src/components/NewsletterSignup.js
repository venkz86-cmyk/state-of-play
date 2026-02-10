import { useState } from 'react';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';

export const NewsletterSignup = ({ variant = 'default' }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Open Ghost subscription page with email pre-filled
    setTimeout(() => {
      window.open(`https://the-state-of-play.ghost.io/#/portal/signup?email=${encodeURIComponent(email)}`, '_blank');
      setSubmitted(true);
      setLoading(false);
    }, 500);
  };

  if (submitted) {
    return (
      <div className={`${variant === 'inline' ? 'p-4' : 'p-8'} bg-secondary/10 border border-secondary/20 text-center`}>
        <p className="text-secondary font-semibold">Check your email to confirm! ✓</p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="bg-muted border-2 border-primary/20 p-6">
        <div className="flex items-start space-x-3 mb-4">
          <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm mb-1">Get notified when we publish</p>
            <p className="text-xs text-muted-foreground">New stories delivered to your inbox every Friday.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            className="flex-1 px-3 py-2 border border-border bg-background text-foreground text-sm focus:border-primary outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-primary text-white p-10">
      <div className="text-center max-w-md mx-auto">
        <div className="inline-flex items-center justify-center bg-white/20 p-3 rounded-full mb-4">
          <Mail className="h-6 w-6" />
        </div>
        <h3 className="text-2xl font-heading font-bold mb-2">Don't miss a story</h3>
        <p className="text-white/80 text-sm mb-6">
          Get notified every Friday when we publish a new deep dive on Indian sports business.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            className="flex-1 px-4 py-3 bg-white/10 border border-white/30 text-white placeholder-white/60 focus:border-white outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-primary px-6 py-3 font-bold hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span>Sign Up Free</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
        <p className="text-xs text-white/60 mt-4">Free to join. Upgrade anytime for full access.</p>
      </div>
    </div>
  );
};
