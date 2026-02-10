import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ghostAPI } from '../services/ghostAPI';

export const SearchModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const searchArticles = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      try {
        const posts = await ghostAPI.getPosts({ limit: 50 });
        const filtered = posts.filter(post => 
          post.title.toLowerCase().includes(query.toLowerCase()) ||
          post.subtitle?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 8);
        setResults(filtered);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchArticles, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-card w-full max-w-2xl mx-auto mt-20 shadow-2xl border-2 border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b-2 border-border p-4">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles..."
            className="flex-1 outline-none text-lg font-body bg-transparent text-foreground"
          />
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-muted-foreground">
              Searching...
            </div>
          )}
          
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No articles found for "{query}"
            </div>
          )}
          
          {results.map((article) => (
            <Link
              key={article.id}
              to={`/article/${article.id}`}
              onClick={onClose}
              className="block p-4 hover:bg-muted border-b border-border/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 ${article.is_premium ? 'bg-primary text-white' : 'bg-secondary text-white'}`}>
                    {article.is_premium ? 'Premium' : 'Free'}
                  </span>
                  <h3 className="font-heading font-bold mt-2 text-foreground">{article.title}</h3>
                  {article.subtitle && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{article.subtitle}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
          
          {query.length < 2 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
