/**
 * NotificationService - Centralized messaging
 *
 * Wraps WhatsApp (GreenAPI) with structured message types.
 * Single place to send all user-facing messages.
 */

import { getGreenAPIClient, sendWhatsAppImage, sendWhatsAppInteractiveButtons } from '@/lib/greenapi/client';

// ============================================================================
// Types
// ============================================================================

export interface ButtonOption {
  buttonId: string;
  buttonText: string;
}

// ============================================================================
// Core Send Functions
// ============================================================================

/**
 * Send a plain text message
 */
export async function sendMessage(phone: string, message: string): Promise<void> {
  const greenAPI = getGreenAPIClient();
  await greenAPI.sendMessage({ phoneNumber: phone, message });
}

/**
 * Send a message with interactive buttons (falls back to text if buttons fail)
 */
export async function sendWithButtons(
  phone: string,
  message: string,
  buttons: ButtonOption[],
  header?: string
): Promise<void> {
  try {
    await sendWhatsAppInteractiveButtons(phone, {
      message,
      header,
      buttons,
    });
  } catch {
    // Fallback to plain text with numbered options
    const buttonList = buttons.map((b, i) => `${i + 1}. ${b.buttonText}`).join('\n');
    await sendMessage(phone, `${message}\n\n${buttonList}`);
  }
}

/**
 * Send an image with optional caption
 */
export async function sendImage(
  phone: string,
  imageBase64: string,
  caption?: string,
  mimeType?: string
): Promise<void> {
  await sendWhatsAppImage(phone, imageBase64, caption, mimeType);
}

// ============================================================================
// Structured Messages (Hebrew, RTL)
// ============================================================================

/**
 * Send a financial summary message
 */
export async function sendFinancialSummary(
  phone: string,
  data: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    topCategories?: Array<{ name: string; amount: number }>;
    title?: string;
  }
): Promise<void> {
  const { totalIncome, totalExpenses, balance, topCategories, title } = data;
  const balanceEmoji = balance >= 0 ? '✨' : '📉';

  let message = title ? `${title}\n\n` : '';
  message += `📊 *הסיכום שלך:*\n`;
  message += `💚 הכנסות: ${totalIncome.toLocaleString('he-IL')} ₪\n`;
  message += `💸 הוצאות: ${totalExpenses.toLocaleString('he-IL')} ₪\n`;
  message += `${balanceEmoji} יתרה: ${balance.toLocaleString('he-IL')} ₪\n`;

  if (topCategories && topCategories.length > 0) {
    message += `\n*הקטגוריות הגדולות:*\n`;
    message += topCategories
      .slice(0, 5)
      .map(c => `• ${c.name}: ${c.amount.toLocaleString('he-IL')} ₪`)
      .join('\n');
  }

  await sendMessage(phone, message);
}

/**
 * Send a phase transition notification
 */
export async function sendPhaseTransition(
  phone: string,
  phaseName: string,
  nextAction: string
): Promise<void> {
  await sendMessage(
    phone,
    `🎉 *עברת לשלב: ${phaseName}!*\n\n${nextAction}`
  );
}

/**
 * Send classification prompt for a transaction
 */
export async function sendClassificationPrompt(
  phone: string,
  data: {
    vendor: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
    count?: number;
    suggestions?: string[];
  }
): Promise<void> {
  const { vendor, amount, date, type, count, suggestions } = data;
  const emoji = type === 'income' ? '💚' : '💸';
  const formattedAmount = Math.abs(amount).toLocaleString('he-IL');

  let message = `${emoji} *${vendor}*\n`;
  message += `💰 ${formattedAmount} ₪`;
  if (count && count > 1) {
    message += ` (${count} תנועות)`;
  }
  message += `\n📅 ${date}\n\n`;

  if (suggestions && suggestions.length > 0) {
    message += `💡 הצעות:\n`;
    suggestions.forEach((s, i) => {
      message += `${i + 1}. ${s}\n`;
    });
    message += `\nבחר מספר או כתוב קטגוריה:`;
  } else {
    message += `לאיזו קטגוריה שייך?`;
  }

  await sendMessage(phone, message);
}

/**
 * Send a goal progress update
 */
export async function sendGoalProgress(
  phone: string,
  goal: {
    name: string;
    current: number;
    target: number;
    monthsLeft?: number;
  }
): Promise<void> {
  const progress = goal.target > 0
    ? Math.round((goal.current / goal.target) * 100)
    : 0;
  const filled = Math.round(progress / 10);
  const progressBar = '▓'.repeat(filled) + '░'.repeat(10 - filled);

  let message = `🎯 *${goal.name}*\n`;
  message += `${progressBar} ${progress}%\n`;
  message += `${goal.current.toLocaleString('he-IL')}/${goal.target.toLocaleString('he-IL')} ₪`;

  if (goal.monthsLeft !== undefined) {
    message += `\n📅 נשארו ${goal.monthsLeft} חודשים`;
  }

  await sendMessage(phone, message);
}

/**
 * Send error message
 */
export async function sendError(phone: string, context?: string): Promise<void> {
  await sendMessage(
    phone,
    `❌ ${context || 'משהו השתבש. נסה שוב.'}`
  );
}
