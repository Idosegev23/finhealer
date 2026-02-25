/**
 * Cash Flow Alerts - התראות תזרים שלילי
 * שולח הודעות WhatsApp למשתמשים עם תחזית שלילית
 */

import { createServiceClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/greenapi/client';
import { projectCashFlow, type CashFlowAnalysis } from './cash-flow-projector';

interface CashFlowAlert {
  user_id: string;
  phone: string;
  analysis: CashFlowAnalysis;
  severity: 'critical' | 'warning' | 'caution';
}

/**
 * בדיקת תזרים שלילי לכל המשתמשים ושליחת התראות
 */
export async function checkNegativeCashFlow(): Promise<void> {
  const supabase = createServiceClient();
  
  console.log('[Cash Flow Alerts] Starting daily check...');
  
  try {
    // שלוף משתמשים פעילים
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, phone, name, full_name')
      .in('phase', ['monitoring', 'behavior', 'goals', 'budget'])
      .not('phone', 'is', null);
    
    if (usersError || !users) {
      console.error('[Cash Flow Alerts] Failed to fetch users:', usersError);
      return;
    }
    
    console.log(`[Cash Flow Alerts] Checking ${users.length} users`);
    
    const alerts: CashFlowAlert[] = [];
    
    // עבור על כל משתמש
    for (const user of users) {
      try {
        // תחזית ל-3 חודשים קדימה
        const analysis = await projectCashFlow(user.id, 3);
        
        // בדוק אם יש חודשים שליליים
        if (analysis.negative_months.length > 0) {
          const severity = determineSeverity(analysis);
          
          alerts.push({
            user_id: user.id,
            phone: user.phone!,
            analysis,
            severity,
          });
          
          console.log(
            `[Cash Flow Alerts] Alert for user ${user.id}: ` +
            `${analysis.negative_months.length} negative months, severity: ${severity}`
          );
        }
        
      } catch (error) {
        console.error(`[Cash Flow Alerts] Error checking user ${user.id}:`, error);
      }
    }
    
    console.log(`[Cash Flow Alerts] Found ${alerts.length} alerts to send`);
    
    // שלח התראות
    for (const alert of alerts) {
      await sendCashFlowAlert(alert);
    }
    
    console.log('[Cash Flow Alerts] Completed');
    
  } catch (error) {
    console.error('[Cash Flow Alerts] Error:', error);
  }
}

/**
 * קביעת רמת חומרה
 */
function determineSeverity(analysis: CashFlowAnalysis): 'critical' | 'warning' | 'caution' {
  const firstNegativeMonth = analysis.negative_months[0];
  const negativeMonthsCount = analysis.negative_months.length;
  const lowestBalance = analysis.summary.lowest_balance_amount;
  
  // קריטי: יתרה שלילית החודש או גירעון גדול מאוד
  if (firstNegativeMonth === 0 || lowestBalance < -10000) {
    return 'critical';
  }
  
  // אזהרה: יתרה שלילית בחודש הבא או 2+ חודשים שליליים
  if (firstNegativeMonth === 1 || negativeMonthsCount >= 2) {
    return 'warning';
  }
  
  // זהירות: יתרה שלילית בחודש השלישי או חודש יחיד
  return 'caution';
}

/**
 * שליחת התראת תזרים
 */
async function sendCashFlowAlert(alert: CashFlowAlert): Promise<void> {
  const { phone, analysis, severity } = alert;
  
  const message = buildAlertMessage(analysis, severity);
  
  try {
    const sent = await sendWhatsAppMessage(phone, message);
    
    if (!sent) {
      console.error(`[Cash Flow Alerts] Failed to send alert to ${phone}`);
      return;
    }
    
    console.log(`[Cash Flow Alerts] Alert sent to ${phone} (${severity})`);
    
    // שמור לוג של ההתראה
    const supabase = createServiceClient();
    await supabase
      .from('notifications')
      .insert({
        user_id: alert.user_id,
        type: 'cash_flow_alert',
        title: 'התראת תזרים שלילי',
        message,
        severity,
        sent_at: new Date().toISOString(),
      });
    
  } catch (error) {
    console.error(`[Cash Flow Alerts] Error sending alert to ${phone}:`, error);
  }
}

/**
 * בניית הודעת התראה
 */
function buildAlertMessage(
  analysis: CashFlowAnalysis,
  severity: 'critical' | 'warning' | 'caution'
): string {
  const { projections, negative_months, recommendations } = analysis;
  
  const firstNegativeIndex = negative_months[0];
  const firstNegativeProjection = projections[firstNegativeIndex];
  
  const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : '⚡';
  const title = severity === 'critical' ? 'התראת תזרים קריטית!' : 
                severity === 'warning' ? 'התראת תזרים!' : 
                'שים לב לתזרים';
  
  let message = `${emoji} *${title}*\n\n`;
  
  // פרטי החודש הבעייתי
  message += `התחזית מראה יתרה שלילית ב*${firstNegativeProjection.month_name}*:\n\n`;
  message += `💰 הכנסות צפויות: ${firstNegativeProjection.projected_income.toLocaleString('he-IL')} ₪\n`;
  message += `💸 הוצאות צפויות: ${firstNegativeProjection.projected_expenses.toLocaleString('he-IL')} ₪\n`;
  message += `📉 יתרה צפויה: *${firstNegativeProjection.projected_balance.toLocaleString('he-IL')} ₪*\n`;
  message += `📊 גירעון: ${Math.abs(firstNegativeProjection.net_cash_flow).toLocaleString('he-IL')} ₪\n\n`;
  
  // אם יש יותר מחודש אחד שלילי
  if (negative_months.length > 1) {
    message += `⚠️ סה״כ *${negative_months.length} חודשים* עם יתרה שלילית!\n\n`;
  }
  
  // המלצות φ
  if (recommendations.length > 0) {
    message += `💡 *המלצות φ:*\n`;
    
    const topRecommendations = recommendations
      .filter(r => r.priority === 'high')
      .slice(0, 3);
    
    for (const rec of topRecommendations) {
      const impact = rec.impact_amount > 0 
        ? ` (חיסכון: ${rec.impact_amount.toLocaleString('he-IL')} ₪)`
        : '';
      message += `• ${rec.recommendation_text}${impact}\n`;
    }
    
    message += `\n`;
  }
  
  // CTA
  if (severity === 'critical') {
    message += `🔴 *דחוף!* עדכן את התקציב או הגדל הכנסה.\n`;
    message += `💼 רוצה שגדי יבדוק את המצב? כתוב *"ייעוץ"*\n`;
  } else if (severity === 'warning') {
    message += `⚠️ *פעל עכשיו* למניעת גירעון.\n`;
    message += `💼 רוצה עזרה מקצועית? כתוב *"ייעוץ"*\n`;
  } else {
    message += `💪 *תכנן מראש* כדי למנוע בעיות.\n`;
  }

  message += `\nכתוב *"תזרים"* לתחזית מלאה 📊`;
  
  return message;
}

/**
 * בדיקת תזרים למשתמש בודד (לשימוש ידני)
 */
export async function checkUserCashFlow(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  
  // שלוף פרטי משתמש
  const { data: user, error } = await supabase
    .from('users')
    .select('phone, name, full_name')
    .eq('id', userId)
    .single();
  
  if (error || !user || !user.phone) {
    console.error('[Cash Flow Alerts] User not found or no phone:', error);
    return false;
  }
  
  try {
    // תחזית
    const analysis = await projectCashFlow(userId, 3);
    
    // בדוק אם יש חודשים שליליים
    if (analysis.negative_months.length === 0) {
      console.log('[Cash Flow Alerts] No negative months for user');
      return false;
    }
    
    // שלח התראה
    const severity = determineSeverity(analysis);
    await sendCashFlowAlert({
      user_id: userId,
      phone: user.phone,
      analysis,
      severity,
    });
    
    return true;
    
  } catch (error) {
    console.error('[Cash Flow Alerts] Error:', error);
    return false;
  }
}
