import { useState, useEffect, useCallback } from 'react';
import { Twitter, Linkedin, Quote } from 'lucide-react';

export const CopyQuote = () => {
  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseUp = useCallback(() => {
    const selectedText = window.getSelection()?.toString().trim();
    
    if (selectedText && selectedText.length > 10 && selectedText.length < 500) {
      const range = window.getSelection()?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect) {
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + window.scrollY - 10
        });
        setSelection(selectedText);
      }
    } else {
      setSelection(null);
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    setSelection(null);
  }, []);

  useEffect(() => {
    const articleContent = document.querySelector('.article-content');
    if (articleContent) {
      articleContent.addEventListener('mouseup', handleMouseUp);
      articleContent.addEventListener('mousedown', handleMouseDown);
      
      return () => {
        articleContent.removeEventListener('mouseup', handleMouseUp);
        articleContent.removeEventListener('mousedown', handleMouseDown);
      };
    }
  }, [handleMouseUp, handleMouseDown]);

  const shareOnTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`"${selection}" — The State of Play`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    setSelection(null);
  };

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
    setSelection(null);
  };

  const copyQuote = () => {
    navigator.clipboard.writeText(`"${selection}" — The State of Play\n${window.location.href}`);
    setSelection(null);
  };

  if (!selection) return null;

  return (
    <div
      className="fixed z-50 bg-foreground text-white px-2 py-1.5 rounded shadow-xl flex items-center space-x-1 transform -translate-x-1/2 -translate-y-full"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={shareOnTwitter}
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
        title="Share on Twitter"
      >
        <Twitter className="h-4 w-4" />
      </button>
      <button
        onClick={shareOnLinkedIn}
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
        title="Share on LinkedIn"
      >
        <Linkedin className="h-4 w-4" />
      </button>
      <button
        onClick={copyQuote}
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
        title="Copy quote"
      >
        <Quote className="h-4 w-4" />
      </button>
    </div>
  );
};
