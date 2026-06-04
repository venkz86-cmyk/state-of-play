import { MockupLayout } from '../components/MockupLayout';

/* GST Invoice Preview — visual mock-up of what the generated PDF will look like.
   Uses sample buyer data. Once approved, this is the template I'll port to
   ReportLab on the backend so users can download a real PDF from /account.   */
export const InvoicePreviewMockup = () => {
  // Real seller details from publisher
  const SELLER = {
    name: 'Left Field Ventures',
    address: [
      'Ground Floor, 36, Infantry Road',
      'Tasker Town, Shivaji Nagar',
      'Bengaluru, Karnataka 560001',
    ],
    gstin: '29AICPA5182B1ZP',
    state: 'Karnataka',
    stateCode: '29',
    email: 'venkat@stateofplay.club',
    website: 'stateofplay.club',
  };

  // Sample buyer — for the preview only.
  // (When live: buyer fills these on /account before downloading.)
  const BUYER = {
    name: 'Acme Sports Holdings Pvt. Ltd.',
    gstin: '27ABCDE1234F1Z2',
    address: [
      '4th Floor, Bandra Kurla Complex',
      'Bandra East',
      'Mumbai, Maharashtra 400051',
    ],
    state: 'Maharashtra',
    stateCode: '27',
  };

  // Sample invoice
  const invoice = {
    number: 'TSOP/2026-27/0001',
    issued: '04 June 2026',
    placeOfSupply: 'Maharashtra (27)',
    description: 'The State of Play — Annual Subscription',
    period: '04 June 2026 to 03 June 2027',
    sacCode: '998431',
    razorpayRef: 'pay_QqXyZAbc1234',
  };

  // Inter-state buyer → 18% IGST single line
  const isInterState = BUYER.stateCode !== SELLER.stateCode;
  const isExport = false; // when buyer's country !== IN

  const taxableValue = 2499;
  const cgstAmt = isInterState || isExport ? 0 : Math.round(taxableValue * 0.09);
  const sgstAmt = isInterState || isExport ? 0 : Math.round(taxableValue * 0.09);
  const igstAmt = isInterState && !isExport ? Math.round(taxableValue * 0.18) : 0;
  const total = taxableValue + cgstAmt + sgstAmt + igstAmt;

  // Indian rupee + amount in words helpers (rough sample for preview)
  const inr = (n) => `\u20B9 ${n.toLocaleString('en-IN')}.00`;

  return (
    <MockupLayout testId="invoice-preview">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 lg:pt-12">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-3">
          <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888]">
            Preview · GST Invoice template
          </span>
          <span className="font-plex text-[14px] text-[#444444] dark:text-[#888888] tabular-nums">
            What the downloadable PDF will look like
          </span>
        </div>
      </div>

      <section className="max-w-[1280px] mx-auto px-6 lg:px-12 pt-10 pb-6">
        <p className="font-plex text-[14px] text-[var(--text-muted)] max-w-[60ch]">
          This is a visual mock. The buyer block (name / GSTIN / address) will be
          filled by the customer when they request the invoice from <code className="text-[var(--accent-burgundy)]">/account</code>.
          Sample buyer below is in <strong>Maharashtra</strong> to demonstrate the
          inter-state (18% IGST) case.
        </p>
      </section>

      {/* Invoice "paper" — A4 ratio, sharp edges, no shadow */}
      <section className="max-w-[900px] mx-auto px-6 lg:px-0 pb-32">
        <article
          className="bg-white text-[#1A1A1A] border border-[#E5E2DC] p-12 lg:p-16"
          style={{ borderRadius: 0, aspectRatio: '210/297', minHeight: '1000px' }}
        >
          {/* Masthead */}
          <header className="flex items-start justify-between border-b border-[#1A1A1A] pb-6 mb-8">
            <div>
              <p className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] mb-1.5">
                The State of Play
              </p>
              <h1 className="font-editorial font-semibold text-[26px] leading-tight">
                Tax Invoice
              </h1>
            </div>
            <div className="text-right">
              <p className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666]">
                Invoice no.
              </p>
              <p className="font-plex text-[14px] font-medium tabular-nums">{invoice.number}</p>
              <p className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] mt-3">
                Date of issue
              </p>
              <p className="font-plex text-[13px] tabular-nums">{invoice.issued}</p>
            </div>
          </header>

          {/* Seller + Buyer two-column block */}
          <div className="grid grid-cols-2 gap-12 mb-10">
            <div>
              <p className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] mb-2">
                Seller
              </p>
              <p className="font-plex text-[14px] font-semibold mb-1">{SELLER.name}</p>
              {SELLER.address.map((l) => (
                <p key={l} className="font-plex text-[13px] leading-[1.5] text-[#1A1A1A]">{l}</p>
              ))}
              <p className="font-plex text-[12px] text-[#666666] mt-3">
                GSTIN: <span className="text-[#1A1A1A] tabular-nums">{SELLER.gstin}</span>
              </p>
              <p className="font-plex text-[12px] text-[#666666]">
                State: <span className="text-[#1A1A1A]">{SELLER.state} ({SELLER.stateCode})</span>
              </p>
              <p className="font-plex text-[12px] text-[#666666]">{SELLER.email}</p>
            </div>

            <div>
              <p className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] mb-2">
                Bill to
              </p>
              <p className="font-plex text-[14px] font-semibold mb-1">{BUYER.name}</p>
              {BUYER.address.map((l) => (
                <p key={l} className="font-plex text-[13px] leading-[1.5] text-[#1A1A1A]">{l}</p>
              ))}
              <p className="font-plex text-[12px] text-[#666666] mt-3">
                GSTIN: <span className="text-[#1A1A1A] tabular-nums">{BUYER.gstin}</span>
              </p>
              <p className="font-plex text-[12px] text-[#666666]">
                State: <span className="text-[#1A1A1A]">{BUYER.state} ({BUYER.stateCode})</span>
              </p>
              <p className="font-plex text-[12px] text-[#666666]">
                Place of supply: <span className="text-[#1A1A1A]">{invoice.placeOfSupply}</span>
              </p>
            </div>
          </div>

          {/* Line-items table */}
          <table className="w-full border-collapse mb-8">
            <thead>
              <tr className="border-y-2 border-[#1A1A1A]">
                <th className="text-left font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] py-3">Description</th>
                <th className="text-left font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] py-3">SAC</th>
                <th className="text-right font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] py-3">Taxable value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E5E2DC]">
                <td className="font-plex text-[13px] py-4 align-top">
                  {invoice.description}
                  <span className="block text-[12px] text-[#666666] mt-1">
                    Subscription period: {invoice.period}
                  </span>
                  <span className="block text-[11px] text-[#666666] mt-0.5">
                    Razorpay ref: {invoice.razorpayRef}
                  </span>
                </td>
                <td className="font-plex text-[13px] py-4 align-top tabular-nums">{invoice.sacCode}</td>
                <td className="font-plex text-[13px] py-4 align-top text-right tabular-nums">{inr(taxableValue)}</td>
              </tr>
            </tbody>
          </table>

          {/* Tax summary */}
          <div className="flex justify-end mb-10">
            <table className="w-[340px]">
              <tbody>
                <tr>
                  <td className="font-plex text-[13px] text-[#666666] py-1.5">Taxable value</td>
                  <td className="font-plex text-[13px] py-1.5 text-right tabular-nums">{inr(taxableValue)}</td>
                </tr>
                {!isInterState && !isExport && (
                  <>
                    <tr>
                      <td className="font-plex text-[13px] text-[#666666] py-1.5">CGST @ 9%</td>
                      <td className="font-plex text-[13px] py-1.5 text-right tabular-nums">{inr(cgstAmt)}</td>
                    </tr>
                    <tr>
                      <td className="font-plex text-[13px] text-[#666666] py-1.5">SGST @ 9%</td>
                      <td className="font-plex text-[13px] py-1.5 text-right tabular-nums">{inr(sgstAmt)}</td>
                    </tr>
                  </>
                )}
                {isInterState && !isExport && (
                  <tr>
                    <td className="font-plex text-[13px] text-[#666666] py-1.5">IGST @ 18%</td>
                    <td className="font-plex text-[13px] py-1.5 text-right tabular-nums">{inr(igstAmt)}</td>
                  </tr>
                )}
                {isExport && (
                  <tr>
                    <td className="font-plex text-[13px] text-[#666666] py-1.5 italic" colSpan={2}>
                      Export of services — GST not applicable (LUT)
                    </td>
                  </tr>
                )}
                <tr className="border-t border-[#1A1A1A]">
                  <td className="font-plex text-[14px] font-semibold py-2">Total payable</td>
                  <td className="font-plex text-[14px] font-semibold py-2 text-right tabular-nums">{inr(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="font-plex text-[11px] italic text-[#666666] mb-8">
            Amount in words: Indian Rupees Two Thousand Nine Hundred and Forty-Nine only.
          </p>

          {/* Notes */}
          <div className="border-t border-[#E5E2DC] pt-6 mb-8">
            <p className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] mb-3">Notes</p>
            <ol className="font-plex text-[12px] leading-[1.6] text-[#1A1A1A] space-y-1.5 list-decimal pl-4">
              <li>Payment received in full via Razorpay. This invoice is issued against transaction <span className="tabular-nums">{invoice.razorpayRef}</span>.</li>
              <li>This invoice is computer-generated and does not require a signature.</li>
              <li>For queries, write to {SELLER.email}.</li>
            </ol>
          </div>

          {/* Footer */}
          <footer className="border-t border-[#1A1A1A] pt-4 flex items-baseline justify-between">
            <span className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666]">
              {SELLER.name} · {SELLER.website}
            </span>
            <span className="font-plex text-[10px] uppercase tracking-[0.16em] text-[#666666] tabular-nums">
              {invoice.number}
            </span>
          </footer>
        </article>

        <p className="text-center font-plex text-[12px] text-[var(--text-label)] mt-6">
          End of preview — let me know what to tweak and I'll build the PDF generator to match.
        </p>
      </section>
    </MockupLayout>
  );
};

export default InvoicePreviewMockup;
