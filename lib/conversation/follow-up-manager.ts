import { ConversationContext } from "@/types/conversation";
import { createClient } from "@/lib/supabase/server";

/**
 * Smart Follow-up Manager
 * Handles reminders and follow-ups without overwhelming the user
 */

export interface Reminder {
  id: string;
  user_id: string;
  reminder_type: "follow_up" | "document_request" | "classification_continue" | "monthly_summary" | "bill_payment" | "goal_check" | "weekly_summary" | "budget_alert" | "expense_reminder";
  scheduled_for: Date;
  message: string;
  context_data?: any;
  sent: boolean;
  created_at: Date;
}

/**
 * Schedule a follow-up reminder
 */
export async function scheduleReminder(
  userId: string,
  type: Reminder["reminder_type"],
  scheduledFor: Date,
  message: string,
  contextData?: any
): Promise<string> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reminders")
      .insert({
        user_id: userId,
        reminder_type: type,
        scheduled_for: scheduledFor.toISOString(),
        message,
        context_data: contextData,
        sent: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error scheduling reminder:", error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error("Failed to schedule reminder:", error);
    throw error;
  }
}

/**
 * Cancel a reminder
 */
export async function cancelReminder(reminderId: string): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase.from("reminders").delete().eq("id", reminderId);
  } catch (error) {
    console.error("Failed to cancel reminder:", error);
  }
}

/**
 * Get pending reminders for user
 */
export async function getPendingReminders(userId: string): Promise<Reminder[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .eq("sent", false)
      .order("scheduled_for", { ascending: true });

    if (error) {
      console.error("Error getting reminders:", error);
      return [];
    }

    return (data || []).map((r: any) => ({
      ...r,
      scheduled_for: new Date(r.scheduled_for),
      created_at: new Date(r.created_at),
    }));
  } catch (error) {
    console.error("Failed to get reminders:", error);
    return [];
  }
}

/**
 * Get due reminders (ready to be sent)
 */
export async function getDueReminders(): Promise<Reminder[]> {
  try {
    const supabase = await createClient();

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("sent", false)
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true });

    if (error) {
      console.error("Error getting due reminders:", error);
      return [];
    }

    return (data || []).map((r: any) => ({
      ...r,
      scheduled_for: new Date(r.scheduled_for),
      created_at: new Date(r.created_at),
    }));
  } catch (error) {
    console.error("Failed to get due reminders:", error);
    return [];
  }
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(reminderId: string): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase
      .from("reminders")
      .update({ sent: true, sent_at: new Date().toISOString() })
      .eq("id", reminderId);
  } catch (error) {
    console.error("Failed to mark reminder as sent:", error);
  }
}

/**
 * Handle "later" response - schedule reminder based on user preference
 */
export async function handlePostponement(
  userId: string,
  context: ConversationContext,
  whenText?: string
): Promise<{ scheduledFor: Date; message: string }> {
  let scheduledFor = new Date();
  let message = "";

  // Parse natural language time
  if (!whenText) {
    // Default: 1 hour from now
    scheduledFor.setHours(scheduledFor.getHours() + 1);
    message = "בסדר! אזכיר לך בעוד שעה 😊";
  } else {
    const lowerText = whenText.toLowerCase();

    if (lowerText.includes("מחר") || lowerText.includes("tomorrow")) {
      // Tomorrow at 9 AM
      scheduledFor.setDate(scheduledFor.getDate() + 1);
      scheduledFor.setHours(9, 0, 0, 0);
      message = "בסדר גמור! אזכיר לך מחר בבוקר ב-9:00 😊";
    } else if (lowerText.includes("ערב") || lowerText.includes("evening")) {
      // Today at 8 PM
      scheduledFor.setHours(20, 0, 0, 0);
      message = "סבבה! אזכיר לך הערב ב-20:00 👍";
    } else if (lowerText.includes("צהריים") || lowerText.includes("noon")) {
      // Today at 12 PM
      scheduledFor.setHours(12, 0, 0, 0);
      message = "בסדר! אזכיר לך בצהריים 😊";
    } else if (lowerText.match(/\d+/)) {
      // Extract number of hours
      const hours = parseInt(lowerText.match(/\d+/)?.[0] || "1");
      scheduledFor.setHours(scheduledFor.getHours() + hours);
      message = `אוקיי! אזכיר לך בעוד ${hours} שעות 👍`;
    } else {
      // Default: 1 hour
      scheduledFor.setHours(scheduledFor.getHours() + 1);
      message = "בסדר! אזכיר לך בעוד שעה 😊";
    }
  }

  // Schedule the reminder
  const reminderMessage = getReminderMessage(context);
  await scheduleReminder(userId, "follow_up", scheduledFor, reminderMessage, {
    context: context,
  });

  return { scheduledFor, message };
}

/**
 * Get appropriate reminder message based on context
 */
function getReminderMessage(context: ConversationContext): string {
  if (context.ongoingTask) {
    const remaining =
      context.ongoingTask.totalItems - context.ongoingTask.completedItems;

    switch (context.ongoingTask.taskType) {
      case "classify_transactions":
        return `היי! זוכר שהשארנו ${remaining} תנועות באמצע?\nבא לך להמשיך? 😊`;

      case "upload_document":
        return `היי! עדיין מחכה למסמך שהבטחת 📄\nיש לך אותו?`;

      case "set_goal":
        return `היי! בוא נסיים להגדיר את היעד? 🎯`;

      default:
        return "היי! בוא נמשיך מאיפה שעצרנו? 😊";
    }
  }

  if (context.waitingForDocument) {
    return `היי! עדיין מחכה ל${getDocumentName(context.waitingForDocument)} 📄\nיש לך?`;
  }

  return "היי! מה נשמע? יש משהו שאני יכול לעזור בו? 😊";
}

/**
 * Get friendly document name in Hebrew
 */
function getDocumentName(docType: string): string {
  const names: Record<string, string> = {
    bank_statement: "דוח בנק",
    credit_card: "דוח כרטיס אשראי",
    receipt: "קבלה",
    salary_slip: "תלוש משכורת",
    insurance_policy: "פוליסת ביטוח",
  };

  return names[docType] || "מסמך";
}

/**
 * Check if we should send a follow-up
 * Logic: Don't send if user has been too inactive or too active recently
 */
export async function shouldSendFollowUp(
  userId: string,
  lastInteraction: Date
): Promise<boolean> {
  const hoursSinceLastInteraction =
    (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60);

  // Don't send if user was active in the last hour
  if (hoursSinceLastInteraction < 1) {
    return false;
  }

  // Don't send if user has been inactive for more than 7 days
  if (hoursSinceLastInteraction > 168) {
    return false;
  }

  // Check if we've already sent too many reminders
  const reminders = await getPendingReminders(userId);
  if (reminders.length > 3) {
    return false; // Don't overwhelm with too many pending reminders
  }

  return true;
}

/**
 * Handle no response scenario
 * Escalation: First gentle reminder, then ask when to remind, then pause
 */
export async function handleNoResponse(
  userId: string,
  context: ConversationContext,
  attemptNumber: number
): Promise<string | null> {
  if (attemptNumber === 1) {
    // First reminder: gentle nudge
    const message = "היי! אולי פספסת? 😊\nאם אתה עסוק, אפשר לדחות למועד אחר.";
    
    // Schedule next check in 2 hours
    const nextCheck = new Date();
    nextCheck.setHours(nextCheck.getHours() + 2);
    
    await scheduleReminder(userId, "follow_up", nextCheck, message, {
      attemptNumber: 2,
      context,
    });
    
    return message;
  } else if (attemptNumber === 2) {
    // Second reminder: ask when to remind
    return "היי! נראה שאתה עסוק 😊\nמתי יהיה לך נוח? כתוב לי 'מחר' או 'ערב' או כל זמן אחר.";
  } else {
    // Third attempt: pause for 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await scheduleReminder(
      userId,
      "follow_up",
      tomorrow,
      "היי! חוזר אליך כדי לראות אם יש זמן להמשיך 😊",
      { context }
    );
    
    return null; // Don't send immediate message
  }
}

/**
 * Create reminder for monthly summary
 */
export async function scheduleMonthlyReminder(userId: string): Promise<void> {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1); // First day of next month
  nextMonth.setHours(9, 0, 0, 0); // 9 AM

  await scheduleReminder(
    userId,
    "monthly_summary",
    nextMonth,
    "היי! הסיכום החודשי שלך מוכן! 📊\nרוצה לראות איך עבר החודש?",
    {}
  );
}

/**
 * Create reminder for document upload (smart linking)
 */
export async function scheduleDocumentReminder(
  userId: string,
  documentType: string,
  reason: string,
  urgency: "high" | "medium" | "low" = "medium"
): Promise<void> {
  let scheduledFor = new Date();
  
  // Schedule based on urgency
  if (urgency === "high") {
    scheduledFor.setHours(scheduledFor.getHours() + 2); // 2 hours
  } else if (urgency === "medium") {
    scheduledFor.setHours(scheduledFor.getHours() + 24); // 1 day
  } else {
    scheduledFor.setDate(scheduledFor.getDate() + 3); // 3 days
  }

  const docName = getDocumentName(documentType);
  const message = `היי! ${reason}\nאפשר לשלוח את ${docName}? 📄`;

  await scheduleReminder(userId, "document_request", scheduledFor, message, {
    documentType,
    reason,
  });
}

export default {
  scheduleReminder,
  cancelReminder,
  getPendingReminders,
  getDueReminders,
  markReminderSent,
  handlePostponement,
  shouldSendFollowUp,
  handleNoResponse,
  scheduleMonthlyReminder,
  scheduleDocumentReminder,
};

