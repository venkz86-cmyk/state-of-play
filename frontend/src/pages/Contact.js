import { Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

export const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.success('Message sent! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl py-20">
        <div className="max-w-2xl mb-16">
          <h1 className="text-5xl md:text-6xl font-heading font-black tracking-tight leading-tight mb-6">
            Get in touch
          </h1>
          <p className="text-xl leading-relaxed text-foreground/70 font-body">
            Have a story tip? Want to collaborate? Or just want to say hello? We'd love to hear from you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2 font-body">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-border focus:border-primary outline-none transition-colors font-body"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 font-body">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 border-2 border-border focus:border-primary outline-none transition-colors font-body"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 font-body">Message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-border focus:border-primary outline-none transition-colors font-body resize-none"
                  placeholder="Tell us what's on your mind..."
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="bg-primary text-white hover:bg-primary-700 font-bold px-8 py-6 text-base transition-all hover:shadow-xl"
              >
                Send Message
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-heading font-bold mb-6">Reach us directly</h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-semibold text-sm mb-1">Email</p>
                    <a href="mailto:hello@stateofplay.club" className="text-foreground/70 hover:text-primary transition-colors">
                      hello@stateofplay.club
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-semibold text-sm mb-1">Location</p>
                    <p className="text-foreground/70">Mumbai, India</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary-50 border-2 border-primary/20 p-6">
              <h4 className="font-heading font-bold mb-2">For Press Inquiries</h4>
              <p className="text-sm text-foreground/70 mb-3">
                Media and press-related questions
              </p>
              <a href="mailto:press@stateofplay.club" className="text-primary hover:underline font-semibold text-sm">
                press@stateofplay.club
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
