/**
 * Budget Management Flow - AI-First!
 * 
 * עיקרון מפתח:
 * ❌ לא: "כמה תקציב תרצה לקבוע ל-X?"
 * ✅ כן: AI מציע תקציב מותאם, המשתמש מאשר/משנה
 * 
 * זרימה:
 * 1. AI בונה תקציב מומלץ (buildSmartBudget)
 * 2. הצגת ההמלצה למשתמש
 * 3. משתמש מאשר או מבקש שינויים
 * 4. שמירה ל-DB
 */

import { createClient } from '@/lib/supabase/server';
import { 
  buildSmartBudget, 
  formatBudgetMessage, 
  saveBudgetToDatabase,
  BudgetRecommendation 
} from '@/lib/analysis/smart-budget-builder';

// ============================================================================
// Types
// ============================================================================

interface BudgetFlowContext {
  userId: string;
  currentStep: 'generate' | 'review' | 'adjust' | 'confirm' | 'complete';
  recommendation?: BudgetRecommendation;
  adjustmentRequest?: {
    category?: string;
    newAmount?: number;
    source?: string; // מאיפה לקחת
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleBudgetManagement(
  context: BudgetFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  switch (context.currentStep) {
    case 'generate':
      return await handleGenerateStep(context, message);
    case 'review':
      return await handleReviewStep(context, message);
    case 'adjust':
      return await handleAdjustStep(context, message);
    case 'confirm':
      return await handleConfirmStep(context, message);
    default:
      return await handleGenerateStep(context, message);
  }
}

// ============================================================================
// שלב 1: יצירת תקציב מומלץ
// ============================================================================

async function handleGenerateStep(
  context: BudgetFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  try {
    // בנה תקציב חכם
    const recommendation = await buildSmartBudget(context.userId);
    context.recommendation = recommendation;
    
    // הצג למשתמש
    const budgetMessage = formatBudgetMessage(recommendation);
    
    return {
      response: budgetMessage,
      completed: false,
      requiresAction: {
        type: 'set_context',
        data: { currentStep: 'review', recommendation },
      },
    };
  } catch (error) {
    console.error('Failed to generate budget:', error);
    return {
      response: `סליחה, משהו השתבש בבניית התקציב 😕\n\nאני צריך עוד נתונים. האם העלית דוחות בנק?`,
      completed: false,
    };
  }
}

// ============================================================================
// שלב 2: סקירה ואישור
// ============================================================================

async function handleReviewStep(
  context: BudgetFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const lowerMessage = message.toLowerCase();
  
  // אם מסכים
  if (isApproval(message)) {
    if (!context.recommendation) {
      return await handleGenerateStep(context, message);
    }
    
    // שמור ל-DB
    const success = await saveBudgetToDatabase(context.userId, context.recommendation);
    
    if (success) {
      return {
        response: `מושלם! 🎉\n\nהתקציב החדש שלך פעיל מהיום.\n\nאני אעקוב ואשלח לך עדכונים:\n• סיכום שבועי (יום ראשון)\n• התראות על חריגות\n• טיפים לחיסכון\n\nבהצלחה! 💪`,
        completed: true,
        requiresAction: {
          type: 'budget_created',
          data: context.recommendation,
        },
      };
    } else {
      return {
        response: `סליחה, משהו השתבש בשמירה 😕\nתוכל לנסות שוב?`,
        completed: false,
      };
    }
  }
  
  // אם רוצה לשנות
  if (lowerMessage.includes('לשנות') || lowerMessage.includes('שינוי') || 
      lowerMessage.includes('רוצה יותר') || lowerMessage.includes('רוצה פחות')) {
    return {
      response: `בסדר! מה תרצה לשנות?\n\nתוכל לכתוב לדוגמה:\n• "יותר על בילויים"\n• "פחות על מסעדות"\n• "להגדיל חיסכון"`,
      completed: false,
      requiresAction: {
        type: 'set_context',
        data: { currentStep: 'adjust' },
      },
    };
  }
  
  // אם רוצה לראות פירוט
  if (lowerMessage.includes('פירוט') || lowerMessage.includes('עוד') || lowerMessage.includes('הסבר')) {
    return {
      response: formatDetailedBudget(context.recommendation!),
      completed: false,
    };
  }
  
  // ברירת מחדל
  return {
    response: `מה אתה אומר?\n\n• "מסכים" - לאשר את התקציב\n• "לשנות" - לעשות שינויים\n• "פירוט" - לראות הסבר מפורט`,
    completed: false,
  };
}

// ============================================================================
// שלב 3: התאמות
// ============================================================================

async function handleAdjustStep(
  context: BudgetFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  const lowerMessage = message.toLowerCase();
  
  if (!context.recommendation) {
    return await handleGenerateStep(context, message);
  }
  
  // זהה מה המשתמש רוצה לשנות
  const adjustment = parseAdjustmentRequest(message, context.recommendation);
  
  if (!adjustment.category) {
    return {
      response: `לא הבנתי איזו קטגוריה...\n\nהקטגוריות שלך:\n${context.recommendation.categories.map(c => `• ${c.name}`).join('\n')}\n\nמה תרצה לשנות?`,
      completed: false,
    };
  }
  
  // אם יש סכום - שאל מאיפה לקחת
  if (adjustment.amount && adjustment.amount > 0) {
    const difference = adjustment.amount - (adjustment.currentAmount || 0);
    
    if (difference > 0) {
      // צריך להוסיף - שאל מאיפה
      const otherCategories = context.recommendation.categories
        .filter(c => c.name !== adjustment.category)
        .slice(0, 4);
      
      return {
        response: `אוקיי, להעלות ${adjustment.category} ל-${formatCurrency(adjustment.amount)}.\n\nזה ${formatCurrency(difference)} יותר.\n\nמאיפה לקחת?\n${otherCategories.map(c => `• ${c.name} (${formatCurrency(c.recommended)})`).join('\n')}\n• חיסכון (${formatCurrency(context.recommendation.savings.amount)})`,
        completed: false,
        requiresAction: {
          type: 'set_context',
          data: { 
            currentStep: 'confirm',
            adjustmentRequest: {
              category: adjustment.category,
              newAmount: adjustment.amount,
            }
          },
        },
      };
    } else {
      // מפחית - שאל לאן להעביר
      return {
        response: `אוקיי, להוריד ${adjustment.category} ל-${formatCurrency(adjustment.amount)}.\n\nזה ${formatCurrency(Math.abs(difference))} פחות.\n\nלאן להעביר?\n• חיסכון\n• לחלק בין שאר הקטגוריות`,
        completed: false,
        requiresAction: {
          type: 'set_context',
          data: { 
            currentStep: 'confirm',
            adjustmentRequest: {
              category: adjustment.category,
              newAmount: adjustment.amount,
            }
          },
        },
      };
    }
  }
  
  // אם אין סכום - שאל כמה
  return {
    response: `כמה תרצה ל-${adjustment.category}?\n\n(כרגע: ${formatCurrency(adjustment.currentAmount || 0)})`,
    completed: false,
    requiresAction: {
      type: 'set_context',
      data: { adjustmentRequest: { category: adjustment.category } },
    },
  };
}

// ============================================================================
// שלב 4: אישור שינויים
// ============================================================================

async function handleConfirmStep(
  context: BudgetFlowContext,
  message: string
): Promise<{ response: string; completed: boolean; requiresAction?: any }> {
  if (!context.recommendation || !context.adjustmentRequest) {
    return await handleGenerateStep(context, message);
  }
  
  const adjustment = context.adjustmentRequest;
  const lowerMessage = message.toLowerCase();
  
  // זהה מאיפה לקחת
  const source = parseSourceCategory(message, context.recommendation);
  
  if (!source) {
    return {
      response: `לא הבנתי מאיפה לקחת...\n\nתוכל לכתוב את שם הקטגוריה?`,
      completed: false,
    };
  }
  
  // בצע את השינוי
  const adjustedRecommendation = applyAdjustment(
    context.recommendation,
    adjustment.category!,
    adjustment.newAmount!,
    source
  );
  
  context.recommendation = adjustedRecommendation;
  
  // הצג תוצאה
  const categoryInfo = adjustedRecommendation.categories.find(c => c.name === adjustment.category);
  const sourceInfo = source === 'חיסכון' ? 
    adjustedRecommendation.savings : 
    adjustedRecommendation.categories.find(c => c.name === source);
  
  let resultMessage = `עדכנתי! ✅\n\n`;
  resultMessage += `${adjustment.category}: ${formatCurrency(adjustment.newAmount!)}\n`;
  
  if (source === 'חיסכון') {
    resultMessage += `חיסכון: ${formatCurrency(adjustedRecommendation.savings.amount)}\n`;
  } else {
    const sourceCat = adjustedRecommendation.categories.find(c => c.name === source);
    resultMessage += `${source}: ${formatCurrency(sourceCat?.recommended || 0)}\n`;
  }
  
  resultMessage += `\nמתאים? או רוצה לשנות עוד משהו?`;
  
  return {
    response: resultMessage,
    completed: false,
    requiresAction: {
      type: 'set_context',
      data: { currentStep: 'review', adjustmentRequest: undefined },
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function isApproval(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('מסכים') || lower.includes('אוקיי') || lower.includes('כן') || 
         lower.includes('מאשר') || lower.includes('בסדר') || lower.includes('מתאים');
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL')}`;
}

function formatDetailedBudget(recommendation: BudgetRecommendation): string {
  let message = `📊 **פירוט מלא:**\n\n`;
  
  message += `💰 **הכנסה:** ${formatCurrency(recommendation.totalIncome)}\n`;
  message += `🏠 **הוצאות קבועות:** ${formatCurrency(recommendation.totalFixed)}\n`;
  message += `💵 **זמין לחלוקה:** ${formatCurrency(recommendation.availableForVariable)}\n\n`;
  
  message += `📋 **קטגוריות:**\n\n`;
  
  for (const cat of recommendation.categories) {
    const changeStr = cat.changePercent !== 0 ? 
      ` (${cat.changePercent > 0 ? '+' : ''}${cat.changePercent}%)` : '';
    message += `**${cat.name}:** ${formatCurrency(cat.recommended)}${changeStr}\n`;
    message += `   ${cat.reasoning}\n\n`;
  }
  
  message += `💰 **חיסכון:** ${formatCurrency(recommendation.savings.amount)} (${recommendation.savings.percentage}%)\n`;
  message += `   ${recommendation.savings.reasoning}\n\n`;
  
  if (recommendation.savingsOpportunities.length > 0) {
    message += `💡 **הזדמנויות לחיסכון:**\n`;
    for (const opp of recommendation.savingsOpportunities) {
      message += `• ${opp.category}: אפשר לחסוך ${formatCurrency(opp.savings)}\n`;
      for (const tip of opp.tips) {
        message += `  - ${tip}\n`;
      }
    }
  }
  
  message += `\nמסכים?`;
  
  return message;
}

interface AdjustmentParsed {
  category?: string;
  amount?: number;
  currentAmount?: number;
  direction?: 'increase' | 'decrease';
}

function parseAdjustmentRequest(
  message: string, 
  recommendation: BudgetRecommendation
): AdjustmentParsed {
  const lower = message.toLowerCase();
  const result: AdjustmentParsed = {};
  
  // חפש קטגוריה
  for (const cat of recommendation.categories) {
    if (lower.includes(cat.name.toLowerCase())) {
      result.category = cat.name;
      result.currentAmount = cat.recommended;
      break;
    }
  }
  
  // חפש מילות מפתח
  if (lower.includes('חיסכון')) {
    result.category = 'חיסכון';
    result.currentAmount = recommendation.savings.amount;
  }
  
  // חפש כיוון
  if (lower.includes('יותר') || lower.includes('להגדיל') || lower.includes('להעלות')) {
    result.direction = 'increase';
  } else if (lower.includes('פחות') || lower.includes('להקטין') || lower.includes('להוריד')) {
    result.direction = 'decrease';
  }
  
  // חפש סכום
  const amountMatch = message.replace(/,/g, '').match(/\d+/);
  if (amountMatch) {
    result.amount = parseInt(amountMatch[0]);
  }
  
  return result;
}

function parseSourceCategory(
  message: string,
  recommendation: BudgetRecommendation
): string | null {
  const lower = message.toLowerCase();
  
  if (lower.includes('חיסכון')) {
    return 'חיסכון';
  }
  
  for (const cat of recommendation.categories) {
    if (lower.includes(cat.name.toLowerCase())) {
      return cat.name;
    }
  }
  
  return null;
}

function applyAdjustment(
  recommendation: BudgetRecommendation,
  targetCategory: string,
  newAmount: number,
  sourceCategory: string
): BudgetRecommendation {
  const updated = { ...recommendation };
  updated.categories = [...recommendation.categories];
  updated.savings = { ...recommendation.savings };
  
  // מצא את הקטגוריה המטרה
  const targetIndex = updated.categories.findIndex(c => c.name === targetCategory);
  if (targetIndex === -1 && targetCategory !== 'חיסכון') return recommendation;
  
  // חשב הפרש
  let difference: number;
  if (targetCategory === 'חיסכון') {
    difference = newAmount - updated.savings.amount;
    updated.savings.amount = newAmount;
    updated.savings.percentage = Math.round(newAmount / updated.totalIncome * 100);
  } else {
    difference = newAmount - updated.categories[targetIndex].recommended;
    updated.categories[targetIndex] = {
      ...updated.categories[targetIndex],
      recommended: newAmount,
      changePercent: updated.categories[targetIndex].current > 0 ?
        Math.round(((newAmount - updated.categories[targetIndex].current) / updated.categories[targetIndex].current) * 100) :
        0,
    };
  }
  
  // קח מהמקור
  if (sourceCategory === 'חיסכון') {
    updated.savings.amount -= difference;
    updated.savings.percentage = Math.round(updated.savings.amount / updated.totalIncome * 100);
  } else {
    const sourceIndex = updated.categories.findIndex(c => c.name === sourceCategory);
    if (sourceIndex !== -1) {
      updated.categories[sourceIndex] = {
        ...updated.categories[sourceIndex],
        recommended: updated.categories[sourceIndex].recommended - difference,
      };
    }
  }
  
  return updated;
}

// ============================================================================
// Legacy exports for orchestrator compatibility
// ============================================================================

export default {
  handleBudgetManagement,
};
