"""
GST Tax Invoice generator — The State of Play (Left Field Ventures).

Generates a compliant Indian GST tax invoice as a PDF (A4) using ReportLab,
matching the design approved in /mockup/invoice. Invoice numbers are
sequential within a fiscal year and persisted to MongoDB so the same
buyer/transaction always yields the same invoice.

Compliance covered:
 - Section 31 CGST Act: prescribed fields, place of supply, HSN/SAC
 - Intra-state (Karnataka) → CGST 9% + SGST 9%
 - Inter-state (other Indian states) → IGST 18%
 - Export of services (non-IN) → 0% under LUT
 - Computer-generated, no signature required (declaration on invoice)
"""

from __future__ import annotations
from datetime import datetime, timezone
from io import BytesIO
import re

from num2words import num2words
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ───────────────────────────── seller (locked) ─────────────────────────────
SELLER = {
    "name": "Left Field Ventures",
    "address": [
        "Ground Floor, 36, Infantry Road",
        "Tasker Town, Shivaji Nagar",
        "Bengaluru, Karnataka 560001",
    ],
    "gstin": "29AICPA5182B1ZP",
    "state_name": "Karnataka",
    "state_code": "29",
    "email": "venkat@stateofplay.club",
    "website": "stateofplay.club",
}

SAC_CODE = "998431"                         # online news / journals
DESCRIPTION = "The State of Play — Annual Subscription"


# ───────────────────────────── helpers ─────────────────────────────
def fiscal_year(d: datetime) -> str:
    """India fiscal year (Apr 1 – Mar 31). Returns e.g. '2026-27'."""
    y = d.year
    if d.month < 4:
        y -= 1
    return f"{y}-{str((y + 1))[-2:]}"


GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$")


def validate_gstin(gstin: str | None) -> bool:
    if not gstin:
        return True  # GSTIN is optional (B2C)
    return bool(GSTIN_RE.match(gstin.strip().upper()))


def amount_in_words_inr(rupees: int) -> str:
    """₹2949 → 'Indian Rupees Two Thousand Nine Hundred and Forty-Nine only.'"""
    words = num2words(rupees, lang="en_IN").title()
    # num2words returns 'Two Thousand, Nine Hundred And Forty-Nine'
    words = words.replace(",", "").replace(" And ", " and ")
    return f"Indian Rupees {words} only."


def compute_tax(taxable_value: int, buyer_state_code: str | None, is_international: bool) -> dict:
    """Returns the tax split for an invoice."""
    if is_international:
        return {
            "cgst": 0, "sgst": 0, "igst": 0,
            "total": taxable_value,
            "tax_label": "Export of services — GST not applicable (LUT)",
            "is_export": True,
        }
    intra_state = (buyer_state_code or "").strip() == SELLER["state_code"]
    if intra_state:
        cgst = round(taxable_value * 0.09)
        sgst = round(taxable_value * 0.09)
        return {
            "cgst": cgst, "sgst": sgst, "igst": 0,
            "total": taxable_value + cgst + sgst,
            "tax_label": None,
            "is_export": False,
        }
    # Inter-state
    igst = round(taxable_value * 0.18)
    return {
        "cgst": 0, "sgst": 0, "igst": igst,
        "total": taxable_value + igst,
        "tax_label": None,
        "is_export": False,
    }


# ───────────────────────────── PDF generation ─────────────────────────────
DARK = HexColor("#1A1A1A")
GREY = HexColor("#666666")
RULE = HexColor("#E5E2DC")


def _rupee(n: int) -> str:
    """Format an INR amount. Helvetica core PDF font lacks the \u20B9 glyph,
    so we use the conventional 'Rs.' prefix which renders everywhere."""
    return f"Rs. {n:,}.00"


def _draw_label(c, x, y, text):
    c.setFont("Helvetica", 7.5)
    c.setFillColor(GREY)
    c.drawString(x, y, text.upper())


def _draw_text(c, x, y, text, font="Helvetica", size=10, color=DARK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, str(text))


def _draw_right(c, x, y, text, font="Helvetica", size=10, color=DARK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawRightString(x, y, str(text))


def build_invoice_pdf(invoice_data: dict) -> bytes:
    """
    invoice_data = {
        'invoice_number': 'TSOP/2026-27/0001',
        'issued_at': datetime,
        'buyer': { 'name', 'gstin' (opt), 'address' (str), 'state_name', 'state_code',
                   'is_international' (bool) },
        'period_start': 'DD MMM YYYY',
        'period_end':   'DD MMM YYYY',
        'razorpay_ref': 'pay_xxx',
        'taxable_value': 2499,
        'tax': dict from compute_tax(...),
    }
    Returns: bytes of the PDF.
    """
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4

    MARGIN = 18 * mm
    cursor_y = H - MARGIN

    # ─── masthead ──────────────────────────────────────────────
    c.setFont("Helvetica", 8)
    c.setFillColor(GREY)
    c.drawString(MARGIN, cursor_y, "THE STATE OF PLAY")
    cursor_y -= 16
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(DARK)
    c.drawString(MARGIN, cursor_y, "Tax Invoice")

    # right-side: invoice number + date
    inv_x = W - MARGIN
    _draw_label(c, inv_x - 35 * mm, H - MARGIN, "Invoice no.")
    _draw_right(c, inv_x, H - MARGIN - 12, invoice_data["invoice_number"], "Helvetica-Bold", 11)
    _draw_label(c, inv_x - 35 * mm, H - MARGIN - 28, "Date of issue")
    _draw_right(c, inv_x, H - MARGIN - 40, invoice_data["issued_at"].strftime("%d %B %Y"))

    # Divider must sit BELOW both the masthead (left) and the date block (right).
    cursor_y = H - MARGIN - 52
    c.setStrokeColor(DARK)
    c.setLineWidth(0.8)
    c.line(MARGIN, cursor_y, W - MARGIN, cursor_y)
    cursor_y -= 18

    # ─── seller + buyer ────────────────────────────────────────
    col1 = MARGIN
    col2 = W / 2 + 4 * mm

    def draw_party(x, y, label, name, address_lines, gstin, state_name, state_code, extra=None):
        _draw_label(c, x, y, label); y -= 14
        _draw_text(c, x, y, name, "Helvetica-Bold", 11); y -= 14
        for line in address_lines:
            _draw_text(c, x, y, line, "Helvetica", 9.5); y -= 12
        y -= 6
        if gstin:
            _draw_text(c, x, y, "GSTIN: ", "Helvetica", 9, GREY)
            _draw_text(c, x + 32, y, gstin, "Helvetica-Bold", 9); y -= 11
        _draw_text(c, x, y, "State: ", "Helvetica", 9, GREY)
        _draw_text(c, x + 30, y, f"{state_name} ({state_code})", "Helvetica", 9); y -= 11
        if extra:
            _draw_text(c, x, y, extra, "Helvetica", 9, GREY); y -= 11
        return y

    seller_y = draw_party(
        col1, cursor_y, "Seller", SELLER["name"],
        SELLER["address"], SELLER["gstin"], SELLER["state_name"], SELLER["state_code"],
        extra=SELLER["email"],
    )

    buyer = invoice_data["buyer"]
    buyer_addr_lines = [l.strip() for l in buyer["address"].split("\n") if l.strip()]
    buyer_place = (
        "International"
        if buyer.get("is_international")
        else f"{buyer['state_name']} ({buyer['state_code']})"
    )
    buyer_y = draw_party(
        col2, cursor_y, "Bill to", buyer["name"],
        buyer_addr_lines, buyer.get("gstin"), buyer.get("state_name") or "—", buyer.get("state_code") or "—",
        extra=f"Place of supply: {buyer_place}",
    )

    cursor_y = min(seller_y, buyer_y) - 14

    # ─── line item table ───────────────────────────────────────
    c.setStrokeColor(DARK); c.setLineWidth(1.2)
    c.line(MARGIN, cursor_y, W - MARGIN, cursor_y)
    cursor_y -= 12
    _draw_label(c, MARGIN, cursor_y, "Description")
    _draw_label(c, W * 0.62, cursor_y, "SAC")
    _draw_label(c, W - MARGIN - 60, cursor_y, "Taxable value")
    cursor_y -= 6
    c.line(MARGIN, cursor_y, W - MARGIN, cursor_y)
    cursor_y -= 16

    _draw_text(c, MARGIN, cursor_y, invoice_data.get("description_override") or DESCRIPTION, "Helvetica", 10.5)
    _draw_text(c, W * 0.62, cursor_y, SAC_CODE)
    _draw_right(c, W - MARGIN, cursor_y, _rupee(invoice_data['taxable_value']))
    cursor_y -= 14
    _draw_text(
        c, MARGIN, cursor_y,
        f"Subscription period: {invoice_data['period_start']} to {invoice_data['period_end']}",
        "Helvetica", 9, GREY,
    )
    cursor_y -= 12
    _draw_text(c, MARGIN, cursor_y, f"Razorpay ref: {invoice_data['razorpay_ref']}", "Helvetica", 8.5, GREY)
    cursor_y -= 18
    c.setStrokeColor(RULE); c.setLineWidth(0.6)
    c.line(MARGIN, cursor_y, W - MARGIN, cursor_y)
    cursor_y -= 18

    # ─── tax summary (right aligned) ───────────────────────────
    tax = invoice_data["tax"]
    summary_x_label = W - MARGIN - 65 * mm
    summary_x_amt = W - MARGIN

    def row(label, amount_text, bold=False):
        nonlocal cursor_y
        font = "Helvetica-Bold" if bold else "Helvetica"
        _draw_text(c, summary_x_label, cursor_y, label, font, 10, GREY if not bold else DARK)
        _draw_right(c, summary_x_amt, cursor_y, amount_text, font, 10)
        cursor_y -= 14

    row("Taxable value", _rupee(invoice_data['taxable_value']))
    if tax["is_export"]:
        _draw_text(c, summary_x_label, cursor_y, tax["tax_label"], "Helvetica-Oblique", 9, GREY)
        cursor_y -= 14
    elif tax["cgst"]:
        row("CGST @ 9%", _rupee(tax['cgst']))
        row("SGST @ 9%", _rupee(tax['sgst']))
    else:
        row("IGST @ 18%", _rupee(tax['igst']))

    cursor_y -= 4
    c.setStrokeColor(DARK); c.setLineWidth(0.8)
    c.line(summary_x_label, cursor_y, W - MARGIN, cursor_y)
    cursor_y -= 14
    row("Total payable", _rupee(tax['total']), bold=True)

    cursor_y -= 8
    _draw_text(c, MARGIN, cursor_y, f"Amount in words: {amount_in_words_inr(tax['total'])}",
               "Helvetica-Oblique", 9, GREY)
    cursor_y -= 24

    # ─── notes ────────────────────────────────────────────────
    c.setStrokeColor(RULE); c.setLineWidth(0.6)
    c.line(MARGIN, cursor_y, W - MARGIN, cursor_y)
    cursor_y -= 14
    _draw_label(c, MARGIN, cursor_y, "Notes")
    cursor_y -= 14
    notes = [
        f"1. Payment received in full via Razorpay. This invoice is issued against transaction {invoice_data['razorpay_ref']}.",
        "2. This invoice is computer-generated and does not require a signature.",
        f"3. For queries, write to {SELLER['email']}.",
    ]
    for n in notes:
        _draw_text(c, MARGIN, cursor_y, n, "Helvetica", 8.5)
        cursor_y -= 12

    # ─── footer ───────────────────────────────────────────────
    footer_y = MARGIN + 8
    c.setStrokeColor(DARK); c.setLineWidth(0.8)
    c.line(MARGIN, footer_y + 14, W - MARGIN, footer_y + 14)
    _draw_text(c, MARGIN, footer_y, f"{SELLER['name']} · {SELLER['website']}", "Helvetica", 7.5, GREY)
    _draw_right(c, W - MARGIN, footer_y, invoice_data["invoice_number"], "Helvetica", 7.5, GREY)

    c.showPage()
    c.save()
    return buf.getvalue()
