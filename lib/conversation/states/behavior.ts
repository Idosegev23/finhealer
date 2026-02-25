// @ts-nocheck
import type { RouterContext, RouterResult } from '../shared';
import { isCommand } from '../shared';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient, sendWhatsAppInteractiveButtons } from '@/lib/greenapi/client';

export async function handleBehaviorPhase(ctx: RouterContext, msg: string): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();

  if (isCommand(msg, ['נתח', 'ניתוח', 'analyze', 'התחל', 'start', '🔍 ניתוח התנהגות', 'ניתוח התנהגות 🔍', 'add_more', 'add_docs'])) {
    if (msg === 'add_more' || msg === 'add_docs') {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `📄 מעולה! שלח לי עוד מסמך.`,
      });
      return { success: true };
    }
    return await startBehaviorAnalysis(ctx);
  }

  if (isCommand(msg, ['סיכום', 'תובנות', 'insights', 'summary'])) {
    return await showBehaviorSummary(ctx);
  }

  if (isCommand(msg, ['המשך', 'נמשיך', 'הבא', 'next', 'יעדים', 'goals', '▶️ המשך ליעדים', 'המשך ליעדים ▶️', 'to_goals'])) {
    return await transitionToGoals(ctx);
  }

  if (isCommand(msg, ['עזרה', 'help', '?'])) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📊 *שלב 2: ניתוח התנהגות*\n\n` +
        `*פקודות:*\n` +
        `• *"ניתוח"* - הרץ ניתוח מלא\n` +
        `• *"סיכום"* - הצג תובנות\n` +
        `• *"המשך"* - עבור לשלב היעדים\n\n` +
        `φ מזהה דפוסים בהוצאות שלך`,
    });
    return { success: true };
  }

  // Default - run analysis
  return await startBehaviorAnalysis(ctx);
}

export async function startBehaviorAnalysis(ctx: RouterContext): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🔍 מנתח את ההתנהגות הפיננסית שלך...\n\nזה יכול לקחת כמה שניות.`,
  });

  try {
    const { runFullAnalysis } = await import('@/lib/analysis/behavior-analyzer');
    const analysis = await runFullAnalysis(ctx.userId, 3);
    return await sendBehaviorSummary(ctx, analysis);
  } catch (error) {
    console.error('[Behavior] Analysis failed:', error);
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ משהו השתבש בניתוח.\n\nנסה שוב או כתוב "עזרה".`,
    });
    return { success: false };
  }
}

export async function showBehaviorSummary(ctx: RouterContext): Promise<RouterResult> {
  try {
    const { runFullAnalysis } = await import('@/lib/analysis/behavior-analyzer');
    const analysis = await runFullAnalysis(ctx.userId, 3);
    return await sendBehaviorSummary(ctx, analysis);
  } catch (error) {
    const greenAPI = getGreenAPIClient();
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `❌ לא הצלחתי לטעון את הניתוח.\n\nכתוב "ניתוח" להפעיל מחדש.`,
    });
    return { success: false };
  }
}

export async function sendBehaviorSummary(ctx: RouterContext, analysis: any): Promise<RouterResult> {
  const greenAPI = getGreenAPIClient();

  if (analysis.transactionCount === 0) {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `📊 אין עדיין מספיק נתונים לניתוח.\n\nשלח דוחות בנק/אשראי כדי שאוכל לנתח.`,
    });
    return { success: true };
  }

  // Send analysis summary
  let msg = `📊 *ניתוח התנהגות פיננסית*\n\n`;
  msg += `📅 תקופה: ${analysis.months || 3} חודשים\n`;
  msg += `📝 ${analysis.transactionCount} תנועות\n\n`;

  if (analysis.insights && analysis.insights.length > 0) {
    msg += `*💡 תובנות:*\n`;
    analysis.insights.slice(0, 5).forEach((insight: string) => {
      msg += `• ${insight}\n`;
    });
  }

  if (analysis.topCategories && analysis.topCategories.length > 0) {
    msg += `\n*🏷️ הוצאות עיקריות:*\n`;
    analysis.topCategories.slice(0, 5).forEach((cat: any) => {
      msg += `• ${cat.category}: ₪${cat.total?.toLocaleString('he-IL') || '0'}\n`;
    });
  }

  await greenAPI.sendMessage({ phoneNumber: ctx.phone, message: msg });

  // Offer next step
  try {
    await sendWhatsAppInteractiveButtons(ctx.phone, {
      message: 'מה עכשיו?',
      buttons: [
        { buttonId: 'to_goals', buttonText: 'המשך ליעדים' },
        { buttonId: 'add_more', buttonText: 'עוד מסמכים' },
      ],
    });
  } catch {
    await greenAPI.sendMessage({
      phoneNumber: ctx.phone,
      message: `*מה עכשיו?*\nכתוב *"המשך"* ליעדים\nאו שלח עוד מסמכים`,
    });
  }

  return { success: true };
}

export async function transitionToGoals(ctx: RouterContext): Promise<RouterResult> {
  const supabase = createServiceClient();
  const greenAPI = getGreenAPIClient();

  await supabase
    .from('users')
    .update({
      onboarding_state: 'goals',
      phase: 'goals',
      phase_updated_at: new Date().toISOString()
    })
    .eq('id', ctx.userId);

  await greenAPI.sendMessage({
    phoneNumber: ctx.phone,
    message: `🎯 *שלב 3: φ Goals Balancer*\n\n` +
      `עכשיו נגדיר את היעדים הפיננסיים שלך!\n\n` +
      `💡 *המערכת תעשה בשבילך:*\n` +
      `• 📊 תחשב הקצאה אוטומטית לכל יעד\n` +
      `• ⚖️ תשקלל לפי עדיפות ודחיפות\n` +
      `• 🛡️ תוודא שנשאר לך לחיות (\"אוכל בצלחת\")\n` +
      `• 🔄 תתאים אוטומטית לשינויי הכנסה\n\n` +
      `*מה חשוב לך?*\n` +
      `1️⃣ חיסכון לקרן חירום\n` +
      `2️⃣ סגירת חובות\n` +
      `3️⃣ חיסכון למטרה ספציפית\n` +
      `4️⃣ שיפור מצב פיננסי כללי\n\n` +
      `כתוב מספר או תאר את היעד שלך.`,
  });

  // Show advanced tools if user already has goals
  const { count: existingGoals } = await supabase
    .from('goals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId);

  if (existingGoals && existingGoals > 0) {
    try {
      await greenAPI.sendInteractiveButtons({
        phoneNumber: ctx.phone,
        message: `✨ *כלים מתקדמים זמינים:*\n\n` +
          `• *יעדים* - הצג יעדים + הקצאות מחושבות\n` +
          `• *סימולציה* - בדוק \"מה יקרה אם...\"\n` +
          `• *אופטימיזציה* - קבל המלצות φ חכמות`,
        buttons: [
          { buttonId: 'show_goals', buttonText: 'יעדים' },
          { buttonId: 'simulate', buttonText: 'סימולציה' },
          { buttonId: 'optimize', buttonText: 'אופטימיזציה' },
        ],
      });
    } catch {
      await greenAPI.sendMessage({
        phoneNumber: ctx.phone,
        message: `✨ *כלים מתקדמים:*\n` +
          `• כתוב *"יעדים"* לראות הקצאות\n` +
          `• כתוב *"סימולציה"* לבדוק תרחישים\n` +
          `• כתוב *"אופטימיזציה"* להמלצות`,
      });
    }
  }

  return { success: true, newState: 'goals' as any };
}
