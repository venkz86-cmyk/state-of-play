import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { SearchModal } from './SearchModal';
import { User, LogOut, Menu, Search } from 'lucide-react';
import { useState } from 'react';

export const Header = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Home', color: 'text-foreground' },
    { path: '/state-of-play', label: 'The State of Play', color: 'text-primary', isPremium: true },
    { path: '/left-field', label: 'The Left Field', color: 'text-secondary' },
    { path: '/outfield', label: 'The Outfield', color: 'text-muted-foreground', comingSoon: true },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <img 
              src="https://customer-assets.emergentagent.com/job_leftfield-hub/artifacts/fx9mc000_TSOP-Logo%20Final%3AColour.jpg" 
              alt="The State of Play" 
              className="h-14 w-auto transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button 
                  variant="ghost" 
                  className={`font-body font-medium tracking-wide relative ${
                    isActive(item.path) ? item.color : 'text-foreground/60 hover:text-foreground'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <span>{item.label}</span>
                  {item.comingSoon && (
                    <span className="absolute -top-2 -right-2 bg-accent text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase shadow-md border border-accent/20">
                      Soon
                    </span>
                  )}
                  {item.isPremium && (
                    <span className="ml-1.5 text-premium text-xs">★</span>
                  )}
                  {isActive(item.path) && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-current rounded-full" />
                  )}
                </Button>
              </Link>
            ))}
            
            <div className="h-6 w-px bg-border mx-2" />
            
            <Link to="/about">
              <Button 
                variant="ghost" 
                className={`font-body font-medium relative ${
                  isActive('/about') ? 'text-foreground' : 'text-foreground/60 hover:text-foreground'
                }`}
                data-testid="nav-about"
              >
                About
                {isActive('/about') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-current rounded-full" />
                )}
              </Button>
            </Link>
            <Link to="/contact">
              <Button 
                variant="ghost" 
                className={`font-body font-medium relative ${
                  isActive('/contact') ? 'text-foreground' : 'text-foreground/60 hover:text-foreground'
                }`}
                data-testid="nav-contact"
              >
                Contact
                {isActive('/contact') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-current rounded-full" />
                )}
              </Button>
            </Link>
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="font-body"
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
                    className="font-body hidden md:inline-flex"
                    data-testid="btn-login-header"
                  >
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button 
                    size="sm" 
                    className="bg-primary text-white hover:bg-primary-700 font-semibold px-6 transition-all hover:shadow-lg hover:-translate-y-0.5"
                    data-testid="btn-signup-header"
                  >
                    Subscribe
                  </Button>
                </Link>
              </>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-border mt-2 pt-2">
            <nav className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start ${item.color}`}
                  >
                    {item.label}
                    {item.comingSoon && (
                      <span className="ml-2 bg-accent text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase">
                        Soon
                      </span>
                    )}
                  </Button>
                </Link>
              ))}
              <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">About</Button>
              </Link>
              <Link to="/contact" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">Contact</Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
