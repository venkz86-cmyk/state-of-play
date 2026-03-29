import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { RazorpayButton } from '../components/RazorpayButton';
import { ghostAPI } from '../services/ghostAPI';
import { 
  AlertCircle, 
  Loader2, 
  Newspaper, 
  Mail, 
  Archive, 
  Bell, 
  Mic, 
  BarChart3, 
  ShieldCheck, 
  MessageCircle,
  Trophy,
  Handshake,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

/* =============================================================================
   SUBSCRIBE PAGE - The State of Play
   Complete subscription page with value proposition, social proof, and conversion elements
   ============================================================================= */

export const Signup = () => {
  const pricing = useGeoPricing();
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Fetch real premium articles for the "Recent Premium Analysis" section
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const posts = await ghostAPI.getPosts({ limit: 8 });
        // Filter to premium articles only and take first 4
        const premiumPosts = posts.filter(p => p.is_premium).slice(0, 4);
        setArticles(premiumPosts);
      } catch (error) {
        console.error('Failed to fetch articles:', error);
      } finally {
        setLoadingArticles(false);
      }
    };
    fetchArticles();
  }, []);

  // Benefits data for "What's Included" section
  const benefits = [
    {
      icon: Newspaper,
      title: 'Weekly TSOP Newsletter',
      description: 'Long-form analysis on Indian sports business—IPL, ISL, kabaddi, private equity, media rights, and more'
    },
    {
      icon: Mail,
      title: 'Bi-weekly Left Field',
      description: 'Curated news briefs covering Indian and global sports business'
    },
    {
      icon: Archive,
      title: 'Full Archive Access',
      description: 'Every premium story since launch—searchable and always available'
    },
    {
      icon: Bell,
      title: 'Breaking News Alerts',
      description: 'First to know about major deals and announcements'
    },
    {
      icon: Mic,
      title: 'Exclusive Interviews',
      description: 'TSOP Transcript Q&As with industry insiders'
    },
    {
      icon: BarChart3,
      title: 'Data & Analysis',
      description: 'IRR models, valuation breakdowns, market sizing'
    },
    {
      icon: ShieldCheck,
      title: 'Ad-Free Experience',
      description: 'No sponsored content, no ads, just journalism'
    },
    {
      icon: MessageCircle,
      title: 'Direct Access',
      description: 'Reply to any newsletter, get responses from Venkat'
    }
  ];

  // Reader personas for "Who Reads TSOP" section
  const personas = [
    {
      icon: Trophy,
      title: 'Sports Franchises & Leagues',
      description: 'Track competitor deals, benchmark valuations, inform commercial and M&A strategy'
    },
    {
      icon: Handshake,
      title: 'Agencies & Brands',
      description: 'Brief clients on market trends, identify sponsorship and partnership opportunities'
    },
    {
      icon: TrendingUp,
      title: 'Investors & Advisors',
      description: 'Deal flow intelligence, sector analysis, investment thesis development across Indian sports'
    }
  ];

  // FAQ data
  const faqs = [
    {
      question: 'What sports do you cover?',
      answer: 'We cover the full business of Indian sport: cricket (IPL, domestic, international rights), football (ISL), kabaddi (PKL), badminton, hockey, motorsport, emerging leagues, private equity deals, media rights, sports tech, governance, and regulatory developments. If it\'s sports business in India, we\'re on it.'
    },
    {
      question: 'How is this different from The Left Field?',
      answer: 'The Left Field is a free news brief. TSOP is original, reported, long-form analysis you won\'t find anywhere else—plus exclusive interviews, investigations, and data breakdowns.'
    },
    {
      question: 'What happens after I subscribe?',
      answer: 'After payment via Razorpay, your account is created automatically. Check your email for a verification link, click it, and you\'ll have immediate access to all premium content.'
    },
    {
      question: 'How long is the subscription?',
      answer: 'Subscriptions are annual (12 months from purchase date). You\'ll receive a renewal reminder before your subscription expires.'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      
      {/* =========================================================================
          SECTION 1: HERO + VALUE PROPOSITION
          ========================================================================= */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-b border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black tracking-tight leading-tight mb-6">
            India's Premier Sports Business Intelligence
          </h1>
          <p className="text-lg md:text-xl text-foreground/70 font-body leading-relaxed max-w-3xl mx-auto">
            Deep-dive analysis, exclusive interviews, and the untold stories behind the business of Indian sport—across leagues, franchises, governance, media rights, retail, manufacturing, policy, and beyond. Delivered weekly.
          </p>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: PRICING BOX
          ========================================================================= */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-8 max-w-lg">
          <div 
            className="bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/30 p-8 md:p-10 text-center shadow-lg"
            data-testid="pricing-box"
          >
            {/* Email Notice */}
            <div className="bg-accent/10 border border-accent/30 p-4 mb-6 text-left" data-testid="email-notice">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-foreground mb-1">Important: Email Matching</p>
                  <p className="text-xs text-foreground/70 leading-relaxed">
                    Use the same email in the Razorpay payment form that you want to use for accessing premium content.
                  </p>
                </div>
              </div>
            </div>

            {/* Price Display */}
            {pricing.loading ? (
              <div className="py-6">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Loading pricing...</p>
              </div>
            ) : (
              <>
                <div className="text-5xl md:text-6xl font-heading font-black text-primary mb-2">
                  {pricing.symbol}{pricing.amount}
                  <span className="text-xl font-body text-muted-foreground font-normal">/year</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{pricing.note}</p>
              </>
            )}
            
            {/* Razorpay Button */}
            <RazorpayButton className="mb-4" />
            
            <p className="text-xs text-muted-foreground">
              Secured by Razorpay • Annual subscription
            </p>
          </div>

          <p className="text-center text-sm text-muted-foreground font-body mt-6">
            Already a subscriber?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: SOCIAL PROOF
          ========================================================================= */}
      <section className="py-8 border-y border-border bg-muted/30">
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
          SECTION 4: WHAT'S INCLUDED (Benefits Grid)
          ========================================================================= */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            What's Included
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {benefits.map((benefit, index) => (
              <div 
                key={index}
                className="bg-muted/50 hover:bg-muted p-5 md:p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md group"
                data-testid={`benefit-card-${index}`}
              >
                <div className="flex items-start space-x-4">
                  <div className="bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground mb-1">
                      {benefit.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: RECENT PREMIUM ANALYSIS (Real Articles from Ghost)
          ========================================================================= */}
      <section className="py-16 md:py-20 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-4">
            Recent Premium Analysis
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            A sample of what subscribers get access to every week
          </p>
          
          {loadingArticles ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {articles.map((article, index) => (
                <Link 
                  key={article.id} 
                  to={`/${article.id}`}
                  className="group"
                  data-testid={`premium-article-${index}`}
                >
                  <div className="bg-card border border-border hover:border-primary/50 p-5 md:p-6 h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                    {/* Tag Badge */}
                    <span className="inline-block bg-primary/10 text-primary text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 mb-3">
                      {article.theme || 'Premium'}
                    </span>
                    
                    {/* Headline */}
                    <h3 className="font-heading font-bold text-foreground mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    
                    {/* Excerpt */}
                    {article.subtitle && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {article.subtitle}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">Loading premium content...</p>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: WHO READS TSOP (Reader Personas)
          ========================================================================= */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Who Reads The State of Play
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {personas.map((persona, index) => (
              <div 
                key={index}
                className="bg-muted/50 p-6 md:p-8 text-center hover:bg-muted transition-all duration-300"
                data-testid={`persona-card-${index}`}
              >
                <div className="bg-primary/10 w-14 h-14 flex items-center justify-center mx-auto mb-4">
                  <persona.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-foreground mb-2">
                  {persona.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {persona.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: FAQ
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
                data-testid={`faq-item-${index}`}
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <span className="font-heading font-bold text-foreground pr-4">
                    {faq.question}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-primary flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
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
          SECTION 8: FINAL CTA
          ========================================================================= */}
      <section className="py-20 md:py-28 bg-primary text-white relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>
        
        <div className="container mx-auto px-4 md:px-8 max-w-3xl text-center relative z-10">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold tracking-tight mb-6">
            Ready to upgrade your sports business intelligence?
          </h2>
          <p className="text-lg md:text-xl text-white/80 font-body mb-10 max-w-2xl mx-auto">
            Join hundreds of industry insiders who rely on TSOP every week.
          </p>
          
          {/* CTA Button - scrolls to pricing */}
          <button
            onClick={() => {
              document.querySelector('[data-testid="pricing-box"]')?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
            }}
            className="inline-flex items-center bg-white text-primary font-bold px-10 py-4 text-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 hover:bg-gray-50"
            data-testid="final-cta-button"
          >
            Subscribe Now — {pricing.symbol}{pricing.amount}/year
          </button>
          
          <p className="text-white/60 text-sm mt-6">
            Questions?{' '}
            <a href="mailto:venkat@stateofplay.club" className="text-white hover:underline">
              venkat@stateofplay.club
            </a>
          </p>
        </div>
      </section>

    </div>
  );
};
