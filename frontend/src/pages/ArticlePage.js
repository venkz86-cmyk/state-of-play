import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Clock, Calendar, Lock } from 'lucide-react';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ArticlePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    try {
      const response = await axios.get(`${API}/articles/${id}`);
      setArticle(response.data);
    } catch (error) {
      console.error('Failed to fetch article:', error);
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

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground font-body">Article not found</p>
      </div>
    );
  }

  const canAccessContent = !article.is_premium || (user && user.is_subscriber);
  const publicationColor = article.publication === 'The State of Play' ? 'bg-premium' : 'bg-secondary';
  const publicationText = article.publication === 'The State of Play' ? 'PREMIUM' : 'FREE';

  return (
    <div className="min-h-screen py-24">
      <article className="container mx-auto px-6 max-w-3xl">
        <div className="mb-8">
          <div className={`inline-block ${publicationColor} text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm mb-4`}>
            {publicationText}
          </div>
          
          {article.theme && (
            <p className="text-xs md:text-sm font-mono font-medium tracking-wider uppercase text-muted-foreground mb-4">
              {article.theme}
            </p>
          )}
          
          <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-6 leading-tight" data-testid="article-title">
            {article.title}
          </h1>
          
          {article.subtitle && (
            <p className="text-xl leading-8 text-foreground/70 font-body mb-6">
              {article.subtitle}
            </p>
          )}
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground font-body pb-6 border-b border-border/40">
            <span className="font-medium text-foreground">{article.author}</span>
            <span>•</span>
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(article.created_at), 'MMM dd, yyyy')}</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{article.read_time} min read</span>
            </div>
          </div>
        </div>

        {article.image_url && (
          <div className="relative w-full aspect-[16/9] mb-12 overflow-hidden rounded-sm">
            <img 
              src={article.image_url} 
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="relative">
          {canAccessContent ? (
            <div className="prose prose-lg max-w-none font-body" data-testid="article-content">
              <div className="text-base leading-8 text-foreground/80 whitespace-pre-wrap">
                {article.content}
              </div>
            </div>
          ) : (
            <>
              <div className="prose prose-lg max-w-none font-body mb-8">
                <div className="text-base leading-8 text-foreground/80 whitespace-pre-wrap">
                  {article.preview_content}
                </div>
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background flex flex-col items-center justify-end pb-20 backdrop-blur-[2px]" data-testid="paywall-overlay">
                <div className="bg-background/80 border border-primary/20 p-8 text-center max-w-md mx-auto backdrop-blur-md shadow-2xl rounded-sm">
                  <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-heading font-semibold mb-3">Subscribe to continue reading</h3>
                  <p className="text-base text-foreground/70 mb-6 font-body">
                    Get unlimited access to premium stories and exclusive analysis.
                  </p>
                  <Button 
                    onClick={() => navigate('/signup')}
                    className="rounded-none bg-primary text-white hover:bg-primary/90 font-medium uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all w-full"
                    data-testid="btn-paywall-subscribe"
                  >
                    Subscribe Now
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </article>
    </div>
  );
};
