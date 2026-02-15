import { Link } from 'react-router-dom';
import { Clock, TrendingUp, Lock } from 'lucide-react';

export const ArticleCard = ({ article, featured = false }) => {
  const publicationColor = article.publication === 'The State of Play' ? 'border-primary/20' : 'border-secondary/20';
  const badgeColor = article.publication === 'The State of Play' ? 'bg-primary' : 'bg-secondary';
  const isPremium = article.is_premium;

  if (featured) {
    return (
      <Link to={`/${article.id}`} data-testid={`featured-article-${article.id}`}>
        <article className={`group relative overflow-hidden bg-card border-2 ${publicationColor} hover:border-primary/40 transition-all duration-300 hover:shadow-2xl cursor-pointer h-full`}>
          {article.image_url && (
            <div className="relative w-full aspect-[16/9] overflow-hidden">
              <img 
                src={article.image_url} 
                alt={article.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className={`absolute top-4 right-4 ${badgeColor} text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 font-mono shadow-lg flex items-center space-x-1.5`}>
                {isPremium && <Lock className="h-3 w-3" />}
                <span>{isPremium ? 'PREMIUM' : 'FREE'}</span>
              </div>
              {isPremium && (
                <div className="absolute top-4 left-4 bg-premium text-white p-2 rounded-full shadow-lg">
                  <TrendingUp className="h-4 w-4" />
                </div>
              )}
            </div>
          )}
          
          <div className="p-8">
            {article.theme && (
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-primary mb-3 block">
                {article.theme}
              </span>
            )}
            
            <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-4 leading-tight group-hover:text-primary transition-colors">
              {article.title}
            </h2>
            
            {article.subtitle && (
              <p className="text-base leading-relaxed text-foreground/70 mb-4">
                {article.subtitle}
              </p>
            )}
            
            <div className="flex items-center justify-between text-sm text-muted-foreground font-body pt-4 border-t border-border">
              <span className="font-semibold text-foreground">{article.author}</span>
              <div className="flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{article.read_time} min</span>
              </div>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link to={`/${article.id}`} data-testid={`article-card-${article.id}`}>
      <article className={`group relative overflow-hidden bg-card border ${publicationColor} hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 cursor-pointer h-full`}>
        {article.image_url && (
          <div className="relative w-full aspect-[16/10] overflow-hidden">
            <img 
              src={article.image_url} 
              alt={article.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className={`absolute top-3 left-3 ${badgeColor} text-white text-[8px] font-bold uppercase tracking-widest px-2 py-1 font-mono flex items-center space-x-1`}>
              {isPremium && <Lock className="h-2.5 w-2.5" />}
              <span>{isPremium ? 'PREMIUM' : 'FREE'}</span>
            </div>
          </div>
        )}
        
        <div className="p-6">
          {article.theme && (
            <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-primary/70 mb-2 block">
              {article.theme}
            </span>
          )}
          
          <h3 className="text-xl font-heading font-bold tracking-tight text-foreground mb-2 leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {article.title}
          </h3>
          
          {article.subtitle && (
            <p className="text-sm leading-relaxed text-foreground/60 mb-3 line-clamp-2">
              {article.subtitle}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground font-body pt-3 border-t border-border">
            <span className="font-medium">{article.author}</span>
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{article.read_time}m</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};
