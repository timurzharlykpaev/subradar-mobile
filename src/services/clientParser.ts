export interface ParsedInput {
  name: string;
  amount?: number;
  currency?: string;
  billingPeriod?: string;
}

const CURRENCY_MAP: Record<string, string> = {
  '$': 'USD', '€': 'EUR', '£': 'GBP', '₽': 'RUB', '₸': 'KZT',
  'usd': 'USD', 'eur': 'EUR', 'gbp': 'GBP', 'rub': 'RUB', 'kzt': 'KZT',
  'dollars': 'USD', 'dollar': 'USD', 'euros': 'EUR', 'euro': 'EUR',
  'руб': 'RUB', 'рублей': 'RUB', 'тенге': 'KZT',
};

const PERIOD_MAP: Record<string, string> = {
  'mo': 'MONTHLY', 'month': 'MONTHLY', 'monthly': 'MONTHLY', 'мес': 'MONTHLY',
  'yr': 'YEARLY', 'year': 'YEARLY', 'yearly': 'YEARLY', 'annual': 'YEARLY', 'год': 'YEARLY',
  'week': 'WEEKLY', 'weekly': 'WEEKLY', 'нед': 'WEEKLY',
  'quarter': 'QUARTERLY', 'quarterly': 'QUARTERLY',
};

const PRICE_PATTERNS = [
  // Netflix $15.49/mo
  /^(.+?)\s*([€$£₽₸])\s*(\d+[\.,]?\d*)\s*\/?\s*(\w+)?$/,
  // Netflix 15.49$/mo
  /^(.+?)\s+(\d+[\.,]?\d*)\s*([€$£₽₸])\s*\/?\s*(\w+)?$/,
  // Netflix 15 dollars monthly
  /^(.+?)\s+(\d+[\.,]?\d*)\s+(dollars?|usd|eur|euros?|gbp|руб\w*|тенге|kzt)\s*\/?\s*(\w+)?$/i,
  // Netflix 15/mo
  /^(.+?)\s+(\d+[\.,]?\d*)\s*\/\s*(\w+)$/,
];

export function extractPrice(input: string): ParsedInput {
  const trimmed = input.trim();

  for (const pattern of PRICE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    if (pattern === PRICE_PATTERNS[0]) {
      const [, name, currSymbol, amount, period] = match;
      return {
        name: name.trim(),
        amount: parseFloat(amount.replace(',', '.')),
        currency: CURRENCY_MAP[currSymbol] || 'USD',
        billingPeriod: period ? (PERIOD_MAP[period.toLowerCase()] || 'MONTHLY') : undefined,
      };
    }
    if (pattern === PRICE_PATTERNS[1]) {
      const [, name, amount, currSymbol, period] = match;
      return {
        name: name.trim(),
        amount: parseFloat(amount.replace(',', '.')),
        currency: CURRENCY_MAP[currSymbol] || 'USD',
        billingPeriod: period ? (PERIOD_MAP[period.toLowerCase()] || 'MONTHLY') : undefined,
      };
    }
    if (pattern === PRICE_PATTERNS[2]) {
      const [, name, amount, currWord, period] = match;
      return {
        name: name.trim(),
        amount: parseFloat(amount.replace(',', '.')),
        currency: CURRENCY_MAP[currWord.toLowerCase()] || 'USD',
        billingPeriod: period ? (PERIOD_MAP[period.toLowerCase()] || 'MONTHLY') : undefined,
      };
    }
    if (pattern === PRICE_PATTERNS[3]) {
      const [, name, amount, period] = match;
      return {
        name: name.trim(),
        amount: parseFloat(amount.replace(',', '.')),
        billingPeriod: PERIOD_MAP[period.toLowerCase()] || 'MONTHLY',
      };
    }
  }

  return { name: trimmed };
}

export function isBulkInput(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.includes('\n')) return true;
  const commaCount = (trimmed.match(/,/g) || []).length;
  if (commaCount >= 1) {
    // Check if commas separate services (not decimals like "$1,500")
    const parts = trimmed.split(',').map(p => p.trim());
    const looksLikeServices = parts.filter(p => p.length > 2 && /[a-zA-Zа-яА-Я]/.test(p));
    if (looksLikeServices.length >= 2) return true;
  }
  return false;
}

export function splitBulkInput(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
