/**
 * Milestone Notifier - הודעות חגיגה על אבני דרך ביעדים
 * שולח הודעות WhatsApp למשתמשים שהגיעו לאבני דרך
 */

import { createServiceClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/greenapi/client';

interface Milestone {
  id: string;
  goal_id: string;
  milestone_percent: number;
  reached_at: string;
  celebrated: boolean;
  goal: {
    name: string;
    current_amount: number;
    target_amount: number;
    user_id: string;
  };
  user: {
    phone: string;
    name: string;
    full_name: string;
  };
}

/**
 * בדיקה ושליחת הודעות חגיגה לאבני דרך שלא נחגגו
 */
export async function sendMilestoneNotifications(): Promise<void> {
  const supabase = createServiceClient();
  
  console.log('[Milestone Notifier] Checking for uncelebrated milestones...');
  
  try {
    // שלוף אבני דרך שלא נחגגו
    const { data: milestones, error } = await supabase
      .from('goal_milestones')
      .select(`
        id,
        goal_id,
        milestone_percent,
        reached_at,
        celebrated,
        goal:goals(
          name,
          current_amount,
          target_amount,
          user_id
        )
      `)
      .eq('celebrated', false)
      .order('reached_at', { ascending: true });
    
    if (error) {
      console.error('[Milestone Notifier] Failed to fetch milestones:', error);
      return;
    }
    
    if (!milestones || milestones.length === 0) {
      console.log('[Milestone Notifier] No uncelebrated milestones');
      return;
    }
    
    console.log(`[Milestone Notifier] Found ${milestones.length} milestones to celebrate`);
    
    // עבור על כל אבן דרך
    for (const milestone of milestones as any[]) {
      await celebrateMilestone(milestone);
    }
    
    console.log('[Milestone Notifier] Completed');
    
  } catch (error) {
    console.error('[Milestone Notifier] Error:', error);
  }
}

/**
 * חגיגת אבן דרך בודדת
 */
async function celebrateMilestone(milestone: any): Promise<void> {
  const supabase = createServiceClient();
  
  try {
    const goal = milestone.goal;
    
    if (!goal) {
      console.error(`[Milestone Notifier] Goal not found for milestone ${milestone.id}`);
      return;
    }
    
    // שלוף את פרטי המשתמש
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('phone, name, full_name')
      .eq('id', goal.user_id)
      .single();
    
    if (userError || !user || !user.phone) {
      console.error(`[Milestone Notifier] User not found or no phone for goal ${milestone.goal_id}`);
      return;
    }
    
    // בנה הודעת חגיגה
    const message = buildCelebrationMessage(
      milestone.milestone_percent,
      goal.name,
      goal.current_amount,
      goal.target_amount,
      user.name || user.full_name
    );
    
    // שלח הודעת WhatsApp
    const sent = await sendWhatsAppMessage(user.phone, message);
    
    if (!sent) {
      console.error(`[Milestone Notifier] Failed to send WhatsApp for milestone ${milestone.id}`);
      return;
    }
    
    // עדכן שהחגיגה נשלחה
    const { error: updateError } = await supabase
      .from('goal_milestones')
      .update({
        celebrated: true,
        celebration_sent_at: new Date().toISOString(),
      })
      .eq('id', milestone.id);
    
    if (updateError) {
      console.error(`[Milestone Notifier] Failed to update milestone ${milestone.id}:`, updateError);
      return;
    }
    
    console.log(
      `[Milestone Notifier] 🎉 Celebrated ${milestone.milestone_percent}% for "${goal.name}" ` +
      `(${goal.current_amount.toLocaleString('he-IL')}/${goal.target_amount.toLocaleString('he-IL')} ₪)`
    );
    
  } catch (error) {
    console.error(`[Milestone Notifier] Error celebrating milestone ${milestone.id}:`, error);
  }
}

/**
 * בניית הודעת חגיגה
 */
function buildCelebrationMessage(
  percent: number,
  goalName: string,
  currentAmount: number,
  targetAmount: number,
  userName: string | null
): string {
  const greeting = userName ? `${userName},` : '';
  const remaining = targetAmount - currentAmount;
  const progressBar = getProgressBar(percent);
  
  // הודעות שונות לפי אחוזים
  if (percent === 25) {
    return `🎯 ${greeting} רבע הדרך!

הגעת ל-25% ביעד "${goalName}"!

${progressBar}

💰 חסכת: ${currentAmount.toLocaleString('he-IL')} ₪
🎯 יעד: ${targetAmount.toLocaleString('he-IL')} ₪
📊 עוד: ${remaining.toLocaleString('he-IL')} ₪

התחלה מצוינת! 🚀
המשך ככה והיעד בכיס 💪`;
  }
  
  if (percent === 50) {
    return `🎉 ${greeting} מזל טוב!

הגעת לחצי הדרך ביעד "${goalName}"!

${progressBar}

💰 חסכת: ${currentAmount.toLocaleString('he-IL')} ₪
🎯 יעד: ${targetAmount.toLocaleString('he-IL')} ₪
📊 עוד רק: ${remaining.toLocaleString('he-IL')} ₪

עוד חצי דרך והגעת! 🎯`;
  }
  
  if (percent === 75) {
    return `🔥 ${greeting} וואו!

הגעת ל-75% ביעד "${goalName}"!

${progressBar}

💰 חסכת: ${currentAmount.toLocaleString('he-IL')} ₪
🎯 יעד: ${targetAmount.toLocaleString('he-IL')} ₪
📊 נשארו רק: ${remaining.toLocaleString('he-IL')} ₪

כמעט שם! עוד קצת... 🚀`;
  }
  
  if (percent === 100) {
    return `🏆 ${greeting} יש!!!

*הגעת ליעד "${goalName}"!* 🎉

${progressBar}

💰 חסכת: ${currentAmount.toLocaleString('he-IL')} ₪
✅ השגת את היעד המלא!

איזה כיף! אתה/את מדהים/ה! 💪🎊

מה היעד הבא? 🎯`;
  }
  
  // ברירת מחדל
  return `🎉 ${greeting} התקדמות מעולה!

הגעת ל-${percent}% ביעד "${goalName}"!

${progressBar}

💰 חסכת: ${currentAmount.toLocaleString('he-IL')} ₪
🎯 יעד: ${targetAmount.toLocaleString('he-IL')} ₪
📊 עוד: ${remaining.toLocaleString('he-IL')} ₪

המשך ככה! 💪`;
}

/**
 * Progress bar חזותי
 */
function getProgressBar(percent: number): string {
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  
  const bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);
  return `${bar} ${percent}%`;
}

/**
 * שליחת חגיגה מיידית (לשימוש ידני או בעת הגעה לאבן דרך)
 */
export async function celebrateMilestoneNow(milestoneId: string): Promise<boolean> {
  const supabase = createServiceClient();
  
  const { data: milestone, error } = await supabase
    .from('goal_milestones')
    .select(`
      id,
      goal_id,
      milestone_percent,
      reached_at,
      celebrated,
      goal:goals(
        name,
        current_amount,
        target_amount,
        user_id
      )
    `)
    .eq('id', milestoneId)
    .single();
  
  if (error || !milestone) {
    console.error('[Milestone Notifier] Milestone not found:', error);
    return false;
  }
  
  await celebrateMilestone(milestone);
  return true;
}

/**
 * בדיקה אם יש אבן דרך חדשה להודעה מיידית
 */
export async function checkNewMilestone(goalId: string): Promise<void> {
  const supabase = createServiceClient();
  
  // מצא אבן דרך לא מחוגגת אחרונה
  const { data: milestone } = await supabase
    .from('goal_milestones')
    .select(`
      id,
      milestone_percent,
      goal:goals(name, current_amount, target_amount, user_id)
    `)
    .eq('goal_id', goalId)
    .eq('celebrated', false)
    .order('milestone_percent', { ascending: false })
    .limit(1)
    .single();
  
  if (milestone) {
    await celebrateMilestone(milestone);
  }
}
