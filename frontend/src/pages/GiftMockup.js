import { useState } from 'react';
import { useGeoPricing } from '../hooks/useGeoPricing';
import { MockupLayout, Overline } from '../components/MockupLayout';
import { RazorpayCheckoutButton } from '../components/RazorpayCheckoutButton';

// Buy the real annual membership for someone else -- distinct from
// NominateReaderBlock's free 14-day taste and GiftArticleModal's
// 72-hour single-article link. Same price a buyer would pay for
// themselves (razorpay_orders.py's own PLAN_PRICING['standard']);
// the only choice here is who ends up with the access, not what it
// costs.

export const GiftMockup = () => {
  const pricing = useGeoPricing();
  const isIndia = pricing.country === 'IN';

  const [buyerName, setBuyerName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [result, setResult] = useState(null);

  return (
    <MockupLayout testId="mockup-gift" seo={{ title: 'Gift a Subscription', path: '/gift', description: 'Give someone a year of The State of Play — reported stories on the business of Indian sport, delivered weekly.' }}>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)]/15 pb-3">
          <Overline className="!normal-case !tracking-normal !text-sm">Give a subscription</Overline>
          <span className="font-editorial italic text-sm text-[var(--text-muted)] tabular-nums">Gift</span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12 pb-8">
        <h1 className="font-editorial font-semibold tracking-tight text-[28px] md:text-[2.75rem] leading-[1.1] mb-6 max-w-[22ch]">
          Give someone a year of <em className="italic font-normal">The State of Play.</em>
        </h1>
        <p className="font-plex text-base lg:text-lg text-[var(--text-muted)] max-w-[60ch] leading-relaxed">
          Every weekly story, the Left Field briefing and the full archive, on you. Same price as subscribing for yourself.
        </p>
      </section>

      <section data-testid="gift-form" className="max-w-[1280px] mx-auto px-6 lg:px-12 pb-24">
        <div className="border-t border-[var(--text)] pt-8 max-w-[560px]">
          {result ? (
            result.delivery === 'direct' ? (
              <div>
                <p className="font-editorial italic text-lg mb-3">Sent.</p>
                <p className="font-plex text-base text-[var(--text-muted)]" data-testid="gift-result-direct">
                  {result.recipient_email} now has full access, and an email letting them know it came from you.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-editorial italic text-lg mb-3">Paid. Here's their link.</p>
                <p className="font-plex text-sm text-[var(--text-muted)] mb-4">
                  We've also emailed this to you as a backup. Send it to whoever it's for — they redeem it with their own email, whenever they're ready.
                </p>
                <p className="font-plex text-base border-b border-[var(--rule)] py-3 break-all" data-testid="gift-result-code">
                  {result.redeem_url}
                </p>
              </div>
            )
          ) : (
            <>
              <p className="font-editorial italic text-lg mb-6">Annual Membership</p>
              <div className="flex items-end gap-3 mb-2">
                <span className="font-editorial font-semibold tracking-tight text-[3rem] lg:text-[3.5rem] leading-[0.9] text-[var(--text)]">
                  {isIndia ? '₹2,499' : '$120'}
                </span>
                <span className="font-plex text-base text-[var(--text-muted)] pb-2">
                  {isIndia ? '+ 18% GST' : '/ year'}
                </span>
              </div>
              {isIndia && (
                <p className="font-plex text-[14px] text-[var(--text-label)] mb-8">₹2,949 total</p>
              )}
              {!isIndia && <div className="mb-8" />}

              <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Your name</p>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="So they know who this is from"
                data-testid="gift-buyer-name"
                className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 mb-5 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)]"
              />

              <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">Recipient's email (optional)</p>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Know their email? We'll set them up right away."
                data-testid="gift-recipient-email"
                className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-lg py-3 mb-2 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)]"
              />
              <p className="font-plex text-[13px] text-[var(--text-muted)] mb-5">
                Leave it blank and you'll get a link to send them yourself instead.
              </p>

              <p className="font-plex text-[11px] tracking-[0.08em] uppercase text-[var(--text-label)] mb-2">A note (optional)</p>
              <textarea
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                placeholder="Add a short note"
                rows={2}
                data-testid="gift-personal-note"
                className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-base py-3 mb-6 focus:outline-none focus:border-[var(--accent-burgundy)] placeholder:text-[var(--text-muted)] resize-none"
              />

              <RazorpayCheckoutButton
                plan="standard"
                country={isIndia ? 'IN' : 'INTL'}
                buttonLabel={recipientEmail ? 'Gift now' : 'Pay and get a link'}
                dataTestId="gift-checkout"
                verifyEndpoint="/api/gifts/subscription/verify-payment"
                emailLabel="Your email"
                extraVerifyFields={{
                  name: buyerName,
                  recipient_email: recipientEmail.trim() || null,
                  personal_note: personalNote.trim() || null,
                }}
                disclosureText="One payment, one year. If you gave us their email, they're set up immediately — otherwise you'll get a link to pass along yourself."
                onSuccess={(_email, response) => setResult(response)}
              />
            </>
          )}
        </div>
      </section>
    </MockupLayout>
  );
};

export default GiftMockup;
