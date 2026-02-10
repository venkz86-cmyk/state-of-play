import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

export const RelatedArticles = ({ articles, currentSlug }) => {
  // Filter out current article and limit to 3
  const related = articles
    .filter(article => article.slug !== currentSlug)
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <div className="bg-gray-50 border-t-2 border-border py-12">
      <div className="container mx-auto px-6 max-w-4xl">
        <h3 className="text-2xl font-heading font-bold mb-8">More from The State of Play</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {related.map((article) => (
            <Link
              key={article.id}
              to={`/article/${article.id}`}
              className="group bg-white border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg"
            >
              {article.image_url && (
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-4">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 ${article.is_premium ? 'bg-primary text-white' : 'bg-secondary text-white'}`}>
                  {article.is_premium ? 'Premium' : 'Free'}
                </span>
                <h4 className="font-heading font-bold text-sm mt-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h4>
                <div className="flex items-center text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{article.read_time} min read</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
