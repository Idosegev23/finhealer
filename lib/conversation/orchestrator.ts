import { chatWithGPT5, chatWithGPT5Fast } from "@/lib/ai/gpt5-client";
import { parseIntent, detectUserMood } from "@/lib/ai/intent-parser";
import { PHI_COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts/phi-coach-system";
import { Message, UserContext, ConversationContext, Intent } from "@/types/conversation";
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
  const currentState = stateMachine.getState();

  // Handle special intents first (can override state)
  switch (intent.type) {
    case "budget_request":
      return await handleBudgetIntent(userContext, context);
    
    case "goal_request":
      return await handleGoalsIntent(userContext, context);
    
    case "loan_consolidation":
      return await handleLoanIntent(userContext, context);
  }

  // Handle based on current state
  switch (currentState) {
    case "idle":
      return await handleIdleState(intent, message, userContext, context);

    case "active_monitoring":
      return await handleActiveMonitoring(intent, message, userContext, context);

    case "transaction_classification":
      return await handleClassificationState(intent, message, userContext, context);

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
  const response = await chatWithGPT5Fast(
    message,
    PHI_COACH_SYSTEM_PROMPT,
    userContext
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
  // TODO: Get from database
  return [];
}

export default {
  processMessage,
};
