import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const DarkModeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 hover:bg-foreground/5 dark:hover:bg-white/10 rounded-sm transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      data-testid="dark-mode-toggle"
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-foreground/60" />
      )}
    </button>
  );
};
