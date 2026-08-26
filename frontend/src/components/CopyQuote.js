import { useState, useEffect, useCallback } from 'react';
import { Twitter, Linkedin, Quote } from 'lucide-react';

// Estimated toolbar height (3 icon buttons + padding) — used to decide
// whether there's room to place the toolbar above the selection before
// it renders, so the very first paint already picks the right side.
const ESTIMATED_HEIGHT = 44;
const GAP = 10;

export const CopyQuote = () => {
  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [placement, setPlacement] = useState('above');

  const handleMouseUp = useCallback(() => {
    const selectedText = window.getSelection()?.toString().trim();

    if (selectedText && selectedText.length > 10 && selectedText.length < 500) {
      const range = window.getSelection()?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        const fitsAbove = rect.top - ESTIMATED_HEIGHT - GAP >= 0;
        setPlacement(fitsAbove ? 'above' : 'below');
        setPosition({
          x: rect.left + rect.width / 2,
          y: fitsAbove ? rect.top - GAP : rect.bottom + GAP
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
    const articleContent = document.querySelector('[data-testid="article-body"]');
    if (articleContent) {
      articleContent.addEventListener('mouseup', handleMouseUp);
      articleContent.addEventListener('mousedown', handleMouseDown);
      
      return () => {
        articleContent.removeEventListener('mouseup', handleMouseUp);
        articleContent.removeEventListener('mousedown', handleMouseDown);
      };
    }
  }, [handleMouseUp, handleMouseDown]);

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `"${selection}" — The State of Play`
  )}&url=${encodeURIComponent(pageUrl)}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;

  const copyQuote = () => {
    navigator.clipboard.writeText(`"${selection}" — The State of Play\n${window.location.href}`);
    setSelection(null);
  };

  if (!selection) return null;

  return (
    <div
      className={`fixed z-[60] bg-[var(--footer-bg)] text-white px-2 py-1.5 rounded shadow-xl flex items-center space-x-1 transform -translate-x-1/2 ${
        placement === 'above' ? '-translate-y-full' : ''
      }`}
      style={{ left: position.x, top: position.y }}
    >
      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setSelection(null)}
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
        title="Share on X"
      >
        <Twitter className="h-4 w-4" />
      </a>
      <a
        href={linkedInHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setSelection(null)}
        className="p-1.5 hover:bg-white/20 rounded transition-colors"
        title="Share on LinkedIn"
      >
        <Linkedin className="h-4 w-4" />
      </a>
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
