import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-40 bg-primary text-white p-3 shadow-lg hover:bg-primary-700 transition-all hover:scale-110"
      aria-label="Back to top"
      data-testid="back-to-top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
};
