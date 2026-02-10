import { useEffect } from 'react';

export const useKeyboardShortcuts = ({ onSearchOpen }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K or "/" to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onSearchOpen?.();
      }
      
      // "/" to open search (when not in input)
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        onSearchOpen?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchOpen]);
};
