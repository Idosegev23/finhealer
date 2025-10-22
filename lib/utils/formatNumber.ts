/**
 * Format a number with thousands separators for display
 * @param value - The number to format
 * @param options - Formatting options
 * @returns Formatted string with commas
 */
export function formatNumber(
  value: number | string | null | undefined,
  options: {
    decimals?: number;
    locale?: string;
    currency?: boolean;
  } = {}
): string {
  const { decimals = 0, locale = 'he-IL', currency = false } = options;
  
  if (value === null || value === undefined || value === '') {
    return currency ? '₪0' : '0';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return currency ? '₪0' : '0';
  }

  const formatted = numValue.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return currency ? `₪${formatted}` : formatted;
}

/**
 * Format currency with ₪ symbol and thousands separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number | string | null | undefined,
  decimals: number = 0
): string {
  return formatNumber(value, { currency: true, decimals });
}

/**
 * Parse a formatted number string back to a number
 * @param value - The formatted string
 * @returns Parsed number
 */
export function parseFormattedNumber(value: string): number {
  if (!value) return 0;
  // Remove currency symbols, commas, and other formatting
  const cleaned = value.replace(/[₪,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

