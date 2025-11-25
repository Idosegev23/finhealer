/**
 * Income Management Flow - ניהול מקורות הכנסה
 * 
 * פעולות:
 * 1. הוספת מקור הכנסה חדש
 * 2. עריכת מקור הכנסה קיים
 * 3. מחיקת מקור הכנסה
 * 4. העלאת תלוש משכורת / דוח הכנסות
 */

import { createClient } from '@/lib/supabase/server';
import { getRandomPhrase } from '../../../lib/ai/prompts/conversation-rules';

interface IncomeManagementContext {
  userId: string;
  action: 'add' | 'edit' | 'delete' | 'view';
  currentStep: string;
  incomeData: {
    id?: string;
    source_name?: string; // שם המעסיק / מקור ההכנסה
    income_type?: 'salary' | 'self_employed' | 'rental' | 'investments' | 'pension' | 'social_benefits' | 'other';
    amount?: number; // סכום נטו
    amount_gross?: number; // סכום ברוטו (לשכירים)
    frequency?: 'monthly' | 'weekly' | 'one_time'; // תדירות
    payment_day?: number; // יום קבלת תשלום (1-31)
    start_date?: string; // תאריך התחלה
    end_date?: string | null; // תאריך סיום (לעבודות זמניות)
    notes?: string;
  };
}

// ============================================================================
// Main Handler - ניתוב לפעולה המתאימה
// ============================================================================

export async function handleIncomeManagement(
  context: IncomeManagementContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  switch (context.action) {
    case 'add':
      return await handleAddIncome(context, message);
    case 'edit':
      return await handleEditIncome(context, message);
    case 'delete':
      return await handleDeleteIncome(context, message);
    case 'view':
      return await handleViewIncome(context, message);
    default:
      return {
        response: 'משהו השתבש 😕\nמה תרצה לעשות עם מקורות ההכנסה?',
        completed: false,
      };
  }
}

// ============================================================================
// הוספת מקור הכנסה חדש
// ============================================================================

async function handleAddIncome(
  context: IncomeManagementContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const data = context.incomeData;

  // שלב 1: סוג ההכנסה
  if (!data.income_type) {
    return {
      response: 'איזה סוג הכנסה תרצה להוסיף?\n\n• משכורת (שכיר)\n• הכנסה מעסק (עצמאי)\n• שכירות\n• השקעות\n• פנסיה\n• קצבה/דמי אבטלה\n• אחר',
      completed: false,
    };
  }

  // שלב 2: שם המקור
  if (!data.source_name) {
    const incomeType = extractIncomeType(message);
    if (incomeType) {
      data.income_type = incomeType;
      
      const sourcePrompt = getSourceNamePrompt(incomeType);
      return {
        response: sourcePrompt,
        completed: false,
      };
    } else {
      return {
        response: 'לא הבנתי... איזה סוג הכנסה? (משכורת/עצמאי/שכירות/השקעות/פנסיה/קצבה/אחר)',
        completed: false,
      };
    }
  }

  // שלב 3: סכום נטו
  if (!data.amount) {
    data.source_name = message.trim();
    return {
      response: 'כמה נכנס לך לחשבון בפועל? (סכום נטו אחרי מס)',
      completed: false,
    };
  }

  // שלב 4: סכום ברוטו (רק לשכירים)
  if (data.income_type === 'salary' && !data.amount_gross) {
    const amount = extractAmount(message);
    if (amount && amount > 0) {
      data.amount = amount;
      return {
        response: 'וכמה הברוטו? (לפני ניכויים)\n\n(אם לא יודע - "דלג")',
        completed: false,
      };
    } else {
      return {
        response: 'לא הבנתי את הסכום... כמה נכנס בפועל? (מספר בלבד)',
        completed: false,
      };
    }
  }

  // שלב 5: תדירות
  if (!data.frequency) {
    if (message.toLowerCase().includes('דלג')) {
      // דילוג על ברוטו
      data.amount_gross = undefined;
    } else {
      const gross = extractAmount(message);
      if (gross && gross >= (data.amount || 0)) {
        data.amount_gross = gross;
      }
    }

    return {
      response: 'כמה פעמים זה נכנס?\n\n• חודשי (כל חודש)\n• שבועי\n• חד פעמי',
      completed: false,
    };
  }

  // שלב 6: יום קבלת תשלום (רק לחודשי)
  if (!data.payment_day && data.frequency === 'monthly') {
    const frequency = extractFrequency(message);
    if (frequency) {
      data.frequency = frequency;
      
      if (frequency === 'monthly') {
        return {
          response: 'באיזה יום בחודש זה נכנס? (1-31)\n\n(לדוגמה: "10" או "סוף החודש")',
          completed: false,
        };
      } else {
        // שבועי או חד פעמי - לא צריך יום
        data.payment_day = undefined;
      }
    } else {
      return {
        response: 'לא הבנתי... כמה פעמים זה נכנס? (חודשי/שבועי/חד פעמי)',
        completed: false,
      };
    }
  }

  // שלב 7: תאריך התחלה (אופציונלי)
  if (!data.start_date && data.frequency !== 'one_time') {
    if (data.frequency === 'monthly') {
      const paymentDay = extractPaymentDay(message);
      if (paymentDay) {
        data.payment_day = paymentDay;
      } else {
        return {
          response: 'לא הבנתי... באיזה יום בחודש? (מספר 1-31)',
          completed: false,
        };
      }
    }

    return {
      response: 'מתי התחלת לקבל את ההכנסה הזאת?\n\n(תאריך או "לא יודע")',
      completed: false,
    };
  }

  // שלב 8: הערות (אופציונלי)
  if (!data.notes) {
    if (message.toLowerCase().includes('לא יודע') || message.toLowerCase().includes('דלג')) {
      data.start_date = undefined;
    } else {
      const startDate = extractDate(message);
      if (startDate) {
        data.start_date = startDate;
      }
    }

    return {
      response: 'רוצה להוסיף הערות? (אופציונלי)\n\n(או "לא" אם אין)',
      completed: false,
    };
  }

  // סיום - שמירה לדאטהבייס
  if (isNegativeAnswer(message)) {
    data.notes = undefined;
  } else {
    data.notes = message.trim();
  }

  // שמירה
  const success = await saveIncomeSource(context.userId, data);

  if (success) {
    const summary = buildIncomeSummary(data);
    return {
      response: `✅ מעולה! רשמתי את מקור ההכנסה:\n\n${summary}\n\nרוצה להוסיף עוד מקור הכנסה?`,
      completed: true,
      requiresAction: {
        type: 'income_added',
        data: data,
      },
    };
  } else {
    return {
      response: 'סליחה, משהו השתבש בשמירה 😕\nתוכל לנסות שוב?',
      completed: false,
    };
  }
}

// ============================================================================
// עריכת מקור הכנסה קיים
// ============================================================================

async function handleEditIncome(
  context: IncomeManagementContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  // TODO: Implement edit flow
  return {
    response: 'עריכת מקור הכנסה תהיה זמינה בקרוב 🚧',
    completed: true,
  };
}

// ============================================================================
// מחיקת מקור הכנסה
// ============================================================================

async function handleDeleteIncome(
  context: IncomeManagementContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  // TODO: Implement delete flow
  return {
    response: 'מחיקת מקור הכנסה תהיה זמינה בקרוב 🚧',
    completed: true,
  };
}

// ============================================================================
// צפייה במקורות הכנסה
// ============================================================================

async function handleViewIncome(
  context: IncomeManagementContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const incomeSources = await getIncomeSources(context.userId);

  if (incomeSources.length === 0) {
    return {
      response: 'עדיין אין לך מקורות הכנסה רשומים.\n\nרוצה להוסיף מקור הכנסה?',
      completed: true,
    };
  }

  let summary = '💰 מקורות ההכנסה שלך:\n\n';
  let totalMonthly = 0;

  incomeSources.forEach((source, index) => {
    const amount = source.amount || 0;
    const typeLabel = getIncomeTypeLabel(source.income_type);
    
    summary += `${index + 1}. ${source.source_name} (${typeLabel})\n`;
    summary += `   ${formatCurrency(amount)}`;
    
    if (source.frequency === 'monthly' && source.payment_day) {
      summary += ` • יום ${source.payment_day} בחודש`;
    }
    
    summary += '\n\n';

    if (source.frequency === 'monthly') {
      totalMonthly += amount;
    }
  });

  summary += `📊 סה"כ הכנסות חודשיות: ${formatCurrency(totalMonthly)}`;

  return {
    response: summary,
    completed: true,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractIncomeType(text: string): 'salary' | 'self_employed' | 'rental' | 'investments' | 'pension' | 'social_benefits' | 'other' | null {
  const lower = text.toLowerCase();
  
  if (lower.includes('משכורת') || lower.includes('שכיר') || lower.includes('salary')) return 'salary';
  if (lower.includes('עצמאי') || lower.includes('עסק') || lower.includes('self')) return 'self_employed';
  if (lower.includes('שכירות') || lower.includes('דירה') || lower.includes('rental')) return 'rental';
  if (lower.includes('השקעות') || lower.includes('מניות') || lower.includes('invest')) return 'investments';
  if (lower.includes('פנסיה') || lower.includes('pension')) return 'pension';
  if (lower.includes('קצבה') || lower.includes('דמי') || lower.includes('אבטלה') || lower.includes('benefit')) return 'social_benefits';
  if (lower.includes('אחר') || lower.includes('other')) return 'other';
  
  return null;
}

function getSourceNamePrompt(incomeType: string): string {
  switch (incomeType) {
    case 'salary':
      return 'מה שם המעסיק?';
    case 'self_employed':
      return 'מה שם העסק/התחום שלך?';
    case 'rental':
      return 'מה תרצה לקרוא להכנסה הזאת? (לדוגמה: "שכירות דירה בתל אביב")';
    case 'investments':
      return 'מאיזה סוג השקעה? (מניות, קרנות נאמנות, נדל"ן...)';
    case 'pension':
      return 'מאיזו קרן פנסיה?';
    case 'social_benefits':
      return 'איזה סוג קצבה? (אבטלה, נכות, זקנה...)';
    default:
      return 'מה תרצה לקרוא למקור ההכנסה הזה?';
  }
}

function extractAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '');
  const match = cleaned.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function extractFrequency(text: string): 'monthly' | 'weekly' | 'one_time' | null {
  const lower = text.toLowerCase();
  
  if (lower.includes('חודש') || lower.includes('monthly')) return 'monthly';
  if (lower.includes('שבוע') || lower.includes('week')) return 'weekly';
  if (lower.includes('חד פעמי') || lower.includes('one time') || lower.includes('פעם אחת')) return 'one_time';
  
  return null;
}

function extractPaymentDay(text: string): number | null {
  const lower = text.toLowerCase();
  
  // "סוף החודש" = 31
  if (lower.includes('סוף') || lower.includes('end')) {
    return 31;
  }
  
  const match = text.match(/\d+/);
  if (match) {
    const day = parseInt(match[0]);
    if (day >= 1 && day <= 31) {
      return day;
    }
  }
  
  return null;
}

function extractDate(text: string): string | null {
  // Try to extract date in format DD/MM/YYYY or DD-MM-YYYY
  const match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

function isNegativeAnswer(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('לא') || lower.includes('no') || lower.includes('אין') || lower === '0';
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL')}`;
}

function getIncomeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    salary: 'משכורת',
    self_employed: 'עצמאי',
    rental: 'שכירות',
    investments: 'השקעות',
    pension: 'פנסיה',
    social_benefits: 'קצבה',
    other: 'אחר',
  };
  
  return labels[type] || type;
}

function buildIncomeSummary(data: any): string {
  let summary = `💰 ${data.source_name}`;
  
  if (data.income_type) {
    summary += ` (${getIncomeTypeLabel(data.income_type)})`;
  }
  
  summary += `\n💵 ${formatCurrency(data.amount)}`;
  
  if (data.amount_gross) {
    summary += ` (ברוטו: ${formatCurrency(data.amount_gross)})`;
  }
  
  if (data.frequency === 'monthly') {
    summary += '\n📅 חודשי';
    if (data.payment_day) {
      summary += ` • יום ${data.payment_day}`;
    }
  } else if (data.frequency === 'weekly') {
    summary += '\n📅 שבועי';
  } else {
    summary += '\n📅 חד פעמי';
  }
  
  if (data.start_date) {
    summary += `\n🗓️ החל מ-${data.start_date}`;
  }
  
  if (data.notes) {
    summary += `\n📝 ${data.notes}`;
  }
  
  return summary;
}

// ============================================================================
// Database Operations
// ============================================================================

async function saveIncomeSource(userId: string, data: any): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('income_sources')
      .insert({
        user_id: userId,
        source_name: data.source_name,
        employment_type: data.income_type, // Note: טבלה שם employment_type לא income_type
        actual_bank_amount: data.amount, // מה שבאמת נכנס לבנק
        gross_amount: data.amount_gross || null,
        net_amount: data.amount, // נטו = מה שנכנס לבנק
        payment_frequency: data.frequency, // monthly/weekly/etc
        // payment_day לא קיים בטבלה, אבל יכול להיות בmetadata
        is_active: true,
        notes: data.notes,
        created_at: new Date().toISOString(),
      });
    
    return !error;
  } catch (error) {
    console.error('Error saving income source:', error);
    return false;
  }
}

async function getIncomeSources(userId: string): Promise<any[]> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('income_sources')
      .select('id, source_name, employment_type, actual_bank_amount, payment_frequency, is_active, created_at')
      .eq('user_id', userId)
      .eq('active', true) // Note: שדה active, לא is_active
      .order('created_at', { ascending: false });
    
    return (data || []).map(source => ({
      ...source,
      amount: source.actual_bank_amount,
      income_type: source.employment_type,
      frequency: source.payment_frequency,
    }));
  } catch (error) {
    console.error('Error fetching income sources:', error);
    return [];
  }
}

export default {
  handleIncomeManagement,
};

