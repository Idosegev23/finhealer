import { ConversationState, ConversationContext } from "@/types/conversation";

/**
 * State Machine for conversation flow management
 */

export type StateTransition = {
  from: ConversationState;
  to: ConversationState;
  condition?: (context: ConversationContext) => boolean;
  action?: (context: ConversationContext) => Promise<void>;
};

export const VALID_TRANSITIONS: StateTransition[] = [
  // From idle
  { from: "idle", to: "onboarding_personal" },
  { from: "idle", to: "document_processing" },
  { from: "idle", to: "active_monitoring" },
  { from: "idle", to: "data_collection" },

  // From onboarding_personal (שלב 1: איסוף מסמכים)
  { from: "onboarding_personal", to: "data_collection" },
  { from: "onboarding_personal", to: "onboarding_income" },
  { from: "onboarding_personal", to: "paused" },

  // From data_collection (שלב 1: איסוף מסמכים)
  { from: "data_collection", to: "behavior_analysis" },
  { from: "data_collection", to: "active_monitoring" },
  { from: "data_collection", to: "paused" },

  // From behavior_analysis (שלב 2: ניתוח דפוסים)
  { from: "behavior_analysis", to: "budget_planning" },
  { from: "behavior_analysis", to: "active_monitoring" },
  { from: "behavior_analysis", to: "paused" },

  // From budget_planning (שלב 3: בניית תקציב)
  { from: "budget_planning", to: "goals_setting" },
  { from: "budget_planning", to: "active_monitoring" },
  { from: "budget_planning", to: "paused" },

  // From goals_setting (שלב 4: יעדים)
  { from: "goals_setting", to: "loan_consolidation" },
  { from: "goals_setting", to: "active_monitoring" },
  { from: "goals_setting", to: "paused" },

  // From loan_consolidation (שלב 5: איחוד הלוואות)
  { from: "loan_consolidation", to: "active_monitoring" },
  { from: "loan_consolidation", to: "paused" },

  // From onboarding_income (legacy)
  { from: "onboarding_income", to: "onboarding_expenses" },
  { from: "onboarding_income", to: "data_collection" },
  { from: "onboarding_income", to: "paused" },

  // From onboarding_expenses (legacy)
  { from: "onboarding_expenses", to: "active_monitoring" },
  { from: "onboarding_expenses", to: "data_collection" },
  { from: "onboarding_expenses", to: "paused" },

  // From document_processing
  { from: "document_processing", to: "transaction_classification" },
  { from: "document_processing", to: "behavior_analysis" },
  { from: "document_processing", to: "active_monitoring" },
  { from: "document_processing", to: "paused" },

  // From transaction_classification
  { from: "transaction_classification", to: "behavior_analysis" },
  { from: "transaction_classification", to: "active_monitoring" },
  { from: "transaction_classification", to: "paused" },

  // From active_monitoring (שלב 6: בקרה - יכול לעבור לכל שלב)
  { from: "active_monitoring", to: "document_processing" },
  { from: "active_monitoring", to: "transaction_classification" },
  { from: "active_monitoring", to: "data_collection" },
  { from: "active_monitoring", to: "behavior_analysis" },
  { from: "active_monitoring", to: "budget_planning" },
  { from: "active_monitoring", to: "goals_setting" },
  { from: "active_monitoring", to: "loan_consolidation" },
  { from: "active_monitoring", to: "paused" },

  // From paused (can resume to any state)
  { from: "paused", to: "onboarding_personal" },
  { from: "paused", to: "onboarding_income" },
  { from: "paused", to: "onboarding_expenses" },
  { from: "paused", to: "document_processing" },
  { from: "paused", to: "transaction_classification" },
  { from: "paused", to: "data_collection" },
  { from: "paused", to: "behavior_analysis" },
  { from: "paused", to: "budget_planning" },
  { from: "paused", to: "goals_setting" },
  { from: "paused", to: "loan_consolidation" },
  { from: "paused", to: "active_monitoring" },
];

/**
 * State Machine class for managing conversation states
 */
export class ConversationStateMachine {
  private currentState: ConversationState;
  private context: ConversationContext;

  constructor(context: ConversationContext) {
    this.currentState = context.currentState;
    this.context = context;
  }

  /**
   * Check if transition is valid
   */
  canTransition(to: ConversationState): boolean {
    return VALID_TRANSITIONS.some(
      (transition) =>
        transition.from === this.currentState &&
        transition.to === to &&
        (!transition.condition || transition.condition(this.context))
    );
  }

  /**
   * Transition to new state
   */
  async transition(to: ConversationState): Promise<boolean> {
    if (!this.canTransition(to)) {
      console.warn(
        `Invalid transition from ${this.currentState} to ${to}`
      );
      return false;
    }

    const transition = VALID_TRANSITIONS.find(
      (t) => t.from === this.currentState && t.to === to
    );

    // Execute action if defined
    if (transition?.action) {
      await transition.action(this.context);
    }

    // Update state
    const previousState = this.currentState;
    this.currentState = to;
    this.context.currentState = to;

    console.log(
      `State transition: ${previousState} → ${to}`
    );

    return true;
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.currentState;
  }

  /**
   * Get context
   */
  getContext(): ConversationContext {
    return this.context;
  }

  /**
   * Update context
   */
  updateContext(updates: Partial<ConversationContext>): void {
    this.context = { ...this.context, ...updates };
  }
}

/**
 * Get welcome message for each state
 */
export function getStateWelcomeMessage(state: ConversationState): string {
  switch (state) {
    case "idle":
      return "היי! אני φ (פאי) - המאמן הפיננסי שלך 👋\nמה תרצה לעשות היום?";

    case "onboarding_personal":
      return "בוא נכיר! אני צריך כמה פרטים בסיסיים עליך כדי לעזור לך טוב יותר 😊";

    case "onboarding_income":
      return "מעולה! עכשיו בוא נדבר על ההכנסות שלך 💰";

    case "onboarding_expenses":
      return "כמעט סיימנו! בוא נבין את דפוסי ההוצאות שלך 🛒";

    case "data_collection":
      return "📄 **שלב 1: שיקוף**\nבוא נאסוף את הדוחות הפיננסיים שלך כדי לקבל תמונה אמיתית של המצב.";

    case "behavior_analysis":
      return "🔍 **שלב 2: שינוי הרגלים**\nאני מנתח את דפוסי ההוצאות שלך ומזהה איפה אפשר לשפר.";

    case "budget_planning":
      return "📊 **שלב 3: תכנון תקציב**\nבהתבסס על הנתונים שאספנו, אני בונה לך תקציב מותאם אישית.";

    case "goals_setting":
      return "🎯 **שלב 4: יעדים ומטרות**\nבוא נגדיר יעדי חיסכון ומטרות פיננסיות.";

    case "loan_consolidation":
      return "💳 **שלב 5: איחוד הלוואות**\nבוא נבדוק אם אפשר לחסוך על ההלוואות שלך.";

    case "document_processing":
      return "אוקיי, אני עובר על המסמך. רגע אחד... 📄";

    case "transaction_classification":
      return "יש לי כמה שאלות על התנועות. בא לך לעזור לי לסדר את זה? 🤔";

    case "active_monitoring":
      return "🎯 **שלב 6: בקרה**\nאני כאן למעקב שוטף! מה צריך? 😊\nאפשר לשאול שאלות, לרשום הוצאות, או להעלות מסמכים.";

    case "paused":
      return "בסדר, אני כאן כשתהיה מוכן! 😴";

    default:
      return "היי! מה נשמע? 👋";
  }
}

/**
 * Determine next state based on context (6 שלבי תוכנית ההבראה)
 */
export function determineNextState(
  currentState: ConversationState,
  context: ConversationContext
): ConversationState {
  switch (currentState) {
    case "idle":
      // If user is new, start onboarding
      if (!context.userId) {
        return "onboarding_personal";
      }
      return "active_monitoring";

    case "onboarding_personal":
      // After personal info, go to data collection (שלב 1)
      return "data_collection";

    case "data_collection":
      // After data collection, go to behavior analysis (שלב 2)
      return "behavior_analysis";

    case "behavior_analysis":
      // After behavior analysis, go to budget planning (שלב 3)
      return "budget_planning";

    case "budget_planning":
      // After budget, go to goals (שלב 4)
      return "goals_setting";

    case "goals_setting":
      // After goals, go to loan consolidation (שלב 5)
      return "loan_consolidation";

    case "loan_consolidation":
      // After loans, go to active monitoring (שלב 6: בקרה)
      return "active_monitoring";

    // Legacy states
    case "onboarding_income":
      return "data_collection";

    case "onboarding_expenses":
      return "data_collection";

    case "document_processing":
      // If document has transactions to classify
      if (context.ongoingTask?.taskType === "classify_transactions") {
        return "transaction_classification";
      }
      return "behavior_analysis";

    case "transaction_classification":
      // After classification, go to behavior analysis
      return "behavior_analysis";

    case "active_monitoring":
      // Stay in active monitoring (שלב 6: בקרה)
      return "active_monitoring";

    case "paused":
      // Resume to previous state or active monitoring
      return "active_monitoring";

    default:
      return "active_monitoring";
  }
}

/**
 * Check if state requires immediate action
 */
export function stateRequiresAction(state: ConversationState): boolean {
  return [
    "onboarding_personal",
    "onboarding_income",
    "onboarding_expenses",
    "data_collection",
    "behavior_analysis",
    "budget_planning",
    "goals_setting",
    "loan_consolidation",
    "transaction_classification",
  ].includes(state);
}

/**
 * Get state priority (for handling multiple pending states)
 * מבוסס על 6 שלבי תוכנית ההבראה
 */
export function getStatePriority(state: ConversationState): number {
  const priorities: Record<ConversationState, number> = {
    paused: 0,
    idle: 1,
    active_monitoring: 5,         // שלב 6: בקרה
    loan_consolidation: 6,        // שלב 5
    goals_setting: 7,             // שלב 4
    budget_planning: 8,           // שלב 3
    behavior_analysis: 9,         // שלב 2
    data_collection: 10,          // שלב 1
    data_collection_pending_approval: 10,  // חלק משלב 1
    transaction_classification: 11,
    classification_questions: 11, // 🆕 סיווג אינטראקטיבי
    classification_pending_approval: 11, // 🆕 מחכה לאישור לפני סיווג
    document_processing: 12,
    onboarding_personal: 13,      // חובה קודם
    onboarding_income: 14,        // legacy
    onboarding_expenses: 15,      // legacy
  };

  return priorities[state] || 0;
}

export default ConversationStateMachine;

