import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { authHeader } from '../lib/sessionToken';
import { formatCurrency } from '../lib/format';

const API = process.env.REACT_APP_BACKEND_URL;

// Indian states with GST codes (matches backend member_invoices.INDIAN_STATES)
const INDIAN_STATES = [
  ['29', 'Karnataka'], ['27', 'Maharashtra'], ['07', 'Delhi'], ['33', 'Tamil Nadu'],
  ['09', 'Uttar Pradesh'], ['19', 'West Bengal'], ['24', 'Gujarat'], ['36', 'Telangana'],
  ['08', 'Rajasthan'], ['32', 'Kerala'], ['37', 'Andhra Pradesh'], ['10', 'Bihar'],
  ['23', 'Madhya Pradesh'], ['21', 'Odisha'], ['06', 'Haryana'], ['03', 'Punjab'],
  ['22', 'Chhattisgarh'], ['20', 'Jharkhand'], ['18', 'Assam'], ['05', 'Uttarakhand'],
  ['02', 'Himachal Pradesh'], ['30', 'Goa'], ['01', 'Jammu and Kashmir'], ['38', 'Ladakh'],
  ['04', 'Chandigarh'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'],
  ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['25', 'Daman and Diu'], ['26', 'Dadra and Nagar Haveli'], ['31', 'Lakshadweep'],
  ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'],
];
const STATE_CODES = new Set(INDIAN_STATES.map(([c]) => c));

// 15-character GSTIN format, same check as the backend
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

const label = 'block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-2';
const line = 'w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-base py-2 focus:outline-none focus:border-[var(--accent-burgundy)]';

async function errorText(res, fallback) {
  try {
    const err = await res.json();
    if (err && typeof err.detail === 'string') return err.detail;
  } catch (_e) { /* keep fallback */ }
  return fallback;
}

/* GST invoices, one per payment (backend member_invoices.py). It lists
   the payments, newest first, and fills the form in with the details used
   last time, so a repeat download is one click. With `teamToken` it is the
   team page's version: the team's payments, found through its link. */
export const InvoiceRequestModal = ({ open, onClose, teamToken = null }) => {
  const team = Boolean(teamToken);
  const help = team ? 'prerna@stateofplay.club' : 'venkat@stateofplay.club';
  const [payments, setPayments] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [legalName, setLegalName] = useState('');
  const [showGstin, setShowGstin] = useState(false);
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      try {
        const res = team
          ? await fetch(`${API}/api/invoice/team/list`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: teamToken }),
          })
          : await fetch(`${API}/api/invoice/payments`, { headers: authHeader() });
        if (!res.ok) throw new Error(await errorText(res, 'Your payments did not load. Close this and try again.'));
        const data = await res.json();
        if (!live) return;
        const list = team
          ? (data.invoices || []).map((i) => ({ ...i, payment_id: i.invoice_id, name: `Team of ${i.seats}` }))
          : (data.payments || []);
        setPayments(list);
        const first = list.find((p) => !p.blocked);
        if (first) setPaymentId(first.payment_id);
        const b = data.billing;
        if (team && !b) {
          setLegalName(data.company_name || '');
          setShowGstin(true);
        }
        if (b) {
          setLegalName(b.legal_name || '');
          setAddress(b.address || '');
          if (b.gstin) { setGstin(b.gstin); setShowGstin(true); }
          if (b.state_code && STATE_CODES.has(b.state_code)) setStateCode(b.state_code);
        }
      } catch (e) {
        if (live) setLoadError(e.message);
      }
    })();
    return () => { live = false; };
  }, [open, team, teamToken]);

  if (!open) return null;

  const selected = (payments || []).find((p) => p.payment_id === paymentId);
  const inRupees = !selected || selected.currency === 'INR';

  const onGstin = (value) => {
    const v = value.toUpperCase().replace(/\s/g, '');
    setGstin(v);
    // A GSTIN starts with its state's code, so it picks the state for them.
    if (GSTIN_RE.test(v) && STATE_CODES.has(v.slice(0, 2))) setStateCode(v.slice(0, 2));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(''); setDone('');
    const g = showGstin ? gstin.trim() : '';
    if (!selected) { setError('Choose a payment.'); return; }
    if (!legalName.trim() || address.trim().length < 5) { setError('Add the name and address for the invoice.'); return; }
    if (inRupees && g && !GSTIN_RE.test(g)) { setError('That GSTIN is not in the right format. It has 15 characters, like 29ABCDE1234F1Z5.'); return; }
    if (inRupees && !stateCode) { setError('Choose your state.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/invoice/${team ? 'team/download' : 'download'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(team ? {} : authHeader()) },
        body: JSON.stringify({
          ...(team ? { token: teamToken, invoice_id: selected.payment_id } : { payment_id: selected.payment_id }),
          legal_name: legalName.trim(),
          gstin: inRupees && g ? g : null,
          address: address.trim(),
          state_code: inRupees ? stateCode : null,
        }),
      });
      if (!res.ok) throw new Error(await errorText(res, 'The invoice did not download. Try again.'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const m = (res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/);
      a.href = url;
      a.download = m ? m[1] : 'tax-invoice.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const number = m ? m[1].replace(/\.pdf$/, '').replace(/-(\d{4}-\d{2})-/, '/$1/') : '';
      setDone(number ? `Invoice ${number} is in your downloads.` : 'Your invoice is in your downloads.');
      setPayments((list) => (list || []).map((p) => (p.payment_id === selected.payment_id && number ? { ...p, invoice_number: number } : p)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="invoice-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-title"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--bg)] text-[var(--text)] w-full sm:max-w-[560px] max-h-[90vh] overflow-y-auto border border-[var(--rule)]">
        <div className="flex items-baseline justify-between px-6 py-4 border-b border-[var(--rule)]">
          <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]">GST invoice</p>
          <button type="button" onClick={onClose} data-testid="invoice-modal-close"
            className="text-[var(--text-muted)] hover:text-[var(--text)]" aria-label="Close">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-6">
          <h2 id="invoice-title" className="font-editorial font-semibold text-2xl leading-snug mb-5">Download your invoice.</h2>

          {loadError && <p className="font-plex text-[14px] text-[var(--accent-ink)]" role="alert">{loadError}</p>}
          {!loadError && payments === null && <p className="font-plex text-[14px] text-[var(--text-muted)]">Finding your payments…</p>}

          {payments && payments.length === 0 && (
            <p className="font-plex text-[15px] max-w-[50ch]" data-testid="invoice-none">
              {team
                ? 'We can\u2019t find a payment for this team. Write to '
                : 'We can\u2019t find a payment on this account. If you paid with another email address, write to '}
              <a className="underline underline-offset-4" href={`mailto:${help}?subject=GST%20invoice`}>{help}</a> and
              we&rsquo;ll send your invoice.
            </p>
          )}

          {payments && payments.length > 0 && (
            <form onSubmit={onSubmit} className="space-y-6">
              <fieldset>
                <legend className={label}>{payments.length > 1 ? 'Which payment' : 'Payment'}</legend>
                <ul className="border-t border-[var(--rule)]" data-testid="invoice-payments">
                  {payments.map((p) => {
                    const off = Boolean(p.blocked);
                    return (
                      <li key={p.payment_id} className="border-b border-[var(--rule)]">
                        <label className={`flex gap-3 py-3 ${off ? 'opacity-60' : 'cursor-pointer'}`}>
                          <input
                            type="radio" name="invoice-payment" value={p.payment_id} disabled={off}
                            checked={paymentId === p.payment_id} onChange={() => { setPaymentId(p.payment_id); setDone(''); setError(''); }}
                            className="mt-1 h-4 w-4 accent-[var(--accent-burgundy)]"
                            data-testid={`invoice-payment-${p.payment_id}`}
                          />
                          <span className="font-plex text-[14px] leading-snug">
                            <span className="block">
                              <span className="font-medium">{p.name}</span>, {formatCurrency(p.amount, p.currency)}, paid {p.paid_on_day}
                            </span>
                            {p.period_start && p.period_end && !off && (
                              <span className="block text-[var(--text-muted)]">{p.period_start} to {p.period_end}</span>
                            )}
                            {off && <span className="block text-[var(--text-muted)]">{p.blocked}</span>}
                            {!off && p.invoice_number && (
                              <span className="block text-[var(--text-muted)]">Invoice {p.invoice_number}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>

              {selected && (
                <>
                  <div>
                    <label htmlFor="invoice-name" className={label}>Name on the invoice</label>
                    <input id="invoice-name" type="text" required value={legalName} autoComplete="name"
                      onChange={(e) => setLegalName(e.target.value)} data-testid="invoice-name" className={line} />
                  </div>

                  {inRupees && (
                    showGstin ? (
                      <div>
                        <label htmlFor="invoice-gstin" className={label}>GSTIN</label>
                        <input id="invoice-gstin" type="text" value={gstin} maxLength={15}
                          onChange={(e) => onGstin(e.target.value)} data-testid="invoice-gstin"
                          placeholder="29ABCDE1234F1Z5" className={`${line} tracking-wider`} />
                        <button type="button" onClick={() => { setShowGstin(false); setGstin(''); }}
                          className="mt-2 font-plex text-[12px] text-[var(--text-muted)] underline underline-offset-4">
                          Remove GSTIN
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowGstin(true)} data-testid="invoice-add-gstin"
                        className="font-plex text-[14px] underline underline-offset-4 decoration-[var(--rule)] hover:decoration-[var(--text)]">
                        Add a GSTIN for a business
                      </button>
                    )
                  )}

                  {inRupees ? (
                    <div>
                      <label htmlFor="invoice-state" className={label}>State</label>
                      <select id="invoice-state" value={stateCode} onChange={(e) => setStateCode(e.target.value)}
                        data-testid="invoice-state" className={line}>
                        <option value="" disabled>Choose your state</option>
                        {INDIAN_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <p className="font-plex text-[14px] text-[var(--text-muted)]" data-testid="invoice-export-note">
                      You paid in dollars from outside India, so there&rsquo;s no GST on this invoice.
                    </p>
                  )}

                  <div>
                    <label htmlFor="invoice-address" className={label}>Billing address</label>
                    <textarea id="invoice-address" required rows={3} value={address} autoComplete="street-address"
                      onChange={(e) => setAddress(e.target.value)} data-testid="invoice-address"
                      placeholder="Street, city, PIN code"
                      className="w-full bg-transparent border border-[var(--text)] font-plex text-base p-3 focus:outline-none focus:border-[var(--accent-burgundy)]"
                      style={{ borderRadius: 'var(--control-radius)' }} />
                  </div>

                  {error && <p className="font-plex text-[14px] text-[var(--accent-ink)]" role="alert" data-testid="invoice-error">{error}</p>}
                  {done && <p className="font-plex text-[14px]" role="status" data-testid="invoice-done">{done}</p>}

                  <div className="flex items-center gap-6 pt-1">
                    <button type="submit" disabled={submitting} data-testid="invoice-submit"
                      className="inline-flex items-center justify-center btn-cta disabled:opacity-60"
                      style={{ borderRadius: 'var(--control-radius)' }}>
                      {submitting ? 'Preparing…' : 'Download invoice'}
                    </button>
                    <button type="button" onClick={onClose}
                      className="font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                      {done ? 'Close' : 'Cancel'}
                    </button>
                  </div>
                  <p className="font-plex text-[12px] text-[var(--text-label)]">
                    Each payment keeps its invoice number, so downloading again gives you the same invoice. We keep
                    these details to fill this form in next time.
                  </p>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceRequestModal;
