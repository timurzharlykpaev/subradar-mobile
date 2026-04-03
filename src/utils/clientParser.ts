/**
 * clientParser — client-side text parsing utilities for the unified add flow.
 *
 * Detects bulk input (multiple services) and extracts prices from text.
 */

/** Returns true if the text looks like multiple subscriptions. */
export function isBulkInput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Multiple lines with content
  const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
  if (lines.length >= 2) return true;

  // Comma/semicolon-separated list with 2+ items
  const commaSplit = trimmed.split(/[,;]/).filter(s => s.trim().length > 2);
  if (commaSplit.length >= 2) return true;

  // "and"/"и"/"plus" connectors between service-like words
  const connectorPattern = /\b(and|и|плюс|также|ещё|еще|plus)\b/i;
  if (connectorPattern.test(trimmed)) {
    const parts = trimmed.split(connectorPattern).filter(s => s.trim().length > 2 && !connectorPattern.test(s));
    if (parts.length >= 2) return true;
  }

  return false;
}

/** Split bulk input into individual chunks. */
export function splitBulkInput(text: string): string[] {
  const trimmed = text.trim();

  // Try newline split first
  const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length >= 2) return lines;

  // Try comma/semicolon split
  const commaSplit = trimmed.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 2);
  if (commaSplit.length >= 2) return commaSplit;

  // Try connector split
  const parts = trimmed
    .split(/\b(?:and|и|плюс|также|ещё|еще|plus)\b/i)
    .map(s => s.trim())
    .filter(s => s.length > 2);
  if (parts.length >= 2) return parts;

  return [trimmed];
}

/** Extract a price from text (e.g. "$9.99" -> 9.99, "15 dollars" -> 15). */
export function extractPrice(text: string): { amount: number; currency: string } | null {
  // $9.99, 9.99$, €15, 15€
  const symbolMatch = text.match(/([€$£₽₸])\s*(\d+(?:[.,]\d{1,2})?)/);
  if (symbolMatch) {
    const symbolMap: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₽': 'RUB', '₸': 'KZT' };
    return { amount: parseFloat(symbolMatch[2].replace(',', '.')), currency: symbolMap[symbolMatch[1]] || 'USD' };
  }

  const symbolAfter = text.match(/(\d+(?:[.,]\d{1,2})?)\s*([€$£₽₸])/);
  if (symbolAfter) {
    const symbolMap: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₽': 'RUB', '₸': 'KZT' };
    return { amount: parseFloat(symbolAfter[1].replace(',', '.')), currency: symbolMap[symbolAfter[2]] || 'USD' };
  }

  // "9.99 USD", "15 dollars"
  const wordMatch = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(usd|eur|gbp|rub|kzt|dollar|euro|рубл)/i);
  if (wordMatch) {
    const currMap: Record<string, string> = { usd: 'USD', eur: 'EUR', gbp: 'GBP', rub: 'RUB', kzt: 'KZT', dollar: 'USD', euro: 'EUR' };
    const key = wordMatch[2].toLowerCase().replace(/s$/, '').replace(/ей$|ь$/, '');
    return { amount: parseFloat(wordMatch[1].replace(',', '.')), currency: currMap[key] || 'USD' };
  }

  return null;
}
