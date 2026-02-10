import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArticleCard } from '../components/ArticleCard';
import { Button } from '../components/ui/button';
import { ArrowRight, Newspaper, Zap } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const Home = () => {
  const [articles, setArticles] = useState([]);
  const [featuredArticle, setFeaturedArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await axios.get(`${API}/articles?limit=10`);
      const allArticles = response.data;
      if (allArticles.length > 0) {
        setFeaturedArticle(allArticles[0]);
        setArticles(allArticles.slice(1, 7));
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
          <p className="text-muted-foreground font-body">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50 border-b-2 border-primary/10">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl py-20 md:py-28">
          <div className="max-w-4xl">
            <div className="inline-block bg-primary/10 border border-primary/20 px-4 py-2 mb-6 animate-fade-in">
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-primary">Premium Sports Business Intelligence</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight leading-[0.95] mb-6 text-foreground animate-fade-in">
              The business of sport from an{' '}
              <span className="text-primary relative inline-block">
                India lens
                <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 200 8" fill="none">
                  <path d="M0 4C50 2 100 6 150 3C175 1.5 200 4 200 4" stroke="#2E5AAC" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </span>
            </h1>
            <p className="text-xl md:text-2xl leading-relaxed text-foreground/70 font-body mb-10 max-w-3xl">
              Deep-dive analysis, exclusive insights, and the untold stories behind Indian sports business.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signup">
                <Button 
                  size="lg" 
                  className="bg-primary text-white hover:bg-primary-700 font-bold px-8 py-6 text-base transition-all hover:shadow-2xl hover:scale-105 group"
                  data-testid="btn-hero-subscribe"
                >
                  <Newspaper className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  Subscribe Now
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/left-field">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-2 border-secondary text-secondary hover:bg-secondary hover:text-white font-bold px-8 py-6 text-base transition-all group"
                  data-testid="btn-hero-free-content"
                >
                  <Zap className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  Read Free Stories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Article */}
      {featuredArticle && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-8 max-w-7xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-heading font-bold tracking-tight mb-1">Featured Story</h2>
                <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider">Editor's Pick</p>
              </div>
            </div>
            <div className="max-w-5xl">
              <ArticleCard article={featuredArticle} featured={true} />
            </div>
          </div>
        </section>
      )}

      {/* Latest Stories */}
      <section className="py-16 bg-gradient-to-b from-white to-primary-50/30">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="mb-12">
            <h2 className="text-3xl font-heading font-bold tracking-tight mb-2">Latest Stories</h2>
            <p className="text-base text-muted-foreground font-body">From The State of Play & The Left Field</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/state-of-play">
              <Button 
                variant="outline" 
                size="lg"
                className="border-2 border-primary text-primary hover:bg-primary hover:text-white font-semibold px-8 transition-all"
              >
                View All Stories
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-6">
            Join the insider's circle
          </h2>
          <p className="text-xl leading-relaxed text-white/90 font-body mb-10 max-w-2xl mx-auto">
            Subscribe to unlock premium analysis, exclusive interviews, and deep dives into the business of Indian sports.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/signup">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-gray-100 font-bold px-10 py-6 text-base transition-all hover:shadow-2xl hover:scale-105"
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
                className="border-2 border-white text-white hover:bg-white hover:text-primary font-semibold px-8 py-6 text-base transition-all"
              >
                View Membership Benefits
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
