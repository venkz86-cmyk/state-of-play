import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ghostAPI } from '../services/ghostAPI';
import { RazorpayButton } from '../components/RazorpayButton';
import { Clock, Calendar, Shield, TrendingUp, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

export const ArticlePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readProgress, setReadProgress] = useState(0);

  useEffect(() => {
    fetchArticle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reading progress tracker
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setReadProgress(Math.min(progress, 100));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchArticle = async () => {
    try {
      console.log('Fetching article with slug:', id);
      const post = await ghostAPI.getPost(id);
      console.log('Received post:', post);
      setArticle(post);
    } catch (error) {
      console.error('Failed to fetch article:', error);
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

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground font-body">Article not found</p>
      </div>
    );
  }

  // Determine user status and content access
  const isLoggedIn = !!user;
  const isPaidMember = user?.is_subscriber || user?.paid;
  const isFreeMember = isLoggedIn && !isPaidMember;
  const canAccessContent = !article.is_premium || isPaidMember;
  
  const publicationColor = article.publication === 'The State of Play' ? 'bg-primary' : 'bg-secondary';
  const publicationText = article.publication === 'The State of Play' ? 'PREMIUM' : 'FREE';

  return (
    <div className="min-h-screen bg-white">
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 z-50">
        <div 
          className="h-full bg-primary transition-all duration-150 ease-out"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      {/* Article Header */}
      <article className="container mx-auto px-6 max-w-4xl py-16">
        <div className="mb-10">
          <div className="flex items-center space-x-3 mb-6">
            <div className={`${publicationColor} text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 font-mono`}>
              {publicationText}
            </div>
            {article.theme && (
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-primary/70">
                {article.theme}
              </span>
            )}
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black tracking-tight mb-6 leading-[1.1] text-balance" data-testid="article-title">
            {article.title}
          </h1>
          
          {article.subtitle && (
            <p className="text-xl md:text-2xl leading-relaxed text-foreground/70 font-body mb-8 text-balance">
              {article.subtitle}
            </p>
          )}
          
          <div className="flex items-center flex-wrap gap-4 text-sm text-muted-foreground font-body pb-8 border-b-2 border-border">
            <span className="font-bold text-foreground text-base">{article.author}</span>
            <div className="flex items-center space-x-1.5">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(article.created_at), 'MMM dd, yyyy')}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-primary/5 px-3 py-1 rounded-full">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">{article.read_time} min read</span>
            </div>
          </div>
        </div>

        {article.image_url && (
          <figure className="mb-12">
            <div className="relative w-full aspect-[16/9] overflow-hidden border-2 border-border">
              <img 
                src={article.image_url} 
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
            {article.image_caption && (
              <figcaption 
                className="mt-3 text-sm text-muted-foreground font-body text-center italic"
                dangerouslySetInnerHTML={{ __html: article.image_caption }}
              />
            )}
          </figure>
        )}

        {/* Content with Hard Paywall */}
        <div className="relative">
          {canAccessContent ? (
            <>
              <div 
                className="prose prose-lg max-w-none font-body article-content" 
                data-testid="article-content"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
              {/* End of article + Comments Section */}
              <div className="mt-16 pt-8 border-t-2 border-border">
                <p className="text-sm text-muted-foreground font-body text-center mb-8">
                  Thanks for reading The State of Play
                </p>
                
                {/* Comments CTA */}
                <div className="bg-primary-50 border-2 border-primary/20 p-8 text-center">
                  <h3 className="text-xl font-heading font-bold mb-3">Join the Discussion</h3>
                  <p className="text-sm text-foreground/70 mb-6 max-w-md mx-auto">
                    Have thoughts on this story? Share your comments and join the conversation.
                  </p>
                  <a 
                    href={`https://the-state-of-play.ghost.io/${article.slug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 bg-primary text-white hover:bg-primary-700 font-semibold px-6 py-3 transition-all"
                  >
                    <span>View Comments</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Preview Content */}
              <div className="relative">
                <div 
                  className="prose prose-lg max-w-none font-body article-content"
                  dangerouslySetInnerHTML={{ __html: article.preview_content }}
                />
                {/* Fade Effect */}
                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none" />
              </div>
              
              {/* Hard Paywall - Different messaging for free members vs visitors */}
              <div className="relative py-16" data-testid="paywall-overlay">
                <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-primary-100/80" />
                
                <div className="relative z-10 max-w-xl mx-auto">
                  <div className="bg-white border-2 border-primary shadow-2xl p-10 text-center">
                    {/* Icon */}
                    <div className="relative inline-flex items-center justify-center mb-6">
                      <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl" />
                      <div className="relative bg-primary text-white p-5 rounded-full">
                        {isFreeMember ? <Sparkles className="h-10 w-10" /> : <Shield className="h-10 w-10" />}
                      </div>
                    </div>
                    
                    {isFreeMember ? (
                      <>
                        {/* Personalized message for free members */}
                        <div className="mb-3">
                          <span className="inline-block bg-secondary text-white text-xs font-bold uppercase tracking-widest px-3 py-1 mb-4">
                            Free Member
                          </span>
                        </div>
                        
                        <h3 className="text-3xl font-heading font-bold mb-4 text-foreground">
                          Upgrade to unlock this story
                        </h3>
                        
                        <p className="text-base text-foreground/70 mb-4 font-body leading-relaxed">
                          Hey {user?.name || 'there'}! You're enjoying our free content. 
                          Upgrade to premium for unlimited access to stories like this.
                        </p>
                        
                        <div className="bg-primary/5 border border-primary/20 p-4 mb-6 text-left">
                          <p className="text-sm font-bold text-foreground mb-2">As a premium member, you'll get:</p>
                          <ul className="space-y-2 text-sm text-foreground/80">
                            <li className="flex items-center space-x-2">
                              <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                              <span>All premium stories & deep-dive analysis</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                              <span>Exclusive interviews & insider access</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                              <span>Ad-free reading experience</span>
                            </li>
                          </ul>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Standard message for visitors */}
                        <div className="mb-3">
                          <span className="inline-block bg-premium text-white text-xs font-bold uppercase tracking-widest px-3 py-1 mb-4">
                            Premium Content
                          </span>
                        </div>
                        
                        <h3 className="text-3xl font-heading font-bold mb-4 text-foreground">
                          Subscribe to unlock this story
                        </h3>
                        
                        <p className="text-base text-foreground/70 mb-8 font-body leading-relaxed">
                          Get unlimited access to premium analysis, exclusive interviews, and deep dives into Indian sports business.
                        </p>
                        
                        <div className="space-y-3 mb-8">
                          <div className="flex items-center justify-center space-x-2 text-sm text-foreground/80">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span>Premium stories & analysis</span>
                          </div>
                          <div className="flex items-center justify-center space-x-2 text-sm text-foreground/80">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span>Exclusive interviews</span>
                          </div>
                          <div className="flex items-center justify-center space-x-2 text-sm text-foreground/80">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span>Ad-free reading</span>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* Razorpay Payment Button */}
                    <RazorpayButton className="mb-4" />
                    
                    {!isLoggedIn && (
                      <p className="text-xs text-muted-foreground">
                        Already a member?{' '}
                        <button onClick={() => navigate('/login')} className="text-primary hover:underline font-semibold">
                          Sign in
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Bottom blur to prevent reading */}
              <div className="h-48 bg-gradient-to-b from-primary-100/80 to-white" />
            </>
          )}
        </div>
      </article>
    </div>
  );
};
