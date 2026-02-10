import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, X, History } from 'lucide-react';

const STORAGE_KEY = 'tsop_reading_history';
const MAX_HISTORY = 10;

// Utility functions for managing reading history
export const addToReadingHistory = (article) => {
  const history = getReadingHistory();
  
  // Remove if already exists
  const filtered = history.filter(item => item.id !== article.id);
  
  // Add to beginning
  const newHistory = [
    {
      id: article.id,
      title: article.title,
      read_time: article.read_time,
      image_url: article.image_url,
      is_premium: article.is_premium,
      timestamp: Date.now()
    },
    ...filtered
  ].slice(0, MAX_HISTORY);
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
};

export const getReadingHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearReadingHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// Component to display reading history
export const ReadingHistory = ({ variant = 'sidebar' }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(getReadingHistory());
  }, []);

  const handleClear = () => {
    clearReadingHistory();
    setHistory([]);
  };

  if (history.length === 0) return null;

  if (variant === 'inline') {
    return (
      <div className="bg-foreground/5 border border-border/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold flex items-center">
            <History className="h-4 w-4 mr-2 text-primary" />
            Continue Reading
          </h3>
          <button
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
        <div className="space-y-3">
          {history.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              to={`/article/${item.id}`}
              className="flex items-center space-x-3 group"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-16 h-12 object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3 mr-1" />
                  {item.read_time} min read
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold flex items-center">
          <History className="h-4 w-4 mr-1.5 text-primary" />
          Recently Read
        </h4>
        <button
          onClick={handleClear}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Clear history"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-2">
        {history.slice(0, 5).map((item) => (
          <Link
            key={item.id}
            to={`/article/${item.id}`}
            className="block text-sm hover:text-primary transition-colors line-clamp-1"
          >
            {item.title}
          </Link>
        ))}
      </div>
    </div>
  );
};
