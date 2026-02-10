import { useState, useEffect } from 'react';
import { ghostAPI } from '../services/ghostAPI';
import { ArticleCard } from '../components/ArticleCard';
import { ArrowRight } from 'lucide-react';

export const StateOfPlay = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const posts = await ghostAPI.getPosts({ limit: 50 });
      // Filter for State of Play articles (not tagged as Left Field)
      const stateOfPlayArticles = posts.filter(article => 
        article.publication === 'The State of Play'
      );
      setArticles(stateOfPlayArticles);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading stories from Ghost...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-24">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="mb-12 pb-8 border-b border-border/40">
          <div className="inline-block bg-premium text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-sm mb-4">
            Premium
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-4 text-primary">
            The State of Play
          </h1>
          <p className="text-lg leading-8 text-foreground/80 font-body max-w-2xl">
            Premium analysis and exclusive insights into the business of Indian sports.
          </p>
        </div>
        
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-body">No articles found. Publish your first premium story in Ghost!</p>
          </div>
        )}
      </div>
    </div>
  );
};
