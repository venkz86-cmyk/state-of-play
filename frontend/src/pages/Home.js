import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArticleCard } from '../components/ArticleCard';
import { Button } from '../components/ui/button';
import { ArrowRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const Home = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await axios.get(`${API}/articles?limit=6`);
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
    <div className="min-h-screen">
      <section className="relative py-24 md:py-32 border-b border-border/40 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1750716413444-c8a957fcf35c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwxfHxjcmlja2V0JTIwc3RhZGl1bSUyMG5pZ2h0JTIwcGFub3JhbWljfGVufDB8fHx8MTc3MDcxODM0OHww&ixlib=rb-4.1.0&q=85)'
          }}
        />
        <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">
          <div className="max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-heading font-bold tracking-tighter leading-[0.9] mb-6 text-foreground">
              The business of sport from an India lens
            </h1>
            <p className="text-lg md:text-xl leading-8 text-foreground/80 font-body mb-8 max-w-2xl">
              Deep dives into Indian sports business. Premium analysis, exclusive insights, and the stories behind the numbers.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signup">
                <Button 
                  size="lg" 
                  className="rounded-none bg-primary text-white hover:bg-primary/90 font-medium uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all px-8"
                  data-testid="btn-hero-subscribe"
                >
                  Subscribe Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/left-field">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="rounded-none border-secondary text-secondary hover:bg-secondary/5 font-medium uppercase tracking-widest px-8"
                  data-testid="btn-hero-free-content"
                >
                  Read Free Content
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="mb-12">
            <h2 className="text-3xl font-heading font-semibold tracking-tight mb-2">Latest Stories</h2>
            <p className="text-base text-muted-foreground font-body">From both publications</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-primary/5 border-t border-border/40">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-6">
            Join the insider's desk
          </h2>
          <p className="text-lg leading-8 text-foreground/80 font-body mb-8">
            Get unlimited access to premium stories, deep dives, and exclusive analysis of Indian sports business.
          </p>
          <Link to="/signup">
            <Button 
              size="lg" 
              className="rounded-none bg-primary text-white hover:bg-primary/90 font-medium uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all px-8"
              data-testid="btn-cta-subscribe"
            >
              Start Your Subscription
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
