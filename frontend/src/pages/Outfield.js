import { useState } from 'react';
import { 
  Users, 
  MapPin, 
  Calendar,
  MessageSquare,
  Wine,
  Shield,
  Mail
} from 'lucide-react';

/* =============================================================================
   THE OUTFIELD - Live Events Page
   Premium, intimate sports business gatherings
   ============================================================================= */

export const Outfield = () => {
  // Timeline for Roundtables
  const roundtableTimeline = [
    { period: 'May', city: 'Mumbai', confirmed: true, registerUrl: 'https://lu.ma/8xh1try1' },
    { period: 'June/July', city: 'Bengaluru', tentative: true },
    { period: 'September/October', city: 'New Delhi', tentative: true },
    { period: 'December', city: 'Mumbai/Bengaluru', tentative: true }
  ];

  // Timeline for Speakeasy (removed March/April Mumbai)
  const speakeasyTimeline = [
    { period: 'June', city: 'Bengaluru', tentative: true },
    { period: 'November', city: 'New Delhi', tentative: true }
  ];

  // Who attends
  const audiences = [
    'VCs investing in gaming and sports tech',
    'Founders running platforms and apps',
    'Gaming company executives',
    'IPL franchise executives',
    'PE investors evaluating sports as an asset class',
    'Investment bankers',
    'Broadcast executives and media buyers',
    'Sports lawyers and law firms'
  ];

  return (
    <div className="min-h-screen bg-background">
      
      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <section className="bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white relative overflow-hidden">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>

        <div className="container mx-auto px-4 md:px-8 max-w-4xl py-24 md:py-32 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight leading-tight mb-6">
            The Outfield
          </h1>
          <p className="text-2xl md:text-3xl font-body text-white/90 mb-8">
            Where sports business meets
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-white/70">
            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> Mumbai</span>
            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> Bengaluru</span>
            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> New Delhi</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INTRO SECTION
          ========================================================================= */}
      <section className="py-16 md:py-20 border-b border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-3xl text-center">
          <p className="text-xl md:text-2xl text-foreground leading-relaxed font-body">
            The State of Play covers the business of Indian sport. <span className="text-primary font-semibold">The Outfield</span> is where that community meets in person. Quarterly Roundtables for subscribers. Premium Speakeasies for decision-makers. Small formats that force depth and encourage candour.
          </p>
        </div>
      </section>

      {/* =========================================================================
          THE EVENTS
          ========================================================================= */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4 md:px-8 max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            The Events
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* The Roundtables */}
            <div className="bg-card border border-border p-8">
              <div className="flex items-center mb-4">
                <div className="bg-secondary/10 p-3 mr-4">
                  <MessageSquare className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-2xl font-heading font-bold">The Roundtables</h3>
                  <p className="text-sm text-muted-foreground">Quarterly Subscriber Discussions</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center text-sm">
                  <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>25-30 people</span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>4 events in 2026</span>
                </div>
                <div className="flex items-center text-sm text-secondary font-medium">
                  <Shield className="w-4 h-4 mr-2" />
                  <span>Boardroom or café. Free for subscribers. Limited guest tickets.*</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Closed-door. Ninety minutes. We take a Friday story from The State of Play and go deeper with the protagonist. What couldn't fit in 1,500 words. What has developed since.
              </p>
              
              <p className="text-xs text-muted-foreground italic mb-6">
                *Tickets redeemable against an annual State of Play subscription.
              </p>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">2026 Schedule</p>
                <div className="space-y-2 text-sm">
                  {roundtableTimeline.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-2 text-secondary" />
                        <span className={item.confirmed ? 'font-semibold' : 'text-muted-foreground'}>
                          {item.period}: {item.city}
                        </span>
                        {item.tentative && (
                          <span className="ml-2 text-xs text-muted-foreground italic">(tentative)</span>
                        )}
                      </div>
                      {item.registerUrl && (
                        <a 
                          href={item.registerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-secondary text-white px-3 py-1 hover:bg-secondary/90 transition-colors"
                        >
                          Register →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* The Speakeasy */}
            <div className="bg-card border border-border p-8">
              <div className="flex items-center mb-4">
                <div className="bg-accent/10 p-3 mr-4">
                  <Wine className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-heading font-bold">The Speakeasy</h3>
                  <p className="text-sm text-muted-foreground">Premium Off-Record Gatherings</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center text-sm">
                  <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>30 people, 3 CXO speakers</span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span>2 events in 2026</span>
                </div>
                <div className="flex items-center text-sm text-accent font-medium">
                  <Wine className="w-4 h-4 mr-2" />
                  <span>Cocktail bar. Ticketed.</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Each speaker gets 20-30 minutes for a fireside chat. Forward-looking topics. After the chats, Q&A, a short pub quiz, then networking. One drink on the house. The evening runs about two and a half hours.
              </p>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">2026 Schedule</p>
                <div className="space-y-2 text-sm">
                  {speakeasyTimeline.map((item, i) => (
                    <div key={i} className="flex items-center">
                      <MapPin className="w-3 h-3 mr-2 text-accent" />
                      <span className="text-muted-foreground">
                        {item.period}: {item.city}
                      </span>
                      {item.tentative && (
                        <span className="ml-2 text-xs text-muted-foreground italic">(tentative)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          WHY THESE WORK
          ========================================================================= */}
      <section className="py-16 md:py-20 border-b border-border">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Intimacy Creates Candour
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-3xl mx-auto">
            These aren't conferences. No stages. No panels. No 500-person networking halls.
          </p>
          <p className="text-lg text-foreground leading-relaxed max-w-3xl mx-auto">
            Small rooms force depth. The Chatham House rule encourages honesty. Premium settings signal seriousness. <span className="text-primary font-semibold">This is where the real conversations happen</span>—the ones that shape how people think about the business of sport in India.
          </p>
        </div>
      </section>

      {/* =========================================================================
          WHO ATTENDS
          ========================================================================= */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-4">
            The Audience
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Decision makers across the sports business ecosystem.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {audiences.map((audience, index) => (
              <div 
                key={index}
                className="flex items-center bg-card border border-border px-4 py-3"
              >
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                <span className="text-sm">{audience}</span>
              </div>
            ))}
          </div>
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
          <p className="text-xl text-white/80">Three cities. Seven events. Year one.</p>
        </div>
      </section>

      {/* =========================================================================
          CONTACT / CTA
          ========================================================================= */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-8 max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Stay in the Loop
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Event announcements, RSVPs, and ticket releases go out via The State of Play newsletter. Subscribe to stay informed.
          </p>
          
          <a
            href="/signup"
            className="inline-flex items-center bg-primary hover:bg-primary/90 text-white font-bold px-10 py-4 text-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
          >
            Subscribe to TSOP
          </a>
          
          <p className="text-sm text-muted-foreground mt-6">
            Questions? <a href="mailto:venkat@stateofplay.club" className="text-primary hover:underline">venkat@stateofplay.club</a>
          </p>
        </div>
      </section>

    </div>
  );
};

export default Outfield;
