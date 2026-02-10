import { useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const LeftField = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await axios.get(`${API}/substack/feed`);
      setArticles(response.data);
    } catch (error) {
      console.error('Failed to fetch Substack articles:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-secondary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground font-body">Loading from Substack...</p>
        </div>
      </div>
    );
  }

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
            <span>Subscribe on Substack</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
        
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {articles.map((article) => (
              <a 
                key={article.id} 
                href={article.external_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group"
                data-testid={`substack-article-${article.id}`}
              >
                <article className="group relative overflow-hidden bg-white border border-border/40 hover:border-secondary/40 transition-all duration-300 hover:shadow-xl cursor-pointer h-full">
                  <div className="p-6">
                    <div className="inline-block bg-secondary/10 text-secondary text-[9px] font-bold uppercase tracking-widest px-2 py-1 font-mono mb-3">
                      FREE
                    </div>
                    
                    <h3 className="text-xl font-heading font-bold tracking-tight text-foreground mb-3 leading-tight group-hover:text-secondary transition-colors">
                      {article.title}
                    </h3>
                    
                    {article.subtitle && (
                      <p className="text-sm leading-relaxed text-foreground/60 mb-4 line-clamp-3">
                        {article.subtitle}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-body pt-3 border-t border-border">
                      <span className="font-medium">{article.author}</span>
                      <span className="text-secondary font-semibold group-hover:translate-x-1 transition-transform inline-block">
                        Read on Substack →
                      </span>
                    </div>
                  </div>
                </article>
              </a>
            ))}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};
