/**
 * Goals Monitor - מערכת ניטור והתראות יעדים
 * 
 * בודק יום יומית את מצב היעדים ושולח התראות רלוונטיות
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { calculateOptimalAllocations } from './goals-balancer';
import { forecastIncome } from './income-forecaster';
import type { Goal } from '@/types/goals';

interface MonitoringResult {
  user_id: string;
  alerts: Alert[];
  recommendations: Recommendation[];
  actions_taken: string[];
}

interface Alert {
  type: 'warning' | 'success' | 'info';
  message: string;
  goal_id?: string;
  priority: 'high' | 'medium' | 'low';
}

interface Recommendation {
  type: string;
  message: string;
  action?: string;
  impact: string;
}

/**
 * בדיקת יעדים לכל המשתמשים הפעילים
 */
export async function monitorAllUsersGoals(): Promise<MonitoringResult[]> {
  const supabase = createServiceClient();
  
  // שלוף משתמשים עם יעדים פעילים
  const { data: users, error } = await supabase
    .from('goals')
    .select('user_id')
    .eq('status', 'active')
    .not('user_id', 'is', null);
  
  if (error || !users) {
    console.error('Failed to fetch users with goals:', error);
    return [];
  }
  
  // הסר כפילויות
  const uniqueUsers = Array.from(new Set(users.map(u => u.user_id)));
  
  const results: MonitoringResult[] = [];
  
  for (const userId of uniqueUsers) {
    try {
      const result = await monitorUserGoals(userId);
      results.push(result);
      
      // שלח התראות אם יש
      if (result.alerts.length > 0) {
        await sendAlertsToUser(userId, result.alerts);
      }
    } catch (error) {
      console.error(`Error monitoring goals for user ${userId}:`, error);
    }
  }
  
  return results;
}

/**
 * בדיקת יעדים למשתמש בודד
 */
export async function monitorUserGoals(userId: string): Promise<MonitoringResult> {
  const supabase = createServiceClient();
  const alerts: Alert[] = [];
  const recommendations: Recommendation[] = [];
  const actions_taken: string[] = [];
  
  // שלוף יעדים
  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');
  
  if (goalsError || !goals || goals.length === 0) {
    return { user_id: userId, alerts, recommendations, actions_taken };
  }
  
  // חשב הקצאות נוכחיות
  const allocationResult = await calculateOptimalAllocations({ userId });
  
  // 1. בדוק יעדים בסיכון (לא יושלמו בזמן)
  const atRiskGoals = allocationResult.allocations.filter(a => !a.is_achievable);
  for (const allocation of atRiskGoals) {
    const goal = goals.find((g: any) => g.id === allocation.goal_id);
    if (goal && goal.deadline) {
      const daysUntilDeadline = Math.ceil(
        (new Date(goal.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      
      if (daysUntilDeadline <= 30) {
        alerts.push({
          type: 'warning',
          message: `⚠️ היעד "${goal.name}" בסיכון! נשארו ${daysUntilDeadline} ימים והוא לא יושלם בזמן.`,
          goal_id: goal.id,
          priority: 'high',
        });
        
        // המלצה להגדלת הקצאה
        const neededAllocation = allocation.remaining_amount / (daysUntilDeadline / 30);
        const increase = neededAllocation - allocation.monthly_allocation;
        if (increase > 0) {
          recommendations.push({
            type: 'increase_allocation',
            message: `להגיע ליעד "${goal.name}" בזמן, צריך להגדיל הקצאה ב-${Math.ceil(increase).toLocaleString('he-IL')} ₪`,
            action: `increase_goal_${goal.id}_by_${Math.ceil(increase)}`,
            impact: `תשלים את היעד בתאריך היעד`,
          });
        }
      }
    }
  }
  
  // 2. בדוק יעדים קרובים להשלמה
  for (const allocation of allocationResult.allocations) {
    if (allocation.months_to_complete <= 1 && allocation.months_to_complete > 0) {
      const goal = goals.find((g: any) => g.id === allocation.goal_id);
      if (goal) {
        alerts.push({
          type: 'success',
          message: `🎉 כמעט סיימת! היעד "${goal.name}" יושלם בחודש הבא!`,
          goal_id: goal.id,
          priority: 'medium',
        });
      }
    }
  }
  
  // 3. בדוק שינויים בהכנסה
  const incomeChange = await detectIncomeChange(userId);
  if (incomeChange) {
    if (incomeChange.change > 0) {
      alerts.push({
        type: 'success',
        message: `💰 הכנסתך עלתה ב-${incomeChange.change.toLocaleString('he-IL')} ₪!`,
        priority: 'medium',
      });
      
      recommendations.push({
        type: 'increase_allocations',
        message: `ניתן להגדיל הקצאות ליעדים או להוסיף יעד חדש`,
        impact: `תקדם מהר יותר ביעדים או תוסיף יעד נוסף`,
      });
    } else if (incomeChange.change < 0) {
      alerts.push({
        type: 'warning',
        message: `📉 הכנסתך ירדה ב-${Math.abs(incomeChange.change).toLocaleString('he-IL')} ₪`,
        priority: 'high',
      });
      
      recommendations.push({
        type: 'reduce_allocations',
        message: `שקול להפחית הקצאות או לדחות יעדים`,
        impact: `שמור על איזון פיננסי`,
      });
      
      // הפעל ריאיזון אוטומטי אם יש יעדים עם auto_adjust
      const hasAutoAdjust = goals.some((g: any) => g.auto_adjust);
      if (hasAutoAdjust) {
        await rebalanceAutomatically(userId, incomeChange.change);
        actions_taken.push('auto_rebalance_after_income_decrease');
      }
    }
  }
  
  // 4. בדוק תקציב צמוד
  if (allocationResult.safetyCheck.comfort_level === 'tight' || 
      allocationResult.safetyCheck.comfort_level === 'critical') {
    alerts.push({
      type: 'warning',
      message: `⚡ התקציב שלך צמוד - ${allocationResult.safetyCheck.remaining_for_life.toLocaleString('he-IL')} ₪ נשארים למחיה`,
      priority: 'high',
    });
    
    recommendations.push({
      type: 'reduce_goals',
      message: `שקול להפחית יעדים או להגדיל הכנסות`,
      impact: `תבטיח שיישאר "אוכל בצלחת"`,
    });
  }
  
  // 5. בדוק יעדים ללא התקדמות
  const stagnantGoals = await detectStagnantGoals(userId, goals as Goal[]);
  for (const goal of stagnantGoals) {
    alerts.push({
      type: 'info',
      message: `⏸️ היעד "${goal.name}" לא התקדם ב-3 החודשים האחרונים`,
      goal_id: goal.id,
      priority: 'low',
    });
    
    recommendations.push({
      type: 'review_goal',
      message: `שקול לבטל או לדחות את "${goal.name}"`,
      impact: `תפנה תקציב ליעדים פעילים יותר`,
    });
  }
  
  // 6. המלצות אופטימיזציה כלליות
  if (allocationResult.suggestions.length > 0) {
    for (const suggestion of allocationResult.suggestions.slice(0, 2)) {
      recommendations.push({
        type: suggestion.type,
        message: suggestion.message,
        impact: suggestion.impact,
      });
    }
  }
  
  return {
    user_id: userId,
    alerts,
    recommendations,
    actions_taken,
  };
}

/**
 * זיהוי שינוי בהכנסה
 */
async function detectIncomeChange(userId: string): Promise<{ change: number; percent: number } | null> {
  const supabase = createServiceClient();
  
  // שלוף הכנסות 3 חודשים אחרונים vs. 3 חודשים לפני
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('date', threeMonthsAgo.toISOString().split('T')[0]);
  
  const { data: oldTx } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('date', sixMonthsAgo.toISOString().split('T')[0])
    .lt('date', threeMonthsAgo.toISOString().split('T')[0]);
  
  if (!recentTx || !oldTx || recentTx.length === 0 || oldTx.length === 0) {
    return null;
  }
  
  const recentAvg = recentTx.reduce((sum, t) => sum + Number(t.amount), 0) / recentTx.length;
  const oldAvg = oldTx.reduce((sum, t) => sum + Number(t.amount), 0) / oldTx.length;
  
  const change = recentAvg - oldAvg;
  const percent = (change / oldAvg) * 100;
  
  // התריע רק על שינוי משמעותי (>10%)
  if (Math.abs(percent) > 10) {
    return { change, percent };
  }
  
  return null;
}

/**
 * זיהוי יעדים עצומים (ללא התקדמות)
 */
async function detectStagnantGoals(userId: string, goals: Goal[]): Promise<Goal[]> {
  const supabase = createServiceClient();
  const stagnant: Goal[] = [];
  
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  for (const goal of goals) {
    // בדוק אם יש עדכון ב-current_amount ב-3 חודשים אחרונים
    // (נניח שאם ההקצאה לא השתנתה, אז לא היתה התקדמות)
    
    const { data: history } = await supabase
      .from('goal_allocations_history')
      .select('*')
      .eq('goal_id', goal.id)
      .gte('calculation_date', threeMonthsAgo.toISOString())
      .order('calculation_date', { ascending: false })
      .limit(1);
    
    if (!history || history.length === 0) {
      // אין היסטוריה - יעד חדש או עצום
      const createdDate = new Date(goal.created_at);
      if (createdDate < threeMonthsAgo) {
        stagnant.push(goal);
      }
    }
  }
  
  return stagnant;
}

/**
 * ריאיזון אוטומטי
 */
async function rebalanceAutomatically(userId: string, incomeChange: number): Promise<void> {
  const supabase = createServiceClient();
  
  // חשב הקצאות חדשות
  const result = await calculateOptimalAllocations({ userId });
  
  // עדכן יעדים
  for (const allocation of result.allocations) {
    await supabase
      .from('goals')
      .update({
        monthly_allocation: allocation.monthly_allocation,
        metadata: {
          last_auto_rebalance: new Date().toISOString(),
          reason: 'income_change',
          change_amount: incomeChange,
        },
      })
      .eq('id', allocation.goal_id);
  }
  
  // שמור בהיסטוריה
  const { saveAllocationHistory } = await import('./goals-balancer');
  await saveAllocationHistory(userId, result.allocations, 'auto_rebalance');
}

/**
 * שליחת התראות למשתמש
 */
async function sendAlertsToUser(userId: string, alerts: Alert[]): Promise<void> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();
  
  // שלוף מספר טלפון
  const { data: user } = await supabase
    .from('users')
    .select('phone')
    .eq('id', userId)
    .single();
  
  if (!user?.phone) return;
  
  // שלח רק התראות בעדיפות גבוהה ובינונית
  const importantAlerts = alerts.filter(a => a.priority === 'high' || a.priority === 'medium');
  
  if (importantAlerts.length === 0) return;
  
  let message = `🎯 *עדכון יעדים*\n\n`;
  
  for (const alert of importantAlerts.slice(0, 3)) { // מקסימום 3 התראות
    message += `${alert.message}\n\n`;
  }
  
  if (importantAlerts.length > 3) {
    message += `...ועוד ${importantAlerts.length - 3} עדכונים\n\n`;
  }
  
  message += `כתוב *"יעדים"* לפרטים מלאים`;
  
  try {
    await greenAPI.sendMessage({
      phoneNumber: user.phone,
      message,
    });
  } catch (error) {
    console.error('Failed to send alert to user:', error);
  }
}

/**
 * פונקציה לבדיקה ידנית (למטרות בדיקה)
 */
export async function testMonitoring(userId: string): Promise<void> {
  console.log('Testing monitoring for user:', userId);
  const result = await monitorUserGoals(userId);
  console.log('Monitoring result:', JSON.stringify(result, null, 2));
  
  if (result.alerts.length > 0) {
    await sendAlertsToUser(userId, result.alerts);
  }
}

