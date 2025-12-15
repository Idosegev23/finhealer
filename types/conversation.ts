// Types for conversation management

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface UserContext {
  userId: string;
  userName: string;
  phoneNumber: string;
  monthlyIncome?: number;
  familySize?: number;
  currentGoals?: string[];
  recentTransactions?: any[];
  activeCategories?: string[];
  phiScore?: number;
  conversationState?: ConversationState;
}

export type ConversationState = 
  | "idle"
  | "onboarding_personal"
  | "onboarding_income"
  | "onboarding_expenses"
  | "document_processing"
  | "transaction_classification"
  | "classification_questions"  // 🆕 שאלות סיווג אינטראקטיביות
  | "classification_pending_approval"  // 🆕 מחכה לאישור לפני סיווג
  | "active_monitoring"
  | "data_collection"      // שלב 1: איסוף מסמכים
  | "data_collection_pending_approval"  // ממתין לאישור תנועות
  | "behavior_analysis"    // שלב 2: ניתוח דפוסים
  | "budget_planning"      // שלב 3: בניית תקציב
  | "goals_setting"        // שלב 4: הגדרת יעדים
  | "loan_consolidation"   // שלב 5: איחוד הלוואות
  | "paused";

export interface OngoingTask {
  taskType: "classify_transactions" | "upload_document" | "set_goal" | "review_budget" | "classification_questions" | "transaction_approval";
  totalItems: number;
  completedItems: number;
  data: any;
}

export interface ConversationContext {
  userId: string;
  currentState: ConversationState;
  ongoingTask?: OngoingTask;
  taskProgress?: number;
  lastInteraction: Date;
  userMood?: "engaged" | "tired" | "busy";
  pendingQuestions: Question[];
  waitingForDocument?: DocumentType;
  previousResponseId?: string;
  metadata?: Record<string, unknown>;  // 🆕 שדה גמיש לנתונים נוספים
}

export interface Question {
  id: string;
  text: string;
  expectedAnswer: "amount" | "category" | "yes_no" | "free_text" | "date";
  context?: any;
}

export type DocumentType = "bank_statement" | "credit_card" | "receipt" | "salary_slip" | "insurance_policy";

export interface Intent {
  type: IntentType;
  confidence: number;
  entities: Entity[];
}

export type IntentType =
  | "expense_log"
  | "income_log"
  | "question_balance"
  | "question_spending"
  | "question_goal"
  | "approval"
  | "correction"
  | "skip"
  | "postpone"
  | "greeting"
  | "help"
  | "upload_document"
  | "budget_request"      // 🆕 בקשת תקציב / הגדרת תקציב
  | "goal_request"        // 🆕 בקשת יעד / הגדרת יעד חיסכון
  | "loan_consolidation"  // 🆕 שאלה/בקשה לאיחוד הלוואות
  | "unknown";

export interface Entity {
  type: EntityType;
  value: any;
  confidence: number;
  rawText: string;
}

export type EntityType =
  | "amount"
  | "date"
  | "category"
  | "merchant"
  | "description"
  | "time"
  | "location";

export interface UserMoodSignals {
  responseLength: number;
  responseTime: number;
  tone: "positive" | "neutral" | "negative" | "frustrated";
  keywords: string[];
}

