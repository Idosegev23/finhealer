import { chatWithGPT5, chatWithGPT5Fast } from "@/lib/ai/gpt5-client";
import { parseIntent, detectUserMood } from "@/lib/ai/intent-parser";
import { PHI_COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts/phi-coach-system";
import { Message, UserContext, ConversationContext, Intent } from "@/types/conversation";
import { getRecentHistory, getHistoryForOpenAI } from "./history-manager";
import {
  loadContext,
  updateContext,
  getOrCreateContext,
  trackPostponement,
  resetPostponementCounter,
} from "./context-manager";
import ConversationStateMachine, { getStateWelcomeMessage } from "./state-machine";
import { handleExpenseLogging, handleExpenseCorrection } from "./flows/expense-logging-flow";
import { startClassificationSession, getNextClassificationQuestion, handleClassificationAnswer } from "./flows/transaction-classification-flow";
import { shouldAskMoreQuestions, detectFrustration, generateApologyMessage } from "@/lib/whatsapp/engagement-manager";
import { handlePostponement } from "./follow-up-manager";

// Import all flows
import { handleOnboardingFlow, handleOnboardingPersonal, handleOnboardingDocuments } from "./flows/onboarding-flow";
import { handleDataCollectionFlow } from "./flows/data-collection-flow";
import { handleBudgetManagement } from "./flows/budget-management-flow";
import { handleGoalsManagement } from "./flows/goals-management-flow";
import { handleLoanConsolidation } from "./flows/loan-consolidation-flow";
import { isContinueRequest, handleContinueRequest } from "./flows/document-upload-flow";

/**
 * Main Conversation Orchestrator
 * Central system that manages all conversations with users
 * 
 * 6 שלבי תוכנית ההבראה:
 * 1. Reflection + Data Collection - איסוף מסמכים ושאלות על תנועות
 * 2. Behavior - זיהוי דפוסים ושינוי הרגלים
 * 3. Budget - AI בונה תקציב מותאם
 * 4. Goals - הגדרת יעדים פיננסיים
 * 5. Loan Consolidation - איחוד הלוואות
 * 6. Monitoring - מעקב שוטף
 */

export interface ConversationResponse {
  message: string;
  requiresAction?: boolean;
  action?: {
    type: "create_transaction" | "update_budget" | "confirm_expense" | "upload_document" | 
          "set_context" | "goal_created" | "budget_created" | "consolidation_submitted";
    data: any;
  };
  metadata?: {
    intent: string;
    confidence: number;
    stateChanged: boolean;
  };
}

/**
 * Process incoming message and orchestrate response
 */
export async function processMessage(
  userId: string,
  message: string,
  messageType: "text" | "voice" | "image" = "text",
  userContext?: UserContext
): Promise<ConversationResponse> {
  try {
    // 1. Get or create conversation context
    let context = await getOrCreateContext(userId);
    
    // 🔍 DEBUG: Log the loaded context
    console.log('🔍 Orchestrator - Loaded context:', {
      userId,
      currentState: context.currentState,
      metadata: (context as any).metadata,
    });

    // 2. Build user context if not provided
    if (!userContext) {
      userContext = await buildUserContext(userId);
    }

    // 3. Update last interaction
    context.lastInteraction = new Date();

    // 4. Detect user mood
    const mood = detectUserMood(message);
    context.userMood = mood;

    // 5. Check if user is frustrated
    const recentMessages = await getRecentMessages(userId, 5);
    if (detectFrustration(recentMessages.map((m) => m.content))) {
      await updateContext(userId, { userMood: "tired" });
      
      return {
        message: generateApologyMessage(),
        metadata: {
          intent: "frustration_detected",
          confidence: 1.0,
          stateChanged: false,
        },
      };
    }

    // 6. Parse intent
    const intent = await parseIntent(message, context);

    // 7. Check for postponement
    if (intent.type === "postpone") {
      const postponeCount = await trackPostponement(userId);
      
      if (postponeCount >= 3) {
        const { message: postponeMessage } = await handlePostponement(userId, context);
        
        return {
          message: postponeMessage,
          metadata: {
            intent: "postpone",
            confidence: intent.confidence,
            stateChanged: false,
          },
        };
      }
    } else {
      await resetPostponementCounter(userId);
    }

    // 8. Route to appropriate handler based on state and intent
    const response = await routeToHandler(
      intent,
      message,
      context,
      userContext
    );

    // 9. Update context with new state
    await updateContext(userId, {
      lastInteraction: new Date(),
      userMood: mood,
    });

    return response;
  } catch (error) {
    console.error("Orchestrator error:", error);
    
    return {
      message: "סליחה, משהו השתבש 😕\nתוכל לנסות שוב?",
      metadata: {
        intent: "error",
        confidence: 0,
        stateChanged: false,
      },
    };
  }
}

/**
 * Route to appropriate handler based on state and intent
 */
async function routeToHandler(
  intent: Intent,
  message: string,
  context: any,
  userContext: UserContext
): Promise<ConversationResponse> {
  const stateMachine = new ConversationStateMachine(context);
  let currentState = stateMachine.getState();

  // 🔍 DEBUG: Log the routing decision
  console.log('🔍 RouteToHandler:', {
    currentState,
    contextCurrentState: context.currentState,
    intentType: intent.type,
  });

  // 🆕 אם המשתמש ב-state idle אבל צריך onboarding - שנה state אוטומטית
  if (currentState === "idle") {
    // בדוק אם המשתמש צריך onboarding (אין לו full_name ב-users)
    const needsOnboarding = await checkIfUserNeedsOnboarding(userContext.userId);
    if (needsOnboarding) {
      console.log('🔄 User needs onboarding, switching to onboarding_personal');
      currentState = "onboarding_personal";
      // עדכן את ה-context
      await updateContext(userContext.userId, {
        currentState: "onboarding_personal",
      });
    }
  }

  // Handle special intents first (can override state)
  switch (intent.type) {
    case "budget_request":
      return await handleBudgetIntent(userContext, context);
    
    case "goal_request":
      return await handleGoalsIntent(userContext, context);
    
    case "loan_consolidation":
      return await handleLoanIntent(userContext, context);
  }

  // 🆕 בדיקה אם משתמש כתב "נמשיך" - מתחיל סיווג תנועות
  if (isContinueRequest(message)) {
    console.log('🔄 User wrote "נמשיך" - checking if can start classification');
    return await handleContinueToClassification(userContext, context);
  }

  // 🆕 בדיקה אם משתמש רוצה ניתוח דפוסים (אחרי סיום סיווג)
  if (isAnalysisRequest(message)) {
    console.log('🔄 User requested analysis');
    return await handleAnalysisRequest(userContext, context);
  }
  
  // 🆕 בדיקה אם משתמש שואל על סטטוס
  if (isStatusRequest(message)) {
    console.log('🔄 User requested status');
    return await handleStatusRequest(userContext);
  }

  // Handle based on current state
  switch (currentState) {
    case "idle":
      return await handleIdleState(intent, message, userContext, context);

    case "active_monitoring":
      return await handleActiveMonitoring(intent, message, userContext, context);

    case "transaction_classification":
      return await handleClassificationState(intent, message, userContext, context);

    case "classification_questions":
      // 🆕 טיפול בשאלות סיווג מה-document-classification-session
      return await handleDocumentClassificationState(intent, message, userContext, context);

    case "classification_pending_approval":
      // 🆕 מחכים לאישור מהמשתמש לפני שמתחילים לסווג
      return await handleClassificationApproval(intent, message, userContext, context);

    case "behavior_analysis":
      // 🆕 שלב 2 - ניתוח דפוסים
      return await handleBehaviorAnalysisState(intent, message, userContext, context);

    case "onboarding_personal":
      return await handleOnboardingState(intent, message, userContext, context, "personal");

    case "onboarding_income":
    case "onboarding_expenses":
      // After personal info, go to data collection
      return await handleDataCollectionState(intent, message, userContext, context);

    case "document_processing":
      return await handleDocumentProcessing(intent, message, userContext, context);

    case "paused":
      return await handlePausedState(intent, message, userContext, context);

    default:
      return await handleActiveMonitoring(intent, message, userContext, context);
  }
}

/**
 * Handle idle state
 */
async function handleIdleState(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const welcomeMessage = getStateWelcomeMessage("idle");

  return {
    message: `${welcomeMessage}\n\nתוכל:\n💬 לספר לי על הוצאה\n📷 לשלוח קבלה/דוח\n❓ לשאול שאלות\n📊 לראות סיכום`,
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: false,
    },
  };
}

/**
 * Handle active monitoring state (main conversation)
 */
async function handleActiveMonitoring(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  // Check if we should still ask questions
  const { allowed, reason, breakDuration } = await shouldAskMoreQuestions(
    userContext.userId,
    context
  );

  if (!allowed) {
    const breakMessage = `בוא ניקח הפסקה 😊\nאני אזכיר לך בעוד ${Math.round(breakDuration! / 60)} שעות.`;
    
    return {
      message: breakMessage,
      metadata: {
        intent: "break_needed",
        confidence: 1.0,
        stateChanged: false,
      },
    };
  }

  // Handle based on intent
  switch (intent.type) {
    case "expense_log":
      return await handleExpenseIntent(intent, message, userContext, context);

    case "question_spending":
    case "question_balance":
    case "question_goal":
      return await handleQuestionIntent(intent, message, userContext, context);

    case "greeting":
      return {
        message: "היי! מה תרצה לעשות? 😊",
        metadata: {
          intent: intent.type,
          confidence: intent.confidence,
          stateChanged: false,
        },
      };

    case "help":
      return {
        message: `אני פה לעזור! 😊\n\nתוכל:\n💰 לרשום הוצאה ("50 שקל קפה")\n📷 לשלוח קבלה או דוח\n🎯 לבדוק יעדים ("איך היעד שלי?")\n📊 לראות תקציב ("כמה נשאר לי?")\n💡 לקבל תובנות\n\nמה תרצה לעשות?`,
        metadata: {
          intent: intent.type,
          confidence: intent.confidence,
          stateChanged: false,
        },
      };

    default:
      return await handleGeneralConversation(intent, message, userContext, context);
  }
}

/**
 * Handle expense logging intent
 */
async function handleExpenseIntent(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const result = await handleExpenseLogging(message, userContext, context);

  if (result.expenseData && !result.requiresConfirmation) {
    return {
      message: result.response,
      requiresAction: true,
      action: {
        type: "create_transaction",
        data: result.expenseData,
      },
      metadata: {
        intent: intent.type,
        confidence: intent.confidence,
        stateChanged: false,
      },
    };
  }

  return {
    message: result.response,
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: false,
    },
  };
}

/**
 * Handle question intent
 */
async function handleQuestionIntent(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const conversationHistory: Message[] = [
    {
      role: "user",
      content: message,
      timestamp: new Date(),
    },
  ];

  const aiResponse = await chatWithGPT5(
    conversationHistory,
    PHI_COACH_SYSTEM_PROMPT,
    userContext,
    {
      reasoningEffort: "low",
      verbosity: "low",
      maxOutputTokens: 300,
    }
  );

  return {
    message: aiResponse.response,
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: false,
    },
  };
}

/**
 * Handle general conversation with AI
 */
async function handleGeneralConversation(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  // 🆕 טעינת היסטוריית שיחה לקונטקסט
  const history = await getHistoryForOpenAI(userContext.userId, 10);
  
  const response = await chatWithGPT5Fast(
    message,
    PHI_COACH_SYSTEM_PROMPT,
    userContext,
    history
  );

  return {
    message: response,
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: false,
    },
  };
}

/**
 * Handle classification state
 */
async function handleClassificationState(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const session = context.ongoingTask;

  if (!session) {
    return await handleActiveMonitoring(intent, message, userContext, context);
  }

  const result = await handleClassificationAnswer(session as any, message, userContext);

  return {
    message: result.nextQuestion || result.response,
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: result.done || false,
    },
  };
}

/**
 * Handle document classification state (new interactive flow)
 * 🆕 משתמש ב-document-classification-session
 */
async function handleDocumentClassificationState(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const { 
    loadClassificationSession, 
    handleUserResponse, 
    clearClassificationSession,
    handleClassificationComplete 
  } = await import("./flows/document-classification-session");
  
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = createServiceClient();
  
  const session = await loadClassificationSession(userContext.userId);
  
  if (!session) {
    // אין session פעיל - חזור ל-active_monitoring
    return await handleActiveMonitoring(intent, message, userContext, context);
  }
  
  const result = await handleUserResponse(session, message, supabase);
  
  let finalMessage = result.message;
  
  if (result.done) {
    // 🆕 סיימנו - מעבר לשלב 2 (behavior_analysis)!
    const completion = await handleClassificationComplete(userContext.userId, session);
    finalMessage = completion.message;
    
    // ניקוי session
    await clearClassificationSession(userContext.userId);
    
    console.log(`✅ Classification complete! Phi Score: ${completion.phiScore || 'N/A'}`);
  }
  
  return {
    message: finalMessage,
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: result.done,
    },
  };
}

/**
 * 🆕 טיפול באישור להתחלת סיווג
 * המשתמש קיבל הקדמה ועכשיו מאשר או מבקש לדחות
 */
async function handleClassificationApproval(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const { 
    loadClassificationSession, 
    getNextQuestionBatch,
    saveClassificationSession 
  } = await import("./flows/document-classification-session");
  const { chatWithGPT5Fast } = await import("@/lib/ai/gpt5-client");
  
  const lowerMessage = message.toLowerCase().trim();
  
  // בדיקה אם המשתמש מאשר
  const approvalWords = ['כן', 'בטח', 'יאללה', 'מתאים', 'בוא', 'נתחיל', 'ok', 'yes', 'אוקי', 'סבבה', 'בסדר', 'מוכן'];
  const isApproval = approvalWords.some(word => lowerMessage.includes(word));
  
  // בדיקה אם המשתמש רוצה לדחות
  const postponeWords = ['לא', 'אחר כך', 'מאוחר', 'לא עכשיו', 'אח"כ', 'מחר', 'בערב'];
  const isPostpone = postponeWords.some(word => lowerMessage.includes(word));
  
  if (isPostpone) {
    // דחייה - שמור את ה-session ותזמן תזכורת
    await updateContext(userContext.userId, {
      currentState: "idle",
    });
    
    return {
      message: `בסדר, אני כאן כשתהיה מוכן.\n\nפשוט כתוב "נמשיך" ונתחיל.`,
      metadata: {
        intent: "classification_postponed",
        confidence: 1.0,
        stateChanged: true,
      },
    };
  }
  
  if (isApproval) {
    // אישור! נתחיל את הסיווג
    const session = await loadClassificationSession(userContext.userId);
    
    if (!session) {
      return {
        message: `משהו השתבש. נסה לכתוב "נמשיך" שוב.`,
        metadata: {
          intent: "classification_error",
          confidence: 1.0,
          stateChanged: false,
        },
      };
    }
    
    // עדכן state ל-classification_questions
    await updateContext(userContext.userId, {
      currentState: "classification_questions",
    });
    
    // קבל את השאלה הראשונה
    const firstQuestion = await getNextQuestionBatch(session);
    await saveClassificationSession(userContext.userId, session);
    
    // 🆕 הקדמה קצרה מ-AI לפני השאלה הראשונה
    let transitionMessage: string;
    try {
      const aiResponse = await chatWithGPT5Fast(
        `המשתמש אישר להתחיל סיווג תנועות. יש ${session.incomeToClassify.length} הכנסות ו-${session.expensesToClassify.length} הוצאות.`,
        `אתה מאמן פיננסי בשם φ.
המשתמש אישר להתחיל לעבור על התנועות.
צור הודעת מעבר קצרה (משפט אחד או שניים) שאומרת שמתחילים.
אם יש הכנסות - נתחיל איתן קודם ותגיד את זה.
בלי אימוג'ים. קצר וענייני.`,
        { userId: 'system', userName: 'Classification', phoneNumber: '' }
      );
      transitionMessage = aiResponse?.trim() || 'מעולה! נתחיל עם ההכנסות.';
    } catch {
      transitionMessage = session.incomeToClassify.length > 0 
        ? 'מעולה! נתחיל עם ההכנסות.' 
        : 'מעולה! נתחיל עם ההוצאות.';
    }
    
    return {
      message: `${transitionMessage}\n\n${firstQuestion.message}`,
      metadata: {
        intent: "classification_started",
        confidence: 1.0,
        stateChanged: true,
      },
    };
  }
  
  // לא הבנתי - שאל שוב
  return {
    message: `לא הבנתי. מתאים לך עכשיו לעבור על התנועות?\n\n(כתוב "כן" להתחיל או "אחר כך" לדחות)`,
    metadata: {
      intent: "classification_unclear",
      confidence: 0.5,
      stateChanged: false,
    },
  };
}

/**
 * 🆕 טיפול ב-"נמשיך" - הקדמה עם AI ובקשת אישור לפני סיווג
 */
async function handleContinueToClassification(
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const { 
    loadClassificationSession, 
    getNextQuestionBatch, 
    saveClassificationSession 
  } = await import("./flows/document-classification-session");
  const { chatWithGPT5Fast } = await import("@/lib/ai/gpt5-client");
  
  // בדוק אם יש session קיים
  let session = await loadClassificationSession(userContext.userId);
  
  if (session) {
    // יש session קיים - נמשיך איפה שעצרנו
    const nextBatch = await getNextQuestionBatch(session);
    
    if (nextBatch.done) {
      return {
        message: `כבר סיימנו לסווג את כל התנועות!\n\nאפשר להעלות עוד מסמכים או לשאול שאלות.`,
        metadata: {
          intent: "continue_classification",
          confidence: 1.0,
          stateChanged: false,
        },
      };
    }
    
    // עדכן state ל-classification_questions
    await updateContext(userContext.userId, {
      currentState: "classification_questions",
    });
    
    return {
      message: `בוא נמשיך מאיפה שעצרנו.\n\n${nextBatch.message}`,
      metadata: {
        intent: "continue_classification",
        confidence: 1.0,
        stateChanged: true,
      },
    };
  }
  
  // אין session - בדוק אם יש תנועות לסיווג
  const result = await handleContinueRequest(userContext.userId);
  
  if (!result.shouldStartClassification) {
    return {
      message: result.message,
      metadata: {
        intent: "continue_classification",
        confidence: 1.0,
        stateChanged: false,
      },
    };
  }
  
  // יש תנועות - צור session חדש
  const { createClassificationSession } = await import("./flows/document-classification-session");
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = createServiceClient();
  
  // קח תנועות pending
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userContext.userId)
    .eq('status', 'pending')
    .order('date', { ascending: false });
  
  if (!transactions || transactions.length === 0) {
    return {
      message: `אין לי תנועות לסיווג.\n\nשלח לי דוח בנק או דוח אשראי ונתחיל!`,
      metadata: {
        intent: "continue_classification",
        confidence: 1.0,
        stateChanged: false,
      },
    };
  }
  
  // מיין לפי הכנסות והוצאות
  const income = transactions.filter(t => t.amount > 0);
  const expenses = transactions.filter(t => t.amount < 0);
  
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
  
  // המרת התנועות לפורמט TransactionToClassify
  const transactionsToClassify = transactions.map(t => ({
    id: t.id,
    amount: Math.abs(t.amount),
    type: (t.amount > 0 ? 'income' : 'expense') as 'income' | 'expense',
    description: t.vendor || t.notes || t.original_description || 'לא ידוע',
    date: t.date || t.tx_date,
    vendor: t.vendor,
    currentCategory: t.expense_category || null,
    aiSuggestedCategory: t.ai_suggested_category || null,
    confidence: t.confidence_score || null,
  }));
  
  // צור session
  session = await createClassificationSession(
    userContext.userId,
    `manual-${Date.now()}`,
    transactionsToClassify,
    totalIncome,
    totalExpenses,
    [] // no missing docs at this point
  );
  
  if (!session) {
    return {
      message: `משהו השתבש ביצירת הסיווג. נסה שוב או שלח דוח חדש.`,
      metadata: {
        intent: "continue_classification",
        confidence: 1.0,
        stateChanged: false,
      },
    };
  }
  
  // שמור session
  await saveClassificationSession(userContext.userId, session);
  
  // 🆕 עדכן state ל-"ממתין לאישור" - לא ישר לשאלות!
  await updateContext(userContext.userId, {
    currentState: "classification_pending_approval",
  });
  
  // 🆕 הקדמה דינמית מ-AI
  const introMessage = await generateClassificationIntro(
    userContext.userName || 'חבר',
    income.length,
    expenses.length,
    totalIncome,
    totalExpenses
  );
  
  return {
    message: introMessage,
    metadata: {
      intent: "continue_classification",
      confidence: 1.0,
      stateChanged: true,
    },
  };
}

/**
 * 🆕 יצירת הקדמה דינמית לסיווג תנועות
 */
async function generateClassificationIntro(
  userName: string,
  incomeCount: number,
  expenseCount: number,
  totalIncome: number,
  totalExpenses: number
): Promise<string> {
  const { chatWithGPT5Fast } = await import("@/lib/ai/gpt5-client");
  
  try {
    const response = await chatWithGPT5Fast(
      `נתונים:
שם: ${userName}
הכנסות: ${incomeCount} תנועות (${totalIncome.toLocaleString('he-IL')} ₪)
הוצאות: ${expenseCount} תנועות (${totalExpenses.toLocaleString('he-IL')} ₪)
מאזן: ${(totalIncome - totalExpenses).toLocaleString('he-IL')} ₪`,
      `אתה מאמן פיננסי בשם φ. המשתמש העלה דוח בנק והגיע הזמן לעבור על התנועות ביחד.

צור הודעה קצרה (3-5 שורות) שמכילה:
1. פתיחה אישית וחמה (לא גנרית)
2. סיכום קצר של מה יש בדוח (הכנסות/הוצאות/מאזן)
3. הסבר קצר על מה שנעשה - נעבור על התנועות ביחד כדי לסווג אותן
4. בקשת אישור להתחיל - שאל "מתאים לך עכשיו?" או משהו דומה

כללים:
- בלי אימוג'ים מיותרים (מקסימום 1-2)
- טון אישי וחם אבל מקצועי
- השתמש ב-*כוכביות* להדגשות
- סיים בשאלה שמבקשת אישור

החזר רק את ההודעה, בלי הסברים.`,
      { userId: 'system', userName: 'Classification', phoneNumber: '' }
    );
    
    return response?.trim() || getDefaultClassificationIntro(userName, incomeCount, expenseCount, totalIncome, totalExpenses);
  } catch {
    return getDefaultClassificationIntro(userName, incomeCount, expenseCount, totalIncome, totalExpenses);
  }
}

/**
 * הקדמה ברירת מחדל אם AI נכשל
 */
function getDefaultClassificationIntro(
  userName: string,
  incomeCount: number,
  expenseCount: number,
  totalIncome: number,
  totalExpenses: number
): string {
  const balance = totalIncome - totalExpenses;
  const balanceText = balance >= 0 ? `+${balance.toLocaleString('he-IL')}` : balance.toLocaleString('he-IL');
  
  return `${userName}, יש לי תמונה ראשונית!

*${incomeCount + expenseCount}* תנועות:
הכנסות: *${totalIncome.toLocaleString('he-IL')} ₪*
הוצאות: *${totalExpenses.toLocaleString('he-IL')} ₪*
מאזן: *${balanceText} ₪*

עכשיו נעבור ביחד על התנועות כדי לסווג אותן נכון.
אשאל שאלה אחת בכל פעם - פשוט תאשר או תתקן.

מתאים לך עכשיו?`;
}

// ============================================================================
// 🆕 Analysis & Status Handlers
// ============================================================================

/**
 * בדיקה אם משתמש מבקש ניתוח
 */
function isAnalysisRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  const analysisWords = [
    'כן', 'בטח', 'רוצה', 'ניתוח', 'לראות', 'הראה', 'מה יש',
    'דפוסים', 'תראה', 'כן!', 'yes', 'show', 'analysis',
  ];
  return analysisWords.some(word => lowerMessage.includes(word));
}

/**
 * בדיקה אם משתמש שואל על סטטוס
 */
function isStatusRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  const statusWords = [
    'איפה אני', 'מה הסטטוס', 'סטטוס', 'כמה חודשים', 
    'מצב', 'התקדמות', 'איפה עומד', 'status',
  ];
  return statusWords.some(word => lowerMessage.includes(word));
}

/**
 * 🆕 Handler לבקשת ניתוח דפוסים
 */
async function handleAnalysisRequest(
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = createServiceClient();
  
  // קבל נתונים לניתוח
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userContext.userId)
    .eq('status', 'approved')
    .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: false });
  
  if (!transactions || transactions.length < 5) {
    return {
      message: `אין לי מספיק נתונים לניתוח 📊\n\nשלח לי עוד דוחות כדי שאוכל לזהות דפוסים.`,
      metadata: { intent: "analysis_request", confidence: 1.0, stateChanged: false },
    };
  }
  
  // חשב דפוסים בסיסיים
  const expensesByCategory: Record<string, number> = {};
  const incomeBySource: Record<string, number> = {};
  let totalExpenses = 0;
  let totalIncome = 0;
  
  for (const tx of transactions) {
    if (tx.amount < 0) {
      const cat = tx.expense_category || 'אחר';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Math.abs(tx.amount);
      totalExpenses += Math.abs(tx.amount);
    } else {
      const src = tx.expense_category || 'הכנסה';
      incomeBySource[src] = (incomeBySource[src] || 0) + tx.amount;
      totalIncome += tx.amount;
    }
  }
  
  // מיין קטגוריות לפי סכום
  const topCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  // בנה הודעה
  let message = `📊 *ניתוח דפוסי ההוצאות שלך*\n\n`;
  
  message += `💰 *סה"כ הכנסות:* ${totalIncome.toLocaleString('he-IL')} ₪\n`;
  message += `💸 *סה"כ הוצאות:* ${totalExpenses.toLocaleString('he-IL')} ₪\n`;
  message += `📈 *מאזן:* ${(totalIncome - totalExpenses).toLocaleString('he-IL')} ₪\n\n`;
  
  message += `🏆 *הקטגוריות המובילות:*\n`;
  for (let i = 0; i < topCategories.length; i++) {
    const [cat, amount] = topCategories[i];
    const percent = Math.round((amount / totalExpenses) * 100);
    message += `${i + 1}. ${cat}: ${amount.toLocaleString('he-IL')} ₪ (${percent}%)\n`;
  }
  
  // תובנות
  const savingsRate = Math.round(((totalIncome - totalExpenses) / totalIncome) * 100);
  message += `\n💡 *תובנות:*\n`;
  
  if (savingsRate > 20) {
    message += `✅ שיעור חיסכון מצוין! ${savingsRate}% מההכנסה.\n`;
  } else if (savingsRate > 10) {
    message += `👍 שיעור חיסכון סביר: ${savingsRate}%. יש מקום לשיפור.\n`;
  } else if (savingsRate > 0) {
    message += `⚠️ שיעור חיסכון נמוך: ${savingsRate}%. בוא נחשוב איפה אפשר לחסוך.\n`;
  } else {
    message += `🚨 אתה מוציא יותר ממה שנכנס! צריך לפעול.\n`;
  }
  
  // 🆕 הוסף AI tip אישי
  try {
    const { getQuickAITip } = await import('@/lib/analysis/behavior-analyzer');
    const aiTip = await getQuickAITip(userContext.userId);
    if (aiTip) {
      message += `\n✨ *טיפ אישי מ-φ:*\n${aiTip}\n`;
    }
  } catch (error) {
    console.error('Error generating AI tip:', error);
  }
  
  message += `\nרוצה שנבנה תקציב חכם? כתוב *"בוא נבנה תקציב"*`;
  
  return {
    message,
    metadata: {
      intent: "analysis_request",
      confidence: 1.0,
      stateChanged: false,
    },
  };
}

/**
 * 🆕 Handler לשאלת סטטוס
 */
async function handleStatusRequest(
  userContext: UserContext
): Promise<ConversationResponse> {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const { getUserPeriodCoverage } = await import("@/lib/documents/period-tracker");
  const supabase = createServiceClient();
  
  // קבל כיסוי תקופות
  const coverage = await getUserPeriodCoverage(userContext.userId);
  
  // קבל מידע על משתמש
  const { data: user } = await supabase
    .from('users')
    .select('current_phase, phi_score, full_name')
    .eq('id', userContext.userId)
    .single();
  
  // קבל ספירת תנועות
  const { count: totalTx } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userContext.userId);
  
  const { count: approvedTx } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userContext.userId)
    .eq('status', 'approved');
  
  const { count: pendingTx } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userContext.userId)
    .eq('status', 'pending');
  
  // בנה הודעה
  const phaseName = getPhaseDisplayName(user?.current_phase || 'reflection');
  let message = `📊 *הסטטוס שלך*\n\n`;
  
  message += `👤 ${user?.full_name || 'משתמש'}\n`;
  message += `🎯 שלב נוכחי: *${phaseName}*\n`;
  
  if (user?.phi_score) {
    message += `φ ציון: *${user.phi_score}/100*\n`;
  }
  
  message += `\n📅 *כיסוי נתונים:* ${coverage.totalMonths} חודשים\n`;
  if (coverage.hasMinimumCoverage) {
    message += `✅ יש מספיק נתונים (3+ חודשים)\n`;
  } else {
    message += `⚠️ חסרים ${3 - coverage.totalMonths} חודשים להשלמת התמונה\n`;
  }
  
  message += `\n📝 *תנועות:*\n`;
  message += `• סה"כ: ${totalTx || 0}\n`;
  message += `• מסווגות: ${approvedTx || 0}\n`;
  message += `• ממתינות: ${pendingTx || 0}\n`;
  
  // המלצה לשלב הבא
  message += `\n💡 *מה עכשיו?*\n`;
  if (!coverage.hasMinimumCoverage) {
    message += `שלח לי עוד דוחות להשלמת 3 חודשים.`;
  } else if ((pendingTx || 0) > 0) {
    message += `יש ${pendingTx} תנועות ממתינות לסיווג. כתוב "נמשיך" לסיווג.`;
  } else {
    message += `הכל מוכן! כתוב "ניתוח" לראות דפוסים או "תקציב" לבנות תקציב.`;
  }
  
  return {
    message,
    metadata: {
      intent: "status_request",
      confidence: 1.0,
      stateChanged: false,
    },
  };
}

/**
 * 🆕 Handler לשלב behavior_analysis
 */
async function handleBehaviorAnalysisState(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  // אם רוצים ניתוח - תן להם
  if (isAnalysisRequest(message)) {
    return await handleAnalysisRequest(userContext, context);
  }
  
  // ברירת מחדל - הצע אפשרויות
  return {
    message: `🔍 *שלב 2: ניתוח דפוסים*\n\nעכשיו אני יכול לזהות את דפוסי ההוצאות שלך.\n\nמה תרצה לעשות?\n• כתוב *"ניתוח"* - לראות דפוסי הוצאות\n• כתוב *"תקציב"* - לבנות תקציב חכם\n• כתוב *"סטטוס"* - לראות איפה אתה עומד`,
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: false,
    },
  };
}

/**
 * שם תצוגה לשלב
 */
function getPhaseDisplayName(phase: string): string {
  const phases: Record<string, string> = {
    reflection: 'שלב 1: השתקפות (איסוף נתונים)',
    behavior: 'שלב 2: שינוי הרגלים',
    budget: 'שלב 3: בניית תקציב',
    goals: 'שלב 4: יעדים',
    consolidation: 'שלב 5: איחוד הלוואות',
    monitoring: 'שלב 6: מעקב שוטף',
  };
  return phases[phase] || phase;
}

/**
 * Handle onboarding state
 */
async function handleOnboardingState(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any,
  step: "personal" | "documents"
): Promise<ConversationResponse> {
  // 🔧 קריאת collectedData מ-metadata (שם הוא נשמר)
  const existingCollectedData = (context as any).metadata?.collectedData || 
                                (context as any).collectedData || 
                                {};
  
  const onboardingContext = {
    userId: userContext.userId,
    currentStep: step,
    collectedData: { ...existingCollectedData },
  };

  console.log('📝 Onboarding context:', { 
    userId: userContext.userId, 
    step, 
    collectedData: onboardingContext.collectedData 
  });

  try {
    const result = await handleOnboardingFlow(onboardingContext, message);

    console.log('📝 Onboarding result:', { 
      nextStep: result.nextStep, 
      completed: result.completed,
      collectedData: onboardingContext.collectedData 
    });

    // Update context with collected data
    await updateContext(userContext.userId, {
      metadata: { collectedData: onboardingContext.collectedData },
    } as any);

    // If step completed, transition state
    let stateChanged = false;
    if (result.completed) {
      const stateMachine = new ConversationStateMachine(context);
      
      if (result.nextStep === "documents") {
        stateMachine.transition("onboarding_income");
        stateChanged = true;
      } else if (result.nextStep === "active_monitoring") {
        stateMachine.transition("active_monitoring");
        stateChanged = true;
      }

      await updateContext(userContext.userId, {
        currentState: stateMachine.getState(),
      } as any);
    }

    return {
      message: result.response,
      metadata: {
        intent: intent.type,
        confidence: intent.confidence,
        stateChanged,
      },
    };
  } catch (error) {
    console.error("Onboarding error:", error);
    return {
      message: "סליחה, משהו השתבש 😕\nתוכל לכתוב את זה שוב?",
      metadata: {
        intent: intent.type,
        confidence: intent.confidence,
        stateChanged: false,
      },
    };
  }
}

/**
 * Handle data collection state
 */
async function handleDataCollectionState(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const dataContext = {
    userId: userContext.userId,
    currentStep: (context as any).dataCollectionStep || "bank_statement",
    documentsUploaded: (context as any).documentsUploaded || {},
    pendingQuestions: (context.pendingQuestions as any)?.length || 0,
  } as any;

  const result = await handleDataCollectionFlow(dataContext, message);

  await updateContext(userContext.userId, {
    metadata: { dataCollectionStep: result.nextStep },
  } as any);

  return {
    message: result.response,
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: result.completed,
    },
  };
}

/**
 * Handle budget intent
 */
async function handleBudgetIntent(
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const budgetContext = {
    userId: userContext.userId,
    currentStep: context.budgetStep || "generate" as any,
    recommendation: context.budgetRecommendation,
  };

  const result = await handleBudgetManagement(budgetContext, "");

  if (result.requiresAction?.type === "set_context") {
    await updateContext(userContext.userId, {
      budgetStep: result.requiresAction.data.currentStep,
      budgetRecommendation: result.requiresAction.data.recommendation,
    } as any);
  }

  return {
    message: result.response,
    requiresAction: result.requiresAction?.type === "budget_created",
    action: result.requiresAction?.type === "budget_created" ? {
      type: "budget_created",
      data: result.requiresAction.data,
    } : undefined,
    metadata: {
      intent: "budget_request",
      confidence: 1.0,
      stateChanged: result.completed,
    },
  };
}

/**
 * Handle goals intent
 */
async function handleGoalsIntent(
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const goalsContext = {
    userId: userContext.userId,
    currentStep: context.goalsStep || "start" as any,
    goalData: context.goalData,
    existingGoals: undefined,
    availableSavings: undefined,
  };

  const result = await handleGoalsManagement(goalsContext, "");

  if (result.requiresAction?.type === "set_context") {
    await updateContext(userContext.userId, {
      goalsStep: result.requiresAction.data.currentStep,
      goalData: result.requiresAction.data.goalData,
    } as any);
  }

  return {
    message: result.response,
    requiresAction: result.requiresAction?.type === "goal_created",
    action: result.requiresAction?.type === "goal_created" ? {
      type: "goal_created",
      data: result.requiresAction.data,
    } : undefined,
    metadata: {
      intent: "goal_request",
      confidence: 1.0,
      stateChanged: result.completed,
    },
  };
}

/**
 * Handle loan consolidation intent
 */
async function handleLoanIntent(
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  const loanContext = {
    userId: userContext.userId,
    currentStep: context.loanStep || "analysis" as any,
    loans: undefined,
    consolidationSuggestion: context.consolidationSuggestion,
    preferredPayment: context.preferredPayment,
  };

  const result = await handleLoanConsolidation(loanContext, "");

  if (result.requiresAction?.type === "set_context") {
    await updateContext(userContext.userId, {
      loanStep: result.requiresAction.data.currentStep,
    } as any);
  }

  return {
    message: result.response,
    requiresAction: result.requiresAction?.type === "consolidation_submitted",
    action: result.requiresAction?.type === "consolidation_submitted" ? {
      type: "consolidation_submitted",
      data: result.requiresAction.data,
    } : undefined,
    metadata: {
      intent: "loan_consolidation",
      confidence: 1.0,
      stateChanged: result.completed,
    },
  };
}

/**
 * Handle document processing state
 */
async function handleDocumentProcessing(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  return {
    message: "אני מעבד את המסמך... רגע אחד 📄",
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: false,
    },
  };
}

/**
 * Handle paused state
 */
async function handlePausedState(
  intent: Intent,
  message: string,
  userContext: UserContext,
  context: any
): Promise<ConversationResponse> {
  return {
    message: "שמח שחזרת! 😊\nמה תרצה לעשות?",
    metadata: {
      intent: intent.type,
      confidence: intent.confidence,
      stateChanged: true,
    },
  };
}

/**
 * Build full user context
 */
async function buildUserContext(userId: string): Promise<UserContext> {
  // TODO: Implement full context building from database
  return {
    userId,
    userName: "",
    phoneNumber: "",
  };
}

/**
 * Get recent messages for mood detection
 */
async function getRecentMessages(userId: string, limit: number): Promise<Message[]> {
  const history = await getRecentHistory(userId, limit);
  return history.map((h) => ({
    role: h.role,
    content: h.content,
    timestamp: h.timestamp || new Date(),
  }));
}

/**
 * Check if user needs onboarding (no full_name in users table)
 */
async function checkIfUserNeedsOnboarding(userId: string): Promise<boolean> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = createServiceClient();
    
    const { data: user, error } = await supabase
      .from("users")
      .select("full_name, age")
      .eq("id", userId)
      .single();
    
    if (error || !user) {
      console.log(`🔍 checkIfUserNeedsOnboarding: User not found or error: ${error?.message}`);
      return true; // If can't find user, assume needs onboarding
    }
    
    // User needs onboarding if no full_name
    const needsOnboarding = !user.full_name;
    console.log(`🔍 checkIfUserNeedsOnboarding: ${userId} - full_name: ${user.full_name}, needsOnboarding: ${needsOnboarding}`);
    
    return needsOnboarding;
  } catch (error) {
    console.error("checkIfUserNeedsOnboarding error:", error);
    return false;
  }
}

export default {
  processMessage,
};
