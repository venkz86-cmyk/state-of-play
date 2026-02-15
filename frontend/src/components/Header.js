import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { SearchModal } from './SearchModal';
import { DarkModeToggle } from './DarkModeToggle';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { User, LogOut, Menu, Search, Mail, Calendar } from 'lucide-react';
import { useState } from 'react';

// Logo URLs
const LOGO_LIGHT = "https://customer-assets.emergentagent.com/job_leftfield-hub/artifacts/fx9mc000_TSOP-Logo%20Final%3AColour.jpg";
const LOGO_DARK = "https://customer-assets.emergentagent.com/job_dcd955ba-7b95-4793-aa4a-cd2ca65f8014/artifacts/gykve31s_Publication%20Icon.jpg";

export const Header = () => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({ onSearchOpen: () => setSearchOpen(true) });

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Home', color: 'text-foreground' },
    { path: '/state-of-play', label: 'The State of Play', color: 'text-primary', isPremium: true },
    { path: '/left-field', label: 'The Left Field', color: 'text-secondary', isNewsletter: true },
    { path: '/outfield', label: 'The Outfield', color: 'text-muted-foreground', comingSoon: true, isEvents: true },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <img 
              src={isDark ? LOGO_DARK : LOGO_LIGHT}
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
                  {item.isNewsletter && (
                    <Mail className="ml-1.5 h-3.5 w-3.5 text-secondary" />
                  )}
                  {item.isEvents && (
                    <Calendar className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
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
          <div className="flex items-center space-x-2">
            {/* Search Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="text-foreground/60 hover:text-foreground hidden sm:flex items-center space-x-1"
              data-testid="btn-search"
            >
              <Search className="h-4 w-4" />
              <span className="text-xs text-muted-foreground">⌘K</span>
            </Button>
            
            {/* Dark Mode Toggle */}
            <DarkModeToggle />
            
            {user ? (
              <>
                <Link to="/account" className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors">
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {user.name || user.email?.split('@')[0]}
                  </span>
                  {user.is_paid && (
                    <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">
                      PRO
                    </span>
                  )}
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="btn-logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="font-body border-primary text-primary hover:bg-primary hover:text-white"
                    data-testid="btn-login-header"
                  >
                    Login
                  </Button>
                </Link>
                <Link to="/signup" className="hidden sm:inline-flex">
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
              
              {/* Mobile Auth Buttons */}
              <div className="border-t border-border mt-2 pt-2">
                {user ? (
                  <div className="space-y-2">
                    <Link to="/account" onClick={() => setMobileMenuOpen(false)}>
                      <div className="flex items-center space-x-2 px-3 py-2 hover:bg-muted rounded-lg transition-colors">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.name || user.email?.split('@')[0]}</p>
                          {user.is_paid && (
                            <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">PRO</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">My Account</span>
                      </div>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full"
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2 px-2">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Login</Button>
                    </Link>
                    <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full bg-primary text-white">Subscribe</Button>
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
      
      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};
