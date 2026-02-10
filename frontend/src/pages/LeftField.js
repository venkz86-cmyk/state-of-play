import { useState, useEffect } from 'react';
import axios from 'axios';
import { ExternalLink } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export const LeftField = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      // Try to fetch from backend if available
      if (API) {
        const response = await axios.get(`${API}/api/substack/feed`, { timeout: 5000 });
        setArticles(response.data);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Failed to fetch Substack articles:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-secondary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground font-body">Loading...</p>
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
            Free perspectives and insights on Indian sports, published regularly on Substack.
          </p>
          <a 
            href="https://theleftfield.substack.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 bg-secondary text-white hover:bg-secondary/90 font-semibold px-8 py-4 transition-all"
          >
            <span>Subscribe on Substack</span>
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
        
        {articles.length > 0 && !error ? (
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
                <article className="group relative overflow-hidden bg-card border border-border/40 hover:border-secondary/40 transition-all duration-300 hover:shadow-xl cursor-pointer h-full">
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
            <h2 className="text-2xl font-heading font-bold mb-4">Read The Left Field on Substack</h2>
            <p className="text-base text-foreground/70 mb-6 max-w-xl mx-auto">
              The Left Field offers free perspectives on Indian sports business. Subscribe to get stories delivered directly to your inbox.
            </p>
            <a 
              href="https://theleftfield.substack.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-secondary text-white hover:bg-secondary/90 font-bold px-10 py-4 transition-all text-lg"
            >
              <span>Visit The Left Field</span>
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
