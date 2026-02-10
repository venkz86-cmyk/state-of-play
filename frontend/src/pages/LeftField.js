import { useState, useEffect } from 'react';
import { substackAPI } from '../services/substackAPI';

export const LeftField = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const posts = await substackAPI.getPosts();
      setArticles(posts);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading stories from Substack...</p>
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
          <p className="text-lg leading-8 text-foreground/80 font-body max-w-2xl">
            Free perspectives and insights, published twice weekly on Substack.
          </p>
          <a 
            href="https://theleftfield.substack.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block mt-4 text-secondary hover:underline font-semibold"
          >
            Subscribe on Substack →
          </a>
        </div>
        
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {articles.map((article) => (
              <a 
                key={article.id} 
                href={article.external_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group"
              >
                <article className="group relative overflow-hidden bg-white border border-border/40 hover:border-secondary/40 transition-all duration-300 hover:shadow-xl cursor-pointer h-full">
                  {article.image_url && (
                    <div className="relative w-full aspect-[16/10] overflow-hidden">
                      <img 
                        src={article.image_url} 
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3 bg-secondary text-white text-[8px] font-bold uppercase tracking-widest px-2 py-1 font-mono">
                        FREE
                      </div>
                    </div>
                  )}
                  
                  <div className="p-6">
                    <h3 className="text-xl font-heading font-bold tracking-tight text-foreground mb-2 leading-tight group-hover:text-secondary transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    
                    {article.subtitle && (
                      <p className="text-sm leading-relaxed text-foreground/60 mb-3 line-clamp-2">
                        {article.subtitle}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-body pt-3 border-t border-border">
                      <span className="font-medium">{article.author}</span>
                      <span className="text-secondary font-semibold">Read on Substack →</span>
                    </div>
                  </div>
                </article>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-body">Unable to load Substack articles. Visit{' '}
              <a href="https://theleftfield.substack.com" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
                theleftfield.substack.com
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
