/**
 * Date Parser for Israeli Financial Documents
 * 
 * Parses dates from various formats found in Israeli credit card and bank statements
 * Supports: DD/MM/YY, DD/MM/YYYY, DD.MM.YY, DD-MM-YYYY, YYYY-MM-DD
 * 
 * Smart year handling: 2-digit years > 50 → 19XX, <= 50 → 20XX
 */

/**
 * Parse date from various Israeli formats to ISO format (YYYY-MM-DD)
 * 
 * @param dateStr - Date string in various formats (DD/MM/YY, DD/MM/YYYY, etc.)
 * @param fallbackYear - Optional fallback year if date parsing fails (YYYY format)
 * @returns ISO date string (YYYY-MM-DD) or null if parsing fails
 * 
 * @example
 * parseDate('52/80/11') // Returns '2025-08-11'
 * parseDate('11/08/2025') // Returns '2025-08-11'
 * parseDate('11.08.25') // Returns '2025-08-11'
 * parseDate('11-08-2025') // Returns '2025-08-11'
 */
export function parseDate(dateStr: string | null | undefined, fallbackYear?: number): string | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  // Already in ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Validate the date
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return trimmed;
    }
  }

  // Try different separators: /, ., -
  const separators = ['/', '.', '-'];
  
  for (const sep of separators) {
    const parts = trimmed.split(sep);
    
    if (parts.length === 3) {
      let day: string;
      let month: string;
      let year: string;

      // Determine format based on year length
      if (parts[0].length === 4) {
        // YYYY-MM-DD or YYYY/MM/DD format
        year = parts[0];
        month = parts[1];
        day = parts[2];
      } else {
        // DD/MM/YY or DD/MM/YYYY format (Israeli format)
        day = parts[0];
        month = parts[1];
        year = parts[2];
      }

      // Normalize day and month (pad with zeros)
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');

      // Handle 2-digit year
      if (year.length === 2) {
        const yearNum = parseInt(year, 10);
        // Smart year handling: > 50 → 19XX, <= 50 → 20XX
        // This handles dates like 52 → 2025, 99 → 1999, 25 → 2025
        if (yearNum > 50) {
          year = `19${year}`;
        } else {
          year = `20${year}`;
        }
      }

      // Validate day, month, year
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (
        dayNum >= 1 && dayNum <= 31 &&
        monthNum >= 1 && monthNum <= 12 &&
        yearNum >= 2000 && yearNum <= 2100
      ) {
        // Create date string and validate
        const isoDate = `${year}-${month}-${day}`;
        const date = new Date(isoDate);
        
        // Check if date is valid (handles invalid dates like 31/02/2025)
        if (!isNaN(date.getTime())) {
          // Verify the date components match (handles overflow)
          const dateYear = date.getFullYear();
          const dateMonth = date.getMonth() + 1;
          const dateDay = date.getDate();
          
          if (
            dateYear === yearNum &&
            dateMonth === monthNum &&
            dateDay === dayNum
          ) {
            return isoDate;
          }
        }
      }
    }
  }

  // If all parsing attempts failed and we have a fallback year
  if (fallbackYear) {
    const currentDate = new Date();
    return `${fallbackYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-15`;
  }

  return null;
}

/**
 * Parse date with statement month fallback
 * Used when we have a statement month but need a specific day
 * 
 * @param dateStr - Date string to parse
 * @param statementMonth - Statement month in YYYY-MM format
 * @returns ISO date string (YYYY-MM-DD) or null
 */
export function parseDateWithFallback(
  dateStr: string | null | undefined,
  statementMonth?: string | null
): string | null {
  const parsed = parseDate(dateStr);
  
  if (parsed) {
    return parsed;
  }

  // Fallback to statement month (use 15th as default day)
  if (statementMonth) {
    const [year, month] = statementMonth.split('-');
    if (year && month) {
      return `${year}-${month.padStart(2, '0')}-15`;
    }
  }

  return null;
}

/**
 * Validate that a date string is in valid format and reasonable range
 * 
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns true if date is valid and in reasonable range (2000-2100)
 */
export function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) {
    return false;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return false;
  }

  const year = date.getFullYear();
  return year >= 2000 && year <= 2100;
}

