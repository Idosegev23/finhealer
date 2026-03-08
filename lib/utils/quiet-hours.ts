/**
 * Quiet Hours Guard
 * Blocks outgoing WhatsApp messages during:
 * - After 20:00 until 08:00 (Israel time)
 * - All day Friday (Shabbat preparation)
 * - All day Saturday (Shabbat)
 * - Jewish holidays
 */

// Israel timezone
const ISRAEL_TZ = 'Asia/Jerusalem';

// Quiet hours config
const QUIET_HOUR_START = 20; // 20:00
const QUIET_HOUR_END = 8;   // 08:00

/**
 * Get current date/time in Israel timezone
 */
function getIsraelTime(): { hour: number; dayOfWeek: number; dateStr: string; year: number } {
  const now = new Date();
  const israelStr = now.toLocaleString('en-US', { timeZone: ISRAEL_TZ });
  const israelDate = new Date(israelStr);

  return {
    hour: israelDate.getHours(),
    dayOfWeek: israelDate.getDay(), // 0=Sunday, 5=Friday, 6=Saturday
    dateStr: `${israelDate.getFullYear()}-${String(israelDate.getMonth() + 1).padStart(2, '0')}-${String(israelDate.getDate()).padStart(2, '0')}`,
    year: israelDate.getFullYear(),
  };
}

/**
 * Check if current time is during quiet hours (after 20:00 or before 08:00)
 */
function isDuringQuietHours(hour: number): boolean {
  return hour >= QUIET_HOUR_START || hour < QUIET_HOUR_END;
}

/**
 * Check if it's Friday or Saturday (Shabbat)
 */
function isShabbat(dayOfWeek: number): boolean {
  return dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
}

/**
 * Jewish holidays (Gregorian dates for 2025-2027)
 * Format: YYYY-MM-DD
 * Includes erev (eve) of major holidays
 */
const JEWISH_HOLIDAYS: Set<string> = new Set([
  // 2025
  '2025-03-13', '2025-03-14', // Purim (13-14 Adar)
  '2025-04-12', '2025-04-13', '2025-04-14', '2025-04-15', '2025-04-16', '2025-04-17', '2025-04-18', '2025-04-19', // Pesach
  '2025-06-01', '2025-06-02', // Shavuot
  '2025-09-22', '2025-09-23', '2025-09-24', // Rosh Hashana
  '2025-10-01', '2025-10-02', // Yom Kippur (erev + day)
  '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', '2025-10-10', '2025-10-11', '2025-10-12', '2025-10-13', // Sukkot + Simchat Torah

  // 2026
  '2026-03-03', '2026-03-04', // Purim
  '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07', '2026-04-08', // Pesach
  '2026-05-21', '2026-05-22', // Shavuot
  '2026-09-11', '2026-09-12', '2026-09-13', // Rosh Hashana
  '2026-09-20', '2026-09-21', // Yom Kippur
  '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', // Sukkot + Simchat Torah

  // 2027
  '2027-03-23', '2027-03-24', // Purim
  '2027-04-21', '2027-04-22', '2027-04-23', '2027-04-24', '2027-04-25', '2027-04-26', '2027-04-27', '2027-04-28', // Pesach
  '2027-06-10', '2027-06-11', // Shavuot
  '2027-10-02', '2027-10-03', '2027-10-04', // Rosh Hashana
  '2027-10-11', '2027-10-12', // Yom Kippur
  '2027-10-16', '2027-10-17', '2027-10-18', '2027-10-19', '2027-10-20', '2027-10-21', '2027-10-22', '2027-10-23', // Sukkot + Simchat Torah
]);

/**
 * Check if a date is a Jewish holiday
 */
function isJewishHoliday(dateStr: string): boolean {
  return JEWISH_HOLIDAYS.has(dateStr);
}

export interface QuietTimeResult {
  isQuiet: boolean;
  reason?: 'quiet_hours' | 'shabbat' | 'holiday';
  description?: string;
}

/**
 * Main guard: should we block sending a proactive message right now?
 *
 * Returns { isQuiet: true, reason } if messages should NOT be sent.
 * Returns { isQuiet: false } if it's OK to send.
 */
export function isQuietTime(): QuietTimeResult {
  const { hour, dayOfWeek, dateStr } = getIsraelTime();

  // Check Jewish holidays first
  if (isJewishHoliday(dateStr)) {
    return { isQuiet: true, reason: 'holiday', description: `חג (${dateStr})` };
  }

  // Check Shabbat (Friday/Saturday)
  if (isShabbat(dayOfWeek)) {
    const dayName = dayOfWeek === 5 ? 'שישי' : 'שבת';
    return { isQuiet: true, reason: 'shabbat', description: `יום ${dayName}` };
  }

  // Check quiet hours (20:00-08:00)
  if (isDuringQuietHours(hour)) {
    return { isQuiet: true, reason: 'quiet_hours', description: `שעות שקטות (${hour}:00)` };
  }

  return { isQuiet: false };
}

/**
 * Wrapper for cron jobs: returns true if messages can be sent now
 */
export function canSendProactiveMessage(): boolean {
  return !isQuietTime().isQuiet;
}
