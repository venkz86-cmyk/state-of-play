import { Check, TrendingUp, Shield, Zap, Mail, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export const About = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 border-b-2 border-primary/10">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl py-20 md:py-28">
          <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight leading-tight mb-6 text-center">
            About
          </h1>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <div className="bg-card border-2 border-primary/20 p-12 mb-16">
            <p className="text-xl leading-relaxed text-foreground/90 font-body mb-6">
              <strong className="text-primary">The State of Play</strong> is a weekly, subscription-only newsletter that provides in-depth, original insight into the business of sport — with sharp reporting, analysis, and a distinct editorial voice grounded in India.
            </p>
            <p className="text-lg leading-relaxed text-foreground/80 font-body mb-6">
              This newsletter arrives at a time when sport is no longer just what happens on the field. It is a high-stakes, capital-intensive, and profoundly global business with fast-evolving dynamics. In India, however, most coverage still gravitates to match results or off-field drama. As social media accelerates that cycle, a gap has opened for sustained, intelligent reporting on how sport actually works.
            </p>
            <p className="text-lg leading-relaxed text-foreground/80 font-body mb-6">
              <strong className="text-primary">The State of Play</strong> aims to fill that gap.
            </p>
            <p className="text-lg leading-relaxed text-foreground/80 font-body">
              Each week, you'll receive a carefully reported edition that cuts through noise to explain how money, power, and strategy are reshaping Indian sport — and how these shifts connect to the wider sporting economy. When a major story breaks, from sponsorships to media rights, The State of Play offers timely, informed perspective.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary text-white p-4 rounded-full mb-4">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">In-Depth Analysis</h3>
              <p className="text-sm text-foreground/70">Carefully reported stories that cut through the noise</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary text-white p-4 rounded-full mb-4">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">Independent Voice</h3>
              <p className="text-sm text-foreground/70">Sharp reporting with a distinct editorial perspective</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-primary text-white p-4 rounded-full mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-bold text-xl mb-2">India Focus</h3>
              <p className="text-sm text-foreground/70">Grounded in the Indian sports business landscape</p>
            </div>
          </div>

          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold mb-8">What We Cover</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">IPL & Cricket Economics</h4>
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
                  <h4 className="font-bold mb-1">Media Rights</h4>
                  <p className="text-sm text-foreground/70">Broadcasting deals, streaming wars, viewership</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">Governance</h4>
                  <p className="text-sm text-foreground/70">BCCI, IOA, federations, and sports policy</p>
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
                  <p className="text-sm text-foreground/70">Stadiums, facilities, and real estate in sport</p>
                </div>
              </div>
            </div>
          </div>

          {/* Global Investors Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-heading font-bold mb-8" style={{ fontStyle: 'italic' }}>Why Global Sports Investors Read The State of Play</h2>
            
            <p className="text-lg leading-relaxed text-foreground/80 font-body mb-6">
              Indian sports business is no longer a local story. IPL franchises are valued at $1B+. International sports funds are acquiring stakes in Indian teams and leagues. The Glazers, RedBird Capital, and other global sports investors are actively evaluating opportunities in what is becoming the world's fastest-growing sports economy.
            </p>
            
            <p className="text-lg leading-relaxed text-foreground/80 font-body mb-4">
              <strong>The problem:</strong> Global sports finance coverage misses Indian context. International sports business publications lack on-the-ground intelligence from India. One-off consulting reports are expensive and quickly outdated.
            </p>
            
            <p className="text-lg leading-relaxed text-foreground/80 font-body mb-6">
              <strong>The solution:</strong> The State of Play provides the granular, sourced reporting that global investors, leagues, agencies, and front offices need to understand Indian sports business.
            </p>
            
            <p className="text-lg leading-relaxed text-foreground/80 font-body mb-8">
              We break news that shapes billion-dollar decisions. We provide context that can't be found anywhere else. We deliver intelligence, not just information.
            </p>
            
            <h3 className="text-xl font-heading font-bold mb-4">Our readers include:</h3>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <span className="text-foreground/80">Premier League ownership groups evaluating Indian sports investments</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <span className="text-foreground/80">Private equity and venture capital investors in India and abroad</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <span className="text-foreground/80">North American sports funds analysing cricket economics</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <span className="text-foreground/80">IPL franchise ownership and management teams</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <span className="text-foreground/80">Global sports agencies with India operations</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <span className="text-foreground/80">Private equity executives and investment bankers</span>
              </li>
              <li className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <span className="text-foreground/80">International consultancies advising on sports sector deals</span>
              </li>
            </ul>
            
            <p className="text-lg leading-relaxed text-foreground/80 font-body">
              <strong>Cited by:</strong> <em>ESPNCricinfo</em>, <em>The Athletic</em>, <em>SportsPro</em>, and leading sports and business media globally.
            </p>
          </div>

          {/* Author Section */}
          <div className="bg-muted border-2 border-primary/20 p-12">
            <h2 className="text-3xl font-heading font-bold mb-6">Who's Behind It?</h2>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <p className="text-lg leading-relaxed text-foreground/80 font-body mb-4">
                  <strong className="text-primary">Venkat Ananth</strong> is a Bengaluru-based journalist and writer who focuses on deeply reported stories about the business of sport and technology.
                </p>
                <p className="text-lg leading-relaxed text-foreground/80 font-body mb-6">
                  Over 18 years, he has worked with and written for leading Indian print and digital publications, including <em>Hindustan Times</em>, Yahoo! Cricket, <em>Mint</em>, <em>The Ken</em>, <em>The Economic Times</em>, <em>The Times of India</em>, and, until recently, <em>The Indian Express</em>.
                </p>
                <div className="flex items-center space-x-4">
                  <a 
                    href="https://www.linkedin.com/in/venkat-ananth/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-primary hover:text-primary-700 font-semibold transition-colors"
                  >
                    <Linkedin className="h-5 w-5" />
                    <span>LinkedIn</span>
                  </a>
                  <a 
                    href="mailto:venkat@stateofplay.club"
                    className="inline-flex items-center space-x-2 text-primary hover:text-primary-700 font-semibold transition-colors"
                  >
                    <Mail className="h-5 w-5" />
                    <span>Email</span>
                  </a>
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
            Support independent sports journalism
          </h2>
          <p className="text-xl leading-relaxed text-white/90 font-body mb-10 max-w-2xl mx-auto">
            If you'd like the weekly edition delivered to your inbox, consider becoming a member. Your support funds original reporting and analysis.
          </p>
          <Link to="/signup">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-gray-100 font-bold px-10 py-6 text-base transition-all hover:shadow-2xl hover:scale-105"
            >
              View Membership
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
