// Shared formatters for the admin dashboard. Extracted so every panel
// (Subscribers, Renewals, Payments, ...) renders dates and money the same
// way, instead of each page re-deriving its own version the way
// AccountMockup.js/CommentsModerationMockup.js/TeamsManage.js each did.

// amountMinorUnits: paise for INR, cents for USD -- exactly what
// payments.py stores (Razorpay's own convention). The two currencies are
// never summed together anywhere in this dashboard; each row shows its
// own currency's symbol, not a converted total.
export function formatCurrency(amountMinorUnits, currency) {
  if (amountMinorUnits == null || !currency) return '—';
  const major = amountMinorUnits / 100;
  if (currency === 'INR') {
    return `₹${major.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  if (currency === 'USD') {
    return `$${major.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
  return `${major.toLocaleString()} ${currency}`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Days between now and an ISO date -- negative means it's in the past.
// Used for expiry/renewal color-flagging (red if overdue, amber if soon).
export function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}
