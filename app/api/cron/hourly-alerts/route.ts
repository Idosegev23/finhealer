// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { isQuietTime } from '@/lib/utils/quiet-hours';

/**
 * Cron: התראות שעתיות
 * 
 * מה זה עושה:
 * 1. בודק חריגות תקציב (warning/exceeded)
 * 2. שולח התראות למשתמשים שחרגו
 */

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quietCheck = isQuietTime();
    if (quietCheck.isQuiet) {
      console.log(`[Cron] Skipped — ${quietCheck.description}`);
      return NextResponse.json({ skipped: true, reason: quietCheck.description });
    }

    const supabase = await createClient();
    const greenAPI = getGreenAPIClient();

    const currentMonth = new Date().toISOString().substring(0, 7);

    // Recalculate all budget spending before checking thresholds
    const { syncAllBudgets } = await import('@/lib/services/BudgetSyncService');
    await syncAllBudgets();

    // מצא משתמשים עם תקציב פעיל
    const { data: budgets } = await supabase
      .from('budgets')
      .select(`
        id,
        user_id,
        total_budget,
        total_spent,
        status,
        users!inner(name, phone, wa_opt_in)
      `)
      .eq('month', currentMonth)
      .eq('status', 'active');

    const results = [];

    for (const budget of budgets || []) {
      try {
        const user = (budget as any).users;
        if (!user?.phone || !user?.wa_opt_in) continue;

        const remaining = budget.total_budget - budget.total_spent;
        const percentUsed = (budget.total_spent / budget.total_budget) * 100;

        let shouldAlert = false;
        let message = '';

        // חריגה
        if (percentUsed >= 100) {
          shouldAlert = true;
          message = `⚠️ ${user.name || 'היי'}!\n\nחרגת מהתקציב החודשי! 🚨\n\n💸 תקציב: ₪${budget.total_budget.toLocaleString()}\n💰 הוצאת: ₪${budget.total_spent.toLocaleString()}\n📊 חריגה: ₪${Math.abs(remaining).toLocaleString()}\n\nבוא ננסה להיזהר בימים הבאים 💪`;
        }
        // אזהרה (90-99%)
        else if (percentUsed >= 90 && percentUsed < 100) {
          // בדוק אם כבר שלחנו אזהרה בשעה האחרונה
          const { data: recentAlerts } = await supabase
            .from('alerts')
            .select('id')
            .eq('user_id', budget.user_id)
            .eq('type', 'budget_warning')
            .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!recentAlerts || recentAlerts.length === 0) {
            shouldAlert = true;
            message = `⚠️ ${user.name || 'היי'}!\n\nאזהרת תקציב! 📊\n\n💸 הוצאת ${percentUsed.toFixed(0)}% מהתקציב\n💰 נותר: ₪${remaining.toLocaleString()}\n\nשים לב להוצאות בימים הבאים 👀`;
          }
        }

        if (shouldAlert) {
          await greenAPI.sendMessage({
            phoneNumber: user.phone,
            message,
          });

              await (supabase as any).from('alerts').insert({
            user_id: budget.user_id,
            type: percentUsed >= 100 ? 'budget_exceeded' : 'budget_warning',
            message,
            status: 'sent',
            params: {
              budget_id: budget.id,
              percent_used: percentUsed,
              remaining,
            },
          });

          // עדכן סטטוס התקציב
          await supabase
            .from('budgets')
            .update({ status: percentUsed >= 100 ? 'exceeded' : 'warning' })
            .eq('id', budget.id);

          results.push({ user_id: budget.user_id, alerted: true, type: percentUsed >= 100 ? 'exceeded' : 'warning' });
        } else {
          results.push({ user_id: budget.user_id, alerted: false, reason: 'no threshold reached' });
        }

        // --- Per-category alerts (80%+) ---
        const { data: budgetCats } = await supabase
          .from('budget_categories')
          .select('category_name, allocated_amount, spent_amount, status')
          .eq('budget_id', budget.id);

        for (const cat of budgetCats || []) {
          if (!cat.allocated_amount || cat.allocated_amount <= 0) continue;
          const catPercent = ((cat.spent_amount || 0) / cat.allocated_amount) * 100;
          if (catPercent < 80) continue;
          if (cat.status === 'warning' || cat.status === 'exceeded') continue;

          // Dedup: check last 24h
          const { data: recentCatAlert } = await supabase
            .from('alerts')
            .select('id')
            .eq('user_id', budget.user_id)
            .eq('type', 'category_warning')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (recentCatAlert && recentCatAlert.length > 0) continue;

          const isExceeded = catPercent >= 100;
          const catMsg = isExceeded
            ? `🚨 ${user.name || 'היי'}, חרגת בקטגוריה *${cat.category_name}*!\n\n💸 תקציב: ₪${cat.allocated_amount.toLocaleString()}\n💰 הוצאת: ₪${(cat.spent_amount || 0).toLocaleString()}\n📊 חריגה: ₪${((cat.spent_amount || 0) - cat.allocated_amount).toLocaleString()}`
            : `⚠️ ${user.name || 'היי'}, ${Math.round(catPercent)}% בקטגוריה *${cat.category_name}*\n\n💸 תקציב: ₪${cat.allocated_amount.toLocaleString()}\n💰 הוצאת: ₪${(cat.spent_amount || 0).toLocaleString()}\n📊 נותר: ₪${(cat.allocated_amount - (cat.spent_amount || 0)).toLocaleString()}`;

          await greenAPI.sendMessage({ phoneNumber: user.phone, message: catMsg });

          await (supabase as any).from('alerts').insert({
            user_id: budget.user_id,
            type: 'category_warning',
            message: catMsg,
            status: 'sent',
            params: { budget_id: budget.id, category: cat.category_name, percent: catPercent },
          });

          await supabase
            .from('budget_categories')
            .update({ status: isExceeded ? 'exceeded' : 'warning' })
            .eq('budget_id', budget.id)
            .eq('category_name', cat.category_name);

          results.push({ user_id: budget.user_id, category: cat.category_name, alerted: true });
        }
      } catch (userError) {
        console.error(`Error processing budget ${budget.id}:`, userError);
        results.push({ budget_id: budget.id, success: false, error: String(userError) });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      alerted: results.filter((r) => r.alerted).length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Hourly alerts cron error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}

