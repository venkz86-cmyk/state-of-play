import { InvoiceRequestModal } from './InvoiceRequestModal';

// The team page's invoices: the same form as a member's, for the team's
// own payments, found through the team link (backend member_invoices.py).
export const TeamInvoiceRequestModal = ({ open, onClose, token }) => (
  <InvoiceRequestModal open={open} onClose={onClose} teamToken={token} />
);

export default TeamInvoiceRequestModal;
