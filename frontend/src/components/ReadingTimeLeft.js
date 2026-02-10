import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export const ReadingTimeLeft = ({ totalMinutes }) => {
  const [minutesLeft, setMinutesLeft] = useState(totalMinutes);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollTop / docHeight : 0;
      const remaining = Math.max(1, Math.ceil(totalMinutes * (1 - progress)));
      setMinutesLeft(remaining);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [totalMinutes]);

  return (
    <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span>{minutesLeft} min left</span>
    </div>
  );
};
