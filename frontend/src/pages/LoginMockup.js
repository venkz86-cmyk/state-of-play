import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { MockupHeader } from '../components/MockupHeader';
import { Overline } from '../components/MockupLayout';

export const LoginMockup = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div
      className="min-h-screen bg-[#F7F7F5] dark:bg-[#090E17] text-[#0F172A] dark:text-[#F8FAFC]"
      data-testid="mockup-login"
    >
      <MockupHeader />

      <main className="border-t border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-5rem)]">
          {/* Editorial column — pull quote */}
          <aside className="lg:col-span-7 bg-[#0F172A] text-white relative overflow-hidden">
            <div className="h-full px-8 lg:px-16 py-16 lg:py-24 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <Overline className="!text-[#FF6B35]">— Member Access —</Overline>
              </div>

              <blockquote className="max-w-2xl">
                <p className="font-editorial italic text-3xl sm:text-4xl lg:text-[3.25rem] leading-[1.1] tracking-tight text-white">
                  “Indian sport is no longer the side bet. It’s where the real money is being placed — and we’re publishing the receipts.”
                </p>
                <footer className="mt-10 flex items-center gap-3">
                  <span className="h-px w-12 bg-white/40" />
                  <Overline className="!text-white/70">Venkatesh Sridhar · Founding Editor</Overline>
                </footer>
              </blockquote>

              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Overline className="!text-white/40">Mumbai</Overline>
                <Overline className="!text-white/40">Bengaluru</Overline>
                <Overline className="!text-white/40">Worldwide</Overline>
              </div>
            </div>
          </aside>

          {/* Form column */}
          <section className="lg:col-span-5 px-6 lg:px-12 py-16 lg:py-24 flex items-center">
            <div className="w-full max-w-md mx-auto">
              <Overline className="text-[#234ba0] mb-5 block">— Sign In —</Overline>
              <h1 className="font-editorial font-semibold tracking-tight text-4xl lg:text-[3rem] leading-[1.05] mb-4">
                Welcome back.
              </h1>
              <p className="font-plex text-base text-[#475569] dark:text-[#94A3B8] mb-10 max-w-[40ch]">
                Enter the email associated with your subscription. Members are signed in instantly — no OTP required.
              </p>

              {!submitted ? (
                <form onSubmit={onSubmit} className="space-y-7">
                  <div>
                    <label
                      htmlFor="email"
                      className="block font-plex-mono text-[10px] tracking-[0.22em] uppercase text-[#475569] mb-3"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="login-email"
                      placeholder="you@yourdomain.com"
                      className="w-full bg-transparent border-0 border-b-2 border-[#0F172A] dark:border-[#F8FAFC] font-plex text-lg py-3 focus:outline-none focus:border-[#234ba0] placeholder:text-[#94A3B8]"
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="login-submit"
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#FF6B35] hover:bg-[#e55e2d] text-white font-plex font-semibold px-8 py-4 text-base tracking-wide transition-colors duration-200"
                  >
                    Sign in
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                  </button>

                  <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
                    Not a member yet?{' '}
                    <Link
                      to="/mockup/subscribe"
                      className="text-[#234ba0] underline underline-offset-4 hover:text-[#FF6B35] transition-colors duration-200"
                    >
                      Subscribe
                    </Link>
                    .
                  </p>
                </form>
              ) : (
                <div className="border-y-2 border-[#0F172A] dark:border-[#F8FAFC] py-10">
                  <Overline className="text-[#FF6B35] mb-4 block">— Verifying —</Overline>
                  <h2 className="font-editorial font-semibold text-2xl lg:text-[1.75rem] leading-snug mb-4">
                    Checking your subscription…
                  </h2>
                  <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
                    If you’re a paid member, you’ll be signed in automatically. Otherwise you’ll be prompted to subscribe.
                  </p>
                </div>
              )}

              <div className="mt-12 pt-8 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                <Overline className="block mb-3">Trouble signing in?</Overline>
                <a
                  href="mailto:venkat@stateofplay.club"
                  className="inline-flex items-center gap-2 font-plex-mono text-[11px] tracking-[0.22em] uppercase text-[#0F172A] dark:text-[#F8FAFC] border-b border-[#0F172A] dark:border-[#F8FAFC] pb-1 hover:text-[#234ba0] hover:border-[#234ba0] transition-colors duration-200"
                >
                  Email the desk
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default LoginMockup;
