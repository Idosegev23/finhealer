import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter';

/**
 * API Route: POST /api/expenses/approve
 * מטרה: אישור הוצאות (תומך בהוצאה בודדת או מערך)
 */
export async function POST(request: NextRequest) {
  const limited = checkApiRateLimit(request, 30, 60_000);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // תמיכה גם ב-expenseId בודד וגם במערך expenseIds
    const expenseIds = body.expenseIds || (body.expenseId ? [body.expenseId] : []);

    if (!expenseIds || expenseIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing expenseId or expenseIds' },
        { status: 400 }
      );
    }

    // ✅ Validation: בדיקה שלכל התנועות יש קטגוריה (בעיקר להוצאות)
    const { data: transactions, error: fetchError } = await (supabase as any)
      .from('transactions')
      .select('id, type, expense_category, expense_category_id')
      .in('id', expenseIds)
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // בדוק שכל ההוצאות מסווגות
    // 🚨 חשוב: "לא מסווג" נחשב כלא מסווג!
    const uncategorizedExpenses = transactions?.filter(
      (tx: any) => tx.type === 'expense' && (!tx.expense_category || tx.expense_category === 'לא מסווג')
    ) || [];

    if (uncategorizedExpenses.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot approve uncategorized expenses',
          message: 'לא ניתן לאשר הוצאות שלא מסווגות. יש לבחור קטגוריה לפני אישור.',
          uncategorizedIds: uncategorizedExpenses.map((tx: any) => tx.id)
        },
        { status: 400 }
      );
    }

    // עדכון סטטוס להוצאות מאושרות
    const { data: expenses, error } = await (supabase as any)
      .from('transactions')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .in('id', expenseIds)
      .eq('user_id', user.id) // וידוא שזה של המשתמש הנוכחי
      .select();

    if (error) {
      console.error('Error approving expenses:', error);
      return NextResponse.json(
        { error: 'Failed to approve expenses' },
        { status: 500 }
      );
    }

    // ── Sync onboarding_state: if no more pending → advance state ──
    try {
      const { count: remainingPending } = await (supabase as any)
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (!remainingPending || remainingPending === 0) {
        const { data: userData } = await (supabase as any)
          .from('users')
          .select('onboarding_state, phase')
          .eq('id', user.id)
          .single();

        const classificationStates = ['classification', 'classification_income', 'classification_expense'];
        if (userData && classificationStates.includes(userData.onboarding_state)) {
          // All classified — calculate next phase and advance
          const { calculatePhase } = await import('@/lib/services/PhaseService');
          const nextPhase = await calculatePhase(user.id);

          const phaseToState: Record<string, string> = {
            data_collection: 'waiting_for_document',
            behavior: 'behavior',
            budget: 'budget',
            goals: 'goals_setup',
            monitoring: 'monitoring',
          };
          const nextState = phaseToState[nextPhase] || 'behavior';

          await (supabase as any)
            .from('users')
            .update({
              onboarding_state: nextState,
              phase: nextPhase,
              phase_updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          console.log(`[Approve] State synced: ${userData.onboarding_state} → ${nextState} (phase: ${nextPhase})`);
        }
      }
    } catch (syncErr) {
      console.warn('[Approve] State sync failed (non-fatal):', syncErr);
    }

    return NextResponse.json({
      success: true,
      expenses,
      count: expenses?.length || 0,
      message: `${expenses?.length || 0} expenses approved successfully`,
    });
  } catch (error: any) {
    console.error('Approve expense error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}

