import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

export const ArticleCard = ({ article }) => {
  const publicationColor = article.publication === 'The State of Play' ? 'bg-premium' : 'bg-secondary';
  const publicationText = article.publication === 'The State of Play' ? 'PREMIUM' : 'FREE';

  return (
    <Link to={`/article/${article.id}`} data-testid={`article-card-${article.id}`}>
      <article className="group relative overflow-hidden bg-transparent border-b border-border/40 pb-8 hover:opacity-80 transition-opacity cursor-pointer">
        {article.image_url && (
          <div className="relative w-full aspect-[16/9] mb-6 overflow-hidden">
            <img 
              src={article.image_url} 
              alt={article.title}
              className="w-full h-full object-cover grayscale-[30%] group-hover:scale-105 transition-transform duration-500"
            />
            <div className={`absolute top-4 left-4 ${publicationColor} text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm`}>
              {publicationText}
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {article.theme && (
            <span className="text-xs md:text-sm font-mono font-medium tracking-wider uppercase text-muted-foreground">
              {article.theme}
            </span>
          )}
          
          <h3 className="text-2xl font-heading font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          
          {article.subtitle && (
            <p className="text-base leading-7 text-foreground/70">
              {article.subtitle}
            </p>
          )}
          
          <div className="flex items-center space-x-4 text-sm text-muted-foreground font-body">
            <span>{article.author}</span>
            <span>•</span>
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{article.read_time} min read</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};
