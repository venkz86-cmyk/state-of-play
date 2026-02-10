import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { Calendar, Clock, Filter } from 'lucide-react';
import { format } from 'date-fns';

export const Archive = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'premium', 'free'

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const posts = await ghostAPI.getPosts({ limit: 100 });
      setArticles(posts);
    } catch (error) {
      console.error('Failed to fetch archive:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = articles.filter(article => {
    if (filter === 'all') return true;
    if (filter === 'premium') return article.is_premium;
    if (filter === 'free') return !article.is_premium;
    return true;
  });

  // Group by month/year
  const groupedArticles = filteredArticles.reduce((acc, article) => {
    const date = new Date(article.created_at);
    const key = format(date, 'MMMM yyyy');
    if (!acc[key]) acc[key] = [];
    acc[key].push(article);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground font-body">Loading archive...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-24">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-4">Archive</h1>
          <p className="text-lg text-muted-foreground font-body">
            Browse all {articles.length} stories from The State of Play
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2 mb-10 pb-6 border-b border-border">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Filter:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-primary text-white' : 'bg-foreground/5 hover:bg-foreground/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('premium')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              filter === 'premium' ? 'bg-primary text-white' : 'bg-foreground/5 hover:bg-foreground/10'
            }`}
          >
            Premium
          </button>
          <button
            onClick={() => setFilter('free')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              filter === 'free' ? 'bg-secondary text-white' : 'bg-foreground/5 hover:bg-foreground/10'
            }`}
          >
            Free
          </button>
        </div>

        {/* Grouped Articles */}
        {Object.entries(groupedArticles).map(([monthYear, monthArticles]) => (
          <div key={monthYear} className="mb-12">
            <h2 className="text-lg font-heading font-bold mb-4 text-primary flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              {monthYear}
            </h2>
            <div className="space-y-4">
              {monthArticles.map((article) => (
                <Link
                  key={article.id}
                  to={`/${article.id}`}
                  className="block group"
                >
                  <article className="flex items-start justify-between p-4 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                          article.is_premium ? 'bg-primary text-white' : 'bg-secondary text-white'
                        }`}>
                          {article.is_premium ? 'Premium' : 'Free'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(article.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <h3 className="font-heading font-bold group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                      {article.subtitle && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {article.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground ml-4">
                      <Clock className="h-3 w-3 mr-1" />
                      {article.read_time} min
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {filteredArticles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No articles found for this filter.
          </div>
        )}
      </div>
    </div>
  );
};
