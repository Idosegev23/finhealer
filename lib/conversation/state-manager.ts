/**
 * State Manager - Hybrid State Machine
 * 
 * עקרון מפתח:
 * - Onboarding = קשיח (State Machine מחליט על הפעולה, AI רק מנסח)
 * - אחרי Onboarding = גמיש (AI מחליט הכל)
 * 
 * זה פותר את הבעיה של AI שקופץ בין נושאים או שוכח את הקונטקסט
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export type OnboardingState = 
  | 'start'              // התחלה - שולחים הודעת פתיחה
  | 'waiting_for_name'   // מחכים שיאמר את השם
  | 'name_received'      // קיבלנו שם - נדריך לשלב הבא
  | 'waiting_for_document' // מחכים למסמך ראשון
  | 'document_received'  // קיבלנו מסמך - מתחילים סיווג
  | 'classification';    // סיווג תנועות

export type FlexiblePhase =
  | 'behavior'           // ניתוח דפוסים
  | 'budget'             // בניית תקציב
  | 'goals'              // הגדרת יעדים
  | 'monitoring';        // מעקב שוטף

export type ConversationPhase = OnboardingState | FlexiblePhase;

export interface StateContext {
  userId: string;
  currentState: ConversationPhase;
  userName?: string;
  hasDocuments: boolean;
  hasPendingTransactions: boolean;
  pendingTransactionCount: number;
  lastMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface StateTransitionResult {
  newState: ConversationPhase;
  action: StateAction;
  aiPrompt?: string;  // Prompt מיוחד ל-AI עבור state זה
}

export type StateAction = 
  | { type: 'send_message'; message: string }
  | { type: 'save_name'; name: string }
  | { type: 'request_document' }
  | { type: 'start_classification' }
  | { type: 'ai_decide' }  // AI מחליט הכל
  | { type: 'none' };

// ============================================================================
// State Definitions - הגדרות קשיחות לכל state
// ============================================================================

interface StateDefinition {
  // מה לעשות כשנכנסים ל-state הזה (אופציונלי)
  onEnter?: (ctx: StateContext) => StateAction;
  
  // מה לעשות כשמקבלים הודעה
  onMessage: (ctx: StateContext, message: string) => StateTransitionResult;
  
  // מה לעשות כשמקבלים מסמך
  onDocument?: (ctx: StateContext) => StateTransitionResult;
  
  // האם זה state קשיח או גמיש
  isRigid: boolean;
  
  // Prompt ל-AI עבור ניסוח הודעות
  aiPrompt?: string;
}

// ============================================================================
// State Machine Definitions
// ============================================================================

const STATE_DEFINITIONS: Record<OnboardingState | 'flexible', StateDefinition> = {
  
  // ============================================================================
  // START - משתמש נרשם, שולחים הודעת פתיחה
  // ============================================================================
  'start': {
    isRigid: true,
    onEnter: () => ({
      type: 'send_message',
      message: getWelcomeMessage(),
    }),
    onMessage: (ctx, message) => ({
      newState: 'waiting_for_name',
      action: { type: 'none' },
    }),
  },
  
  // ============================================================================
  // WAITING_FOR_NAME - מחכים שיאמר את השם
  // ============================================================================
  'waiting_for_name': {
    isRigid: true,
    aiPrompt: `המשתמש אמור לתת את שמו. אם הוא שואל שאלה במקום - ענה וחזור לבקש שם בסוף.`,
    
    onMessage: (ctx, message) => {
      // בדוק אם זה שם
      const extractedName = extractName(message);
      
      if (extractedName) {
        return {
          newState: 'name_received',
          action: { type: 'save_name', name: extractedName },
        };
      }
      
      // זו לא הודעת שם - בקש שוב
      return {
        newState: 'waiting_for_name',
        action: { type: 'ai_decide' },  // AI יענה על שאלה ויבקש שם
        aiPrompt: `המשתמש כתב: "${message}"
זה לא נראה כמו שם. ענה על מה שהוא אמר בקצרה, ובסוף בקש את שמו.`,
      };
    },
  },
  
  // ============================================================================
  // NAME_RECEIVED - קיבלנו שם! נדריך לשלב הבא
  // ============================================================================
  'name_received': {
    isRigid: true,
    
    onEnter: (ctx) => ({
      type: 'send_message',
      message: getNameReceivedMessage(ctx.userName || 'חבר'),
    }),
    
    onMessage: (ctx, message) => {
      // אחרי שקיבלנו שם, אנחנו מחכים למסמך
      return {
        newState: 'waiting_for_document',
        action: { type: 'ai_decide' },
        aiPrompt: `המשתמש ${ctx.userName} כתב: "${message}"
אנחנו בשלב של המתנה למסמך. אם הוא שאל משהו - ענה. אם הוא אומר שהוא שולח - עודד אותו.
בסוף, הזכר לו לשלוח דוח עו״ש.`,
      };
    },
    
    onDocument: (ctx) => ({
      newState: 'document_received',
      action: { type: 'none' },
    }),
  },
  
  // ============================================================================
  // WAITING_FOR_DOCUMENT - מחכים למסמך ראשון
  // ============================================================================
  'waiting_for_document': {
    isRigid: true,
    aiPrompt: `אנחנו מחכים שהמשתמש ישלח מסמך. אם הוא כותב משהו - ענה בקצרה והזכר שאתה מחכה לדוח בנק.`,
    
    onMessage: (ctx, message) => {
      // כל הודעת טקסט בזמן המתנה למסמך
      return {
        newState: 'waiting_for_document',
        action: { type: 'ai_decide' },
        aiPrompt: `המשתמש ${ctx.userName || 'חבר'} כתב: "${message}"
אנחנו מחכים למסמך ראשון שלו. ענה על מה שהוא אמר בקצרה והזכר לו לשלוח דוח עו״ש.`,
      };
    },
    
    onDocument: (ctx) => ({
      newState: 'document_received',
      action: { type: 'none' },
    }),
  },
  
  // ============================================================================
  // DOCUMENT_RECEIVED - קיבלנו מסמך! מתחילים לעבד
  // ============================================================================
  'document_received': {
    isRigid: true,
    
    onEnter: () => ({
      type: 'send_message',
      message: 'קיבלתי! 📄 מנתח את המסמך... תקבל עדכון עוד רגע.',
    }),
    
    onMessage: (ctx, message) => {
      // אם יש תנועות ממתינות, נעבור לסיווג
      if (ctx.hasPendingTransactions) {
        return {
          newState: 'classification',
          action: { type: 'start_classification' },
        };
      }
      
      // אין תנועות? ממשיכים לחכות
      return {
        newState: 'waiting_for_document',
        action: { type: 'ai_decide' },
        aiPrompt: `המסמך נקלט בהצלחה אבל אין עדיין תנועות. אולי צריך עוד מסמכים.`,
      };
    },
  },
  
  // ============================================================================
  // CLASSIFICATION - סיווג תנועות
  // ============================================================================
  'classification': {
    isRigid: false,  // כאן AI יותר גמיש
    aiPrompt: `אנחנו בשלב סיווג תנועות. עזור למשתמש לסווג את התנועות שלו.`,
    
    onMessage: (ctx, message) => ({
      newState: 'classification',
      action: { type: 'ai_decide' },
    }),
    
    onDocument: (ctx) => ({
      newState: 'document_received',
      action: { type: 'none' },
    }),
  },
  
  // ============================================================================
  // FLEXIBLE - שלבים גמישים (behavior, budget, goals, monitoring)
  // ============================================================================
  'flexible': {
    isRigid: false,
    
    onMessage: (ctx, message) => ({
      newState: ctx.currentState as FlexiblePhase,
      action: { type: 'ai_decide' },
    }),
    
    onDocument: (ctx) => ({
      newState: 'document_received',
      action: { type: 'none' },
    }),
  },
};

// ============================================================================
// Main State Manager Class
// ============================================================================

export class PhiStateManager {
  private ctx: StateContext;
  
  constructor(ctx: StateContext) {
    this.ctx = ctx;
  }
  
  /**
   * עיבוד הודעת טקסט
   */
  processMessage(message: string): StateTransitionResult {
    const definition = this.getStateDefinition();
    return definition.onMessage(this.ctx, message);
  }
  
  /**
   * עיבוד מסמך שנשלח
   */
  processDocument(): StateTransitionResult {
    const definition = this.getStateDefinition();
    
    if (definition.onDocument) {
      return definition.onDocument(this.ctx);
    }
    
    // ברירת מחדל - עבור ל-document_received
    return {
      newState: 'document_received',
      action: { type: 'none' },
    };
  }
  
  /**
   * קבלת פעולה בכניסה ל-state
   */
  getEntryAction(): StateAction | null {
    const definition = this.getStateDefinition();
    
    if (definition.onEnter) {
      return definition.onEnter(this.ctx);
    }
    
    return null;
  }
  
  /**
   * האם ה-state הנוכחי קשיח?
   */
  isRigidState(): boolean {
    const definition = this.getStateDefinition();
    return definition.isRigid;
  }
  
  /**
   * קבלת ה-AI prompt עבור ה-state הנוכחי
   */
  getAIPrompt(): string | undefined {
    const definition = this.getStateDefinition();
    return definition.aiPrompt;
  }
  
  private getStateDefinition(): StateDefinition {
    const state = this.ctx.currentState;
    
    // בדוק אם זה state של onboarding
    if (state in STATE_DEFINITIONS) {
      return STATE_DEFINITIONS[state as OnboardingState];
    }
    
    // אחרת - השתמש ב-flexible
    return STATE_DEFINITIONS['flexible'];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * חילוץ שם מהודעה
 */
function extractName(message: string): string | null {
  const trimmed = message.trim();
  
  // דפוסים נפוצים לזיהוי שם
  const patterns = [
    /^(?:אני|שמי|קוראים לי|זה)\s+(.+)$/i,
    /^(.+)\s+(?:השם שלי|אני)$/i,
    /^היי,?\s*(?:אני\s+)?(.+)$/i,
    /^שלום,?\s*(?:אני\s+)?(.+)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return cleanName(match[1]);
    }
  }
  
  // אם זה מילה או שתיים בלבד - כנראה שם
  const words = trimmed.split(/\s+/);
  if (words.length <= 2 && words.every(w => isLikelyName(w))) {
    return cleanName(trimmed);
  }
  
  return null;
}

function isLikelyName(word: string): boolean {
  // מילים שהן לא שמות
  const notNames = [
    'היי', 'שלום', 'מה', 'איך', 'כן', 'לא', 'אוקי', 'בסדר',
    'תודה', 'עזוב', 'רגע', 'שניה', 'בוקר', 'ערב', 'לילה',
  ];
  
  // בדוק שזו לא מילה נפוצה
  if (notNames.includes(word.toLowerCase())) {
    return false;
  }
  
  // בדוק שזה לא מספר
  if (/^\d+$/.test(word)) {
    return false;
  }
  
  // בדוק שהמילה מספיק ארוכה
  if (word.length < 2) {
    return false;
  }
  
  return true;
}

function cleanName(name: string): string {
  // נקה תווים מיותרים
  return name
    .replace(/[.,!?]/g, '')
    .trim();
}

/**
 * הודעת פתיחה - לאחר רישום באתר
 */
function getWelcomeMessage(): string {
  return `היי! 👋

אני *φ* (פי) - המאמן הפיננסי האישי שלך.

*איך זה עובד?*
1️⃣ שולחים לי דוחות בנק ואשראי
2️⃣ אני מנתח את התנועות
3️⃣ ביחד מסווגים אותן
4️⃣ מקבלים תמונה ברורה + תובנות

*למה זה שונה?*
אני מאמן, לא יועץ - מלווה אותך, לא מטיף.
בלי שיפוטיות. בקצב שלך. פרטיות מלאה.

בוא נתחיל! *מה השם שלך?* 😊`;
}

/**
 * הודעה אחרי קבלת שם
 */
function getNameReceivedMessage(name: string): string {
  return `נעים מאוד *${name}*! 😊

מעולה, אז בוא נתחיל.

*הצעד הראשון:*
שלח לי דוח עו״ש מהבנק שלך (PDF) של 3 חודשים אחרונים.

אני אנתח את התנועות ונתחיל לבנות את התמונה הפיננסית שלך 📊

💡 *טיפ:* אפשר להוריד את הדוח מהאפליקציה או מהאתר של הבנק`;
}

// ============================================================================
// Database Integration
// ============================================================================

/**
 * טעינת state מה-DB
 */
export async function loadStateContext(userId: string): Promise<StateContext> {
  const supabase = createServiceClient();
  
  // טען מידע על המשתמש
  const { data: user } = await supabase
    .from('users')
    .select('full_name, current_phase, onboarding_state')
    .eq('id', userId)
    .single();
  
  // טען ספירת מסמכים
  const { count: docCount } = await supabase
    .from('uploaded_documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  
  // טען ספירת תנועות ממתינות
  const { count: pendingCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');
  
  // קביעת ה-state
  let currentState: ConversationPhase = 'start';
  
  if (user?.onboarding_state) {
    // יש state שמור
    currentState = user.onboarding_state as ConversationPhase;
  } else if (user?.full_name) {
    // יש שם - נבדוק מסמכים
    if ((docCount || 0) > 0) {
      if ((pendingCount || 0) > 0) {
        currentState = 'classification';
      } else {
        currentState = 'monitoring';
      }
    } else {
      currentState = 'waiting_for_document';
    }
  } else {
    // אין שם - מחכים לשם
    currentState = 'waiting_for_name';
  }
  
  return {
    userId,
    currentState,
    userName: user?.full_name || undefined,
    hasDocuments: (docCount || 0) > 0,
    hasPendingTransactions: (pendingCount || 0) > 0,
    pendingTransactionCount: pendingCount || 0,
  };
}

/**
 * שמירת state ל-DB
 */
export async function saveStateContext(
  userId: string, 
  state: ConversationPhase
): Promise<void> {
  const supabase = createServiceClient();
  
  await supabase
    .from('users')
    .update({ onboarding_state: state })
    .eq('id', userId);
}

/**
 * שמירת שם המשתמש
 */
export async function saveUserName(userId: string, name: string): Promise<void> {
  const supabase = createServiceClient();
  
  await supabase
    .from('users')
    .update({ 
      full_name: name,
      onboarding_state: 'waiting_for_document',
    })
    .eq('id', userId);
    
  console.log(`[StateManager] ✅ Saved name: ${name}, moving to waiting_for_document`);
}

// ============================================================================
// Export
// ============================================================================

export default PhiStateManager;

