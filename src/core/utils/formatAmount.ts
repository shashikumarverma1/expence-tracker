// Shared money-formatting helpers. Compact notation (K/L/Cr/M) keeps 2
// decimal places and trims trailing zeros, so e.g. ₹125000 reads as
// "₹1.25L" rather than rounding to a misleading "₹1.3L".

const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

/** Rounds to 2 decimals and drops trailing zeros: 1 -> "1", 1.5 -> "1.5", 1.25 -> "1.25". */
function trimmed(value: number): string {
  const fixed = value.toFixed(2);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

/** Compact amount, no sign: ₹1.25L, ₹850, $2.4K, … */
export function formatCompactAmount(amount: number, currency = 'INR'): string {
  const sym = CURRENCY_SYMBOL[currency] ?? '₹';
  const abs = Math.abs(amount);
  let str: string;
  if (currency === 'INR') {
    str = abs >= 100000
      ? `${trimmed(abs / 100000)}L`
      : abs >= 1000
      ? `${trimmed(abs / 1000)}K`
      : `${abs}`;
  } else {
    str = abs >= 1000000
      ? `${trimmed(abs / 1000000)}M`
      : abs >= 1000
      ? `${trimmed(abs / 1000)}K`
      : `${abs}`;
  }
  return `${sym}${str}`;
}

/** Compact amount with a leading +/- sign, for P&L-style displays. */
export function formatSignedCompactAmount(amount: number, currency = 'INR'): string {
  return `${amount >= 0 ? '+' : '-'}${formatCompactAmount(amount, currency)}`;
}

/** Compact INR amount including a Cr (crore) tier and a leading "-" for negatives. */
export function formatCompactINR(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const str = abs >= 10000000 ? `${trimmed(abs / 10000000)}Cr`
    : abs >= 100000 ? `${trimmed(abs / 100000)}L`
    : abs >= 1000 ? `${trimmed(abs / 1000)}K`
    : `${Math.round(abs)}`;
  return `${sign}₹${str}`;
}
