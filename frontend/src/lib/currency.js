// Dollar figures for readers outside India: "₹1,500 crore" in a story
// becomes "₹1,500 crore (about $160 million)". The rupee figure stays as
// written; the dollar one is rounded, a reader aid only.
//
// One fixed, rounded rate, updated by hand when the rupee moves enough
// to matter (Venkat's call). Last set: October 8, 2026.
export const RUPEES_PER_DOLLAR = 96;

const UNITS = {
  'lakh crore': 1e12, 'lakh-crore': 1e12,
  crore: 1e7, crores: 1e7, cr: 1e7,
  lakh: 1e5, lakhs: 1e5, lac: 1e5,
  billion: 1e9, bn: 1e9,
  million: 1e6, mn: 1e6,
  thousand: 1e3,
};

// Rs / Rs. / ₹ / INR (stories use Rs), a number (Indian or Western
// grouping, decimals), then an optional unit, spaced or hyphenated
// ("Rs 1,500 crore", "a Rs 1,500-crore deal", "Rs 500cr"). Ranges ("₹1,500-2,000 crore") and figures the
// writer already gave in dollars ("₹1,500 crore ($180 million)") are
// left alone.
const AMOUNT = /(₹|\bRs\.?|\bINR)\s?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:[\s-]?(lakh[ -]crore|crores?|cr|lakhs?|lac|billion|bn|million|mn|thousand)\b)?/gi;
// "Rs 1,500-2,000 crore", "Rs 1,500 to 2,000 crore", or a dollar figure
// the writer already gave: the amount is left as written.
const RANGE_OR_DOLLARS_NEXT = /^(?:\s?[-–]\s?(?:Rs\.?\s?)?\d|\s+to\s+(?:Rs\.?\s?)?\d|\s*\(\s*(?:US)?\$|\d)/i;

const twoSignificant = (n) => {
  if (n === 0) return 0;
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(n))) - 1);
  return Math.round(n / magnitude) * magnitude;
};

const trim = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

export const formatDollars = (usd) => {
  if (usd >= 1e9) {
    const b = usd / 1e9;
    return `$${trim(b >= 10 ? twoSignificant(b) : Math.round(b * 10) / 10)} billion`;
  }
  if (usd >= 1e6) {
    const m = usd / 1e6;
    return `$${trim(m >= 10 ? twoSignificant(m) : Math.round(m * 10) / 10)} million`;
  }
  return `$${(usd < 100 ? Math.round(usd) : twoSignificant(usd)).toLocaleString('en-US')}`;
};

export const rupeesToDollarText = (amount, unit) => {
  const multiplier = unit ? UNITS[unit.toLowerCase().replace(/[\s-]+/, ' ')] || 1 : 1;
  const rupees = parseFloat(amount.replace(/,/g, '')) * multiplier;
  if (!Number.isFinite(rupees) || rupees <= 0) return null;
  return formatDollars(rupees / RUPEES_PER_DOLLAR);
};

// Works on a story's HTML: only the text between tags is touched, never
// attributes or links.
export const addDollarAmounts = (html) => {
  if (!html) return html;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(AMOUNT, (match, _sym, amount, unit, offset, text) => {
      // A range, or a figure the writer already put in dollars: leave it.
      if (RANGE_OR_DOLLARS_NEXT.test(text.slice(offset + match.length))) return match;
      const dollars = rupeesToDollarText(amount, unit);
      return dollars
        ? `${match}<span class="tsop-usd" title="At ₹${RUPEES_PER_DOLLAR} to $1"> (about ${dollars})</span>`
        : match;
    })))
    .join('');
};
