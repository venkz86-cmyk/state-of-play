import { Check, X, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export const Membership = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-primary-50/30 to-white">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block bg-primary/10 border border-primary/20 px-4 py-2 mb-6">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-primary">Membership Benefits</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-heading font-black tracking-tight leading-tight mb-6">
            Choose your access level
          </h1>
          <p className="text-xl leading-relaxed text-foreground/70 font-body max-w-2xl mx-auto">
            Get unlimited access to premium sports business journalism
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
          {/* Free */}
          <div className="bg-white border-2 border-border p-8 hover:shadow-xl transition-shadow">
            <div className="mb-6">
              <h3 className="text-2xl font-heading font-bold mb-2">Free Access</h3>
              <div className="text-4xl font-heading font-black mb-2">
                ₹0<span className="text-lg font-body text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Access to The Left Field</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Free stories from The Left Field</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Published twice weekly</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Newsletter access</span>
              </li>
              <li className="flex items-start space-x-2">
                <X className="h-5 w-5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Premium stories</span>
              </li>
              <li className="flex items-start space-x-2">
                <X className="h-5 w-5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Exclusive interviews</span>
              </li>
              <li className="flex items-start space-x-2">
                <X className="h-5 w-5 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Deep dives & analysis</span>
              </li>
            </ul>

            <Link to="/left-field">
              <Button 
                variant="outline"
                size="lg"
                className="w-full border-2 border-secondary text-secondary hover:bg-secondary hover:text-white font-semibold"
              >
                Read Free Stories
              </Button>
            </Link>
          </div>

          {/* Premium */}
          <div className="bg-primary text-white border-2 border-primary-700 p-8 relative hover:shadow-2xl transition-shadow">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-premium text-white text-xs font-bold uppercase tracking-widest px-4 py-1">
              Best Value
            </div>
            
            <div className="mb-6">
              <h3 className="text-2xl font-heading font-bold mb-2">Premium Access</h3>
              <div className="text-4xl font-heading font-black mb-2">
                ₹999<span className="text-lg font-body text-white/70">/year</span>
              </div>
              <p className="text-sm text-white/70">Full access to The State of Play</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-sm">Everything in Free</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-sm font-semibold">Unlimited premium stories</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-sm font-semibold">Exclusive interviews</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-sm font-semibold">In-depth analysis & deep dives</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-sm">Early access to breaking news</span>
              </li>
              <li className="flex items-start space-x-2">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-sm">Ad-free reading experience</span>
              </li>
            </ul>

            <Link to="/signup">
              <Button 
                size="lg"
                className="w-full bg-white text-primary hover:bg-gray-100 font-bold transition-all hover:shadow-xl"
              >
                Subscribe Now
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white border-2 border-primary/20 p-12 max-w-4xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center mb-10">Why subscribe?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary/10 p-4 rounded-full mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-2">Exclusive Access</h3>
              <p className="text-sm text-foreground/70">
                Stories and insights you won't find anywhere else
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary/10 p-4 rounded-full mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-2">Deep Reporting</h3>
              <p className="text-sm text-foreground/70">
                Rigorous journalism that goes beyond headlines
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary/10 p-4 rounded-full mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-2">Industry Impact</h3>
              <p className="text-sm text-foreground/70">
                Stories that influence decision-makers
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
