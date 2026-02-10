import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';
import { ArticleCard } from '../components/ArticleCard';
import { NewsletterSignup } from '../components/NewsletterSignup';
import { ReadingHistory } from '../components/ReadingHistory';
import { Button } from '../components/ui/button';
import { ArrowRight, Newspaper, Zap, Sparkles } from 'lucide-react';

export const Home = () => {
  const [articles, setArticles] = useState([]);
  const [featuredArticle, setFeaturedArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const posts = await ghostAPI.getPosts({ limit: 10 });
      if (posts.length > 0) {
        setFeaturedArticle(posts[0]);
        setArticles(posts.slice(1, 7));
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground font-body">Loading stories from Ghost...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-background border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
        <div className="container mx-auto px-4 md:px-8 max-w-7xl py-24 md:py-32 relative z-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center space-x-2 bg-primary/5 border border-primary/10 px-4 py-2.5 mb-8 group hover:bg-primary/10 transition-colors">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-primary">Premium Sports Business Intelligence</span>
            </div>
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-heading font-black tracking-tight leading-[0.95] mb-8 text-balance">
              The business of sport from an{' '}
              <span className="text-primary relative inline-block">
                India lens
                <svg className="absolute -bottom-3 left-0 w-full" height="12" viewBox="0 0 200 12" fill="none">
                  <path d="M0 6C50 3 100 9 150 4C175 2 200 6 200 6" stroke="#2E5AAC" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </span>
            </h1>
            <p className="text-xl md:text-2xl leading-relaxed text-foreground/70 font-body mb-12 max-w-3xl">
              Deep-dive analysis, exclusive insights, and the untold stories behind Indian sports business.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signup">
                <Button 
                  size="lg" 
                  className="bg-primary text-white hover:bg-primary-700 font-bold px-10 py-7 text-lg transition-all hover:shadow-2xl hover:-translate-y-0.5 group"
                  data-testid="btn-hero-subscribe"
                >
                  <Newspaper className="mr-2 h-5 w-5 group-hover:rotate-3 transition-transform" />
                  Subscribe Now
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="https://theleftfield.substack.com" target="_blank" rel="noopener noreferrer">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-2 border-secondary text-secondary hover:bg-secondary hover:text-white font-bold px-10 py-7 text-lg transition-all group"
                  data-testid="btn-hero-free-content"
                >
                  <Zap className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  Free Briefings
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Article */}
      {featuredArticle && (
        <section className="py-20 bg-gradient-to-b from-white to-gray-50 dark:from-background dark:to-background">
          <div className="container mx-auto px-4 md:px-8 max-w-7xl">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="text-4xl font-heading font-bold tracking-tight mb-2">The Big Story</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3">
                <ArticleCard article={featuredArticle} featured={true} />
              </div>
              <div className="lg:col-span-1">
                <ReadingHistory variant="inline" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Latest Stories */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="mb-14">
            <h2 className="text-4xl font-heading font-bold tracking-tight mb-3">Latest Stories</h2>
            <p className="text-base text-muted-foreground font-body">Published on The State of Play</p>
          </div>
          
          {articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No articles found. Publish your first story in Ghost!</p>
            </div>
          )}

          {articles.length > 0 && (
            <div className="text-center mt-16">
              <Link to="/state-of-play">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-2 border-primary text-primary hover:bg-primary hover:text-white font-semibold px-10 py-6 text-base transition-all hover:-translate-y-0.5"
                >
                  View All Stories
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-28 bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>
        <div className="container mx-auto px-4 md:px-8 max-w-5xl text-center relative z-10">
          <h2 className="text-5xl md:text-6xl font-heading font-bold tracking-tight mb-8">
            Join the insider's circle
          </h2>
          <p className="text-xl md:text-2xl leading-relaxed text-white/90 font-body mb-12 max-w-3xl mx-auto">
            Subscribe to unlock premium analysis, exclusive interviews, and deep dives into the business of Indian sports.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
            <Link to="/signup">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-gray-50 font-bold px-12 py-7 text-lg transition-all hover:shadow-2xl hover:-translate-y-0.5"
                data-testid="btn-cta-subscribe"
              >
                Start Your Subscription
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/membership">
              <Button 
                size="lg" 
                variant="outline"
                className="border-2 border-white text-white hover:bg-white hover:text-primary font-semibold px-10 py-7 text-lg transition-all"
              >
                View Benefits
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      {/* Newsletter Signup */}
      <NewsletterSignup />
    </div>
  );
};
