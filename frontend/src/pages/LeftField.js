import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArticleCard } from '../components/ArticleCard';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const LeftField = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await axios.get(`${API}/articles?publication=The Left Field`);
      setArticles(response.data);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading...</p>
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
            Free perspectives and insights, published twice weekly.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {articles.length > 0 ? (
            articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))
          ) : (
            <p className="text-muted-foreground font-body col-span-3">No articles found.</p>
          )}
        </div>
      </div>
    </div>
  );
};
