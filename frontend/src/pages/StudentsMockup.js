import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { MockupLayout, Overline } from '../components/MockupLayout';

const API = process.env.REACT_APP_BACKEND_URL;

// TODO(Venkat): replace with the real Tally form URL once it's built
// (see the Student plan build spec, section 3).
const TALLY_FORM_URL = 'https://tally.so/r/REPLACE_ME';

// TODO(Venkat): replace with the real Razorpay payment links once
// created (spec section 4 suggests these exact slugs).
const RAZORPAY_LINK_IN = 'https://rzp.io/rzp/tsopstudent';
const RAZORPAY_LINK_USD = 'https://rzp.io/rzp/tsopstudentusd';

const longDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

const HOW_IT_WORKS = [
  ['Apply', 'Submit the form with your name, college and a photo of your current student ID.'],
  ['We verify', 'Venkat checks the ID by hand.'],
  ['Pay and start reading', 'Once approved, you get a payment link by email. Pay it and you\'re in: every story, the whole archive.'],
];

const FAQS = [
  ['What ID works?', 'A current student ID from any recognised institution, in India or abroad, showing your name, your institution and a validity date. A fee receipt or enrollment letter works too if your ID doesn\'t show all three.'],
  ['How long does verification take?', 'Most applications get a decision within two working days. If anything on the ID needs a closer look, we\'ll email you before deciding either way.'],
  ['What happens when I graduate?', 'You\'ll get a note near the end of your plan. If you\'re still studying, reply with a current ID and renew at the same price. If you\'ve graduated, the student price ends, and we\'ll point you to the annual plan.'],
  ['What\'s your refund policy?', 'Full refund within 7 days of payment, no questions. After that, write to us and we\'ll work it out case by case.'],
  ['I\'m already a free member', 'Apply with the same email you use for your free account. Once you\'re approved and pay, that account gets upgraded, nothing new to set up.'],
];

export const StudentsMockup = () => {
  const { user, isLoggedIn, loading: authLoading, canAccessPremium } = useAuth();
  const pricing = useGeoPricing();
  const [details, setDetails] = useState(null);

  const isStudent = user?.tier === 'student';

  useEffect(() => {
    let active = true;
    if (!user?.email || !API || !isStudent) return;
    (async () => {
      try {
        const r = await axios.post(`${API}/api/ghost/member-details`, { email: user.email }, { timeout: 8000 });
        if (active && r.data) setDetails(r.data);
      } catch (e) {
        console.error('Member details failed:', e);
      }
    })();
    return () => { active = false; };
  }, [user?.email, isStudent]);

  return (
    <MockupLayout testId="mockup-students" seo={{ title: 'Student Plan', path: '/students', description: 'The State of Play for currently enrolled students: the same weekly reporting and full archive as the annual plan, at a student price.' }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">For Students</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)] tabular-nums">Student plan</span>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-12">
        <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[2.75rem] leading-[1.1] mb-5 max-w-[22ch]">
          Same stories, <em className="italic font-normal">student price.</em>
        </h1>
        <p className="font-plex text-base md:text-lg text-[var(--text-muted)] max-w-[60ch] leading-relaxed mb-4">
          Every weekly story and the full archive, at a student price. Verification is manual and by ID, so the price stays real for the people it's for.
        </p>
        <p className="font-plex text-base text-[var(--text-muted)] max-w-[60ch] leading-relaxed">
          The weekly story, the Left Field briefing on Mondays and Wednesdays, and the full archive. Same as the annual plan.
        </p>
      </section>

      {/* Who qualifies */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <p className="font-editorial italic text-lg">Who qualifies</p>
          </div>
          <div className="lg:col-span-8">
            <p className="font-plex text-base leading-relaxed text-[var(--text-muted)] max-w-[60ch]">
              Currently enrolled students at any recognised institution, in India or abroad. One application per person. Verification is by ID, checked by hand, not by email domain, so it works the same whether your college uses a .ac.in address or not.
            </p>
          </div>
        </div>
      </section>

      {/* Price block */}
      <section data-testid="students-pricing" className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-6">Price</p>
          <div className="flex items-end gap-3 mb-2">
            <span className="font-editorial font-semibold tracking-tight text-[3rem] lg:text-[3.5rem] leading-[0.9] text-[var(--text)]">
              {pricing.country === 'IN' ? '₹1,770' : '$29'}
            </span>
            <span className="font-plex text-base text-[var(--text-muted)] pb-2">
              {pricing.country === 'IN' ? '/ year, GST included' : '/ year'}
            </span>
          </div>
          {pricing.country === 'IN' && (
            <p className="font-plex text-[14px] text-[var(--text-label)] mb-3">₹1,500 + 18% GST</p>
          )}
          <p className="font-plex text-sm leading-relaxed text-[var(--text-muted)] max-w-[55ch]">
            The annual plan is {pricing.country === 'IN' ? '₹3,499 + GST' : '$169'} a year. The student plan is the same access, for a fraction of the price.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-12">
        <div className="border-t border-[var(--text)] pt-8">
          <p className="font-editorial italic text-lg mb-8">How it works</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8">
            {HOW_IT_WORKS.map(([t, d], i) => (
              <div key={t}>
                <p className="font-plex text-xs tracking-[0.18em] uppercase text-[var(--text-muted)] tabular-nums mb-2">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-editorial font-medium text-lg leading-snug mb-1.5">{t}</h3>
                <p className="font-plex text-sm leading-relaxed text-[var(--text-muted)]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA, state-dependent */}
      <section data-testid="students-cta" className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-16">
        <div className="border-t border-[var(--text)] pt-8">
          {authLoading ? null : isStudent ? (
            <div>
              <p className="font-editorial italic text-lg mb-3">Your plan</p>
              <p className="font-plex text-base text-[var(--text)] mb-1">
                Student{details?.subscription_end ? ` · valid till ${longDate(details.subscription_end)}` : ''}
              </p>
              <p className="font-plex text-sm text-[var(--text-muted)] max-w-[55ch]">
                Renews annually. We'll email you before it expires. Reply with a current ID to keep going at the same price, or let it lapse if you've graduated.
              </p>
            </div>
          ) : canAccessPremium ? (
            <p className="font-plex text-base text-[var(--text)]">You already have full access.</p>
          ) : (
            <div>
              <a
                href={TALLY_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="students-apply-cta"
                className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[13px] uppercase tracking-[0.05em] h-12 px-8 transition-colors duration-200"
                style={{ borderRadius: 'var(--control-radius)' }}
              >
                Apply with your student ID
              </a>
              <p className="font-plex text-sm text-[var(--text-muted)] mt-4">
                Already applied? Watch your inbox for the decision.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-32">
        <div className="border-t border-[var(--text)] pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <p className="font-editorial italic text-lg">FAQ</p>
          </div>
          <div className="lg:col-span-8">
            <ul>
              {FAQS.map(([q, a]) => (
                <li key={q} className="py-6 border-b border-[var(--rule)]">
                  <p className="font-editorial font-medium text-lg leading-snug mb-2">{q}</p>
                  <p className="font-plex text-base text-[var(--text-muted)] leading-relaxed max-w-[60ch]">{a}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </MockupLayout>
  );
};

export default StudentsMockup;
