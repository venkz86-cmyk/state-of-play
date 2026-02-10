import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { User, LogOut } from 'lucide-react';

export const Header = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center space-x-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_leftfield-hub/artifacts/fx9mc000_TSOP-Logo%20Final%3AColour.jpg" 
              alt="The State of Play" 
              className="h-12 w-auto"
            />
          </Link>

          <nav className="hidden md:flex items-center space-x-1">
            <Link to="/">
              <Button 
                variant="ghost" 
                className={`font-body font-medium tracking-wide rounded-none ${isActive('/') ? 'text-primary' : 'text-foreground/70'}`}
                data-testid="nav-home"
              >
                Home
              </Button>
            </Link>
            <Link to="/state-of-play">
              <Button 
                variant="ghost" 
                className={`font-body font-medium tracking-wide rounded-none ${isActive('/state-of-play') ? 'text-primary' : 'text-foreground/70'}`}
                data-testid="nav-state-of-play"
              >
                <span className="text-primary">The State of Play</span>
              </Button>
            </Link>
            <Link to="/left-field">
              <Button 
                variant="ghost" 
                className={`font-body font-medium tracking-wide rounded-none ${isActive('/left-field') ? 'text-secondary' : 'text-foreground/70'}`}
                data-testid="nav-left-field"
              >
                <span className="text-secondary">The Left Field</span>
              </Button>
            </Link>
          </nav>

          <div className="flex items-center space-x-2">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-none"
                    data-testid="btn-dashboard"
                  >
                    <User className="h-4 w-4 mr-2" />
                    {user.name}
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={logout}
                  className="rounded-none"
                  data-testid="btn-logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-none font-medium"
                    data-testid="btn-login-header"
                  >
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button 
                    size="sm" 
                    className="rounded-none bg-primary text-white hover:bg-primary/90 font-medium uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    data-testid="btn-signup-header"
                  >
                    Subscribe
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
