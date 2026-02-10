import { useState, useEffect } from 'react';
import { Minus, Plus, Type } from 'lucide-react';

export const FontSizeToggle = () => {
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('articleFontSize') || '100');
  });

  useEffect(() => {
    // Apply font size via CSS variable on document root
    const calculatedSize = `${1.125 * fontSize / 100}rem`;
    document.documentElement.style.setProperty('--article-font-size', calculatedSize);
    localStorage.setItem('articleFontSize', fontSize.toString());
  }, [fontSize]);

  const decrease = () => setFontSize(Math.max(80, fontSize - 10));
  const increase = () => setFontSize(Math.min(140, fontSize + 10));
  const reset = () => setFontSize(100);

  return (
    <div className="flex items-center space-x-1 bg-foreground/5 rounded-sm p-1">
      <button
        onClick={decrease}
        disabled={fontSize <= 80}
        className="p-1.5 hover:bg-foreground/10 rounded-sm transition-colors disabled:opacity-30"
        title="Decrease font size"
      >
        <Minus className="h-3.5 w-3.5 text-foreground/70" />
      </button>
      
      <button
        onClick={reset}
        className="px-2 py-1 text-xs font-medium text-foreground/70 hover:bg-foreground/10 rounded-sm transition-colors min-w-[3rem] flex items-center justify-center space-x-1"
        title="Reset font size"
      >
        <Type className="h-3 w-3" />
        <span>{fontSize}%</span>
      </button>
      
      <button
        onClick={increase}
        disabled={fontSize >= 140}
        className="p-1.5 hover:bg-foreground/10 rounded-sm transition-colors disabled:opacity-30"
        title="Increase font size"
      >
        <Plus className="h-3.5 w-3.5 text-foreground/70" />
      </button>
    </div>
  );
};
