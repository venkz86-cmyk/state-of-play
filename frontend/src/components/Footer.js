import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-foreground text-white py-12">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="text-2xl font-heading font-bold mb-4">
              THE STATE OF PLAY
            </div>
            <p className="text-white/70 text-sm font-body leading-relaxed mb-4 max-w-md">
              India's premium publication covering the business of sport with depth, insight, and unmatched reporting.
            </p>
            <div className="flex items-center text-sm text-white/70">
              <MapPin className="h-4 w-4 mr-2" />
              <span>Bengaluru, India 🇮🇳</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4">Navigation</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/state-of-play" className="hover:text-white transition-colors">The State of Play</Link></li>
              <li><Link to="/left-field" className="hover:text-white transition-colors">The Left Field</Link></li>
              <li><Link to="/archive" className="hover:text-white transition-colors">Archive</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/membership" className="hover:text-white transition-colors">Membership</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-white/60">
            <p>© 2026 Left Field Ventures. All rights reserved. Published as The State of Play.</p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <span>•</span>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
