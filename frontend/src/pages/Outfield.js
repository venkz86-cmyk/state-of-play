export const Outfield = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl py-32 text-center">
        <div className="inline-block bg-accent/10 border border-accent/20 px-4 py-2 mb-8 animate-fade-in">
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-accent">Coming Soon</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight leading-tight mb-6 text-foreground animate-fade-in">
          The Outfield
        </h1>
        
        <p className="text-xl md:text-2xl leading-relaxed text-foreground/70 font-body mb-12 max-w-2xl mx-auto">
          A new perspective on sports business is coming your way. Stay tuned for something exciting.
        </p>
        
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute inset-0 bg-primary/5 blur-3xl" />
          <div className="relative bg-white border-2 border-primary/20 shadow-xl p-12">
            <h3 className="text-2xl font-heading font-bold mb-4">Get notified when we launch</h3>
            <p className="text-base text-foreground/70 mb-6">Be among the first to explore The Outfield</p>
            <div className="flex gap-3">
              <input 
                type="email" 
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 border-2 border-border focus:border-primary outline-none transition-colors font-body"
              />
              <button className="bg-primary text-white hover:bg-primary-700 font-semibold px-6 transition-all hover:shadow-lg">
                Notify Me
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
