import { useState } from 'react';
import { X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Indian states with GST codes (matches backend INDIAN_STATES)
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

// 15-character GSTIN format — same validation as the backend
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const InvoiceRequestModal = ({ open, onClose, memberEmail }) => {
  const [isBusiness, setIsBusiness] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState('29');
  const [isInternational, setIsInternational] = useState(false);
  const [issueDate, setIssueDate] = useState(''); // YYYY-MM-DD; blank = use payment date
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const reset = () => {
    setIsBusiness(false); setLegalName(''); setGstin(''); setAddress('');
    setStateCode('29'); setIsInternational(false); setIssueDate(''); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!legalName.trim() || !address.trim()) {
      setError('Please fill name and address.'); return;
    }
    if (isBusiness && !GSTIN_RE.test(gstin.trim().toUpperCase())) {
      setError('Enter a valid 15-character GSTIN.'); return;
    }
    if (!isInternational && isBusiness) {
      const gstPrefix = gstin.trim().toUpperCase().slice(0, 2);
      if (gstPrefix !== stateCode) {
        setError(`GSTIN starts with ${gstPrefix} — please pick the matching state.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/invoice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: memberEmail,
          legal_name: legalName.trim(),
          gstin: isBusiness ? gstin.trim().toUpperCase() : null,
          address: address.trim(),
          state_code: isInternational ? null : stateCode,
          is_international: isInternational,
          issue_date: issueDate || null,
        }),
      });
      if (!res.ok) {
        let detail = `Generation failed (HTTP ${res.status})`;
        try {
          const err = await res.json();
          if (err && err.detail) {
            detail = typeof err.detail === 'string'
              ? err.detail
              : (err.detail[0] && err.detail[0].msg) || detail;
          }
        } catch (_e) { /* keep default */ }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      a.download = m ? m[1] : 'tax-invoice.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not generate invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="invoice-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-[var(--bg)] text-[var(--text)] w-full sm:max-w-[560px] max-h-[90vh] overflow-y-auto border border-[var(--rule)]"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-baseline justify-between px-6 py-4 border-b border-[var(--rule)]">
          <p className="font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)]">
            GST tax invoice
          </p>
          <button
            type="button"
            onClick={handleClose}
            data-testid="invoice-modal-close"
            className="text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-6 space-y-6">
          <div>
            <h2 className="font-editorial font-semibold text-2xl leading-snug mb-2">
              Download your invoice.
            </h2>
            <p className="font-plex text-[14px] text-[var(--text-muted)] max-w-[50ch]">
              Fill the details below and we’ll issue a GST-compliant PDF you can download immediately.
            </p>
          </div>

          {/* Business / individual toggle */}
          <div className="flex items-center gap-3">
            <input
              id="invoice-business"
              type="checkbox"
              checked={isBusiness}
              onChange={(e) => setIsBusiness(e.target.checked)}
              data-testid="invoice-is-business"
              className="h-4 w-4 accent-[var(--accent-burgundy)]"
            />
            <label htmlFor="invoice-business" className="font-plex text-[14px] text-[var(--text)]">
              This is for a registered business (with GSTIN)
            </label>
          </div>

          {/* Legal name */}
          <div>
            <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-2">
              {isBusiness ? 'Company / legal name' : 'Full name'}
            </label>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              data-testid="invoice-name"
              className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-base py-2 focus:outline-none focus:border-[var(--accent-burgundy)]"
            />
          </div>

          {/* GSTIN — shown only for business */}
          {isBusiness && (
            <div>
              <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-2">
                GSTIN <span className="text-[#999]">(15-char)</span>
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                maxLength={15}
                data-testid="invoice-gstin"
                placeholder="29ABCDE1234F1Z5"
                className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-base py-2 tracking-wider tabular-nums focus:outline-none focus:border-[var(--accent-burgundy)]"
              />
            </div>
          )}

          {/* International toggle */}
          <div className="flex items-center gap-3">
            <input
              id="invoice-intl"
              type="checkbox"
              checked={isInternational}
              onChange={(e) => setIsInternational(e.target.checked)}
              data-testid="invoice-is-international"
              className="h-4 w-4 accent-[var(--accent-burgundy)]"
            />
            <label htmlFor="invoice-intl" className="font-plex text-[14px] text-[var(--text)]">
              Buyer is outside India (export of services, 0% GST)
            </label>
          </div>

          {/* State — hidden for international */}
          {!isInternational && (
            <div>
              <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-2">
                State
              </label>
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                data-testid="invoice-state"
                className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-base py-2 focus:outline-none focus:border-[var(--accent-burgundy)]"
              >
                {INDIAN_STATES.map(([code, name]) => (
                  <option key={code} value={code}>{name} ({code})</option>
                ))}
              </select>
              <p className="font-plex text-[12px] text-[var(--text-label)] mt-2">
                {stateCode === '29'
                  ? 'Karnataka buyer → 9% CGST + 9% SGST'
                  : 'Inter-state → 18% IGST'}
              </p>
            </div>
          )}

          {/* Address */}
          <div>
            <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-2">
              Billing address
            </label>
            <textarea
              required
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              data-testid="invoice-address"
              placeholder="Street, city, postal code"
              className="w-full bg-transparent border border-[var(--text)] font-plex text-base p-3 focus:outline-none focus:border-[var(--accent-burgundy)]"
              style={{ borderRadius: 0 }}
            />
          </div>

          {/* Optional issue date — defaults to Razorpay payment date */}
          <div>
            <label className="block font-plex text-[11px] uppercase tracking-[0.08em] text-[var(--text-label)] mb-2">
              Issue date <span className="text-[#999]">(optional)</span>
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              data-testid="invoice-issue-date"
              className="w-full bg-transparent border-0 border-b border-[var(--text)] font-plex text-base py-2 focus:outline-none focus:border-[var(--accent-burgundy)]"
            />
            <p className="font-plex text-[12px] text-[var(--text-label)] mt-2">
              Leave blank to use your payment date. Must be on or after the payment date, within the same fiscal year, and not in the future.
            </p>
          </div>

          {error && (
            <p className="font-plex text-[14px] text-[var(--accent-burgundy)]" data-testid="invoice-error">
              {error}
            </p>
          )}

          <div className="flex items-center gap-6 pt-2">
            <button
              type="submit"
              disabled={submitting}
              data-testid="invoice-submit"
              className="inline-flex items-center justify-center bg-[var(--accent-burgundy)] hover:bg-[var(--accent-burgundy-hover)] text-white font-plex font-medium text-[14px] uppercase tracking-[0.05em] h-12 px-8 transition-colors disabled:opacity-60"
              style={{ borderRadius: 0 }}
            >
              {submitting ? 'Generating…' : 'Download invoice'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="font-plex text-[14px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="font-plex text-[12px] text-[var(--text-label)]">
            We don’t store your billing details beyond the invoice itself.
          </p>
        </form>
      </div>
    </div>
  );
};

export default InvoiceRequestModal;
