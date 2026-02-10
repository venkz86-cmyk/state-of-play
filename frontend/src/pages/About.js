import { Check, TrendingUp, Shield, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export const About = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-primary-50 border-b-2 border-primary/10">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl py-20 md:py-28">
          <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight leading-tight mb-6 text-center">
            About The State of Play
          </h1>
          <p className="text-xl md:text-2xl leading-relaxed text-foreground/70 font-body text-center max-w-3xl mx-auto">
            India's premium publication covering the business of sport with depth, insight, and unmatched reporting.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <div className="bg-white border-2 border-primary/20 p-12 mb-16">
            <h2 className="text-3xl font-heading font-bold mb-6">Our Mission</h2>
            <p className="text-lg leading-relaxed text-foreground/80 font-body mb-4">
              The State of Play exists to bridge the gap between sports and business journalism in India. We believe that understanding the business mechanics behind sports is essential to appreciating the games we love.
            </p>
            <p className="text-lg leading-relaxed text-foreground/80 font-body">
              Through rigorous reporting, exclusive access, and deep analysis, we uncover the financial strategies, business deals, and economic forces shaping Indian sports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary text-white p-4 rounded-full mb-4">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">Data-Driven</h3>
              <p className="text-sm text-foreground/70">Numbers, trends, and insights that matter</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary text-white p-4 rounded-full mb-4">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">Independent</h3>
              <p className="text-sm text-foreground/70">Unbiased reporting without agenda</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary text-white p-4 rounded-full mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">Exclusive</h3>
              <p className="text-sm text-foreground/70">Stories you won't find anywhere else</p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-heading font-bold mb-8">What We Cover</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">IPL Economics</h4>
                  <p className="text-sm text-foreground/70">Franchise valuations, media rights, player economics</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">Sports Tech</h4>
                  <p className="text-sm text-foreground/70">Startups, platforms, and digital transformation</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">Broadcasting</h4>
                  <p className="text-sm text-foreground/70">Media rights, streaming wars, viewership trends</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">Governance</h4>
                  <p className="text-sm text-foreground/70">BCCI, IOA, federations, and policy</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">Sponsorships</h4>
                  <p className="text-sm text-foreground/70">Brand deals, endorsements, activation strategies</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">Infrastructure</h4>
                  <p className="text-sm text-foreground/70">Stadiums, facilities, real estate plays</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-700 to-primary-900 text-white">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
            Join thousands of informed readers
          </h2>
          <p className="text-xl leading-relaxed text-white/90 font-body mb-10 max-w-2xl mx-auto">
            Subscribe today and get access to premium stories that decode the business of Indian sports.
          </p>
          <Link to="/signup">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-gray-100 font-bold px-10 py-6 text-base transition-all hover:shadow-2xl hover:scale-105"
            >
              Start Your Subscription
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
