import { Mail, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

export const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Open mailto link with form data
    const subject = encodeURIComponent(`Contact from ${formData.name}`);
    const body = encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`);
    window.location.href = `mailto:venkat@stateofplay.club?subject=${subject}&body=${body}`;
    toast.success('Opening your email client...');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl py-20">
        <div className="max-w-2xl mb-16">
          <h1 className="text-5xl md:text-6xl font-heading font-black tracking-tight leading-tight mb-6">
            Get in touch
          </h1>
          <p className="text-xl leading-relaxed text-foreground/70 font-body">
            Have a story tip? Want to collaborate? Or just want to say hello? I'd love to hear from you.
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
              <h3 className="text-xl font-heading font-bold mb-6">Reach me directly</h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-semibold text-sm mb-1">Email</p>
                    <a href="mailto:venkat@stateofplay.club" className="text-foreground/70 hover:text-primary transition-colors">
                      venkat@stateofplay.club
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-semibold text-sm mb-1">Location</p>
                    <p className="text-foreground/70">Bengaluru, India 🇮🇳</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary-50 border-2 border-primary/20 p-6">
              <h4 className="font-heading font-bold mb-2">Story Tips</h4>
              <p className="text-sm text-foreground/70 mb-3">
                Have an exclusive tip or lead?
              </p>
              <a href="mailto:venkat@stateofplay.club" className="text-primary hover:underline font-semibold text-sm">
                venkat@stateofplay.club
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
