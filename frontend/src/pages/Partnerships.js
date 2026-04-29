import { useState } from 'react';
import { 
  MapPin, 
  Calendar,
  Building2,
  Shield,
  Mail,
  Send,
  Loader2,
  CheckCircle
} from 'lucide-react';

/* =============================================================================
   PARTNERSHIPS PAGE - /partnerships
   Sponsor information for The Outfield events
   Not in top nav - shareable link only
   ============================================================================= */

export const Partnerships = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Partnership tiers
  const partnershipTiers = [
    {
      title: 'Full Annual Partner',
      description: 'All seven events across three cities. Year-round brand association.'
    },
    {
      title: 'Roundtable Partner',
      description: 'Four subscriber discussions. Presenting sponsor.'
    },
    {
      title: 'Speakeasy Partner',
      description: 'Three premium gatherings. Title sponsor.'
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    
    // Create mailto link with form data
    const subject = encodeURIComponent(`Partnership Inquiry from ${formData.company}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\n` +
      `Email: ${formData.email}\n` +
      `Company: ${formData.company}\n\n` +
      `Message:\n${formData.message}`
    );
    
    // Open mailto
    window.location.href = `mailto:venkat@stateofplay.club,prerna@stateofplay.club?subject=${subject}&body=${body}`;
    
    setSending(false);
    setSent(true);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setSent(false);
      setFormData({ name: '', email: '', company: '', message: '' });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      
      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <section className="bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>

        <div className="container mx-auto px-4 md:px-8 max-w-4xl py-20 md:py-28 text-center relative z-10">
          <p className="text-sm font-mono uppercase tracking-widest text-white/70 mb-4">The Outfield</p>
          <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tight leading-tight mb-6">
            Partner With Us
          </h1>
          <p className="text-xl md:text-2xl font-body text-white/90">
            Reach the people shaping Indian sports business.
          </p>
        </div>
      </section>

      {/* =========================================================================
          THE ECOSYSTEM
          ========================================================================= */}
      <section className="py-16 md:py-20 border-b border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-4">
            The Ecosystem
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Three products. One mission: Covering the business of Indian sport with the depth it deserves.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* The Left Field */}
            <div className="bg-card border border-border p-6 hover:shadow-lg transition-all">
              <div className="text-secondary font-mono text-xs uppercase tracking-wider mb-3">Free</div>
              <h3 className="text-xl font-heading font-bold mb-3">The Left Field</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Published every Monday & Wednesday</li>
                <li>India + Global focus</li>
                <li>Insights in one sitting</li>
                <li>Ad-supported</li>
              </ul>
            </div>

            {/* The State of Play */}
            <div className="bg-card border-2 border-primary p-6 hover:shadow-lg transition-all">
              <div className="text-primary font-mono text-xs uppercase tracking-wider mb-3">Premium</div>
              <h3 className="text-xl font-heading font-bold mb-3">The State of Play</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Friday deep-dive (~6 min read)</li>
                <li>₹2,499/year or $120</li>
                <li>50 deep dives annually</li>
                <li>150+ paid subscribers</li>
              </ul>
            </div>

            {/* The Outfield */}
            <div className="bg-primary text-white p-6 hover:shadow-lg transition-all">
              <div className="text-white/70 font-mono text-xs uppercase tracking-wider mb-3">Live</div>
              <h3 className="text-xl font-heading font-bold mb-3">The Outfield</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li>Live events</li>
                <li>Seven gatherings in 2026</li>
                <li>Mumbai, Bengaluru, New Delhi</li>
                <li>Intimate, off-record</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PARTNERSHIP TIERS
          ========================================================================= */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-4">
            Partnership Tiers
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Pricing based on scope and involvement. Let's discuss what makes sense for your brand.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {partnershipTiers.map((tier, index) => (
              <div 
                key={index}
                className="bg-card border border-border p-6 text-center hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <h3 className="text-xl font-heading font-bold mb-3">{tier.title}</h3>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          BRAND INTEGRATION
          ========================================================================= */}
      <section className="py-16 md:py-20 border-b border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Brand Integration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary/10 w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-2">At Events</h3>
              <p className="text-sm text-muted-foreground">
                Acknowledged in pre-event emails, opening remarks, and post-event recaps. Optional welcome opportunity at Speakeasies.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-2">In Content</h3>
              <p className="text-sm text-muted-foreground">
                Contextual placement in The Left Field. Recommended content sections. Partner perspectives. Clearly disclosed, editorially independent.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-2">Throughout the Year</h3>
              <p className="text-sm text-muted-foreground">
                Consistent, transparent presence. Not logos plastered everywhere. Thoughtful integration that respects editorial integrity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          QUALITY OVER SCALE
          ========================================================================= */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Quality Over Scale
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            We are not optimising for headcount, but for conversations that matter.
          </p>
          <p className="text-lg text-foreground leading-relaxed mb-8">
            The people at these events are VCs writing checks, founders building companies, senior executives running operations. When someone asks a question at a Roundtable or responds to a CXO at a Speakeasy, there's a good chance they're working exactly on that problem.
          </p>
          <p className="text-xl font-heading font-semibold text-primary">
            Three cities. Seven events. Year 1 founding rates.
          </p>
        </div>
      </section>

      {/* =========================================================================
          MULTI-CITY PRESENCE
          ========================================================================= */}
      <section className="py-16 md:py-20 bg-primary text-white">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 mb-8">
            <div>
              <MapPin className="w-8 h-8 mx-auto mb-2 text-white/70" />
              <span className="text-2xl font-heading font-bold">Mumbai</span>
            </div>
            <div>
              <MapPin className="w-8 h-8 mx-auto mb-2 text-white/70" />
              <span className="text-2xl font-heading font-bold">Bengaluru</span>
            </div>
            <div>
              <MapPin className="w-8 h-8 mx-auto mb-2 text-white/70" />
              <span className="text-2xl font-heading font-bold">New Delhi</span>
            </div>
          </div>
          <p className="text-xl text-white/80">Three markets. One partnership.</p>
        </div>
      </section>

      {/* =========================================================================
          CONTACT FORM
          ========================================================================= */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-8 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-4">
            Let's Talk
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            We're looking for partners who understand what we're building.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 px-4 border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-12 px-4 border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Company</label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full h-12 px-4 border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Company name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Message</label>
              <textarea
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={5}
                className="w-full px-4 py-3 border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Tell us about your partnership interests..."
              />
            </div>

            <button
              type="submit"
              disabled={sending || sent}
              className={`w-full h-14 font-bold text-lg transition-all duration-300 flex items-center justify-center ${
                sent 
                  ? 'bg-green-600 text-white' 
                  : 'bg-primary hover:bg-primary/90 text-white hover:shadow-lg'
              }`}
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Opening email...
                </>
              ) : sent ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Email client opened!
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Send Message
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Or email us directly at{' '}
            <a href="mailto:venkat@stateofplay.club" className="text-primary hover:underline">venkat@stateofplay.club</a>
            {' '}or{' '}
            <a href="mailto:prerna@stateofplay.club" className="text-primary hover:underline">prerna@stateofplay.club</a>
          </p>
        </div>
      </section>

    </div>
  );
};

export default Partnerships;
