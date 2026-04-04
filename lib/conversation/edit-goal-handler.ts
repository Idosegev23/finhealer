/**
 * מטפל בעריכה ומחיקה של יעדים דרך WhatsApp
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { mergeClassificationContext as mergeContext } from './shared';
import type { Goal } from '@/types/goals';

async function removeEditGoalContext(userId: string): Promise<void> {
  const { removeClassificationContextKey } = await import('./shared');
  await removeClassificationContextKey(userId, 'editGoal');
}

export interface EditGoalContext {
  step: 'select_goal' | 'select_action' | 'edit_field' | 'confirm_delete';
  goalId?: string;
  goalName?: string;
  editField?: 'name' | 'amount' | 'deadline' | 'priority';
  newValue?: any;
}

/**
 * התחל עריכת יעד
 */
export async function startEditGoal(
  userId: string,
  phone: string
): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  // טען יעדים פעילים
  const { data: goals, error } = await supabase
    .from('goals')
    .select('id, name, target_amount, current_amount, deadline, priority, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('priority', { ascending: true });

  if (error || !goals || goals.length === 0) {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ אין יעדים פעילים לעריכה.\n\nכתוב *"יעד חדש"* ליצירת יעד.`,
    });
    return;
  }

  // שמור context
  await mergeContext(userId, {
    editGoal: {
      step: 'select_goal',
      goals: goals.map(g => ({ id: g.id, name: g.name }))
    }
  });

  // הצג רשימת יעדים
  let message = `✏️ *עריכת יעד*\n\n`;
  message += `בחר יעד לעריכה:\n\n`;

  goals.forEach((goal, index) => {
    const progress = goal.target_amount > 0 
      ? Math.round((goal.current_amount / goal.target_amount) * 100)
      : 0;
    message += `${index + 1}️⃣ *${goal.name}*\n`;
    message += `   💰 ${goal.current_amount.toLocaleString('he-IL')} / ${goal.target_amount.toLocaleString('he-IL')} ₪ (${progress}%)\n`;
    if (goal.deadline) {
      message += `   📅 ${new Date(goal.deadline).toLocaleDateString('he-IL')}\n`;
    }
    message += `\n`;
  });

  message += `כתוב מספר או שם היעד:`;

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message,
  });
}

/**
 * טיפול בבחירת יעד לעריכה
 */
export async function handleGoalSelection(
  userId: string,
  phone: string,
  msg: string,
  context: EditGoalContext
): Promise<boolean> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const goals = (context as any).goals || [];

  let selectedGoal: { id: string; name: string } | null = null;

  // נסה לזהות לפי מספר
  const num = parseInt(msg);
  if (!isNaN(num) && num >= 1 && num <= goals.length) {
    selectedGoal = goals[num - 1];
  } else {
    // חיפוש לפי שם
    selectedGoal = goals.find((g: any) => 
      g.name.toLowerCase().includes(msg.toLowerCase()) ||
      msg.toLowerCase().includes(g.name.toLowerCase())
    );
  }

  if (!selectedGoal) {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ לא מצאתי יעד בשם הזה.\n\nכתוב מספר או שם מדויק.`,
    });
    return false;
  }

  // טען פרטי יעד מלאים
  const { data: goal } = await supabase
    .from('goals')
    .select('*')
    .eq('id', selectedGoal.id)
    .single();

  if (!goal) {
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ שגיאה בטעינת היעד.`,
    });
    return false;
  }

  // עדכן context ושאל מה לעשות
  await mergeContext(userId, {
    editGoal: {
      step: 'select_action',
      goalId: goal.id,
      goalName: goal.name,
      goalData: goal
    }
  });

  const progress = goal.target_amount > 0 
    ? Math.round((goal.current_amount / goal.target_amount) * 100)
    : 0;

  let message = `📝 *${goal.name}*\n\n`;
  message += `💰 *סכום:* ${goal.current_amount.toLocaleString('he-IL')} / ${goal.target_amount.toLocaleString('he-IL')} ₪ (${progress}%)\n`;
  if (goal.deadline) {
    message += `📅 *מועד:* ${new Date(goal.deadline).toLocaleDateString('he-IL')}\n`;
  }
  message += `⭐ *עדיפות:* ${goal.priority}/10\n`;
  message += `💵 *הקצאה חודשית:* ${goal.monthly_allocation?.toLocaleString('he-IL') || 0} ₪\n\n`;

  message += `*מה תרצה לעשות?*\n\n`;
  message += `1️⃣ שנה שם\n`;
  message += `2️⃣ שנה סכום יעד\n`;
  message += `3️⃣ שנה תאריך יעד\n`;
  message += `4️⃣ שנה עדיפות\n`;
  message += `5️⃣ ❌ מחק יעד\n`;
  message += `6️⃣ ביטול\n\n`;
  message += `כתוב מספר:`;

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message,
  });

  return true;
}

/**
 * טיפול בבחירת פעולה
 */
export async function handleActionSelection(
  userId: string,
  phone: string,
  msg: string,
  context: EditGoalContext
): Promise<boolean> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  if (msg === '1' || msg.toLowerCase().includes('שם')) {
    await mergeContext(userId, {
      editGoal: {
        ...context,
        step: 'edit_field',
        editField: 'name'
      }
    });

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `✏️ *שינוי שם*\n\nמה השם החדש ליעד?`,
    });
    return true;
  } else if (msg === '2' || msg.toLowerCase().includes('סכום')) {
    await mergeContext(userId, {
      editGoal: {
        ...context,
        step: 'edit_field',
        editField: 'amount'
      }
    });

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `💰 *שינוי סכום יעד*\n\nמה הסכום החדש? (בשקלים)`,
    });
    return true;
  } else if (msg === '3' || msg.toLowerCase().includes('תאריך')) {
    await mergeContext(userId, {
      editGoal: {
        ...context,
        step: 'edit_field',
        editField: 'deadline'
      }
    });

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `📅 *שינוי תאריך יעד*\n\nמתי תרצה להשיג את היעד?\n\n` +
        `דוגמאות:\n• 31/12/2026\n• דצמבר 2026\n• עוד 6 חודשים\n• עוד שנה`,
    });
    return true;
  } else if (msg === '4' || msg.toLowerCase().includes('עדיפות')) {
    await mergeContext(userId, {
      editGoal: {
        ...context,
        step: 'edit_field',
        editField: 'priority'
      }
    });

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `⭐ *שינוי עדיפות*\n\nמה העדיפות החדשה?\n\n` +
        `1 = הכי חשוב\n10 = הכי פחות חשוב\n\nכתוב מספר 1-10:`,
    });
    return true;
  } else if (msg === '5' || msg.toLowerCase().includes('מחק')) {
    await mergeContext(userId, {
      editGoal: {
        ...context,
        step: 'confirm_delete'
      }
    });

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `⚠️ *מחיקת יעד*\n\n` +
        `האם אתה בטוח שברצונך למחוק את היעד *"${context.goalName}"*?\n\n` +
        `⚠️ המחיקה היא סופית!\n\n` +
        `• *"אשר"* - מחק\n• *"ביטול"* - חזור`,
    });
    return true;
  } else if (msg === '6' || msg.toLowerCase().includes('ביטול')) {
    await removeEditGoalContext(userId);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `✅ בוטל.\n\n• כתוב *"עריכה"* לעריכת יעד\n• כתוב *"יעדים"* לראות יעדים`,
    });
    return true;
  }

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `❌ לא הבנתי. כתוב מספר 1-6.`,
  });
  return false;
}

/**
 * טיפול בעריכת שדה
 */
export async function handleFieldEdit(
  userId: string,
  phone: string,
  msg: string,
  context: EditGoalContext
): Promise<boolean> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  const field = context.editField;
  let newValue: any = null;
  let updateData: any = {};

  if (field === 'name') {
    newValue = msg.trim();
    updateData.name = newValue;
  } else if (field === 'amount') {
    const amount = parseFloat(msg.replace(/[^\d.]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ סכום לא תקין. כתוב מספר חיובי.`,
      });
      return false;
    }
    newValue = amount;
    updateData.target_amount = amount;
  } else if (field === 'deadline') {
    // פרסור תאריך פשוט
    let deadline: Date | null = null;

    if (msg.toLowerCase().includes('עוד')) {
      const months = parseInt(msg.match(/\d+/)?.[0] || '0');
      if (months > 0) {
        deadline = new Date();
        deadline.setMonth(deadline.getMonth() + months);
      }
    } else {
      // נסה לפרסר תאריך
      const parsed = new Date(msg);
      if (!isNaN(parsed.getTime())) {
        deadline = parsed;
      }
    }

    if (!deadline) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ תאריך לא תקין.\n\nדוגמאות:\n• 31/12/2026\n• עוד 6 חודשים`,
      });
      return false;
    }

    newValue = deadline.toISOString().split('T')[0];
    updateData.deadline = newValue;
  } else if (field === 'priority') {
    const priority = parseInt(msg);
    if (isNaN(priority) || priority < 1 || priority > 10) {
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ עדיפות לא תקינה. כתוב מספר בין 1-10.`,
      });
      return false;
    }
    newValue = priority;
    updateData.priority = priority;
  }

  // עדכן בDB
  const { error } = await supabase
    .from('goals')
    .update(updateData)
    .eq('id', context.goalId!);

  if (error) {
    console.error('[Edit Goal] Error updating:', error);
    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `❌ שגיאה בעדכון. נסה שוב.`,
    });
    return false;
  }

  // נקה context
  await removeEditGoalContext(userId);

  let fieldName = '';
  if (field === 'name') fieldName = 'שם';
  else if (field === 'amount') fieldName = 'סכום יעד';
  else if (field === 'deadline') fieldName = 'תאריך יעד';
  else if (field === 'priority') fieldName = 'עדיפות';

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `✅ *עודכן!*\n\n` +
      `${fieldName} של *"${context.goalName}"* עודכן.\n\n` +
      `• כתוב *"עריכה"* לעריכה נוספת\n` +
      `• כתוב *"יעדים"* לראות יעדים`,
  });

  return true;
}

/**
 * אישור מחיקת יעד
 */
export async function confirmGoalDeletion(
  userId: string,
  phone: string,
  msg: string,
  context: EditGoalContext
): Promise<boolean> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  if (msg.toLowerCase().includes('אשר') || msg.toLowerCase() === 'כן') {
    // מחק את היעד
    const { error } = await supabase
      .from('goals')
      .update({ status: 'cancelled' })
      .eq('id', context.goalId!);

    if (error) {
      console.error('[Edit Goal] Error deleting:', error);
      await greenAPI.sendMessage({
        phoneNumber: phone,
        message: `❌ שגיאה במחיקה. נסה שוב.`,
      });
      return false;
    }

    // נקה context
    await removeEditGoalContext(userId);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `🗑️ *נמחק!*\n\n` +
        `היעד *"${context.goalName}"* נמחק.\n\n` +
        `• כתוב *"יעד חדש"* ליצירת יעד חדש\n` +
        `• כתוב *"יעדים"* לראות יעדים`,
    });

    return true;
  } else if (msg.toLowerCase().includes('ביטול') || msg.toLowerCase() === 'לא') {
    // בטל
    await removeEditGoalContext(userId);

    await greenAPI.sendMessage({
      phoneNumber: phone,
      message: `✅ בוטל. היעד לא נמחק.\n\n` +
        `• כתוב *"עריכה"* לעריכת יעד\n` +
        `• כתוב *"יעדים"* לראות יעדים`,
    });

    return true;
  }

  await greenAPI.sendMessage({
    phoneNumber: phone,
    message: `❌ לא הבנתי.\n\n• כתוב *"אשר"* למחיקה\n• כתוב *"ביטול"* לביטול`,
  });

  return false;
}
