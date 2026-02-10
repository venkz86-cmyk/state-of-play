export const LeftField = () => {
  return (
    <div className="min-h-screen py-24">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="mb-12 pb-8 border-b border-border/40">
          <div className="inline-block bg-secondary text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-sm mb-4">
            Free
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-4 text-secondary">
            The Left Field
          </h1>
          <p className="text-lg leading-8 text-foreground/80 font-body max-w-2xl mb-6">
            Free perspectives and insights, published twice weekly on Substack.
          </p>
          <a 
            href="https://theleftfield.substack.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 bg-secondary text-white hover:bg-secondary/90 font-semibold px-8 py-4 transition-all"
          >
            <span>Read on Substack</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
        
        <div className="bg-secondary/5 border-2 border-secondary/20 p-12 text-center">
          <h2 className="text-2xl font-heading font-bold mb-4">Visit The Left Field on Substack</h2>
          <p className="text-base text-foreground/70 mb-6">
            Subscribe for free stories delivered twice weekly to your inbox.
          </p>
          <a 
            href="https://theleftfield.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-secondary text-white hover:bg-secondary/90 font-bold px-10 py-4 transition-all text-lg"
          >
            Subscribe for Free →
          </a>
        </div>
      </div>
    </div>
  );
};
