import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { validateFullIncome, quickValidate } from '@/lib/utils/income-validator';

/**
 * API Route: /api/income
 * יצירת מקור הכנסה חדש
 * 
 * POST body:
 * {
 *   source_name: string (required);
 *   employment_type: string (required);
 *   gross_amount?: number;
 *   net_amount?: number;
 *   actual_bank_amount?: number;
 *   employer_name?: string;
 *   pension_contribution?: number;
 *   advanced_study_fund?: number;
 *   other_deductions?: number;
 *   payment_frequency?: 'monthly' | 'weekly' | 'one_time' | 'variable';
 *   is_primary?: boolean;
 *   notes?: string;
 *   is_variable?: boolean;
 *   min_amount?: number;
 *   max_amount?: number;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // ולידציה בסיסית
    if (!body.source_name || !body.employment_type) {
      return NextResponse.json(
        { error: 'חסרים שדות חובה: source_name, employment_type' },
        { status: 400 }
      );
    }

    // ולידציה מתקדמת
    const validation = validateFullIncome({
      source_name: body.source_name,
      employment_type: body.employment_type,
      gross_amount: body.gross_amount,
      net_amount: body.net_amount,
      actual_bank_amount: body.actual_bank_amount,
      pension_contribution: body.pension_contribution,
      advanced_study_fund: body.advanced_study_fund,
      other_deductions: body.other_deductions,
      employer_name: body.employer_name,
      payment_frequency: body.payment_frequency,
      is_variable: body.is_variable,
      min_amount: body.min_amount,
      max_amount: body.max_amount,
    });

    // אם יש שגיאות קריטיות - לא ליצור
    if (!validation.valid) {
      const criticalErrors = validation.messages.filter(m => m.level === 'error');
      if (criticalErrors.length > 0) {
        return NextResponse.json(
          {
            error: 'נתונים לא תקינים',
            validation: validation.messages,
          },
          { status: 400 }
        );
      }
    }

    // הכנת נתונים להכנסה
    const incomeData: any = {
      user_id: user.id,
      source_name: body.source_name.trim(),
      employment_type: body.employment_type,
      gross_amount: body.gross_amount ?? 0,
      net_amount: body.net_amount ?? 0,
      actual_bank_amount: body.actual_bank_amount ?? 0,
      employer_name: body.employer_name?.trim() || null,
      pension_contribution: body.pension_contribution ?? 0,
      advanced_study_fund: body.advanced_study_fund ?? 0,
      other_deductions: body.other_deductions ?? 0,
      payment_frequency: body.payment_frequency || 'monthly',
      is_primary: body.is_primary ?? false,
      active: true,
      notes: body.notes?.trim() || null,
      is_variable: body.is_variable ?? false,
      min_amount: body.min_amount ?? null,
      max_amount: body.max_amount ?? null,
    };

    // יצירה
    const { data, error } = await (supabase as any)
      .from('income_sources')
      .insert([incomeData])
      .select()
      .single();

    if (error) {
      console.error('[/api/income] Insert Error:', error);
      
      // טיפול בשגיאות ספציפיות
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'מקור הכנסה בשם זה כבר קיים' },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      income: data,
      validation: validation.messages.filter(m => m.level === 'warning' || m.level === 'info'),
    }, { status: 201 });

  } catch (error) {
    console.error('[/api/income] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה ביצירת מקור הכנסה' },
      { status: 500 }
    );
  }
}

/**
 * GET: שליפת כל מקורות ההכנסה (קיצור ל-/api/income/list)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await (supabase as any)
      .from('income_sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      incomeSources: data || [],
      count: (data || []).length,
    });

  } catch (error) {
    console.error('[/api/income] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשליפת מקורות הכנסה' },
      { status: 500 }
    );
  }
}
