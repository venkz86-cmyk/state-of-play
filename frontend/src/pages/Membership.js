import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export const Membership = () => {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl py-20">
        {/* Header */}
        <div className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-heading font-black tracking-tight leading-tight mb-6">
            Choose your membership
          </h1>
          <p className="text-xl leading-relaxed text-foreground/70 font-body max-w-2xl mx-auto">
            Get unlimited access to premium sports business journalism
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-24">
          {/* Free */}
          <div className="bg-white border-2 border-border p-10 hover:shadow-xl transition-all">
            <div className="mb-8">
              <div className="inline-block bg-secondary/10 text-secondary text-xs font-bold uppercase tracking-wider px-3 py-1 mb-4 font-mono">
                Free
              </div>
              <h3 className="text-3xl font-heading font-bold mb-3">The Left Field</h3>
              <div className="text-5xl font-heading font-black mb-3">
                ₹0<span className="text-xl font-body text-muted-foreground font-normal">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">Free stories, twice weekly</p>
            </div>

            <ul className="space-y-4 mb-10">
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-base">Free stories from The Left Field</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-base">Published twice weekly</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-base">Newsletter access</span>
              </li>
              <li className="flex items-start space-x-3">
                <X className="h-5 w-5 text-muted-foreground/30 mt-0.5 flex-shrink-0" />
                <span className="text-base text-muted-foreground">Premium stories</span>
              </li>
              <li className="flex items-start space-x-3">
                <X className="h-5 w-5 text-muted-foreground/30 mt-0.5 flex-shrink-0" />
                <span className="text-base text-muted-foreground">Exclusive interviews</span>
              </li>
              <li className="flex items-start space-x-3">
                <X className="h-5 w-5 text-muted-foreground/30 mt-0.5 flex-shrink-0" />
                <span className="text-base text-muted-foreground">Deep dives & analysis</span>
              </li>
            </ul>

            <a href="https://theleftfield.substack.com" target="_blank" rel="noopener noreferrer">
              <Button 
                variant="outline"
                size="lg"
                className="w-full border-2 border-secondary text-secondary hover:bg-secondary hover:text-white font-semibold text-base py-6"
              >
                Read on Substack →
              </Button>
            </a>
          </div>

          {/* Premium */}
          <div className="bg-primary text-white p-10 relative hover:shadow-2xl transition-all">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-premium text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 font-mono shadow-lg">
              Best Value
            </div>
            
            <div className="mb-8">
              <div className="inline-block bg-white/20 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 mb-4 font-mono">
                Premium
              </div>
              <h3 className="text-3xl font-heading font-bold mb-3">The State of Play</h3>
              <div className="text-5xl font-heading font-black mb-2">
                ₹2,499<span className="text-xl font-body text-white/70 font-normal">/year</span>
              </div>
              <p className="text-sm text-white/80 mb-1">+ GST (for Indian readers)</p>
              <p className="text-sm text-white/80">$120/year (International)</p>
            </div>

            <ul className="space-y-4 mb-10">
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-base font-medium">Everything in Free</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-base font-semibold">Unlimited premium stories</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-base font-semibold">Exclusive interviews</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-base font-semibold">In-depth analysis & deep dives</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-base">Early access to breaking news</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-premium mt-0.5 flex-shrink-0" />
                <span className="text-base">Ad-free reading experience</span>
              </li>
            </ul>

            <Link to="/signup">
              <Button 
                size="lg"
                className="w-full bg-white text-primary hover:bg-gray-50 font-bold text-base py-6 transition-all hover:shadow-xl"
              >
                Subscribe Now
              </Button>
            </Link>
          </div>
        </div>

        {/* Why Subscribe */}
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-heading font-bold mb-12">Why subscribe to The State of Play?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="text-5xl font-heading font-black text-primary mb-3">01</div>
              <h3 className="font-heading font-bold text-xl mb-3">Original Reporting</h3>
              <p className="text-base text-foreground/70 leading-relaxed">
                Deeply reported stories you won't find anywhere else
              </p>
            </div>
            <div>
              <div className="text-5xl font-heading font-black text-primary mb-3">02</div>
              <h3 className="font-heading font-bold text-xl mb-3">Expert Analysis</h3>
              <p className="text-base text-foreground/70 leading-relaxed">
                Sharp insights into the business dynamics of Indian sports
              </p>
            </div>
            <div>
              <div className="text-5xl font-heading font-black text-primary mb-3">03</div>
              <h3 className="font-heading font-bold text-xl mb-3">Independent Voice</h3>
              <p className="text-base text-foreground/70 leading-relaxed">
                Unbiased journalism without influence or agenda
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
