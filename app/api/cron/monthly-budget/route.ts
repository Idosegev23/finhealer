// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';

/**
 * Cron: תקציב חודשי אוטומטי (1st of month 00:00)
 * 
 * מה זה עושה:
 * 1. מוצא משתמשים עם לפחות 3 חודשי נתונים
 * 2. יוצר תקציב אוטומטי לחודש הבא
 * 3. שולח הודעה ב-WhatsApp
 */

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const greenAPI = getGreenAPIClient();

    // חודש הבא
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().substring(0, 7); // YYYY-MM

    // מצא משתמשים שצריכים תקציב חודשי
    const { data: users } = await supabase
      .from('users')
      .select('id, name, phone, created_at')
      .in('subscription_status', ['active', 'trial']);

    const results = [];

    for (const user of users || []) {
      try {
        // בדוק אם יש כבר תקציב לחודש הבא
        const { data: existingBudget } = await supabase
          .from('budgets')
          .select('id')
          .eq('user_id', user.id)
          .eq('month', nextMonthStr)
          .single();

        if (existingBudget) {
          results.push({ user_id: user.id, skipped: true, reason: 'budget exists' });
          continue;
        }

        // בדוק אם יש לפחות 3 חודשי נתונים
        const userCreatedAt = new Date(user.created_at);
        const monthsSinceCreation = Math.floor(
          (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        if (monthsSinceCreation < 3) {
          results.push({ user_id: user.id, skipped: true, reason: 'not enough data' });
          continue;
        }

        // קרא ל-API ליצירת תקציב
        const createResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL}/api/budget/create-smart`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({
              userId: user.id,
              month: nextMonthStr,
            }),
          }
        );

        if (!createResponse.ok) {
          throw new Error('Failed to create budget');
        }

        const budgetData = await createResponse.json();

        // שלח הודעה ב-WhatsApp
        if (user.phone && user.wa_opt_in) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app';
          const message = `🎯 ${user.name || 'היי'}!\n\nהתקציב שלך לחודש הבא מוכן! 🎉\n\n💰 תקציב כולל: ₪${budgetData.budget.total_budget.toLocaleString()}\n\n📊 התקציב נבנה על בסיס ההתנהלות שלך ב-3 החודשים האחרונים.\n\nהכנס לדשבורד לראות את הפירוט המלא! 💪\n\n${siteUrl}/dashboard/budget`;

          await greenAPI.sendMessage({
            phoneNumber: user.phone,
            message,
          });
        }

        results.push({ user_id: user.id, success: true, budget_id: budgetData.budget.id });
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        results.push({ user_id: user.id, success: false, error: String(userError) });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      created: results.filter((r) => r.success).length,
      skipped: results.filter((r) => r.skipped).length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Monthly budget cron error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}

