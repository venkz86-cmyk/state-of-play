import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Building2, 
  Briefcase, 
  TrendingUp,
  Mail
} from 'lucide-react';

/* =============================================================================
   TEAMS SALES PAGE - /teams
   Corporate subscription sales page with pricing, features, and FAQs
   ============================================================================= */

export const Teams = () => {
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Scroll to pricing section
  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // FAQ data
  const faqs = [
    {
      question: 'How does team access work?',
      answer: 'You pay for X seats, then use our dashboard to add team members by email. Each member gets a Ghost login link to access all content.'
    },
    {
      question: 'Can we add/remove members?',
      answer: 'Yes! Use the team dashboard to add or remove members anytime. Changes take effect immediately.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit/debit cards and UPI via Razorpay. International customers can pay via card.'
    },
    {
      question: 'How does renewal work?',
      answer: 'Founding customers who sign up before June 30, 2026 get Year 1 at the founding rate, then a gentle increase in Year 2 (still below standard pricing).'
    }
  ];

  // Features list
  const features = [
    'Weekly premium analysis (TSOP)',
    'Bi-weekly news briefs (Left Field)',
    'Full archive access',
    'Breaking news alerts',
    'Centralized billing',
    'GST-compliant invoicing',
    'Self-serve team management',
    'Priority email support'
  ];

  // Who it's for data
  const audiences = [
    {
      icon: Building2,
      title: 'IPL Franchises',
      description: 'Track competitor deals, benchmark valuations, inform M&A strategy'
    },
    {
      icon: Briefcase,
      title: 'Sports Agencies',
      description: 'Brief clients on market trends, identify partnership opportunities'
    },
    {
      icon: TrendingUp,
      title: 'VC/PE Funds',
      description: 'Deal flow intelligence, sector analysis, investment thesis development'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      
      {/* =========================================================================
          SECTION 1: HERO
          ========================================================================= */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-b border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black tracking-tight leading-tight mb-6">
            The State of Play <span className="text-primary">for Teams</span>
          </h1>
          <p className="text-lg md:text-xl text-foreground/70 font-body leading-relaxed max-w-2xl mx-auto mb-10">
            One subscription, your whole team stays informed. Volume pricing with centralized management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={scrollToPricing}
              className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-white font-bold px-8 py-4 text-lg transition-all duration-300 hover:shadow-lg"
              data-testid="hero-view-plans"
            >
              View Plans
            </button>
            <a
              href="mailto:venkat@stateofplay.club?subject=Corporate Subscription Inquiry"
              className="inline-flex items-center justify-center border-2 border-primary text-primary hover:bg-primary hover:text-white font-bold px-8 py-4 text-lg transition-all duration-300"
              data-testid="hero-contact-sales"
            >
              <Mail className="w-5 h-5 mr-2" />
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: SOCIAL PROOF
          ========================================================================= */}
      <section className="py-8 border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center">
          <p className="text-base md:text-lg text-foreground/70 italic font-body">
            Cited by{' '}
            <span className="text-primary font-semibold not-italic">Bloomberg</span>,{' '}
            <span className="text-primary font-semibold not-italic">SportBusiness</span>,{' '}
            <span className="text-primary font-semibold not-italic">ESPNCricinfo</span>,{' '}
            <span className="text-primary font-semibold not-italic">The Athletic</span>,{' '}
            <span className="text-primary font-semibold not-italic">SportsPro</span>,{' '}
            and leading sports and business media globally.
          </p>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: PRICING TABLE
          ========================================================================= */}
      <section id="pricing" className="py-16 md:py-24 scroll-mt-8">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-4">
            Team Plans
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Volume pricing for organizations. All plans include full access to TSOP and The Left Field.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Team-5 Card */}
            <div 
              className="relative bg-card border border-border p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              data-testid="pricing-team-5"
            >
              {/* Founding Rate Badge */}
              <div className="absolute top-4 left-4">
                <span className="bg-accent text-white text-xs font-bold px-3 py-1 uppercase tracking-wider">
                  Founding Rate
                </span>
              </div>

              <div className="pt-8">
                <h3 className="text-2xl font-heading font-bold mb-2">Team-5</h3>
                <p className="text-muted-foreground mb-6">5 seats for your team</p>

                <div className="mb-6">
                  <div className="text-4xl font-heading font-black text-primary">
                    ₹10,000
                    <span className="text-lg font-body text-muted-foreground font-normal"> + GST/year</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ₹2,000 per seat <span className="text-accent font-semibold">(20% off individual)</span>
                  </p>
                  <p className="text-sm text-green-600 font-medium mt-2">
                    Save ₹2,495 vs individual subscriptions
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Weekly TSOP newsletter</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Bi-weekly Left Field briefs</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Full archive access</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Centralized billing & management</span>
                  </li>
                </ul>

                <a
                  href="https://rzp.io/rzp/tsopteam5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-primary hover:bg-primary/90 text-white text-center font-bold py-4 transition-all duration-300"
                  data-testid="team-5-cta"
                >
                  Get Started
                </a>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Standard rate from July 1: ₹12,500 + GST
                </p>
              </div>
            </div>

            {/* Team-10 Card */}
            <div 
              className="relative bg-card border-2 border-primary p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              data-testid="pricing-team-10"
            >
              {/* Most Popular Badge */}
              <div className="absolute -top-4 right-4">
                <span className="bg-accent text-white text-sm font-bold px-4 py-2 uppercase tracking-wider shadow-lg">
                  Most Popular
                </span>
              </div>

              <div className="pt-4">
                <h3 className="text-2xl font-heading font-bold mb-2">Team-10</h3>
                <p className="text-muted-foreground mb-6">10 seats for your team</p>

                <div className="mb-6">
                  <div className="text-4xl font-heading font-black text-primary">
                    ₹20,000
                    <span className="text-lg font-body text-muted-foreground font-normal"> + GST/year</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ₹2,000 per seat <span className="text-accent font-semibold">(20% off individual)</span>
                  </p>
                  <p className="text-sm text-green-600 font-medium mt-2">
                    Save ₹4,990 vs individual subscriptions
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Weekly TSOP newsletter</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Bi-weekly Left Field briefs</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Full archive access</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Centralized billing & management</span>
                  </li>
                </ul>

                <a
                  href="https://rzp.io/rzp/tsopteam10"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-primary hover:bg-primary/90 text-white text-center font-bold py-4 transition-all duration-300"
                  data-testid="team-10-cta"
                >
                  Get Started
                </a>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Standard rate from July 1: ₹22,500 + GST
                </p>
              </div>
            </div>
          </div>

          {/* Larger teams note */}
          <p className="text-center text-muted-foreground mt-10">
            Larger teams? We offer custom pricing for 15+ seats.{' '}
            <a 
              href="mailto:venkat@stateofplay.club?subject=Custom Team Pricing Inquiry"
              className="text-primary hover:underline font-medium"
            >
              Contact us
            </a>
          </p>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: WHO IT'S FOR
          ========================================================================= */}
      <section className="py-16 md:py-20 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Who It's For
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {audiences.map((audience, index) => (
              <div 
                key={index}
                className="text-center p-6"
                data-testid={`audience-card-${index}`}
              >
                <div className="bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <audience.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-xl mb-2">{audience.title}</h3>
                <p className="text-muted-foreground">{audience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: WHAT'S INCLUDED
          ========================================================================= */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            What's Included
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center space-x-3 p-3"
                data-testid={`feature-${index}`}
              >
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="font-body">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: FAQ
          ========================================================================= */}
      <section className="py-16 md:py-20 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="bg-card border border-border overflow-hidden"
                data-testid={`faq-${index}`}
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <span className="font-heading font-bold text-foreground pr-4">
                    {faq.question}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                
                {expandedFaq === index && (
                  <div className="px-5 pb-5 border-t border-border">
                    <p className="text-muted-foreground leading-relaxed pt-4">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: CTA FOOTER
          ========================================================================= */}
      <section className="py-20 md:py-28 bg-primary text-white">
        <div className="container mx-auto px-4 md:px-8 max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold tracking-tight mb-6">
            Ready to upgrade your team?
          </h2>
          <p className="text-lg md:text-xl text-white/80 font-body mb-10">
            Join leading sports organizations who trust TSOP for their business intelligence.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={scrollToPricing}
              className="inline-flex items-center justify-center bg-white text-primary font-bold px-8 py-4 text-lg transition-all duration-300 hover:bg-gray-100"
              data-testid="footer-view-plans"
            >
              View Plans
            </button>
            <a
              href="mailto:venkat@stateofplay.club?subject=Corporate Subscription Inquiry"
              className="inline-flex items-center justify-center border-2 border-white text-white hover:bg-white hover:text-primary font-bold px-8 py-4 text-lg transition-all duration-300"
              data-testid="footer-contact-sales"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Teams;
