/**
 * Loan Consolidation Flow - שלב 5: איחוד הלוואות
 * 
 * מטרות:
 * - ניתוח הלוואות קיימות
 * - זיהוי הזדמנויות לאיחוד
 * - הצגת חיסכון פוטנציאלי
 * - שליחת בקשה לגדי
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

interface LoanConsolidationContext {
  userId: string;
  currentStep: 'analysis' | 'details' | 'suggestion' | 'confirm' | 'complete';
  loans?: Array<{
    id: string;
    lenderName: string;
    loanType: string;
    currentBalance: number;
    monthlyPayment: number;
    interestRate: number;
    remainingPayments: number;
  }>;
  consolidationSuggestion?: {
    totalDebt: number;
    currentMonthlyTotal: number;
    estimatedNewPayment: number;
    estimatedSavings: number;
    estimatedNewRate: number;
  };
  preferredPayment?: number;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleLoanConsolidation(
  context: LoanConsolidationContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  // אתחול
  if (!context.loans) {
    context.loans = await getExistingLoans(context.userId);
  }
  
  switch (context.currentStep) {
    case 'analysis':
      return await handleAnalysisStep(context, message);
    case 'details':
      return await handleDetailsStep(context, message);
    case 'suggestion':
      return await handleSuggestionStep(context, message);
    case 'confirm':
      return await handleConfirmStep(context, message);
    default:
      return await handleAnalysisStep(context, message);
  }
}

// ============================================================================
// שלב 1: ניתוח הלוואות
// ============================================================================

async function handleAnalysisStep(
  context: LoanConsolidationContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const loans = context.loans || [];
  
  // אם אין הלוואות
  if (loans.length === 0) {
    return {
      response: `לא מצאתי הלוואות פעילות בחשבון שלך.\n\nיש לך הלוואות שתרצה לרשום?`,
      completed: false,
      requiresAction: {
        type: 'no_loans',
        data: {},
      },
    };
  }
  
  // אם יש רק הלוואה אחת
  if (loans.length === 1) {
    return {
      response: `יש לך הלוואה אחת:\n\n🏦 ${loans[0].lenderName}\n💰 יתרה: ${formatCurrency(loans[0].currentBalance)}\n💵 תשלום: ${formatCurrency(loans[0].monthlyPayment)}/חודש\n📊 ריבית: ${loans[0].interestRate}%\n\nאיחוד רלוונטי רק אם יש 2 הלוואות או יותר.\n\nרוצה להוסיף הלוואה נוספת?`,
      completed: true,
    };
  }
  
  // ניתוח איחוד
  const analysis = analyzeConsolidation(loans);
  context.consolidationSuggestion = analysis;
  
  let msg = `💡 מצאתי ${loans.length} הלוואות פעילות:\n\n`;
  
  for (const loan of loans) {
    msg += `🏦 **${loan.lenderName}**\n`;
    msg += `   יתרה: ${formatCurrency(loan.currentBalance)}\n`;
    msg += `   תשלום: ${formatCurrency(loan.monthlyPayment)}/חודש\n`;
    msg += `   ריבית: ${loan.interestRate}%\n\n`;
  }
  
  msg += `📊 **סיכום:**\n`;
  msg += `סה"כ חוב: ${formatCurrency(analysis.totalDebt)}\n`;
  msg += `סה"כ תשלום חודשי: ${formatCurrency(analysis.currentMonthlyTotal)}\n\n`;
  
  if (analysis.estimatedSavings > 100) {
    msg += `🎯 **הזדמנות לאיחוד!**\n\n`;
    msg += `אם נאחד את כל ההלוואות:\n`;
    msg += `• תשלום חדש משוער: ${formatCurrency(analysis.estimatedNewPayment)}/חודש\n`;
    msg += `• ריבית משוערת: ${analysis.estimatedNewRate}%\n`;
    msg += `• חיסכון: ${formatCurrency(analysis.estimatedSavings)}/חודש! 🎉\n\n`;
    msg += `רוצה שאבדוק את זה מול גדי?`;
  } else {
    msg += `💡 נראה שההלוואות שלך כבר בתנאים טובים.\n`;
    msg += `החיסכון הפוטנציאלי מאיחוד הוא רק ${formatCurrency(analysis.estimatedSavings)}/חודש.\n\n`;
    msg += `רוצה בכל זאת לבדוק?`;
  }
  
  return {
    response: msg,
    completed: false,
    requiresAction: {
      type: 'set_context',
      data: { currentStep: 'suggestion' },
    },
  };
}

// ============================================================================
// שלב 2: פרטים נוספים
// ============================================================================

async function handleDetailsStep(
  context: LoanConsolidationContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  // אם המשתמש רוצה להוסיף הלוואה
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('להוסיף') || lowerMessage.includes('עוד')) {
    return {
      response: `בוא נוסיף הלוואה.\n\nמאיזה בנק/גוף ההלוואה?`,
      completed: false,
      requiresAction: {
        type: 'add_loan',
        data: {},
      },
    };
  }
  
  // חזור לניתוח
  return await handleAnalysisStep(context, message);
}

// ============================================================================
// שלב 3: הצעת איחוד
// ============================================================================

async function handleSuggestionStep(
  context: LoanConsolidationContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const lowerMessage = message.toLowerCase();
  
  // אם מסכים לבדוק
  if (isPositive(message)) {
    return {
      response: `מעולה! 👍\n\nלפני שאני שולח לגדי, איזה תשלום חודשי יהיה נוח לך?\n\n(כרגע אתה משלם ${formatCurrency(context.consolidationSuggestion!.currentMonthlyTotal)}/חודש)`,
      completed: false,
      requiresAction: {
        type: 'set_context',
        data: { currentStep: 'confirm' },
      },
    };
  }
  
  // אם לא מעוניין
  if (isNegative(message)) {
    return {
      response: `בסדר! 😊\n\nאם תרצה לבדוק בעתיד - פשוט תגיד "איחוד הלוואות".\n\nיש משהו אחר שאני יכול לעזור?`,
      completed: true,
    };
  }
  
  // אם רוצה מידע נוסף
  if (lowerMessage.includes('איך') || lowerMessage.includes('מה') || lowerMessage.includes('הסבר')) {
    return {
      response: `📚 **איך זה עובד?**\n\n1️⃣ אני שולח את הפרטים לגדי\n2️⃣ גדי בודק אפשרויות מול בנקים/גופים\n3️⃣ גדי חוזר אליך עם הצעות\n4️⃣ אתה בוחר את ההצעה הטובה ביותר\n5️⃣ גדי מטפל בכל הבירוקרטיה\n\n💡 **יתרונות איחוד:**\n• תשלום אחד במקום כמה\n• ריבית נמוכה יותר (בד"כ)\n• פחות עמלות\n• פשטות בניהול\n\nרוצה שאבדוק?`,
      completed: false,
    };
  }
  
  // ברירת מחדל
  return {
    response: `מה אתה אומר? רוצה שאבדוק עם גדי?`,
    completed: false,
  };
}

// ============================================================================
// שלב 4: אישור ושליחה
// ============================================================================

async function handleConfirmStep(
  context: LoanConsolidationContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  // זהה תשלום מועדף
  const preferredPayment = extractAmount(message);
  
  if (preferredPayment && preferredPayment > 0) {
    context.preferredPayment = preferredPayment;
    
    // שמור בקשה
    const success = await submitConsolidationRequest(
      context.userId,
      context.loans!,
      context.consolidationSuggestion!,
      preferredPayment
    );
    
    if (success) {
      return {
        response: `מעולה! 🎉\n\nשלחתי בקשה לגדי:\n\n📊 **פרטים:**\n💰 סה"כ לאיחוד: ${formatCurrency(context.consolidationSuggestion!.totalDebt)}\n💵 תשלום מועדף: ${formatCurrency(preferredPayment)}/חודש\n🏦 מספר הלוואות: ${context.loans!.length}\n\nגדי יחזור אליך תוך 1-2 ימי עסקים 📞\n\nאני אעדכן אותך ברגע שיהיה משהו חדש!`,
        completed: true,
        requiresAction: {
          type: 'consolidation_submitted',
          data: {
            loans: context.loans,
            suggestion: context.consolidationSuggestion,
            preferredPayment,
          },
        },
      };
    } else {
      return {
        response: `סליחה, משהו השתבש בשליחת הבקשה 😕\nתוכל לנסות שוב?`,
        completed: false,
      };
    }
  }
  
  // אם לא הבנו סכום
  return {
    response: `לא הבנתי את הסכום...\n\nכמה תשלום חודשי יהיה נוח לך? (מספר בלבד)`,
    completed: false,
  };
}

// ============================================================================
// Proactive Suggestion
// ============================================================================

/**
 * נקרא מה-insights generator כשמזוהים 2+ הלוואות
 */
export async function generateConsolidationSuggestion(userId: string): Promise<string | null> {
  const loans = await getExistingLoans(userId);
  
  if (loans.length < 2) return null;
  
  const analysis = analyzeConsolidation(loans);
  
  // רק אם יש חיסכון משמעותי
  if (analysis.estimatedSavings < 200) return null;
  
  let msg = `💡 שמתי לב למשהו חשוב:\n\n`;
  msg += `יש לך ${loans.length} הלוואות פעילות.\n`;
  msg += `סה"כ תשלום: ${formatCurrency(analysis.currentMonthlyTotal)}/חודש\n\n`;
  msg += `🎯 אפשרות איחוד:\n`;
  msg += `• תשלום חדש: ~${formatCurrency(analysis.estimatedNewPayment)}/חודש\n`;
  msg += `• חיסכון: ${formatCurrency(analysis.estimatedSavings)}/חודש!\n\n`;
  msg += `רוצה שאבדוק את זה מול גדי?`;
  
  return msg;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL')}`;
}

function isPositive(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('כן') || lower.includes('בטח') || lower.includes('אוקיי') || 
         lower.includes('לבדוק') || lower.includes('תבדוק');
}

function isNegative(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('לא') || lower.includes('לא צריך') || lower.includes('לא מעניין');
}

function extractAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

interface ConsolidationAnalysis {
  totalDebt: number;
  currentMonthlyTotal: number;
  estimatedNewPayment: number;
  estimatedSavings: number;
  estimatedNewRate: number;
}

function analyzeConsolidation(loans: Array<any>): ConsolidationAnalysis {
  const totalDebt = loans.reduce((sum, l) => sum + l.currentBalance, 0);
  const currentMonthlyTotal = loans.reduce((sum, l) => sum + l.monthlyPayment, 0);
  
  // חישוב ריבית משוקללת נוכחית
  let weightedRate = 0;
  for (const loan of loans) {
    weightedRate += loan.interestRate * (loan.currentBalance / totalDebt);
  }
  
  // הערכה: ריבית חדשה תהיה נמוכה ב-0.5-1.5%
  const estimatedNewRate = Math.max(2.5, weightedRate - 1);
  
  // חישוב תשלום חדש משוער (60 חודשים)
  const monthlyRate = estimatedNewRate / 100 / 12;
  const periods = 60;
  const estimatedNewPayment = Math.round(
    totalDebt * (monthlyRate * Math.pow(1 + monthlyRate, periods)) / 
    (Math.pow(1 + monthlyRate, periods) - 1)
  );
  
  const estimatedSavings = currentMonthlyTotal - estimatedNewPayment;
  
  return {
    totalDebt,
    currentMonthlyTotal,
    estimatedNewPayment,
    estimatedSavings: Math.max(0, estimatedSavings),
    estimatedNewRate: Math.round(estimatedNewRate * 10) / 10,
  };
}

// ============================================================================
// Database Operations
// ============================================================================

async function getExistingLoans(userId: string): Promise<Array<any>> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);
  
  return (data || []).map(l => ({
    id: l.id,
    lenderName: l.lender_name,
    loanType: l.loan_type,
    currentBalance: l.current_balance,
    monthlyPayment: l.monthly_payment,
    interestRate: l.interest_rate,
    remainingPayments: l.remaining_payments,
  }));
}

async function submitConsolidationRequest(
  userId: string,
  loans: Array<any>,
  suggestion: ConsolidationAnalysis,
  preferredPayment: number
): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    // Create loan application
    const { error } = await supabase
      .from('loan_applications')
      .insert({
        user_id: userId,
        application_type: 'consolidation',
        status: 'submitted',
        requested_amount: suggestion.totalDebt,
        requested_term_months: 60,
        purpose: `איחוד ${loans.length} הלוואות קיימות`,
        current_loans: loans.map(l => ({
          lender: l.lenderName,
          balance: l.currentBalance,
          payment: l.monthlyPayment,
          rate: l.interestRate,
        })),
        preferred_monthly_payment: preferredPayment,
        estimated_savings: suggestion.estimatedSavings,
        created_at: new Date().toISOString(),
      });
    
    if (error) throw error;
    
    // TODO: Send notification to Gadi (webhook/email)
    
    return true;
  } catch (error) {
    console.error('Failed to submit consolidation request:', error);
    return false;
  }
}

export default {
  handleLoanConsolidation,
  generateConsolidationSuggestion,
};

