// @ts-nocheck

// ============================================================================
// PII masking helpers for production logs
// ============================================================================

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  return phone.slice(0, 3) + '***' + phone.slice(-2);
}

export function maskUserId(id: string): string {
  if (!id || id.length < 8) return '***';
  return id.slice(0, 4) + '...' + id.slice(-4);
}

// ============================================================================
// Date parsing
// ============================================================================

/** Convert DD/MM/YYYY or other date formats → YYYY-MM-DD safely */
export function safeParseDateToISO(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  // DD/MM/YYYY format (from Gemini OCR)
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Try native parsing as last resort
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// Safe fetch with timeout + response validation
// ============================================================================

const FETCH_TIMEOUT_MS = 30_000; // 30 seconds

/** Fetch with timeout and response validation. Throws descriptive error on failure. */
export async function safeFetch(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
    }
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Download timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// Rate limiting per user_id
// ============================================================================

const userRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds

// Cleanup stale rate limit entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of userRateLimit.entries()) {
      if (val.resetAt < now) userRateLimit.delete(key);
    }
  }, 5 * 60 * 1000);
}

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRateLimit.get(userId);

  // Clean expired entries periodically
  if (userRateLimit.size > 500) {
    for (const [key, val] of userRateLimit) {
      if (val.resetAt < now) userRateLimit.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    userRateLimit.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// ============================================================================
// Per-user processing lock (prevents state transition race conditions)
// ============================================================================

const processingLocks = new Map<string, number>();
const LOCK_TIMEOUT_MS = 30_000; // 30 seconds max lock time

// Cleanup stale locks every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of processingLocks.entries()) {
      if (now - timestamp > LOCK_TIMEOUT_MS * 2) {
        processingLocks.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Acquire a processing lock for a user.
 * Returns true if lock acquired, false if user is already being processed.
 * Locks auto-expire after 30s to prevent deadlocks.
 */
export function acquireProcessingLock(userId: string): boolean {
  const now = Date.now();
  const existingLock = processingLocks.get(userId);

  // Lock exists and hasn't expired
  if (existingLock && (now - existingLock) < LOCK_TIMEOUT_MS) {
    return false;
  }

  processingLocks.set(userId, now);
  return true;
}

/** Release the processing lock for a user. */
export function releaseProcessingLock(userId: string): void {
  processingLocks.delete(userId);
}

// ============================================================================
// Processing tips & progress updates (shown during document analysis)
// ============================================================================

const CHART_PREPARING_MESSAGES = [
  '🎨 שניה, מכין לך משהו יפה...',
  '📊 רגע, מציירים את הנתונים שלך...',
  '✨ מכין תמונה מיוחדת בשבילך...',
  '🖼️ עובד על הויזואליזציה...',
  '🎯 שניה, מארגן את המספרים בתמונה...',
];

export { CHART_PREPARING_MESSAGES };

const PROCESSING_TIPS = [
  "💡 ידעת? לפי מחקרים, אנשים שעוקבים אחרי ההוצאות שלהם חוסכים בממוצע 15% יותר!",
  "💡 טיפ: הגדרת תקציב לכל קטגוריה עוזרת להימנע מהוצאות אימפולסיביות.",
  "💡 הידעת? רוב ההוצאות הקטנות (קפה, חטיפים) מצטברות ל-15% מהתקציב החודשי.",
  "💡 טיפ: בדיקת דוחות פעם בשבוע עוזרת לזהות בעיות לפני שהן גדלות.",
  "💡 הידעת? השקעה של 10% מההכנסה מגיל צעיר יכולה להכפיל את החיסכון לפנסיה.",
  "💡 טיפ: לפני קנייה גדולה, המתן 48 שעות - זה מונע רכישות אימפולסיביות.",
  "💡 הידעת? מנוי שלא משתמשים בו עולה בממוצע 200₪ בחודש לישראלי.",
  "💡 טיפ: כלל 50/30/20 - 50% לצרכים, 30% לרצונות, 20% לחיסכון.",
];

const PROCESSING_STAGES = [
  "🔍 סורק את המסמך...",
  "📊 מזהה תנועות...",
  "🏷️ מסווג קטגוריות...",
  "🧮 מחשב סיכומים...",
  "✨ מסיים ניתוח...",
];

async function sendProcessingTip(greenAPI: any, phoneNumber: string, tipIndex: number): Promise<void> {
  const tip = PROCESSING_TIPS[tipIndex % PROCESSING_TIPS.length];
  await greenAPI.sendMessage({ phoneNumber, message: tip });
}

async function sendProgressUpdate(greenAPI: any, phoneNumber: string, stage: number): Promise<void> {
  const stageMessage = PROCESSING_STAGES[Math.min(stage, PROCESSING_STAGES.length - 1)];
  await greenAPI.sendMessage({ phoneNumber, message: stageMessage });
}

/** Start background progress updates during document processing. Returns stop function. */
export function startProgressUpdates(
  greenAPI: any,
  phoneNumber: string
): { stop: () => void } {
  let stage = 0;
  let tipIndex = Math.floor(Math.random() * PROCESSING_TIPS.length);
  let stopped = false;

  const tipTimeout = setTimeout(async () => {
    if (!stopped) { await sendProcessingTip(greenAPI, phoneNumber, tipIndex); tipIndex++; }
  }, 15000);

  const progressTimeout = setTimeout(async () => {
    if (!stopped) { stage++; await sendProgressUpdate(greenAPI, phoneNumber, stage); }
  }, 30000);

  const tipTimeout2 = setTimeout(async () => {
    if (!stopped) { await sendProcessingTip(greenAPI, phoneNumber, tipIndex); tipIndex++; }
  }, 50000);

  const progressTimeout2 = setTimeout(async () => {
    if (!stopped) { stage++; await sendProgressUpdate(greenAPI, phoneNumber, stage); }
  }, 70000);

  const progressTimeout3 = setTimeout(async () => {
    if (!stopped) {
      await greenAPI.sendMessage({
        phoneNumber,
        message: "⏳ עוד קצת... המסמך מורכב אבל אני כמעט סיימתי!"
      });
    }
  }, 90000);

  return {
    stop: () => {
      stopped = true;
      clearTimeout(tipTimeout);
      clearTimeout(progressTimeout);
      clearTimeout(tipTimeout2);
      clearTimeout(progressTimeout2);
      clearTimeout(progressTimeout3);
    }
  };
}
