import { createClient } from "@/lib/supabase/server";
import { getGreenAPIClient } from "@/lib/greenapi/client";
import { scheduleReminder, getDueReminders, markReminderSent } from "@/lib/conversation/follow-up-manager";

/**
 * Proactive Reminder System
 * Sends intelligent reminders based on user behavior and financial events
 */

export interface ReminderConfig {
  enabled: boolean;
  frequency: "minimal" | "normal" | "frequent";
  preferredTime: string; // HH:MM format
  quietHoursStart: string;
  quietHoursEnd: string;
}

/**
 * Check and send due reminders
 * Should be called by a cron job
 */
export async function processDueReminders(): Promise<{
  sent: number;
  failed: number;
}> {
  const reminders = await getDueReminders();
  const greenAPI = getGreenAPIClient();

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    try {
      // Get user's phone number
      const supabase = await createClient();
      const { data: user } = await supabase
        .from("users")
        .select("phone, name")
        .eq("id", reminder.user_id)
        .single();

      if (!user || !user.phone) {
        failed++;
        continue;
      }

      // Check user preferences
      const config = await getReminderConfig(reminder.user_id);
      
      if (!config.enabled) {
        // Skip if user disabled reminders
        await markReminderSent(reminder.id);
        continue;
      }

      // Check quiet hours
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      
      if (isQuietHours(currentTime, config)) {
        // Reschedule for after quiet hours
        const nextTime = getNextActiveTime(config);
        // TODO: Reschedule reminder
        continue;
      }

      // Send reminder
      await greenAPI.sendMessage({
        phoneNumber: user.phone,
        message: reminder.message,
      });

      // Mark as sent
      await markReminderSent(reminder.id);
      sent++;
    } catch (error) {
      console.error(`Failed to send reminder ${reminder.id}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Schedule salary reminder
 */
export async function scheduleSalaryReminder(
  userId: string,
  expectedSalaryDate: Date,
  expectedAmount: number
): Promise<void> {
  const supabase = await createClient();

  // Check if salary was received
  const { data: salaryTransaction } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "income")
    .eq("category", "משכורת")
    .gte("date", expectedSalaryDate.toISOString())
    .single();

  if (!salaryTransaction) {
    // Salary not received, schedule reminder
    const reminderDate = new Date(expectedSalaryDate);
    reminderDate.setDate(reminderDate.getDate() + 2); // 2 days after expected date

    await scheduleReminder(
      userId,
      "follow_up",
      reminderDate,
      `היי! שמתי לב שהמשכורת עוד לא הגיעה 🤔\n\nכל בסדר?`,
      { expectedAmount }
    );
  }
}

/**
 * Schedule expense logging reminder
 */
export async function scheduleExpenseLoggingReminder(
  userId: string
): Promise<void> {
  const supabase = await createClient();

  // Check last expense logged
  const { data: lastExpense } = await supabase
    .from("transactions")
    .select("date")
    .eq("user_id", userId)
    .eq("type", "expense")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (lastExpense) {
    const lastDate = new Date(lastExpense.date);
    const daysSince = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince >= 3) {
      // Haven't logged expenses in 3 days
      const reminderDate = new Date();
      reminderDate.setHours(reminderDate.getHours() + 1); // 1 hour from now

      await scheduleReminder(
        userId,
        "follow_up",
        reminderDate,
        `היי! לא רשמת הוצאות כבר ${daysSince} ימים 😊\n\nהיה משהו שכדאי לרשום?`,
        {}
      );
    }
  }
}

/**
 * Schedule monthly summary reminder
 */
export async function scheduleMonthlySummaryReminder(
  userId: string
): Promise<void> {
  // First day of next month at 9 AM
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(9, 0, 0, 0);

  await scheduleReminder(
    userId,
    "monthly_summary",
    nextMonth,
    `🎉 הסיכום החודשי מוכן!\n\nרוצה לראות איך עבר החודש?`,
    {}
  );
}

/**
 * Schedule bill payment reminder
 */
export async function scheduleBillPaymentReminder(
  userId: string,
  billName: string,
  amount: number,
  dueDate: Date
): Promise<void> {
  // Remind 3 days before due date
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 3);

  await scheduleReminder(
    userId,
    "bill_payment",
    reminderDate,
    `תזכורת: ${billName} יגיע בעוד 3 ימים 📅\n\nסכום: ${amount} ₪\n\nרוצה שאזכיר שוב לפני התאריך?`,
    { billName, amount, dueDate: dueDate.toISOString() }
  );
}

/**
 * Schedule goal milestone reminder
 */
export async function scheduleGoalMilestoneReminder(
  userId: string,
  goalName: string,
  milestone: number
): Promise<void> {
  const reminderDate = new Date();
  reminderDate.setHours(reminderDate.getHours() + 1);

  await scheduleReminder(
    userId,
    "goal_check",
    reminderDate,
    `🎯 וואו! הגעת ל-${milestone}% מהיעד "${goalName}"!\n\nכל הכבוד! המשך ככה! 💪`,
    { goalName, milestone }
  );
}

/**
 * Get reminder configuration for user
 */
async function getReminderConfig(userId: string): Promise<ReminderConfig> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_preferences")
    .select("reminder_frequency, preferred_reminder_time")
    .eq("user_id", userId)
    .single();

  return {
    enabled: true,
    frequency: data?.reminder_frequency || "normal",
    preferredTime: data?.preferred_reminder_time || "09:00",
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  };
}

/**
 * Check if current time is in quiet hours
 */
function isQuietHours(currentTime: string, config: ReminderConfig): boolean {
  const [startHour] = config.quietHoursStart.split(":").map(Number);
  const [endHour] = config.quietHoursEnd.split(":").map(Number);
  const [currentHour] = currentTime.split(":").map(Number);

  if (startHour > endHour) {
    // Quiet hours span midnight (e.g., 22:00 - 08:00)
    return currentHour >= startHour || currentHour < endHour;
  } else {
    // Quiet hours within same day
    return currentHour >= startHour && currentHour < endHour;
  }
}

/**
 * Get next active time (after quiet hours)
 */
function getNextActiveTime(config: ReminderConfig): Date {
  const now = new Date();
  const [endHour, endMinute] = config.quietHoursEnd.split(":").map(Number);

  const nextTime = new Date(now);
  nextTime.setHours(endHour, endMinute, 0, 0);

  // If end time is before now, set to tomorrow
  if (nextTime <= now) {
    nextTime.setDate(nextTime.getDate() + 1);
  }

  return nextTime;
}

/**
 * Create proactive insight reminder
 */
export async function createInsightReminder(
  userId: string,
  insightType: "overspending" | "savings_opportunity" | "upcoming_bills" | "goal_progress",
  data: any
): Promise<void> {
  let message: string;
  
  switch (insightType) {
    case "overspending":
      message = `שמתי לב שהוצאות ${data.category} עלו ב-${data.percentage}% החודש 📊\n\nרוצה לראות פירוט?`;
      break;

    case "savings_opportunity":
      message = `הבחנתי שאפשר לחסוך ${data.amount} ₪ בחודש על ${data.category} 💰\n\nבא לך לשמוע איך?`;
      break;

    case "upcoming_bills":
      message = `חודש הבא יש ${data.count} תשלומים גדולים (סה״כ ${data.total} ₪) 📅\n\nבוא נתכנן ביחד?`;
      break;

    case "goal_progress":
      message = `אתה ${data.ahead ? "לפני" : "אחרי"} לוח הזמנים ביעד "${data.goalName}" 🎯\n\nרוצה עדכון?`;
      break;

    default:
      message = "יש לי תובנה פיננסית בשבילך 💡";
  }

  const reminderDate = new Date();
  reminderDate.setHours(reminderDate.getHours() + 2); // 2 hours from now

  await scheduleReminder(userId, "follow_up", reminderDate, message, { insightType, data });
}

export default {
  processDueReminders,
  scheduleSalaryReminder,
  scheduleExpenseLoggingReminder,
  scheduleMonthlySummaryReminder,
  scheduleBillPaymentReminder,
  scheduleGoalMilestoneReminder,
  createInsightReminder,
};

