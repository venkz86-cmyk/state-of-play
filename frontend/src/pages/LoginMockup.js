import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MockupHeader } from '../components/MockupHeader';

const datelineDate = (d = new Date()) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export const LoginMockup = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const onSubmit = (e) => { e.preventDefault(); setSubmitted(true); };

  return (
    <div
      className="min-h-screen bg-[#F7F7F5] dark:bg-[#090E17] text-[#0F172A] dark:text-[#F8FAFC]"
      data-testid="mockup-login"
    >
      <MockupHeader />

      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[#0F172A]/15 dark:border-[#F8FAFC]/15 pb-3">
          <span className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
            Bengaluru · {datelineDate()}
          </span>
          <span className="font-editorial italic text-sm text-[#475569] dark:text-[#94A3B8] tabular-nums">
            Sign in
          </span>
        </div>
      </div>

      <section className="max-w-[560px] mx-auto px-6 lg:px-0 pt-16 lg:pt-24 pb-32">
        <h1 className="font-editorial font-semibold tracking-tight text-[2rem] sm:text-[2.5rem] lg:text-[3rem] leading-[1.06] mb-5">
          Welcome back.
        </h1>
        <p className="font-plex text-base lg:text-lg text-[#475569] dark:text-[#94A3B8] mb-10 max-w-[45ch] leading-relaxed">
          Enter the email associated with your subscription. Members are signed in instantly — no OTP required.
        </p>

        {!submitted ? (
          <form onSubmit={onSubmit} className="space-y-7">
            <div>
              <label htmlFor="email" className="block font-plex text-xs tracking-[0.18em] uppercase text-[#475569] mb-2">
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
                className="w-full bg-transparent border-0 border-b border-[#0F172A] dark:border-[#F8FAFC] font-plex text-lg py-3 focus:outline-none focus:border-[var(--accent)] placeholder:text-[#94A3B8]"
              />
            </div>
            <button
              type="submit"
              data-testid="login-submit"
              className="font-plex text-base text-[var(--accent)] underline underline-offset-[6px] decoration-1 hover:decoration-2 transition-all"
            >
              Sign in →
            </button>
            <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
              Not a member yet?{' '}
              <Link to="/mockup/subscribe" className="text-[#0F172A] dark:text-[#F8FAFC] underline underline-offset-4 hover:text-[var(--accent)] transition-colors">
                Subscribe
              </Link>.
            </p>
          </form>
        ) : (
          <div className="border-t border-[#0F172A] dark:border-[#F8FAFC] pt-8">
            <p className="font-editorial italic text-xl mb-3">Verifying your subscription…</p>
            <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8] max-w-[45ch]">
              If you’re a paid member, you’ll be signed in automatically. Otherwise you’ll be prompted to subscribe.
            </p>
          </div>
        )}

        <div className="mt-16 pt-6 border-t border-[#E2E8F0] dark:border-[#1E293B]">
          <p className="font-plex text-sm text-[#475569] dark:text-[#94A3B8]">
            Trouble signing in?{' '}
            <a href="mailto:venkat@stateofplay.club" className="text-[#0F172A] dark:text-[#F8FAFC] underline underline-offset-4 hover:text-[var(--accent)] transition-colors">
              Email the desk
            </a>.
          </p>
        </div>
      </section>
    </div>
  );
};

export default LoginMockup;
